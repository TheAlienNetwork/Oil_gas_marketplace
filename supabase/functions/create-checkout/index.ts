// Supabase Edge Function: create Stripe Checkout Session for one or more listings (same seller)
// Default: ui_mode embedded + clientSecret for in-app Checkout. Pass embedded: false for hosted redirect URL.
// Set env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// STRIPE_CONNECT_PLATFORM_FEE_PERCENT (0–100, default 10), FRONTEND_URL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecretApiKey, getSupabaseUrl } from '../_shared/secrets.ts'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// Platform fee on every paid Connect checkout (percent of total, same currency as line items).
// Override with STRIPE_CONNECT_PLATFORM_FEE_PERCENT (whole number 0–100; default 10).
function readPlatformFeePercent(): number {
  const raw = Deno.env.get('STRIPE_CONNECT_PLATFORM_FEE_PERCENT')?.trim()
  const n = raw ? Number(raw) : 10
  if (!Number.isFinite(n) || n < 0) return 10
  if (n > 100) return 100
  return n
}
const platformFeePercent = readPlatformFeePercent()

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function normalizeListingIds(body: Record<string, unknown>): string[] {
  const single = body.listingId
  const many = body.listingIds
  let ids: string[] = []
  if (Array.isArray(many)) {
    ids = many
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  if (ids.length === 0 && typeof single === 'string' && single.trim()) {
    ids = [single.trim()]
  }
  return [...new Set(ids)]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  try {
    if (!stripeSecretKey) {
      return json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.' },
        503
      )
    }

    const sbUrl = getSupabaseUrl()
    const sbKey = getSecretApiKey()
    if (!sbUrl || !sbKey) {
      return json(
        {
          error:
            'Server misconfigured: missing Supabase URL or secret API key. Set SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets.',
        },
        503
      )
    }
    const supabase = createClient(sbUrl, sbKey)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const useEmbedded = body.embedded !== false && body.embedded !== 'false'
    const ids = normalizeListingIds(body)
    if (ids.length === 0) {
      return json({ error: 'Provide listingId or listingIds' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: rows, error: listingError } = await supabase
      .from('listings')
      .select('id, title, price, seller_id')
      .in('id', ids)
      .eq('is_published', true)

    if (listingError || !rows || rows.length !== ids.length) {
      return json({ error: 'Invalid listing' }, 400)
    }

    for (const row of rows) {
      if (row.price <= 0) {
        return json({ error: 'Invalid listing' }, 400)
      }
    }

    const sellerIds = new Set(rows.map((r) => r.seller_id))
    if (sellerIds.size !== 1) {
      return json({ error: 'Checkout must be for one seller at a time' }, 400)
    }

    const sellerId = rows[0].seller_id
    if (user.id === sellerId) {
      return json({ error: 'Cannot purchase your own listing' }, 400)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', sellerId)
      .single()

    const connectAccountId = profile?.stripe_connect_account_id
    if (!connectAccountId) {
      return json({ error: 'Seller has not connected Stripe' }, 400)
    }

    const idOrder = new Map(ids.map((id, i) => [id, i]))
    const listingsOrdered = [...rows].sort(
      (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
    )

    const totalAmount = listingsOrdered.reduce((s, l) => s + l.price, 0)
    const applicationFeeAmount = Math.round((totalAmount * platformFeePercent) / 100)

    const appOrigin =
      (Deno.env.get('FRONTEND_URL') ?? new URL(req.url).origin).replace(/\/$/, '')

    const listingIdsCsv = [...ids].sort().join(',')

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(useEmbedded
        ? {
            ui_mode: 'embedded' as const,
            return_url: `${appOrigin}/purchases?session_id={CHECKOUT_SESSION_ID}`,
            redirect_on_completion: 'always' as const,
          }
        : {
            success_url: `${appOrigin}/purchases?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: ids.length > 1 ? `${appOrigin}/checkout` : `${appOrigin}/listing/${ids[0]}`,
          }),
      metadata: {
        marketplace: 'the_patch',
        buyer_id: user.id,
        listing_ids: listingIdsCsv,
        seller_id: sellerId,
      },
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: connectAccountId },
        metadata: {
          marketplace: 'the_patch',
          buyer_id: user.id,
          listing_ids: listingIdsCsv,
          seller_id: sellerId,
        },
      },
      line_items: listingsOrdered.map((listing) => ({
        price_data: {
          currency: 'usd',
          unit_amount: listing.price,
          product_data: {
            name: listing.title,
            metadata: { marketplace: 'the_patch', listing_id: listing.id },
          },
        },
        quantity: 1,
      })),
      client_reference_id: `${user.id}:${listingIdsCsv}`,
    })

    if (useEmbedded) {
      const clientSecret = session.client_secret
      if (!clientSecret) {
        return json({ error: 'Stripe did not return a client secret for embedded checkout.' }, 502)
      }
      return json({ clientSecret }, 200)
    }

    const checkoutUrl =
      session.url ?? (session.id ? `https://checkout.stripe.com/c/pay/${session.id}` : null)
    return json({ url: checkoutUrl }, 200)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('You did not provide an API key') || msg.includes('Invalid API Key')) {
      return json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.' },
        503
      )
    }
    return json({ error: msg }, 500)
  }
})
