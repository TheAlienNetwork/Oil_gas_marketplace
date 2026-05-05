import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const inputClass =
  'mt-2 w-full rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (err) {
      const msg =
        err.message?.toLowerCase().includes('rate limit') ||
        err.message?.toLowerCase().includes('429')
          ? 'Too many attempts. Please wait a while and try again.'
          : err.message
      setError(msg)
      return
    }
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/[0.07] bg-slate-900/35 p-8 shadow-market-lg ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Welcome back</p>
        <h1 className="mt-3 font-display text-3xl font-normal text-white">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Access your purchases and seller dashboard.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
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
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/sign-up" className="font-semibold text-primary-400 transition hover:text-primary-300">
            Join the marketplace
          </Link>
        </p>
      </div>
    </div>
  )
}
