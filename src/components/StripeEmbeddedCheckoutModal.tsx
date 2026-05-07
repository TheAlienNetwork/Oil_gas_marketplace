import { useEffect, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { getStripePublishableKey } from '@/lib/stripePublishableKey'
import { clearPendingCartClear } from '@/lib/stripeCheckoutStorage'

type EmbeddedCheckoutInstance = {
  mount: (el: HTMLElement) => void
  destroy: () => void
}

/** Stripe.js renamed initEmbeddedCheckout → createEmbeddedCheckoutPage (breaking change). Prefer new API. */
function getCreateEmbeddedCheckoutPage(
  stripe: Stripe
): ((opts: { clientSecret: string }) => Promise<EmbeddedCheckoutInstance>) | undefined {
  const s = stripe as Stripe & {
    createEmbeddedCheckoutPage?: (opts: { clientSecret: string }) => Promise<EmbeddedCheckoutInstance>
    initEmbeddedCheckout?: (opts: { clientSecret: string }) => Promise<EmbeddedCheckoutInstance>
  }
  if (typeof s.createEmbeddedCheckoutPage === 'function') {
    return s.createEmbeddedCheckoutPage.bind(s)
  }
  if (typeof s.initEmbeddedCheckout === 'function') {
    return s.initEmbeddedCheckout.bind(s)
  }
  return undefined
}

interface StripeEmbeddedCheckoutModalProps {
  clientSecret: string | null
  onClose: () => void
}

export default function StripeEmbeddedCheckoutModal({
  clientSecret,
  onClose,
}: StripeEmbeddedCheckoutModalProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const handleClose = () => {
    clearPendingCartClear()
    onClose()
  }

  useEffect(() => {
    if (!clientSecret || !container) return
    setLoadError(null)
    let instance: EmbeddedCheckoutInstance | undefined
    let cancelled = false

    ;(async () => {
      try {
        const pk = getStripePublishableKey()
        const stripe = await loadStripe(pk)
        if (!stripe || cancelled) return
        const createEmbedded = getCreateEmbeddedCheckoutPage(stripe)
        if (typeof createEmbedded !== 'function') {
          setLoadError(
            'This browser build of Stripe.js does not support embedded Checkout. Update @stripe/stripe-js and reload.'
          )
          return
        }
        instance = await createEmbedded({ clientSecret })
        if (cancelled) {
          instance.destroy()
          return
        }
        instance.mount(container)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not start checkout.')
        }
      }
    })()

    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [clientSecret, container])

  if (!clientSecret) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-slate-950/92 p-4 py-8 backdrop-blur-md sm:items-center sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-embedded-checkout-title"
    >
      <div
        className="relative my-auto flex max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-slate-950 shadow-[0_32px_120px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06)_inset] ring-1 ring-white/[0.07]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-gradient-to-b from-slate-900 to-slate-950 px-5 py-4">
          <div>
            <p id="stripe-embedded-checkout-title" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-400/95">
              Secure payment
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">Stripe Checkout</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
          >
            Close
          </button>
        </div>
        {loadError ? (
          <div className="shrink-0 border-b border-white/[0.06] bg-slate-900 px-5 py-8">
            <p className="rounded-xl border border-red-500/25 bg-red-950/70 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/20">
              {loadError}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-slate-100 p-3 sm:p-4">
            <div className="rounded-xl bg-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_24px_-8px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/90">
              <div
                ref={setContainer}
                className="min-h-[min(480px,55dvh)] w-full bg-white pb-1 sm:min-h-[min(520px,60dvh)]"
              />
            </div>
          </div>
        )}
        <p className="shrink-0 border-t border-white/[0.06] bg-slate-950 px-5 py-3 text-center text-[11px] leading-snug text-slate-500">
          Powered by Stripe · Complete payment here, then you&apos;ll return to your purchases.
        </p>
      </div>
    </div>
  )
}
