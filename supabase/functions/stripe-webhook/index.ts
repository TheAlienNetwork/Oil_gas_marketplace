// Supabase Edge Function: Stripe webhook (payment_intent.succeeded, etc.)
// Set env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!sig || !webhookSecret) {
    return new Response('Webhook secret missing', { status: 500 })
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e}`, { status: 400 })
  }
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    if (account.details_submitted) {
      await supabase
        .from('profiles')
        .update({
          stripe_onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_connect_account_id', account.id)
    }
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const ref = session.client_reference_id as string | null
    if (!ref?.includes(':')) return new Response('OK', { status: 200 })
    const [buyerId, listingId] = ref.split(':')
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    const { data: listing } = await supabase
      .from('listings')
      .select('id, file_storage_path, app_bundle_path')
      .eq('id', listingId)
      .single()
    if (!listing) return new Response('OK', { status: 200 })
    const amount = session.amount_total ?? 0
    const fee = session.application_fee_amount ?? 0
    const { data: purchase } = await supabase
      .from('purchases')
      .insert({
        buyer_id: buyerId,
        listing_id: listingId,
        stripe_payment_intent_id: paymentIntentId,
        amount_paid_cents: amount,
        platform_fee_cents: fee,
        seller_payout_cents: amount - fee,
        status: 'completed',
      })
      .select('id')
      .single()
    if (purchase) {
      await supabase.from('purchase_grants').insert({
        purchase_id: purchase.id,
        listing_id: listingId,
        user_id: buyerId,
        download_path: listing.file_storage_path,
        app_access_path: listing.app_bundle_path,
      })
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
