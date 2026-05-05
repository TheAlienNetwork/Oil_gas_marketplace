import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { requestGenerateDownloadUrl, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { PurchaseGrant } from '@/lib/types'
import { CATEGORY_LABELS, LISTING_TYPES, type Category } from '@/lib/constants'

type GrantWithListing = PurchaseGrant & {
  listings?: { title: string; listing_type: string; category: Category; thumbnail_url?: string | null }
}

export default function AppLibrary() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<GrantWithListing[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('purchase_grants')
      .select('*, listings(title, listing_type, category, thumbnail_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setGrants((data as GrantWithListing[]) ?? [])
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
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-slate-400">
        Loading your apps…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Apps</h1>
        <p className="mt-1 text-slate-400">
          Access all your purchased applications and tools in one place.
        </p>
      </div>

      {downloadError && (
        <p className="mb-6 rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
          {downloadError}
        </p>
      )}

      {grants.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
          <p className="text-slate-400">You haven&apos;t purchased any apps yet.</p>
          <Link
            to="/marketplace"
            className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            Browse marketplace
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {grants.map((grant) => {
            const listing = grant.listings
            const isWebApp = listing?.listing_type === LISTING_TYPES.web_app
            const isDesktopApp = listing?.listing_type === LISTING_TYPES.desktop_app
            const title = listing?.title ?? 'App'
            const category = listing?.category
            const imageUrl = listing?.thumbnail_url

            return (
              <div
                key={grant.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg transition hover:border-slate-600"
              >
                <div className="aspect-video shrink-0 bg-slate-700/50">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-slate-500">
                      {title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-semibold text-white">{title}</h2>
                  {category && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      {CATEGORY_LABELS[category]}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {isWebApp && (
                      <Link
                        to={`/app/${grant.id}`}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                      >
                        Open app
                      </Link>
                    )}
                    {!isWebApp && (
                      <button
                        type="button"
                        onClick={() => getDownloadUrl(grant.id)}
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                      >
                        {isDesktopApp ? 'Download for Windows' : 'Download'}
                      </button>
                    )}
                    {isWebApp && (
                      <button
                        type="button"
                        onClick={() => getDownloadUrl(grant.id)}
                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        Download package
                      </button>
                    )}
                    <Link
                      to={`/listing/${grant.listing_id}`}
                      className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
