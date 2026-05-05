import { useState, useEffect } from 'react'
import { requestStripeConnectOnboard, supabase } from '@/lib/supabase'
import { PLATFORM_FEE_PERCENT } from '@/lib/constants'
import type { Profile } from '@/lib/types'

function getSupabaseProjectRefFromEnv(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!raw?.trim()) return null
  try {
    const host = new URL(raw.trim()).hostname
    const m = /^([a-z0-9-]{10,})\.supabase\.co$/i.exec(host)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

function isStripePlatformConfigError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('stripe is not configured') ||
    m.includes('stripe_secret_key') ||
    m.includes('you did not provide an api key') ||
    m.includes('invalid api key')
  )
}

function isStripeConnectNotEnabledError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('signed up for connect') ||
    m.includes('stripe connect is not enabled') ||
    (m.includes('you can only create new accounts') && m.includes('connect'))
  )
}

function StripeConnectActivationPanel() {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/30 px-4 py-4 text-left text-sm text-violet-100/90 ring-1 ring-violet-500/15">
      <p className="font-semibold text-violet-100">For the marketplace owner</p>
      <p className="mt-2 text-xs leading-relaxed text-violet-100/75">
        Your Stripe account can accept payments, but <strong className="text-violet-100">Connect</strong> must be
        turned on before this app can create seller (connected) accounts. Use the same mode as your API key (
        <strong className="text-violet-100">Test</strong> vs <strong className="text-violet-100">Live</strong>).
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-violet-100/85">
        <li>
          Open{' '}
          <a
            href="https://dashboard.stripe.com/connect"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline"
          >
            Stripe Dashboard → Connect
          </a>{' '}
          and complete platform onboarding (Express works with this app).
        </li>
        <li>Return here and click <strong className="text-violet-100">Start setup with Stripe</strong> again.</li>
      </ol>
    </div>
  )
}

function StripeOwnerConfigPanel({
  edgeFunctionsSettingsUrl,
  projectRef,
}: {
  edgeFunctionsSettingsUrl: string
  projectRef: string | null
}) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-950/30 px-4 py-4 text-left text-sm text-sky-100/90 ring-1 ring-sky-500/15">
      <p className="font-semibold text-sky-100">For the marketplace owner</p>
      <p className="mt-2 text-xs leading-relaxed text-sky-100/75">
        Seller onboarding uses your platform Stripe account (Connect). Add your{' '}
        <strong className="text-sky-100">secret key</strong> to Supabase so Edge Functions can talk to Stripe. Sellers
        never see this key.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-sky-100/80">
        <li>
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            Stripe Dashboard → Developers → API keys
          </a>
          : copy the <strong className="text-sky-100">Secret key</strong> (starts with{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">sk_test_</code> or{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">sk_live_</code>).
        </li>
        <li>
          In Supabase:{' '}
          <a
            href={edgeFunctionsSettingsUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            Project Settings → Edge Functions
          </a>
          , add secret <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">STRIPE_SECRET_KEY</code> (and{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">FRONTEND_URL</code>,{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">STRIPE_WEBHOOK_SECRET</code> for paid orders).
        </li>
        <li>
          Optional: <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">
            STRIPE_CONNECT_PLATFORM_FEE_PERCENT
          </code>{' '}
          — whole-number platform fee % on each checkout (server default <strong className="text-sky-100">{PLATFORM_FEE_PERCENT}</strong>).
          Keep <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">PLATFORM_FEE_PERCENT</code> in{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">src/lib/constants.ts</code> aligned with that
          value (currently <strong className="text-sky-100">{PLATFORM_FEE_PERCENT}%</strong>).
        </li>
      </ol>
      {projectRef && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-sky-200/70">
          CLI:{' '}
          <span className="break-all">
            npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref {projectRef}
          </span>
        </p>
      )}
    </div>
  )
}

type ConnectIntent = 'onboarding' | 'update' | 'express_dashboard'

interface SellerStripeSetupProps {
  profile: Profile | null
}

export default function SellerStripeSetup({ profile }: SellerStripeSetupProps) {
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') === 'refresh') {
      setConnectError(
        'Your Stripe session expired or was refreshed. Click below to continue — your progress is saved.'
      )
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const openStripeFlow = async (intent: ConnectIntent) => {
    setConnectError('')
    setConnecting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setConnectError('Sign in again, then retry Stripe setup.')
        return
      }
      let token = session.access_token
      try {
        const { data: ref } = await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
        if (ref.session?.access_token) token = ref.session.access_token
      } catch {
        /* use existing token */
      }
      const { url, error } = await requestStripeConnectOnboard(intent, token)
      if (error) {
        setConnectError(error)
        return
      }
      if (url) {
        window.location.href = url
        return
      }
      setConnectError('No redirect URL returned. Deploy stripe-connect-onboard and set STRIPE_SECRET_KEY + Supabase secrets.')
    } finally {
      setConnecting(false)
    }
  }

  if (!profile) return null

  const projectRef = getSupabaseProjectRefFromEnv()
  const edgeFunctionsSettingsUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/settings/functions`
    : 'https://supabase.com/dashboard/project/_/settings/functions'

  const hasAccount = Boolean(profile.stripe_connect_account_id)
  const ready = profile.stripe_onboarding_complete

  if (ready) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/35 to-slate-900/40 p-6 ring-1 ring-emerald-500/10 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-300">
                ✓
              </span>
              Payouts are set up
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-100/70">
              Paid listings use Stripe Checkout. Buyers pay securely; earnings settle to your connected account.
              Use Stripe&apos;s dashboard to view payouts, update your bank, or manage tax forms.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <button
              type="button"
              disabled={connecting}
              onClick={() => openStripeFlow('express_dashboard')}
              className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {connecting ? 'Opening…' : 'Open payout dashboard'}
            </button>
            <button
              type="button"
              disabled={connecting}
              onClick={() => openStripeFlow('update')}
              className="text-xs font-medium text-emerald-200/80 underline-offset-2 hover:text-emerald-100 hover:underline disabled:opacity-60"
            >
              Update bank, identity, or business details
            </button>
          </div>
        </div>
        {connectError && (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-slate-950/40 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/20">
              {connectError}
            </p>
            {isStripeConnectNotEnabledError(connectError) && <StripeConnectActivationPanel />}
            {isStripePlatformConfigError(connectError) && (
              <StripeOwnerConfigPanel
                edgeFunctionsSettingsUrl={edgeFunctionsSettingsUrl}
                projectRef={projectRef}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  const step1Done = hasAccount
  const step2Label = hasAccount ? 'Finish verification on Stripe' : 'Verify identity & payouts on Stripe'

  return (
    <div className="mt-8 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-slate-900/40 p-6 ring-1 ring-amber-500/10 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400/90">Get paid</p>
      <h2 className="mt-2 font-display text-2xl font-normal text-white">Set up payouts in two steps</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/65">
        We use Stripe so you never share bank details with The Patch. You&apos;ll enter tax and banking information
        on Stripe&apos;s secure page — usually under five minutes. When sales go through, The Patch keeps{' '}
        <span className="font-semibold text-amber-200/90">{PLATFORM_FEE_PERCENT}%</span> per checkout; the rest is paid
        to your connected Stripe account after Stripe&apos;s fees.
      </p>

      <ol className="mt-6 space-y-3 text-sm">
        <li className="flex gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              step1Done ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/10 text-amber-200'
            }`}
          >
            {step1Done ? '✓' : '1'}
          </span>
          <div>
            <p className={`font-medium ${step1Done ? 'text-emerald-100/90' : 'text-white'}`}>
              Create your seller payout profile
            </p>
            <p className="text-xs text-amber-100/50">
              {step1Done ? 'Done — connected to Stripe.' : 'One click opens Stripe to link your seller account.'}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-amber-200">
            2
          </span>
          <div>
            <p className="font-medium text-white">{step2Label}</p>
            <p className="text-xs text-amber-100/50">
              Stripe will ask for identity and where to send deposits. You can pause and resume anytime.
            </p>
          </div>
        </li>
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={connecting}
          onClick={() => openStripeFlow('onboarding')}
          className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {connecting ? 'Connecting…' : hasAccount ? 'Continue with Stripe' : 'Start setup with Stripe'}
        </button>
        {!hasAccount && (
          <span className="text-xs text-amber-100/45">Secure redirect · you&apos;ll return here when finished</span>
        )}
      </div>

      {connectError && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-slate-950/50 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-500/25">
            {connectError}
          </p>
          {isStripeConnectNotEnabledError(connectError) && <StripeConnectActivationPanel />}
          {isStripePlatformConfigError(connectError) && (
            <StripeOwnerConfigPanel
              edgeFunctionsSettingsUrl={edgeFunctionsSettingsUrl}
              projectRef={projectRef}
            />
          )}
        </div>
      )}

      <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-amber-100/40">
        After you finish, this page updates automatically. If it doesn&apos;t within a minute, refresh — or click
        Continue again (Stripe remembers your progress).
      </p>
    </div>
  )
}
