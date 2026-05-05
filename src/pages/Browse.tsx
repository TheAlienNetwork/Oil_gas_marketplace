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
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:pt-14">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/90">Catalog</p>
        <h1 className="mt-2 font-display text-4xl font-normal tracking-tight text-white sm:text-5xl">
          Marketplace
        </h1>
        <p className="mt-4 text-lg text-slate-500">
          Professional tools, documents, and applications for exploration, drilling, and operations.
        </p>
      </header>

      <div className="mt-10 rounded-2xl border border-white/[0.07] bg-slate-900/25 p-4 shadow-market backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search by title or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-slate-950/50 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 outline-none ring-primary-500/0 transition focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:w-64">
            <label htmlFor="category-select" className="sr-only">
              Category
            </label>
            <select
              id="category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | '')}
              className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All categories</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              categoryFilter === ''
                ? 'bg-primary-600 text-white'
                : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            All
          </button>
          {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategoryFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                categoryFilter === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500/30 border-t-primary-500" />
          <p className="text-sm font-medium">Loading listings…</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 py-16 text-center">
          <p className="font-display text-xl text-slate-400">No listings match your filters.</p>
          <p className="mt-2 text-sm text-slate-600">Try another search or browse all categories.</p>
        </div>
      ) : (
        <>
          <p className="mt-10 text-sm text-slate-600">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorited={favoriteSet.has(listing.id)}
                onFavoriteChange={handleFavoriteChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
