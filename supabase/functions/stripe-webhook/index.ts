// Supabase Edge Function: Stripe webhook (payment_intent.succeeded, etc.)
// Set env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecretApiKey, getSupabaseUrl } from '../_shared/secrets.ts'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

function parseBuyerAndListingIds(session: Stripe.Checkout.Session): {
  buyerId: string
  listingIds: string[]
} | null {
  const mdBuyer = session.metadata?.buyer_id
  const mdListings = session.metadata?.listing_ids
  if (typeof mdBuyer === 'string' && mdBuyer && typeof mdListings === 'string' && mdListings.trim()) {
    const listingIds = mdListings.split(',').map((s) => s.trim()).filter(Boolean)
    if (listingIds.length) return { buyerId: mdBuyer, listingIds }
  }
  const ref = session.client_reference_id
  if (typeof ref !== 'string' || !ref.includes(':')) return null
  const idx = ref.indexOf(':')
  const buyerId = ref.slice(0, idx)
  const rest = ref.slice(idx + 1).trim()
  if (!buyerId || !rest) return null
  const listingIds = rest.includes(',')
    ? rest.split(',').map((s) => s.trim()).filter(Boolean)
    : [rest]
  return listingIds.length ? { buyerId, listingIds } : null
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!stripeSecretKey) {
    return new Response('Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.', {
      status: 503,
    })
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

  const sbUrl = getSupabaseUrl()
  const sbKey = getSecretApiKey()
  if (!sbUrl || !sbKey) {
    return new Response('Server misconfigured: missing Supabase secrets', { status: 500 })
  }
  const supabase = createClient(sbUrl, sbKey)

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const ready = Boolean(account.details_submitted && account.charges_enabled)
    await supabase
      .from('profiles')
      .update({
        stripe_onboarding_complete: ready,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_connect_account_id', account.id)
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const parsed = parseBuyerAndListingIds(session)
    if (!parsed) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { buyerId, listingIds } = parsed
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id

    const amountTotal = session.amount_total ?? 0
    const totalFee = session.application_fee_amount ?? 0

    const { data: listingRows } = await supabase
      .from('listings')
      .select('id, price, file_storage_path, app_bundle_path')
      .in('id', listingIds)

    const byId = new Map((listingRows ?? []).map((r) => [r.id, r]))
    const ordered = listingIds.map((id) => byId.get(id)).filter(Boolean) as {
      id: string
      price: number
      file_storage_path: string | null
      app_bundle_path: string | null
    }[]

    if (ordered.length === 0) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const lineSum = ordered.reduce((s, l) => s + l.price, 0)
    let feeAllocated = 0
    let paidAllocated = 0

    for (let i = 0; i < ordered.length; i++) {
      const listing = ordered[i]
      const isLast = i === ordered.length - 1
      let platformFeeCents: number
      if (ordered.length === 1) {
        platformFeeCents = totalFee
      } else if (isLast) {
        platformFeeCents = Math.max(0, totalFee - feeAllocated)
      } else {
        platformFeeCents =
          lineSum > 0 ? Math.round((totalFee * listing.price) / lineSum) : 0
        feeAllocated += platformFeeCents
      }

      let amountPaidCents: number
      if (ordered.length === 1) {
        amountPaidCents = amountTotal
      } else if (isLast) {
        amountPaidCents = Math.max(0, amountTotal - paidAllocated)
      } else {
        amountPaidCents =
          lineSum > 0 ? Math.round((amountTotal * listing.price) / lineSum) : 0
        paidAllocated += amountPaidCents
      }

      const sellerPayoutCents = Math.max(0, amountPaidCents - platformFeeCents)

      const { data: purchase } = await supabase
        .from('purchases')
        .insert({
          buyer_id: buyerId,
          listing_id: listing.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_paid_cents: amountPaidCents,
          platform_fee_cents: platformFeeCents,
          seller_payout_cents: sellerPayoutCents,
          status: 'completed',
        })
        .select('id')
        .single()

      if (purchase) {
        await supabase.from('purchase_grants').insert({
          purchase_id: purchase.id,
          listing_id: listing.id,
          user_id: buyerId,
          download_path: listing.file_storage_path,
          app_access_path: listing.app_bundle_path,
        })
      }
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
