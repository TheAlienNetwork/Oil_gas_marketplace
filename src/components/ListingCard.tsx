import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Listing } from '@/lib/types'
import {
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  coerceCategory,
  coerceSubcategory,
} from '@/lib/constants'
import { HeartFilledIcon, HeartIcon } from '@/components/Icons'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { supabase } from '@/lib/supabase'

interface ListingCardProps {
  listing: Listing
  isFavorited?: boolean
  onFavoriteChange?: (listingId: string, favorited: boolean) => void
}

export default function ListingCard({
  listing,
  isFavorited,
  onFavoriteChange,
}: ListingCardProps) {
  const categoryLabel = CATEGORY_LABELS[coerceCategory(listing.category)]
  const subKey = coerceSubcategory(listing.subcategory ?? undefined)
  const subBadge = subKey !== 'general' ? SUBCATEGORY_LABELS[subKey] : null
  const isSubscription = Boolean(
    (listing as Listing & { is_subscription?: boolean }).is_subscription
  )
  const priceLabel =
    isSubscription &&
    (listing as Listing & { price_per_month_cents?: number | null }).price_per_month_cents != null
      ? `$${(
          ((listing as Listing & { price_per_month_cents?: number }).price_per_month_cents ?? 0) /
          100
        ).toFixed(2)}/mo`
      : listing.price === 0
        ? 'Free'
        : `$${(listing.price / 100).toFixed(2)}`
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addLineFromListing } = useCart()
  const [cartFlash, setCartFlash] = useState<string | null>(null)
  const favorited = Boolean(isFavorited)
  const seller = listing.profiles

  const canAddToCart = listing.price > 0 && !isSubscription
  const isOwnListing = Boolean(user?.id && user.id === listing.seller_id)

  useEffect(() => {
    if (!cartFlash) return
    const t = window.setTimeout(() => setCartFlash(null), 2800)
    return () => window.clearTimeout(t)
  }, [cartFlash])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) {
      navigate('/sign-in')
      return
    }
    if (favorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listing.id)
      if (!error) onFavoriteChange?.(listing.id, false)
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listing.id })
      if (!error) onFavoriteChange?.(listing.id, true)
    }
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCartFlash(null)
    if (!user?.id) {
      navigate('/sign-in')
      return
    }
    const result = addLineFromListing(listing)
    if (!result.ok) {
      setCartFlash(result.reason)
      return
    }
    setCartFlash('Added to cart')
  }

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-slate-900/35 shadow-market ring-1 ring-white/[0.07] transition-all duration-300 hover:-translate-y-1 hover:shadow-market-lg hover:ring-primary-500/25"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        {listing.thumbnail_url ? (
          <img
            src={listing.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
            <span className="font-display text-3xl text-slate-700">◆</span>
            <span className="text-xs font-medium uppercase tracking-widest">Preview</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />
        <button
          type="button"
          onClick={toggleFavorite}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/50 text-slate-200 backdrop-blur-md ring-1 ring-white/15 transition hover:bg-slate-950/70 hover:text-white"
          title={favorited ? 'Remove from saved' : 'Save'}
          aria-label={favorited ? 'Remove from saved' : 'Save listing'}
        >
          {favorited ? (
            <HeartFilledIcon className="h-5 w-5 text-rose-400" />
          ) : (
            <HeartIcon className="h-5 w-5" />
          )}
        </button>
        <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-300 backdrop-blur-md ring-1 ring-white/10">
            {categoryLabel}
          </span>
          {subBadge && (
            <span className="rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200 backdrop-blur-md ring-1 ring-white/15">
              {subBadge}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-normal leading-snug tracking-tight text-white transition group-hover:text-primary-50">
          {listing.title}
        </h3>
        {listing.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {listing.description}
          </p>
        )}
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
          <div className="flex min-w-0 items-center gap-2">
            {seller?.avatar_url ? (
              <img
                src={seller.avatar_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-500 ring-1 ring-white/10">
                {(seller?.display_name || 'S').slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="truncate text-xs font-medium text-slate-500">
              {seller?.display_name || 'Seller'}
            </span>
          </div>
          <span className="shrink-0 text-lg font-semibold tabular-nums tracking-tight text-white">
            {priceLabel}
          </span>
        </div>
        {canAddToCart && !isOwnListing && (
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-4 w-full rounded-full border border-white/[0.12] bg-white/[0.06] py-2.5 text-xs font-semibold text-white ring-1 ring-white/[0.06] transition hover:bg-white/[0.1]"
          >
            Add to cart
          </button>
        )}
        {cartFlash && (
          <p
            className={`mt-2 text-center text-xs leading-snug ${
              cartFlash === 'Added to cart' ? 'text-emerald-400/95' : 'text-amber-200/90'
            }`}
            aria-live="polite"
          >
            {cartFlash}
          </p>
        )}
      </div>
    </Link>
  )
}
