import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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
    const { data, error } = await supabase.functions.invoke('generate-download-url', {
      body: { grantId },
    })
    if (error) {
      setDownloadError('Download link could not be generated. Ensure the Edge Function is deployed.')
      return
    }
    if (data?.url) window.open(data.url, '_blank')
    else setDownloadError('Download link could not be generated.')
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
