import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, PLATFORM_FEE_PERCENT, type Category } from '@/lib/constants'
import CreateListingForm from '@/components/CreateListingForm'
import SellerStripeSetup from '@/components/SellerStripeSetup'

export default function SellerDashboard() {
  const { user, profile, refreshProfile } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
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
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Seller</p>
        <h1 className="mt-2 font-display text-4xl font-normal tracking-tight text-white">Dashboard</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          Upload digital products (files, calculators, apps). Paid sales use Stripe Checkout; the platform
          retains {PLATFORM_FEE_PERCENT}% per sale (configurable server-side as{' '}
          <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-xs text-slate-300 ring-1 ring-white/10">
            STRIPE_CONNECT_PLATFORM_FEE_PERCENT
          </code>
          ). Connect Stripe so payouts reach your account.
        </p>
      </header>

      <SellerStripeSetup profile={profile} />

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Your listings</p>
          <p className="text-xs text-slate-600">Manage what buyers see on the marketplace.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingListing(null)
            setShowCreate(true)
          }}
          className="rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
        >
          New listing
        </button>
      </div>

      {(showCreate || editingListing) && (
        <CreateListingForm
          key={editingListing?.id ?? 'new'}
          initialListing={editingListing}
          onClose={() => {
            setShowCreate(false)
            setEditingListing(null)
          }}
          onSuccess={() => {
            setShowCreate(false)
            setEditingListing(null)
            refetchListings()
          }}
        />
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500/25 border-t-primary-500" />
        </div>
      ) : (
        <>
          {deleteError && (
            <div className="mt-8 rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
              {deleteError}
            </div>
          )}
          {listings.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 py-16 text-center">
              <p className="font-display text-lg text-slate-400">No listings yet</p>
              <p className="mt-2 text-sm text-slate-600">Create your first product to appear on the marketplace.</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-slate-900/25 p-5 shadow-market ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/listing/${listing.id}`}
                      className="font-medium text-white transition hover:text-primary-300"
                    >
                      {listing.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {CATEGORY_LABELS[listing.category as Category]} ·{' '}
                      {listing.price === 0 ? 'Free' : `$${(listing.price / 100).toFixed(2)}`} ·{' '}
                      <span className={listing.is_published ? 'text-emerald-500/90' : 'text-amber-500/90'}>
                        {listing.is_published ? 'Live' : 'Draft'}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      to={`/listing/${listing.id}`}
                      className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false)
                        setEditingListing(listing)
                      }}
                      className="rounded-full border border-primary-500/35 bg-primary-500/10 px-4 py-1.5 text-xs font-semibold text-primary-200 transition hover:bg-primary-500/20"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(
                          'Delete this listing? This cannot be undone.'
                        )
                        if (ok) handleDeleteListing(listing.id)
                      }}
                      disabled={deleteId === listing.id}
                      className="rounded-full bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-white/10 transition hover:bg-red-950/50 hover:text-red-300 hover:ring-red-500/30 disabled:opacity-60"
                    >
                      {deleteId === listing.id ? 'Deleting…' : 'Remove'}
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
