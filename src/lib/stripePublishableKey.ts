/** Browser-safe publishable key (pk_test_… / pk_live_…) — must match STRIPE_SECRET_KEY mode. */
export function getStripePublishableKey(): string {
  const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  const trimmed = k?.trim() ?? ''
  if (!trimmed || trimmed.includes('placeholder')) {
    throw new Error(
      'Missing VITE_STRIPE_PUBLISHABLE_KEY. Add it to .env (Stripe Dashboard → Developers → API keys → Publishable key).'
    )
  }
  return trimmed
}

export function isStripePublishableKeyConfigured(): boolean {
  const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  return Boolean(k?.trim() && !k.includes('placeholder'))
}
