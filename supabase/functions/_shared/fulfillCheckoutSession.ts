// Shared: create purchases + purchase_grants from a paid Stripe Checkout Session (webhook + client-triggered fulfill).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function parseBuyerAndListingIds(session: {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
}): { buyerId: string; listingIds: string[] } | null {
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

function paymentIntentIdFromSession(session: {
  id?: string
  payment_intent?: string | { id?: string } | null
  payment_status?: string | null
}): string | null {
  const pi = session.payment_intent
  if (typeof pi === 'string' && pi) return pi
  if (pi && typeof pi === 'object' && typeof pi.id === 'string') return pi.id
  // Rare: paid Checkout Session without expanded PI — use session id for idempotent fulfillment.
  if (
    typeof session.id === 'string' &&
    session.id.startsWith('cs_') &&
    session.payment_status === 'paid'
  ) {
    return session.id
  }
  return null
}

/**
 * Idempotent: skips rows already created for the same PaymentIntent + listing.
 * Call only for sessions that are fully paid.
 */
export async function fulfillPaidCheckoutSession(
  supabase: SupabaseClient,
  session: {
    amount_total: number | null
    application_fee_amount: number | null
    payment_intent?: string | { id?: string } | null
    metadata?: Record<string, string> | null
    client_reference_id?: string | null
  }
): Promise<{ ok: true; purchasesCreated: number } | { ok: false; error: string }> {
  const parsed = parseBuyerAndListingIds(session)
  if (!parsed) {
    return { ok: false, error: 'Checkout session missing buyer/listing metadata.' }
  }

  const paymentIntentId = paymentIntentIdFromSession(session)
  if (!paymentIntentId) {
    return { ok: false, error: 'Checkout session has no payment_intent.' }
  }

  const { buyerId, listingIds } = parsed
  const amountTotal = session.amount_total ?? 0
  const totalFee = session.application_fee_amount ?? 0

  const { data: listingRows, error: listErr } = await supabase
    .from('listings')
    .select('id, price, file_storage_path, app_bundle_path')
    .in('id', listingIds)

  if (listErr) {
    return { ok: false, error: `Listings lookup failed: ${listErr.message}` }
  }

  const byId = new Map((listingRows ?? []).map((r) => [r.id, r]))
  const ordered = listingIds.map((id) => byId.get(id)).filter(Boolean) as {
    id: string
    price: number
    file_storage_path: string | null
    app_bundle_path: string | null
  }[]

  if (ordered.length === 0) {
    return { ok: false, error: 'No matching listings for session metadata.' }
  }

  const lineSum = ordered.reduce((s, l) => s + l.price, 0)
  let feeAllocated = 0
  let paidAllocated = 0
  let purchasesCreated = 0

  for (let i = 0; i < ordered.length; i++) {
    const listing = ordered[i]
    const isLast = i === ordered.length - 1

    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('listing_id', listing.id)
      .maybeSingle()

    if (existingPurchase?.id) {
      const { data: grantForListing } = await supabase
        .from('purchase_grants')
        .select('id')
        .eq('user_id', buyerId)
        .eq('listing_id', listing.id)
        .maybeSingle()
      if (!grantForListing) {
        const { error: grantErr } = await supabase.from('purchase_grants').insert({
          purchase_id: existingPurchase.id,
          listing_id: listing.id,
          user_id: buyerId,
          download_path: listing.file_storage_path,
          app_access_path: listing.app_bundle_path,
        })
        if (grantErr) {
          return { ok: false, error: `Grant repair failed: ${grantErr.message}` }
        }
      }
      continue
    }

    let platformFeeCents: number
    if (ordered.length === 1) {
      platformFeeCents = totalFee
    } else if (isLast) {
      platformFeeCents = Math.max(0, totalFee - feeAllocated)
    } else {
      platformFeeCents = lineSum > 0 ? Math.round((totalFee * listing.price) / lineSum) : 0
      feeAllocated += platformFeeCents
    }

    let amountPaidCents: number
    if (ordered.length === 1) {
      amountPaidCents = amountTotal
    } else if (isLast) {
      amountPaidCents = Math.max(0, amountTotal - paidAllocated)
    } else {
      amountPaidCents = lineSum > 0 ? Math.round((amountTotal * listing.price) / lineSum) : 0
      paidAllocated += amountPaidCents
    }

    const sellerPayoutCents = Math.max(0, amountPaidCents - platformFeeCents)

    const { data: purchase, error: insErr } = await supabase
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

    if (insErr || !purchase) {
      return { ok: false, error: insErr?.message ?? 'Purchase insert failed.' }
    }

    purchasesCreated += 1

    const { data: grantAlready } = await supabase
      .from('purchase_grants')
      .select('id')
      .eq('user_id', buyerId)
      .eq('listing_id', listing.id)
      .maybeSingle()

    if (!grantAlready) {
      const { error: grantErr } = await supabase.from('purchase_grants').insert({
        purchase_id: purchase.id,
        listing_id: listing.id,
        user_id: buyerId,
        download_path: listing.file_storage_path,
        app_access_path: listing.app_bundle_path,
      })
      if (grantErr) {
        return { ok: false, error: grantErr.message }
      }
    }
  }

  return { ok: true, purchasesCreated }
}
