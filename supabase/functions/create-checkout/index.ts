// Supabase Edge Function: create Stripe Checkout Session for a listing
// Set env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_CONNECT_PLATFORM_FEE_PERCENT

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// 5% of all purchases go to the platform; override with STRIPE_CONNECT_PLATFORM_FEE_PERCENT env
const platformFeePercent = Number(Deno.env.get('STRIPE_CONNECT_PLATFORM_FEE_PERCENT') ?? 5)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { listingId } = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, price, seller_id')
      .eq('id', listingId)
      .eq('is_published', true)
      .single()
    if (listingError || !listing || listing.price <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid listing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', listing.seller_id)
      .single()
    const connectAccountId = profile?.stripe_connect_account_id
    if (!connectAccountId) {
      return new Response(JSON.stringify({ error: 'Seller has not connected Stripe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const applicationFeeAmount = Math.round((listing.price * platformFeePercent) / 100)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: connectAccountId },
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: listing.price,
            product_data: { name: listing.title },
          },
          quantity: 1,
        },
      ],
      success_url: `${new URL(req.url).origin}/purchases?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(req.url).origin}/listing/${listingId}`,
      client_reference_id: `${user.id}:${listingId}`,
    })
    return new Response(
      JSON.stringify({ url: session.url ?? session.id ? `https://checkout.stripe.com/c/pay/${session.id}` : null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
