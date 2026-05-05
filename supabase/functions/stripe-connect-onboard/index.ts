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

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

type ConnectIntent = 'onboarding' | 'update' | 'express_dashboard'

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

    if (!['onboarding', 'update', 'express_dashboard'].includes(intent)) {
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
  } catch (e) {
    const msg = String(e)
    if (
      msg.includes('STRIPE_SECRET_KEY') ||
      msg.includes('Invalid API Key') ||
      msg.includes('You did not provide an API key')
    ) {
      return json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.' }, 503)
    }
    if (
      msg.includes('signed up for Connect') ||
      msg.toLowerCase().includes('you can only create new accounts') && msg.toLowerCase().includes('connect')
    ) {
      return json(
        {
          error:
            'Stripe Connect is not enabled for this platform account. The marketplace owner must activate Connect in the Stripe Dashboard (same Test/Live mode as your API key): https://dashboard.stripe.com/connect — then sellers can complete payout setup.',
        },
        503
      )
    }
    return json({ error: msg }, 500)
  }
})
