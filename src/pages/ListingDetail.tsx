import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Listing } from '@/lib/types'
import { CATEGORY_LABELS, LISTING_TYPES, type Category } from '@/lib/constants'
import { HeartFilledIcon, HeartIcon, ThumbDownIcon, ThumbUpIcon } from '@/components/Icons'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutError, setCheckoutError] = useState('')
  const [isFavorited, setIsFavorited] = useState(false)
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [dislikeCount, setDislikeCount] = useState(0)
  const [reviews, setReviews] = useState<
    { id: string; user_id: string; rating: number; body: string | null; created_at: string; profiles?: { display_name: string | null } }[]
  >([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [messageError, setMessageError] = useState('')

  useEffect(() => {
    if (!id) return
    supabase
      .from('listings')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('id', id)
      .eq('is_published', true)
      .single()
      .then(({ data, error }) => {
        if (!error) setListing(data as Listing)
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!id) return
    // reaction counts (public)
    Promise.all([
      supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', id)
        .eq('reaction', 'like'),
      supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', id)
        .eq('reaction', 'dislike'),
    ]).then(([likes, dislikes]) => {
      setLikeCount(likes.count ?? 0)
      setDislikeCount(dislikes.count ?? 0)
    })

    // reviews (public)
    supabase
      .from('reviews')
      .select('id, user_id, rating, body, created_at, profiles(display_name)')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setReviews((data as typeof reviews) ?? []))
  }, [id])

  useEffect(() => {
    if (!user?.id || !id) return
    // favorite + my reaction
    supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(Boolean(data)))
    supabase
      .from('reactions')
      .select('reaction')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle()
      .then(({ data }) => setReaction((data?.reaction as 'like' | 'dislike' | undefined) ?? null))
  }, [user?.id, id])

  const handleGetFree = async () => {
    if (!user || !listing || listing.price !== 0) return
    const { data: purchase } = await supabase
      .from('purchases')
      .insert({
        buyer_id: user.id,
        listing_id: listing.id,
        amount_paid_cents: 0,
        platform_fee_cents: 0,
        seller_payout_cents: 0,
        status: 'completed',
      })
      .select('id')
      .single()
    if (purchase) {
      await supabase.from('purchase_grants').insert({
        purchase_id: purchase.id,
        listing_id: listing.id,
        user_id: user.id,
        download_path: listing.file_storage_path,
        app_access_path: listing.app_bundle_path,
      })
      navigate('/purchases')
    }
  }

  const toggleFavorite = async () => {
    if (!user?.id || !id) {
      navigate('/sign-in')
      return
    }
    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', id)
      if (!error) setIsFavorited(false)
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: id })
      if (!error) setIsFavorited(true)
    }
  }

  const setMyReaction = async (next: 'like' | 'dislike') => {
    if (!user?.id || !id) {
      navigate('/sign-in')
      return
    }
    // toggle off if same
    if (reaction === next) {
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', id)
      if (!error) setReaction(null)
    } else {
      const { error } = await supabase.from('reactions').upsert({
        user_id: user.id,
        listing_id: id,
        reaction: next,
      })
      if (!error) setReaction(next)
    }
    // refresh counts
    const [likes, dislikes] = await Promise.all([
      supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', id)
        .eq('reaction', 'like'),
      supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', id)
        .eq('reaction', 'dislike'),
    ])
    setLikeCount(likes.count ?? likeCount)
    setDislikeCount(dislikes.count ?? dislikeCount)
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !id) {
      navigate('/sign-in')
      return
    }
    setReviewError('')
    const { error } = await supabase.from('reviews').insert({
      listing_id: id,
      user_id: user.id,
      rating: reviewRating,
      body: reviewBody.trim() || null,
    })
    if (error) {
      setReviewError(error.message)
      return
    }
    setReviewBody('')
    const { data } = await supabase
      .from('reviews')
      .select('id, user_id, rating, body, created_at, profiles(display_name)')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
    setReviews((data as typeof reviews) ?? [])
  }

  const handleMessageSeller = async () => {
    setMessageError('')
    if (!user?.id || !listing) {
      navigate('/sign-in')
      return
    }
    if (user.id === listing.seller_id) {
      setMessageError('You are the seller of this listing.')
      return
    }
    try {
      const { data: existing, error: findErr } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .eq('seller_id', listing.seller_id)
        .maybeSingle()
      if (findErr) throw findErr
      if (existing?.id) {
        navigate(`/messages/${existing.id}`)
        return
      }
      const { data: created, error: createErr } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      navigate(`/messages/${created.id}`)
    } catch (e: unknown) {
      setMessageError(e instanceof Error ? e.message : 'Failed to start conversation')
    }
  }

  const handleBuy = async () => {
    if (!user) {
      navigate('/sign-in')
      return
    }
    if (listing?.price === 0) {
      handleGetFree()
      return
    }
    if (!listing) return
    setCheckoutError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { listingId: listing.id },
      })
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setCheckoutError('Checkout could not be started. Connect Stripe in Seller Dashboard or try again.')
    } catch {
      setCheckoutError('Checkout failed. Ensure Stripe is configured and the seller has connected their account.')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">
        Loading...
      </div>
    )
  }
  if (!listing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">
        Listing not found.
      </div>
    )
  }

  const categoryLabel =
    CATEGORY_LABELS[listing.category as Category] || listing.category
  const isSub = (listing as Listing & { is_subscription?: boolean }).is_subscription
  const pricePerMonth = (listing as Listing & { price_per_month_cents?: number | null }).price_per_month_cents
  const priceLabel = isSub && pricePerMonth != null
    ? `$${(pricePerMonth / 100).toFixed(2)}/mo`
    : listing.price === 0
      ? 'Free'
      : `$${(listing.price / 100).toFixed(2)}`

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl bg-slate-800">
            {listing.thumbnail_url ? (
              <img
                src={listing.thumbnail_url}
                alt=""
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-slate-500">
                No image
              </div>
            )}
          </div>
          {(listing as Listing & { demo_video_url?: string | null }).demo_video_url && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-400">How it works</p>
              <video
                src={(listing as Listing & { demo_video_url?: string | null }).demo_video_url!}
                controls
                className="w-full rounded-xl bg-black aspect-video"
              />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-primary-400">{categoryLabel}</p>
            {isSub && (
              <span className="rounded bg-primary-600/20 px-2 py-0.5 text-xs font-medium text-primary-400">
                Subscription
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">{listing.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleFavorite}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {isFavorited ? (
                <HeartFilledIcon className="h-5 w-5 text-rose-400" />
              ) : (
                <HeartIcon className="h-5 w-5" />
              )}
              Favorite
            </button>
            <button
              type="button"
              onClick={() => setMyReaction('like')}
              className={
                reaction === 'like'
                  ? 'inline-flex items-center gap-2 rounded-lg bg-emerald-700/30 px-3 py-2 text-sm text-emerald-200'
                  : 'inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800'
              }
            >
              <ThumbUpIcon className="h-5 w-5" /> {likeCount}
            </button>
            <button
              type="button"
              onClick={() => setMyReaction('dislike')}
              className={
                reaction === 'dislike'
                  ? 'inline-flex items-center gap-2 rounded-lg bg-red-700/30 px-3 py-2 text-sm text-red-200'
                  : 'inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800'
              }
            >
              <ThumbDownIcon className="h-5 w-5" /> {dislikeCount}
            </button>
            <button
              type="button"
              onClick={handleMessageSeller}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Message seller
            </button>
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{priceLabel}</p>
          {listing.description && (
            <p className="mt-4 text-slate-400">{listing.description}</p>
          )}
          {listing.profiles && (
            <p className="mt-4 text-sm text-slate-500">
              Sold by {listing.profiles.display_name || 'Seller'}
            </p>
          )}
          {listing.listing_type === LISTING_TYPES.desktop_app && (
            <p className="mt-4 text-xs text-slate-500">
              Desktop executable (.exe/.msi). You download and run it on your
              own machine at your responsibility.
            </p>
          )}
          {checkoutError && (
            <p className="mt-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {checkoutError}
            </p>
          )}
          {messageError && (
            <p className="mt-4 rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
              {messageError}
            </p>
          )}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleBuy}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-500 transition-colors"
            >
              {listing.price === 0 ? 'Get for free' : `Buy for ${priceLabel}`}
            </button>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">Reviews</h2>
        {reviewError && (
          <div className="mt-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {reviewError}
          </div>
        )}
        <form onSubmit={handleSubmitReview} className="mt-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm text-slate-300">
              Rating
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="ml-2 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-500">
              One review per listing (you can edit later in DB).
            </span>
          </div>
          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            rows={3}
            placeholder="Write a review (optional)…"
            className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <div className="mt-3">
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            >
              Submit review
            </button>
          </div>
        </form>

        {reviews.length === 0 ? (
          <p className="mt-6 text-slate-500">No reviews yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-300">
                    {r.profiles?.display_name || 'User'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {r.rating}/5 · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                {r.body && <p className="mt-2 text-sm text-slate-200">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
