import { Link, useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { requestCreateCheckout, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import type { Listing } from '@/lib/types'
import {
  CATEGORY_LABELS,
  LISTING_TYPES,
  PLATFORM_FEE_PERCENT,
  SUBCATEGORY_LABELS,
  coerceCategory,
  coerceSubcategory,
} from '@/lib/constants'
import { listingGalleryFromLegacy } from '@/lib/listingGallery'
import { HeartFilledIcon, HeartIcon, ThumbDownIcon, ThumbUpIcon } from '@/components/Icons'
import { setPendingCartClear } from '@/lib/stripeCheckoutStorage'
import { isStripePublishableKeyConfigured } from '@/lib/stripePublishableKey'
import StripeEmbeddedCheckoutModal from '@/components/StripeEmbeddedCheckoutModal'
import ListingDeliverablePreview from '@/components/ListingDeliverablePreview'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addLineFromListing } = useCart()
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
  const [cartMessage, setCartMessage] = useState('')
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null)
  const [checkoutStarting, setCheckoutStarting] = useState(false)
  const [freeAdding, setFreeAdding] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [alreadyInLibrary, setAlreadyInLibrary] = useState(false)

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
    setGalleryIndex(0)
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
      .then(({ data }) => setReviews(((data ?? []) as unknown) as { id: string; user_id: string; rating: number; body: string | null; created_at: string; profiles?: { display_name: string | null } }[]))
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

  useEffect(() => {
    if (!user?.id || !id) {
      setAlreadyInLibrary(false)
      return
    }
    supabase
      .from('purchase_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle()
      .then(({ data }) => setAlreadyInLibrary(Boolean(data)))
  }, [user?.id, id])

  const handleGetFree = async () => {
    if (!user || !listing || listing.price !== 0) return
    setFreeAdding(true)
    try {
      const { data: existingGrant } = await supabase
        .from('purchase_grants')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listing.id)
        .maybeSingle()
      if (existingGrant) {
        setAlreadyInLibrary(true)
        navigate('/purchases')
        return
      }
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
        const { error: grantErr } = await supabase.from('purchase_grants').insert({
          purchase_id: purchase.id,
          listing_id: listing.id,
          user_id: user.id,
          download_path: listing.file_storage_path,
          app_access_path: listing.app_bundle_path,
        })
        if (grantErr?.code === '23505') {
          setAlreadyInLibrary(true)
        }
        navigate('/purchases')
      }
    } finally {
      setFreeAdding(false)
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
    setReviews(((data ?? []) as unknown) as { id: string; user_id: string; rating: number; body: string | null; created_at: string; profiles?: { display_name: string | null } }[])
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

  const handleAddToCart = () => {
    setCartMessage('')
    if (!user) {
      navigate('/sign-in')
      return
    }
    if (!listing) return
    if (user.id === listing.seller_id) {
      setCartMessage('You cannot add your own listing to the cart.')
      return
    }
    const result = addLineFromListing(listing)
    if (!result.ok) {
      setCartMessage(result.reason)
      return
    }
    setCartMessage('Added to cart. Open the cart icon to review or checkout.')
  }

  const handleBuy = async () => {
    if (!user) {
      navigate('/sign-in')
      return
    }
    if (listing?.price === 0) {
      await handleGetFree()
      return
    }
    if (!listing) return
    if (user.id === listing.seller_id) {
      setCheckoutError('You cannot purchase your own listing.')
      return
    }
    if (!isStripePublishableKeyConfigured()) {
      setCheckoutError(
        'Embedded checkout needs VITE_STRIPE_PUBLISHABLE_KEY in .env (Stripe Dashboard → Developers → API keys → Publishable key, same test/live mode as your secret key).'
      )
      return
    }
    setCheckoutError('')
    setCheckoutStarting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setCheckoutError('Please sign in and try again.')
        return
      }
      let token = session.access_token
      try {
        const { data: ref } = await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        })
        if (ref.session?.access_token) token = ref.session.access_token
      } catch {
        /* use existing */
      }
      setPendingCartClear([listing.id])
      const { url, clientSecret, error } = await requestCreateCheckout(token, { listingId: listing.id })
      if (error) {
        setCheckoutError(error)
        return
      }
      if (clientSecret) {
        setCheckoutClientSecret(clientSecret)
        return
      }
      if (url) {
        window.location.href = url
        return
      }
      setCheckoutError('No checkout session returned.')
    } finally {
      setCheckoutStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-center px-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-500/25 border-t-primary-500" />
        <p className="mt-4 text-sm font-medium text-slate-500">Loading listing…</p>
      </div>
    )
  }
  if (!listing) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-24 text-center">
        <p className="font-display text-2xl text-slate-400">This listing is unavailable.</p>
        <Link
          to="/marketplace"
          className="mt-6 inline-flex rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-primary-400 transition hover:border-primary-500/40 hover:text-primary-300"
        >
          ← Back to marketplace
        </Link>
      </div>
    )
  }

  const categoryLabel = CATEGORY_LABELS[coerceCategory(listing.category)]
  const subcategoryKey = coerceSubcategory(listing.subcategory ?? undefined)
  const subcategoryLabel =
    subcategoryKey !== 'general' ? SUBCATEGORY_LABELS[subcategoryKey] : null
  const isSub = (listing as Listing & { is_subscription?: boolean }).is_subscription
  const pricePerMonth = (listing as Listing & { price_per_month_cents?: number | null }).price_per_month_cents
  const priceLabel = isSub && pricePerMonth != null
    ? `$${(pricePerMonth / 100).toFixed(2)}/mo`
    : listing.price === 0
      ? 'Free'
      : `$${(listing.price / 100).toFixed(2)}`

  const chip =
    'inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white'

  const gallery = listing ? listingGalleryFromLegacy(listing) : []
  const activeMedia = gallery[galleryIndex]

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <Link to="/marketplace" className="transition hover:text-primary-400">
          Marketplace
        </Link>
        <span aria-hidden className="text-slate-700">
          /
        </span>
        <span className="text-slate-400">
          {categoryLabel}
          {subcategoryLabel ? (
            <>
              {' '}
              · <span className="text-primary-400/90">{subcategoryLabel}</span>
            </>
          ) : null}
        </span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-12 lg:items-start">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/[0.07] shadow-market">
            {gallery.length === 0 ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-600">
                <span className="font-display text-4xl text-slate-700">◆</span>
                <span className="text-xs uppercase tracking-widest">No preview yet</span>
              </div>
            ) : (
              <>
                <div className="aspect-video w-full bg-black">
                  {activeMedia?.kind === 'video' ? (
                    <video
                      key={activeMedia.url}
                      src={activeMedia.url}
                      controls
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <img src={activeMedia?.url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-white/[0.06] bg-slate-950 p-3">
                    {gallery.map((item, i) => (
                      <button
                        key={`${item.url}-${i}`}
                        type="button"
                        onClick={() => setGalleryIndex(i)}
                        className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                          i === galleryIndex ? 'ring-primary-500' : 'ring-white/10 hover:ring-white/25'
                        }`}
                      >
                        {item.kind === 'video' ? (
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                        )}
                        {item.kind === 'video' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[10px] font-bold text-white">
                            ▶
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <ListingDeliverablePreview listing={listing} />
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/35 p-6 shadow-market-lg backdrop-blur-sm ring-1 ring-white/[0.04] sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-300">
                {categoryLabel}
              </span>
              {subcategoryLabel && (
                <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-200">
                  {subcategoryLabel}
                </span>
              )}
              {isSub && (
                <span className="rounded-full border border-primary-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-400">
                  Subscription
                </span>
              )}
            </div>
            <h1 className="mt-4 font-display text-3xl font-normal leading-tight tracking-tight text-white sm:text-[2rem]">
              {listing.title}
            </h1>
            <p className="mt-5 font-display text-4xl font-normal tabular-nums text-white">{priceLabel}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={toggleFavorite} className={chip}>
                {isFavorited ? (
                  <HeartFilledIcon className="h-4 w-4 text-rose-400" />
                ) : (
                  <HeartIcon className="h-4 w-4" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => setMyReaction('like')}
                className={
                  reaction === 'like'
                    ? `${chip} border-emerald-500/30 bg-emerald-500/10 text-emerald-200`
                    : chip
                }
              >
                <ThumbUpIcon className="h-4 w-4" /> {likeCount}
              </button>
              <button
                type="button"
                onClick={() => setMyReaction('dislike')}
                className={
                  reaction === 'dislike'
                    ? `${chip} border-red-500/30 bg-red-500/10 text-red-200`
                    : chip
                }
              >
                <ThumbDownIcon className="h-4 w-4" /> {dislikeCount}
              </button>
              <button type="button" onClick={handleMessageSeller} className={chip}>
                Message seller
              </button>
            </div>

            {listing.description && (
              <p className="mt-6 border-t border-white/[0.06] pt-6 text-sm leading-relaxed text-slate-400">
                {listing.description}
              </p>
            )}

            {listing.profiles && (
              <div className="mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-6">
                {listing.profiles.avatar_url ? (
                  <img
                    src={listing.profiles.avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-400 ring-1 ring-white/10">
                    {(listing.profiles.display_name || 'S').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seller</p>
                  <p className="text-sm font-medium text-white">
                    {listing.profiles.display_name || 'Independent seller'}
                  </p>
                </div>
              </div>
            )}

            {listing.listing_type === LISTING_TYPES.desktop_app && (
              <p className="mt-4 rounded-xl bg-slate-950/50 px-3 py-2 text-xs leading-relaxed text-slate-500 ring-1 ring-white/[0.05]">
                Desktop executable (.exe/.msi). Download and run on your machine at your own risk.
              </p>
            )}

            {cartMessage && (
              <p className="mt-4 rounded-xl bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-500/20">
                {cartMessage}
              </p>
            )}
            {checkoutError && (
              <p className="mt-4 rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
                {checkoutError}
              </p>
            )}
            {messageError && (
              <p className="mt-4 rounded-xl bg-amber-950/30 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/20">
                {messageError}
              </p>
            )}

            <div className="mt-8 space-y-3">
              {listing.price === 0 ? (
                alreadyInLibrary ? (
                  <Link
                    to="/purchases"
                    className="flex w-full items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] py-3.5 text-sm font-semibold text-white ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]"
                  >
                    View in library
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={checkoutStarting || freeAdding}
                    className="w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
                  >
                    {freeAdding ? 'Adding…' : 'Add to library — free'}
                  </button>
                )
              ) : isSub ? (
                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={checkoutStarting}
                  className="w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
                >
                  {checkoutStarting ? 'Opening checkout…' : `Subscribe — ${priceLabel}`}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={checkoutStarting}
                    className="w-full rounded-full bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
                  >
                    {checkoutStarting ? 'Opening checkout…' : `Buy now — ${priceLabel}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="w-full rounded-full border border-white/[0.12] bg-white/[0.04] py-3 text-sm font-semibold text-white ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]"
                  >
                    Add to cart
                  </button>
                </>
              )}
              {listing.price > 0 && (
                <p className="text-center text-[11px] leading-relaxed text-slate-500">
                  Secure Stripe Checkout. Platform fee {PLATFORM_FEE_PERCENT}% · remainder to seller (after
                  Stripe processing fees). Use the cart to combine items from the same seller into one payment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-16 border-t border-white/[0.06] pt-16">
        <h2 className="font-display text-2xl font-normal text-white">Reviews</h2>
        <p className="mt-1 text-sm text-slate-600">Feedback from verified purchasers and visitors.</p>
        {reviewError && (
          <div className="mt-4 rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
            {reviewError}
          </div>
        )}
        <form
          onSubmit={handleSubmitReview}
          className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-900/25 p-6 ring-1 ring-white/[0.04]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm text-slate-400">
              Rating
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="ml-2 rounded-lg border border-white/[0.1] bg-slate-950/50 px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/30"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-600">One review per listing.</span>
          </div>
          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            rows={3}
            placeholder="Share your experience…"
            className="mt-4 w-full rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-primary-500/25"
          />
          <div className="mt-4">
            <button
              type="submit"
              className="rounded-full bg-white/[0.08] px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.12]"
            >
              Submit review
            </button>
          </div>
        </form>

        {reviews.length === 0 ? (
          <p className="mt-8 text-sm text-slate-600">No reviews yet — be the first.</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-white/[0.06] bg-slate-900/20 p-5 ring-1 ring-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200">
                    {r.profiles?.display_name || 'User'}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {r.rating}/5 · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                {r.body && <p className="mt-3 text-sm leading-relaxed text-slate-400">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <StripeEmbeddedCheckoutModal
        clientSecret={checkoutClientSecret}
        onClose={() => setCheckoutClientSecret(null)}
      />
    </div>
  )
}
