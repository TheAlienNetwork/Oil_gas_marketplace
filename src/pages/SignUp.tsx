import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const inputClass =
  'mt-2 w-full rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (err) {
      const msg =
        err.message?.toLowerCase().includes('rate limit') ||
        err.message?.toLowerCase().includes('429')
          ? 'Too many sign-up attempts. Please wait a while and try again, or sign in if you already have an account.'
          : err.message
      setError(msg)
      return
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName || null,
        updated_at: new Date().toISOString(),
      })
      setDone(true)
    } else {
      navigate('/')
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16 text-center">
        <div className="rounded-2xl border border-white/[0.07] bg-slate-900/35 p-10 shadow-market ring-1 ring-white/[0.04]">
          <p className="font-display text-xl text-slate-200">Check your inbox</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Confirm your email to activate your account, then sign in.
          </p>
          <Link
            to="/sign-in"
            className="mt-8 inline-flex rounded-full bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/[0.07] bg-slate-900/35 p-8 shadow-market-lg ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Join</p>
        <h1 className="mt-3 font-display text-3xl font-normal text-white">Create account</h1>
        <p className="mt-2 text-sm text-slate-500">Buy tools or open your seller dashboard in minutes.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="displayName" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-slate-600">At least 6 characters.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/sign-in" className="font-semibold text-primary-400 transition hover:text-primary-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
