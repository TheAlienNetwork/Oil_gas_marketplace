// Supabase Edge Function: Stripe Connect — onboarding, account updates, Express Dashboard login
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecretApiKey, getSupabaseUrl } from '../_shared/secrets.ts'

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

/** Stripe SDK throws objects with `message` and often `code`; stringify alone can miss details. */
function stripeThrownDetails(e: unknown): { message: string; code?: string } {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const topCode = typeof o.code === 'string' ? o.code : undefined
    if (typeof o.message === 'string' && o.message.length > 0) {
      return { message: o.message, code: topCode }
    }
    const raw = o.raw
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      const code = (typeof r.code === 'string' ? r.code : topCode) ?? topCode
      if (typeof r.message === 'string' && r.message.length > 0) {
        return { message: r.message, code }
      }
    }
  }
  return { message: String(e) }
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

type ConnectIntent = 'onboarding' | 'update' | 'express_dashboard' | 'sync_status'

/** Same rule as stripe-webhook account.updated — seller can receive Checkout payouts. */
function expressOnboardingReady(account: Stripe.Account): boolean {
  return Boolean(account.details_submitted && account.charges_enabled)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = getSupabaseUrl()
  const secretKey = getSecretApiKey()
  if (!supabaseUrl || !secretKey) {
    return json(
      {
        error:
          'Server misconfigured: missing Supabase URL or secret API key. Add SUPABASE_SERVICE_ROLE_KEY under Edge Functions → Secrets.',
      },
      503
    )
  }

  const supabase = createClient(supabaseUrl, secretKey)

  try {
    if (!stripeSecretKey) {
      return json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.' },
        503
      )
    }

    const body = await req.json().catch(() => ({}))
    const intent = (body.intent ?? 'onboarding') as ConnectIntent
    const userIdBody = body.userId as string | undefined

    if (!['onboarding', 'update', 'express_dashboard', 'sync_status'].includes(intent)) {
      return json({ error: 'Invalid intent' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user || (userIdBody && user.id !== userIdBody)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const uid = user.id
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', uid)
      .single()

    let accountId = profile?.stripe_connect_account_id as string | null

    const origin = (Deno.env.get('FRONTEND_URL') ?? new URL(req.url).origin).replace(/\/$/, '')
    const refreshUrl = `${origin}/dashboard?stripe=refresh`
    const returnUrl = `${origin}/dashboard?stripe=connected`

    if (intent === 'sync_status') {
      if (!accountId) {
        return json({ error: 'No Connect account on file yet.' }, 400)
      }
      const account = await stripe.accounts.retrieve(accountId)
      const ready = expressOnboardingReady(account)
      await supabase
        .from('profiles')
        .update({
          stripe_onboarding_complete: ready,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid)
      return json({ stripe_onboarding_complete: ready }, 200)
    }

    if (intent === 'express_dashboard') {
      if (!accountId) {
        return json({ error: 'Complete payout setup first' }, 400)
      }
      const loginLink = await stripe.accounts.createLoginLink(accountId)
      return json({ url: loginLink.url }, 200)
    }

    if (intent === 'update' && !accountId) {
      return json({ error: 'Run payout setup first before updating details' }, 400)
    }

    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'express' })
      accountId = account.id
      await supabase
        .from('profiles')
        .update({
          stripe_connect_account_id: accountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uid)
    }

    const linkType = intent === 'update' ? 'account_update' : 'account_onboarding'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: linkType,
    })

    return json({ url: accountLink.url }, 200)
  } catch (e: unknown) {
    const { message: msg, code } = stripeThrownDetails(e)
    const lower = msg.toLowerCase()

    if (
      msg.includes('STRIPE_SECRET_KEY') ||
      msg.includes('Invalid API Key') ||
      msg.includes('You did not provide an API key')
    ) {
      return json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.' }, 503)
    }

    if (
      lower.includes('rk_live') ||
      lower.includes('rk_test') ||
      (lower.includes('required permissions') && lower.includes('key')) ||
      (lower.includes('does not have access') && lower.includes('connect'))
    ) {
      return json(
        {
          error:
            'Supabase is using a Stripe key that cannot create Connect accounts. Set a standard secret key (sk_test_… or sk_live_…) with Connect access in Edge Function secrets — not a restricted key (rk_…).',
        },
        503
      )
    }

    const connectNotReady =
      code === 'platform_account_required' ||
      lower.includes('signed up for connect') ||
      (lower.includes('you can only create new accounts') && lower.includes('connect')) ||
      lower.includes('only connect platforms') ||
      (lower.includes('connect') && lower.includes('not enabled'))

    if (connectNotReady) {
      return json(
        {
          error:
            'Stripe Connect is not enabled for this platform account. The marketplace owner must activate Connect in the Stripe Dashboard (same Test/Live mode as your API key): https://dashboard.stripe.com/connect — then sellers can complete payout setup.',
        },
        503
      )
    }

    if (
      lower.includes('managing losses') ||
      lower.includes('losses for connected') ||
      lower.includes('platform-profile') ||
      lower.includes('platform profile') ||
      (lower.includes('responsibilities') && lower.includes('connected'))
    ) {
      return json(
        {
          error:
            'Finish your Stripe Connect platform profile first (including loss liability for connected accounts), then retry seller setup: https://dashboard.stripe.com/settings/connect/platform-profile',
        },
        503
      )
    }

    return json({ error: msg }, 500)
  }
})
