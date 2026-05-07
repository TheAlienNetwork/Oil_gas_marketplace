import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/lib/types'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  type Category,
  type Subcategory,
} from '@/lib/constants'
import ListingCard from '@/components/ListingCard'
import FeaturedListingCarousel from '@/components/FeaturedListingCarousel'
import { useAuth } from '@/context/AuthContext'

export default function Browse() {
  const { user } = useAuth()
  const [featured, setFeatured] = useState<Listing[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('')
  const [subcategoryFilter, setSubcategoryFilter] = useState<Subcategory | ''>('')
  const [search, setSearch] = useState('')
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase
      .from('listings')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured((data as Listing[]) ?? []))
  }, [])

  useEffect(() => {
    let query = supabase
      .from('listings')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (categoryFilter) {
      query = query.eq('category', categoryFilter)
    }
    if (subcategoryFilter) {
      query = query.eq('subcategory', subcategoryFilter)
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
  }, [categoryFilter, subcategoryFilter, search])

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

      {featured.length > 0 && (
        <section className="mt-12 border-t border-white/[0.06] pt-12 sm:mt-14 sm:pt-14" aria-labelledby="browse-featured-heading">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/80">Featured</p>
              <h2
                id="browse-featured-heading"
                className="mt-2 font-display text-3xl font-normal tracking-tight text-white sm:text-4xl"
              >
                New & notable
              </h2>
              <p className="mt-3 max-w-lg text-slate-500">
                Hand-picked spotlight — latest published listings from the community.
              </p>
            </div>
          </div>
          <div className="mt-10 sm:mt-12">
            <FeaturedListingCarousel listings={featured} />
          </div>
        </section>
      )}

      <div className="mt-10 rounded-2xl border border-white/[0.07] bg-slate-900/25 p-4 shadow-market backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-6">
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
          <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-end xl:w-auto">
            <div className="min-w-0 flex-1 xl:w-52">
              <label htmlFor="category-select" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Format
              </label>
              <select
                id="category-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | '')}
                className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All formats</option>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 xl:w-56">
              <label htmlFor="subcategory-select" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Discipline
              </label>
              <select
                id="subcategory-select"
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value as Subcategory | '')}
                className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All disciplines</option>
                {SUBCATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {SUBCATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-4 border-t border-white/[0.05] pt-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Format</p>
            <div className="flex flex-wrap gap-2">
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
              {CATEGORIES.map((value) => (
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
                  {CATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Discipline</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubcategoryFilter('')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  subcategoryFilter === ''
                    ? 'bg-slate-700 text-white ring-1 ring-white/15'
                    : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                All
              </button>
              {SUBCATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSubcategoryFilter(value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    subcategoryFilter === value
                      ? 'bg-slate-700 text-white ring-1 ring-primary-500/40'
                      : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {SUBCATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
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
