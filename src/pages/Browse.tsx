import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, type Category } from '@/lib/constants'
import ListingCard from '@/components/ListingCard'
import { useAuth } from '@/context/AuthContext'

export default function Browse() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('')
  const [search, setSearch] = useState('')
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    let query = supabase
      .from('listings')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (categoryFilter) {
      query = query.eq('category', categoryFilter)
    }
    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
      )
    }

    query.then(({ data, error }) => {
      if (!error) setListings((data as Listing[]) ?? [])
      setLoading(false)
    })
  }, [categoryFilter, search])

  useEffect(() => {
    if (!user?.id || listings.length === 0) {
      setFavoriteSet(new Set())
      return
    }
    const ids = listings.map((l) => l.id)
    supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .in('listing_id', ids)
      .then(({ data, error }) => {
        if (error) return
        setFavoriteSet(new Set((data as { listing_id: string }[]).map((r) => r.listing_id)))
      })
  }, [user?.id, listings])

  const handleFavoriteChange = (listingId: string, favorited: boolean) => {
    setFavoriteSet((prev) => {
      const next = new Set(prev)
      if (favorited) next.add(listingId)
      else next.delete(listingId)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Marketplace</h1>
      <p className="mt-1 text-slate-400">Tools, calculators, manuals & apps for the oil & gas industry</p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search tools, calculators, manuals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | '')}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>
      {loading ? (
        <div className="mt-12 text-center text-slate-400">Loading...</div>
      ) : listings.length === 0 ? (
        <div className="mt-12 text-center text-slate-400">
          No listings found. Sell your first tool or app from the Seller Dashboard.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isFavorited={favoriteSet.has(listing.id)}
              onFavoriteChange={handleFavoriteChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
