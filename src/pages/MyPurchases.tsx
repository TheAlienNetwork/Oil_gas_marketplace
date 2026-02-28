import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { PurchaseGrant } from '@/lib/types'
import { CATEGORY_LABELS, LISTING_TYPES, type Category } from '@/lib/constants'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export default function MyPurchases() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<(PurchaseGrant & { listings?: { title: string; listing_type: string; category: Category } })[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('purchase_grants')
      .select('*, listings(title, listing_type, category)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setGrants((data as typeof grants) ?? [])
        setLoading(false)
      })
  }, [user?.id])

  const getDownloadUrl = async (grantId: string) => {
    setDownloadError('')
    const { data: { session: initialSession } } = await supabase.auth.getSession()
    if (!initialSession?.access_token) {
      setDownloadError('Please sign in and try again.')
      return
    }
    let token = initialSession.access_token
    try {
      const { data: { session } } = await supabase.auth.refreshSession({
        refresh_token: initialSession.refresh_token,
      })
      if (session?.access_token) token = session.access_token
    } catch {
      // use initial token
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setDownloadError('Supabase URL or anon key is missing. Check your .env.')
      return
    }
    const url = `${SUPABASE_URL}/functions/v1/generate-download-url`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ grantId }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setDownloadError(
        `Could not reach the download service (${msg}). Check your connection and that the Edge Function is deployed for this project.`
      )
      return
    }
    const text = await res.text()
    let body: { url?: string; error?: string } = {}
    try {
      body = text ? (JSON.parse(text) as { url?: string; error?: string }) : {}
    } catch {
      // non-JSON response (e.g. HTML error page)
    }
    if (res.ok && body.url) {
      window.open(body.url, '_blank')
      return
    }
    const msg =
      typeof body.error === 'string'
        ? body.error
        : res.status === 401
          ? 'Sign-in expired or invalid. Sign out and sign back in, then try again.'
          : res.status === 404
            ? 'Download not found or not available for this purchase.'
            : res.status >= 500
              ? 'Download service error. Try again later or check Edge Function logs.'
              : `Download failed (${res.status}). ${body.error || res.statusText || ''}`.trim()
    setDownloadError(msg || 'Download link could not be generated.')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">
        Loading...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">My Purchases</h1>
      {downloadError && (
        <p className="mt-4 rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
          {downloadError}
        </p>
      )}
      {grants.length === 0 ? (
        <p className="mt-6 text-slate-400">
          You haven&apos;t purchased anything yet.{' '}
          <Link to="/browse" className="text-primary-400 hover:underline">
            Browse the marketplace
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {grants.map((grant) => {
            const listing = grant.listings
            const isWebApp = grant.listings?.listing_type === LISTING_TYPES.web_app
            const isDesktopApp = grant.listings?.listing_type === LISTING_TYPES.desktop_app
            return (
              <li
                key={grant.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">
                    {listing?.title ?? 'Listing'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {listing ? CATEGORY_LABELS[listing.category] : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isWebApp ? (
                    <Link
                      to={`/app/${grant.id}`}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                    >
                      Open app
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => getDownloadUrl(grant.id)}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                    >
                      {isDesktopApp ? 'Download for Windows' : 'Download'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
