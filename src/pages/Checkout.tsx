import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { requestCreateCheckout, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart, type CartLine } from '@/context/CartContext'
import { PLATFORM_FEE_PERCENT } from '@/lib/constants'
import { setPendingCartClear } from '@/lib/stripeCheckoutStorage'
import { isStripePublishableKeyConfigured } from '@/lib/stripePublishableKey'
import StripeEmbeddedCheckoutModal from '@/components/StripeEmbeddedCheckoutModal'

function groupBySeller(lines: CartLine[]) {
  const map = new Map<string, CartLine[]>()
  for (const line of lines) {
    const arr = map.get(line.sellerId) ?? []
    arr.push(line)
    map.set(line.sellerId, arr)
  }
  return Array.from(map.entries())
}

export default function Checkout() {
  const { user, loading } = useAuth()
  const { lines, subtotalCents, removeLine } = useCart()
  const [payError, setPayError] = useState('')
  const [payingSellerId, setPayingSellerId] = useState<string | null>(null)
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null)

  const groups = useMemo(() => groupBySeller(lines), [lines])

  const paySellerGroup = async (groupLines: CartLine[]) => {
    if (!user) return
    const listingIds = groupLines.map((l) => l.listingId)
    const sellerId = groupLines[0].sellerId
    setPayError('')
    if (!isStripePublishableKeyConfigured()) {
      setPayError(
        'Embedded checkout needs VITE_STRIPE_PUBLISHABLE_KEY in .env (Stripe Dashboard → Developers → API keys → Publishable key, same test/live mode as your secret key).'
      )
      return
    }
    setPayingSellerId(sellerId)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPayError('Please sign in and try again.')
        return
      }
      let token = session.access_token
      try {
        const { data: ref } = await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
        if (ref.session?.access_token) token = ref.session.access_token
      } catch {
        /* use existing */
      }
      setPendingCartClear(listingIds)
      const { url, clientSecret, error } = await requestCreateCheckout(token, { listingIds })
      if (error) {
        setPayError(error)
        return
      }
      if (clientSecret) {
        setCheckoutClientSecret(clientSecret)
        return
      }
      if (url) {
        window.location.href = url
        return
      }
      setPayError('No checkout session returned.')
    } finally {
      setPayingSellerId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1400px] justify-center px-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-500/25 border-t-primary-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: '/checkout' }} />
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-white">Your cart is empty</h1>
        <p className="mt-3 text-slate-500">Add listings from the marketplace, then check out here.</p>
        <Link
          to="/marketplace"
          className="mt-8 inline-flex rounded-full bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-500"
        >
          Browse marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="rounded-3xl border border-white/[0.09] bg-slate-950/95 p-6 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-sm sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Checkout</p>
        <h1 className="mt-2 font-display text-4xl font-normal tracking-tight text-white">Review & pay</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Secure payment with Stripe Checkout. Platform fee {PLATFORM_FEE_PERCENT}% applies to each payment.
          Multiple sellers means one Stripe payment per seller group below.
        </p>

        {payError && (
          <div className="mt-6 rounded-xl border border-red-500/25 bg-red-950/80 px-4 py-3 text-sm text-red-100 shadow-inner ring-1 ring-red-500/20">
            {payError}
          </div>
        )}

        <div className="mt-10 space-y-8">
        {groups.map(([sellerId, groupLines]) => {
          const groupTotal = groupLines.reduce((s, l) => s + l.priceCents, 0)
          const payingThisSeller = payingSellerId === sellerId
          return (
            <section
              key={sellerId}
              className="rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-8"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Seller</p>
                  <p className="text-lg font-medium text-white">{groupLines[0].sellerName}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-white">
                  ${(groupTotal / 100).toFixed(2)}
                </p>
              </div>
              <ul className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {groupLines.map((line) => (
                  <li key={line.listingId} className="flex gap-4 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10">
                      {line.thumbnailUrl ? (
                        <img src={line.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-600">◆</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/listing/${line.listingId}`}
                        className="font-medium text-white hover:text-primary-300"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-1 text-sm tabular-nums text-slate-400">
                        ${(line.priceCents / 100).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.listingId)}
                      className="shrink-0 self-start text-xs text-slate-500 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={payingSellerId !== null}
                onClick={() => paySellerGroup(groupLines)}
                className="mt-6 w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
              >
                {payingThisSeller
                  ? 'Opening checkout…'
                  : `Pay ${groupLines[0].sellerName} — $${(groupTotal / 100).toFixed(2)}`}
              </button>
            </section>
          )
        })}
        </div>

        <div className="mt-8 flex items-center justify-between rounded-xl border border-white/[0.1] bg-slate-900 px-5 py-4 shadow-inner">
          <span className="text-sm font-medium text-slate-400">Cart total (all sellers)</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight text-white">
            ${(subtotalCents / 100).toFixed(2)}
          </span>
        </div>

        <Link
          to="/marketplace"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-400 transition hover:text-primary-300"
        >
          <span aria-hidden>←</span> Continue shopping
        </Link>
      </div>

      <StripeEmbeddedCheckoutModal
        clientSecret={checkoutClientSecret}
        onClose={() => setCheckoutClientSecret(null)}
      />
    </div>
  )
}
