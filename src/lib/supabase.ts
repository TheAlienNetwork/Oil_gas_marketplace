import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDB9.placeholder'

/** True when no real Supabase env vars are set — use this to show a "test mode" banner. */
export const isDemoMode =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Calls generate-download-url via fetch so the JSON body (`error`) is always shown,
 * instead of the generic "Edge Function returned a non-2xx status code" from `invoke`.
 */
export async function requestGenerateDownloadUrl(
  grantId: string,
  accessToken: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
    return { url: null, error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-download-url`
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ grantId }),
    })
  } catch {
    return { url: null, error: 'Could not reach the download service (network error).' }
  }
  let body: { url?: string; error?: string } = {}
  try {
    body = (await res.json()) as { url?: string; error?: string }
  } catch {
    return {
      url: null,
      error: `Download service returned HTTP ${res.status} with no JSON body.`,
    }
  }
  if (!res.ok) {
    const msg =
      typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : `Download service error (HTTP ${res.status}).`
    return { url: null, error: msg }
  }
  if (typeof body.url === 'string' && body.url.length > 0) {
    return { url: body.url, error: null }
  }
  return {
    url: null,
    error:
      typeof body.error === 'string' ? body.error : 'Download link could not be generated.',
  }
}

/** Stripe Connect onboarding / dashboard — uses fetch so JSON `error` is visible in the UI. */
export async function requestStripeConnectOnboard(
  intent: 'onboarding' | 'update' | 'express_dashboard',
  accessToken: string
): Promise<{ url: string | null; error: string | null }> {
  if (
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return { url: null, error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/stripe-connect-onboard`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ intent }),
    })
    const body = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) {
      const msg =
        typeof body.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `Stripe setup failed (HTTP ${res.status}).`
      return { url: null, error: msg }
    }
    if (typeof body.url === 'string' && body.url.length > 0) {
      return { url: body.url, error: null }
    }
    return { url: null, error: 'No redirect URL returned from Stripe setup.' }
  } catch {
    return { url: null, error: 'Could not reach Stripe setup. Check your connection and try again.' }
  }
}

/** Pull Connect account status from Stripe and update `profiles.stripe_onboarding_complete` (same rules as webhooks). */
export async function requestStripeConnectSync(accessToken: string): Promise<{
  stripe_onboarding_complete: boolean | null
  error: string | null
}> {
  if (
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return { stripe_onboarding_complete: null, error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/stripe-connect-onboard`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ intent: 'sync_status' }),
    })
    const body = (await res.json()) as { stripe_onboarding_complete?: boolean; error?: string }
    if (!res.ok) {
      const msg =
        typeof body.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `Stripe sync failed (HTTP ${res.status}).`
      return { stripe_onboarding_complete: null, error: msg }
    }
    if (typeof body.stripe_onboarding_complete === 'boolean') {
      return { stripe_onboarding_complete: body.stripe_onboarding_complete, error: null }
    }
    return { stripe_onboarding_complete: null, error: 'Invalid response from Stripe sync.' }
  } catch {
    return { stripe_onboarding_complete: null, error: 'Could not reach Stripe sync. Try again.' }
  }
}

export type FulfillCheckoutResult = {
  ok: boolean
  purchases_created?: number
  error: string | null
  /** HTTP status from fulfill-checkout (0 if network/parse error). */
  httpStatus: number
  /** Safe to retry after a short wait (e.g. payment not finalized yet, transient server error). */
  retryable: boolean
}

/** After Checkout return (?session_id=cs_…), creates purchases/grants if the webhook has not yet (idempotent). */
export async function requestFulfillCheckout(
  checkoutSessionId: string,
  accessToken: string
): Promise<FulfillCheckoutResult> {
  if (
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return {
      ok: false,
      error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
      httpStatus: 0,
      retryable: false,
    }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/fulfill-checkout`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
    })
    let body: { ok?: boolean; purchases_created?: number; error?: string } = {}
    try {
      body = (await res.json()) as { ok?: boolean; purchases_created?: number; error?: string }
    } catch {
      return {
        ok: false,
        error: `Fulfill checkout returned HTTP ${res.status} with no JSON body.`,
        httpStatus: res.status,
        retryable: res.status >= 500 || res.status === 429,
      }
    }
    const retryable =
      res.status === 409 ||
      res.status === 429 ||
      res.status === 503 ||
      (res.status >= 500 && res.status <= 599)
    if (!res.ok) {
      const msg =
        typeof body.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `Fulfill checkout failed (HTTP ${res.status}).`
      return { ok: false, error: msg, httpStatus: res.status, retryable }
    }
    if (body.ok === true) {
      return {
        ok: true,
        purchases_created: typeof body.purchases_created === 'number' ? body.purchases_created : undefined,
        error: null,
        httpStatus: res.status,
        retryable: false,
      }
    }
    return { ok: false, error: 'Invalid fulfill response.', httpStatus: res.status, retryable: false }
  } catch {
    return { ok: false, error: 'Could not reach fulfill-checkout. Try again.', httpStatus: 0, retryable: true }
  }
}

/** Stripe Checkout session — uses fetch so JSON `error` is shown (e.g. seller not connected). */
export async function requestCreateCheckout(
  accessToken: string,
  body: { listingId?: string; listingIds?: string[]; embedded?: boolean }
): Promise<{ url: string | null; clientSecret: string | null; error: string | null }> {
  if (
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return { url: null, clientSecret: null, error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-checkout`
  const payload = { ...body, embedded: body.embedded ?? true }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(payload),
    })
    const jsonBody = (await res.json()) as { url?: string; clientSecret?: string; error?: string }
    if (!res.ok) {
      const msg =
        typeof jsonBody.error === 'string' && jsonBody.error.trim()
          ? jsonBody.error.trim()
          : `Checkout failed (HTTP ${res.status}).`
      return { url: null, clientSecret: null, error: msg }
    }
    if (typeof jsonBody.clientSecret === 'string' && jsonBody.clientSecret.length > 0) {
      return { url: null, clientSecret: jsonBody.clientSecret, error: null }
    }
    if (typeof jsonBody.url === 'string' && jsonBody.url.length > 0) {
      return { url: jsonBody.url, clientSecret: null, error: null }
    }
    return { url: null, clientSecret: null, error: 'No checkout session returned.' }
  } catch {
    return { url: null, clientSecret: null, error: 'Could not reach checkout. Try again.' }
  }
}
