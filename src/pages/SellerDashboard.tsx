import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, type Category } from '@/lib/constants'
import CreateListingForm from '@/components/CreateListingForm'

export default function SellerDashboard() {
  const { user, profile, refreshProfile } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'listings' | 'messages'>('listings')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') === 'connected') {
      refreshProfile()
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [refreshProfile])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings((data as Listing[]) ?? [])
        setLoading(false)
      })
  }, [user?.id])

  const refetchListings = () => {
    if (!user?.id) return
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setListings((data as Listing[]) ?? []))
  }

  const handleConnectStripe = async () => {
    try {
      const { data } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: { userId: user?.id },
      })
      if (data?.url) window.location.href = data.url
    } catch {
      // Placeholder: show message when Edge Function not deployed
      alert('Stripe Connect will be available after deploying the backend.')
    }
  }

  const handleDeleteListing = async (listingId: string) => {
    if (!user?.id) return
    setDeleteError('')
    setDeleteId(listingId)
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId)
        .eq('seller_id', user.id)
      if (error) throw error
      setListings((prev) => prev.filter((l) => l.id !== listingId))
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete listing')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Seller Dashboard</h1>

      {profile && !profile.stripe_onboarding_complete && (
        <div className="mt-6 rounded-xl border border-amber-800 bg-amber-900/20 p-4">
          <p className="text-amber-200">
            Connect your Stripe account to receive payouts from paid sales.
          </p>
          <button
            type="button"
            onClick={handleConnectStripe}
            className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Connect Stripe
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('listings')}
            className={
              tab === 'listings'
                ? 'rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-lg bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50'
            }
          >
            Listings
          </button>
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={
              tab === 'messages'
                ? 'rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-lg bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50'
            }
          >
            Messages
          </button>
        </div>

        {tab === 'listings' && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            Create listing
          </button>
        )}
      </div>

      {showCreate && (
        <CreateListingForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            refetchListings()
          }}
        />
      )}

      {tab === 'messages' ? (
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
          Messages inbox is coming next (this tab will show customer messages in a messenger-style view).
        </div>
      ) : loading ? (
        <div className="mt-6 text-slate-400">Loading...</div>
      ) : (
        <>
          {deleteError && (
            <div className="mt-6 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {deleteError}
            </div>
          )}
          {listings.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
              No listings yet. Create one to start selling.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/listing/${listing.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {listing.title}
                    </Link>
                    <p className="text-sm text-slate-400">
                      {CATEGORY_LABELS[listing.category as Category]} ·{' '}
                      {listing.price === 0
                        ? 'Free'
                        : `$${(listing.price / 100).toFixed(2)}`}{' '}
                      · {listing.is_published ? 'Published' : 'Draft'}
                    </p>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    <Link
                      to={`/listing/${listing.id}`}
                      className="text-sm text-primary-400 hover:underline"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(
                          'Delete this listing? This cannot be undone.'
                        )
                        if (ok) handleDeleteListing(listing.id)
                      }}
                      disabled={deleteId === listing.id}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleteId === listing.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
