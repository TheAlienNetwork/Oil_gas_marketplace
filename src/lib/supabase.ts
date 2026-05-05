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

/** Stripe Checkout session — uses fetch so JSON `error` is shown (e.g. seller not connected). */
export async function requestCreateCheckout(
  accessToken: string,
  body: { listingId?: string; listingIds?: string[] }
): Promise<{ url: string | null; error: string | null }> {
  if (
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return { url: null, error: 'App is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' }
  }
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-checkout`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    })
    const jsonBody = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) {
      const msg =
        typeof jsonBody.error === 'string' && jsonBody.error.trim()
          ? jsonBody.error.trim()
          : `Checkout failed (HTTP ${res.status}).`
      return { url: null, error: msg }
    }
    if (typeof jsonBody.url === 'string' && jsonBody.url.length > 0) {
      return { url: jsonBody.url, error: null }
    }
    return { url: null, error: 'No checkout URL returned.' }
  } catch {
    return { url: null, error: 'Could not reach checkout. Try again.' }
  }
}
