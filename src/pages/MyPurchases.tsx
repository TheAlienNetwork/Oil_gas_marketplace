import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { requestGenerateDownloadUrl, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { PurchaseGrant } from '@/lib/types'
import { CATEGORY_LABELS, LISTING_TYPES, type Category } from '@/lib/constants'

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
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setDownloadError('Please sign in and try again.')
      return
    }
    let accessToken = session.access_token
    try {
      const { data: ref } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      })
      if (ref.session?.access_token) accessToken = ref.session.access_token
    } catch {
      // continue with existing token
    }
    const { url, error } = await requestGenerateDownloadUrl(grantId, accessToken)
    if (error) {
      setDownloadError(error)
      return
    }
    if (url) window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500/25 border-t-primary-500" />
        <p className="mt-4 text-sm text-slate-500">Loading your library…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Library</p>
      <h1 className="mt-2 font-display text-4xl font-normal tracking-tight text-white">Orders</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-500">
        Everything you&apos;ve purchased or claimed. Open web apps here or download files securely.
      </p>
      {downloadError && (
        <p className="mt-6 rounded-xl bg-amber-950/35 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/25">
          {downloadError}
        </p>
      )}
      {grants.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 py-16 text-center">
          <p className="text-slate-400">Your library is empty.</p>
          <Link
            to="/marketplace"
            className="mt-4 inline-flex rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-primary-400 transition hover:border-primary-500/40 hover:text-primary-300"
          >
            Browse marketplace
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {grants.map((grant) => {
            const listing = grant.listings
            const isWebApp = grant.listings?.listing_type === LISTING_TYPES.web_app
            const isDesktopApp = grant.listings?.listing_type === LISTING_TYPES.desktop_app
            return (
              <li
                key={grant.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-slate-900/25 p-5 shadow-market ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div>
                  <p className="font-medium text-white">{listing?.title ?? 'Listing'}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                    {listing ? CATEGORY_LABELS[listing.category] : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {isWebApp && (
                    <Link
                      to={`/app/${grant.id}`}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
                    >
                      Open app
                    </Link>
                  )}
                  {!isWebApp && (
                    <button
                      type="button"
                      onClick={() => getDownloadUrl(grant.id)}
                      className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
                    >
                      {isDesktopApp ? 'Download for Windows' : 'Download'}
                    </button>
                  )}
                  {isWebApp && (
                    <button
                      type="button"
                      onClick={() => getDownloadUrl(grant.id)}
                      className="rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]"
                    >
                      Download package
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
