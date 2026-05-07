// Call after embedded/hosted Checkout return so library updates even if the Stripe webhook is delayed or misconfigured.
// POST { checkout_session_id: "cs_..." } with Authorization: Bearer <user JWT>.
// Verifies metadata.buyer_id matches the JWT user and payment_status is paid before inserting rows.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fulfillPaidCheckoutSession } from '../_shared/fulfillCheckoutSession.ts'
import { getSecretApiKey, getSupabaseUrl } from '../_shared/secrets.ts'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!stripeSecretKey) {
    return json({ error: 'Stripe is not configured.' }, 503)
  }

  const sbUrl = getSupabaseUrl()
  const sbKey = getSecretApiKey()
  if (!sbUrl || !sbKey) {
    return json({ error: 'Server misconfigured.' }, 503)
  }

  const supabase = createClient(sbUrl, sbKey)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)
  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const checkoutSessionId =
    typeof body.checkout_session_id === 'string' ? body.checkout_session_id.trim() : ''
  if (!checkoutSessionId.startsWith('cs_')) {
    return json({ error: 'Provide checkout_session_id (cs_…).' }, 400)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['payment_intent'],
    })

    if (session.metadata?.buyer_id !== user.id) {
      return json({ error: 'This order belongs to another signed-in account.' }, 403)
    }

    if (session.payment_status !== 'paid') {
      return json(
        {
          error: `Checkout is not paid yet (status: ${session.payment_status ?? 'unknown'}).`,
          payment_status: session.payment_status,
        },
        409
      )
    }

    const result = await fulfillPaidCheckoutSession(supabase, session)
    if (!result.ok) {
      return json({ error: result.error }, 500)
    }
    return json({ ok: true, purchases_created: result.purchasesCreated }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
