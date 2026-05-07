// Supabase Edge Function: Stripe webhook (payment_intent.succeeded, etc.)
// Set env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

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
    const thin = event.data.object as Stripe.Checkout.Session
    try {
      const session = await stripe.checkout.sessions.retrieve(thin.id, {
        expand: ['payment_intent'],
      })
      if (session.payment_status !== 'paid') {
        console.log(
          `checkout.session.completed ignored: payment_status=${session.payment_status} session=${session.id}`
        )
      } else {
        const result = await fulfillPaidCheckoutSession(supabase, session)
        if (!result.ok) {
          console.error('fulfillPaidCheckoutSession:', result.error)
          return new Response(JSON.stringify({ error: result.error }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    } catch (e) {
      console.error('checkout.session.completed handler error:', e)
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
