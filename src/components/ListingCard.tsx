import { Link, useNavigate } from 'react-router-dom'
import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, type Category } from '@/lib/constants'
import { HeartFilledIcon, HeartIcon } from '@/components/Icons'
import { useAuth } from '@/context/AuthContext'
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
  const categoryLabel =
    CATEGORY_LABELS[listing.category as Category] || listing.category
  const priceLabel =
    listing.price === 0 ? 'Free' : `$${(listing.price / 100).toFixed(2)}`
  const { user } = useAuth()
  const navigate = useNavigate()
  const favorited = Boolean(isFavorited)

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

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="block rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition hover:border-slate-600 hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" />
        <button
          type="button"
          onClick={toggleFavorite}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white"
          title={favorited ? 'Unfavorite' : 'Favorite'}
          aria-label={favorited ? 'Unfavorite' : 'Favorite'}
        >
          {favorited ? (
            <HeartFilledIcon className="h-5 w-5 text-rose-400" />
          ) : (
            <HeartIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-700">
        {listing.thumbnail_url ? (
          <img
            src={listing.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            No image
          </div>
        )}
      </div>
      <h3 className="mt-4 font-medium text-white">{listing.title}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {categoryLabel} · {priceLabel}
      </p>
      {listing.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
          {listing.description}
        </p>
      )}
    </Link>
  )
}
