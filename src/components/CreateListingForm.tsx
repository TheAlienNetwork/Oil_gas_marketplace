import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Listing } from '@/lib/types'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PLATFORM_FEE_PERCENT,
  STORAGE_BUCKETS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  coerceCategory,
  coerceSubcategory,
  type Category,
  type ListingType,
  type Subcategory,
} from '@/lib/constants'
import {
  listingGalleryFromLegacy,
  type ListingGalleryItem,
} from '@/lib/listingGallery'
import {
  displayProductFilename,
  inferCategoryFromProductFilename,
  productDeliverableBadge,
} from '@/lib/productFileMeta'

interface CreateListingFormProps {
  onClose: () => void
  onSuccess: () => void
  /** When set, form updates this listing instead of creating a new one. */
  initialListing?: Listing | null
}

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  file: 'File (Excel, PDF, ZIP, etc.)',
  web_app: 'Web app (hosted bundle)',
  desktop_app: 'Desktop app (.exe / .msi)',
}

const inputClass =
  'mt-2 w-full rounded-xl border border-white/[0.08] bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-slate-600 focus:border-primary-500/35 focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'
const deliverableBadgeClass =
  'inline-flex shrink-0 items-center rounded-full border border-primary-500/30 bg-primary-500/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-200/95'

type GalleryDraftItem =
  | { key: string; kind: 'image' | 'video'; source: 'existing'; url: string }
  | { key: string; kind: 'image' | 'video'; source: 'new'; file: File; previewUrl: string }

const GALLERY_IMAGE_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
])
const GALLERY_VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'])

function inferGalleryKind(file: File): 'image' | 'video' | null {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('image/')) return 'image'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'heic' || ext === 'heif') return 'image'
  if (GALLERY_VIDEO_EXT.has(ext)) return 'video'
  if (GALLERY_IMAGE_EXT.has(ext)) return 'image'
  if (t === 'application/octet-stream' && ext) {
    if (GALLERY_VIDEO_EXT.has(ext)) return 'video'
    if (GALLERY_IMAGE_EXT.has(ext)) return 'image'
  }
  return null
}

function draftItemsFromListing(listing: Listing): GalleryDraftItem[] {
  return listingGalleryFromLegacy(listing).map((item, i) => ({
    key: `${listing.id}-g-${i}-${item.url.slice(-20)}`,
    kind: item.kind,
    source: 'existing',
    url: item.url,
  }))
}

function FileDrop({
  id,
  label,
  hint,
  accept,
  file,
  onFile,
  previewUrl,
  existingSavedName,
  listingType,
}: {
  id: string
  label: string
  hint: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
  /** Optional image preview so the control keeps a stable visual anchor after pick. */
  previewUrl?: string | null
  /** Shown when editing and no new file is chosen (saved deliverable name). */
  existingSavedName?: string | null
  listingType: ListingType
}) {
  const displayName = file
    ? file.name
    : existingSavedName
      ? `Saved: ${existingSavedName}`
      : 'Click or drop a file'

  const typeBadge = file
    ? productDeliverableBadge({
        listingType,
        filenameForExt: file.name,
        mimeType: file.type,
      })
    : existingSavedName
      ? productDeliverableBadge({ listingType, filenameForExt: existingSavedName })
      : null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={labelClass}>{label}</div>
        {typeBadge ? <span className={deliverableBadgeClass}>{typeBadge}</span> : null}
      </div>
      <label className="relative mt-2 block cursor-pointer rounded-xl border border-dashed border-white/[0.12] bg-slate-950/40 transition hover:border-primary-500/35 hover:bg-slate-950/55">
        <div className="pointer-events-none flex min-h-[148px] flex-col items-center justify-center px-4 py-6 text-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="mb-3 h-20 w-full max-w-[200px] rounded-lg object-cover ring-1 ring-white/10"
            />
          ) : null}
          <span className="line-clamp-2 break-all text-sm font-medium text-slate-300">{displayName}</span>
          <span className="mt-1 line-clamp-2 text-xs text-slate-600">{hint}</span>
        </div>
        <input
          id={id}
          type="file"
          accept={accept}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

export default function CreateListingForm({
  onClose,
  onSuccess,
  initialListing,
}: CreateListingFormProps) {
  const { user } = useAuth()
  const isEdit = Boolean(initialListing?.id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [listingType, setListingType] = useState<ListingType>('file')
  const [category, setCategory] = useState<Category>('desktop_apps')
  const [subcategory, setSubcategory] = useState<Subcategory>('general')
  const [priceDollars, setPriceDollars] = useState('')
  const [galleryDraft, setGalleryDraft] = useState<GalleryDraftItem[]>([])
  const [productFile, setProductFile] = useState<File | null>(null)
  const [isSubscription, setIsSubscription] = useState(false)
  const [pricePerMonthDollars, setPricePerMonthDollars] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalScrollRef = useRef<HTMLDivElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  /** Latest listing from props — read inside effects keyed only by id so reference churn does not re-run hydration. */
  const initialListingRef = useRef(initialListing)
  initialListingRef.current = initialListing

  const listingId = initialListing?.id ?? null
  /** Avoid re-hydrating when parent passes a new object for the same listing (prevents wiping gallery edits). */
  const hydratedListingIdRef = useRef<string | null>(null)

  const withPreservedModalScroll = (update: () => void) => {
    const el = modalScrollRef.current
    const y = el?.scrollTop ?? 0
    update()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (modalScrollRef.current) modalScrollRef.current.scrollTop = y
      })
    })
  }

  useEffect(() => {
    if (!listingId) {
      hydratedListingIdRef.current = null
      setTitle('')
      setDescription('')
      setListingType('file')
      setCategory('desktop_apps')
      setSubcategory('general')
      setPriceDollars('')
      setGalleryDraft([])
      setProductFile(null)
      setIsSubscription(false)
      setPricePerMonthDollars('')
      setIsPublished(true)
      return
    }
    if (hydratedListingIdRef.current === listingId) {
      return
    }
    const listing = initialListingRef.current
    if (!listing || listing.id !== listingId) {
      return
    }
    hydratedListingIdRef.current = listingId
    setTitle(listing.title)
    setDescription(listing.description ?? '')
    setListingType(listing.listing_type as ListingType)
    setCategory(coerceCategory(listing.category))
    setSubcategory(coerceSubcategory(listing.subcategory ?? undefined))
    setPriceDollars(
      !listing.is_subscription && listing.price > 0 ? (listing.price / 100).toFixed(2) : ''
    )
    setIsSubscription(Boolean(listing.is_subscription))
    setPricePerMonthDollars(
      listing.price_per_month_cents != null && listing.price_per_month_cents > 0
        ? (listing.price_per_month_cents / 100).toFixed(2)
        : ''
    )
    setIsPublished(listing.is_published)
    setGalleryDraft(draftItemsFromListing(listing))
    setProductFile(null)
  }, [listingId])

  const addGalleryFiles = (files: FileList | null) => {
    if (!files?.length) return
    const fileList = Array.from(files)
    const additions = fileList.flatMap((file) => {
      const kind = inferGalleryKind(file)
      if (!kind) return []
      return [{ file, kind }] as const
    })
    if (additions.length > 0) {
      setError('')
    } else if (fileList.length > 0) {
      setError(
        'Could not use those files for the gallery. Add images (e.g. JPG, PNG, WEBP) or videos (e.g. MP4, WEBM).'
      )
      return
    }
    if (additions.length === 0) return
    withPreservedModalScroll(() => {
      setGalleryDraft((prev) => {
        const next = [...prev]
        for (const { file, kind } of additions) {
          const previewUrl = URL.createObjectURL(file)
          next.push({
            key: crypto.randomUUID(),
            kind,
            source: 'new',
            file,
            previewUrl,
          })
        }
        return next
      })
    })
  }

  const removeGalleryItem = (key: string) => {
    withPreservedModalScroll(() => {
      setGalleryDraft((prev) => {
        const item = prev.find((x) => x.key === key)
        if (item?.source === 'new' && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl)
        }
        return prev.filter((x) => x.key !== key)
      })
    })
  }

  const moveGalleryItem = (index: number, delta: -1 | 1) => {
    withPreservedModalScroll(() => {
      setGalleryDraft((prev) => {
        const j = index + delta
        if (j < 0 || j >= prev.length) return prev
        const next = [...prev]
        const t = next[index]!
        next[index] = next[j]!
        next[j] = t
        return next
      })
    })
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setError('')
    setLoading(true)

    try {
      const rawPrice = priceDollars.trim()
      const parsedPrice =
        isSubscription ? 0 : rawPrice === '' ? 0 : Number.parseFloat(rawPrice)
      const priceCents =
        !isSubscription && Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) : 0
      if (!isSubscription && !(Number.isFinite(parsedPrice) && parsedPrice >= 0)) {
        setError('Enter a valid price in USD (0 for free).')
        setLoading(false)
        return
      }

      const rawSub = pricePerMonthDollars.trim()
      const subDollars = rawSub === '' ? 0 : Number.parseFloat(rawSub)
      const pricePerMonthCents =
        isSubscription && Number.isFinite(subDollars) ? Math.round(subDollars * 100) : 0

      const paidOneTime = !isSubscription && priceCents > 0
      const paidSubscription = isSubscription && pricePerMonthCents > 0
      const hasExistingDeliverable = Boolean(
        initialListing?.file_storage_path || initialListing?.app_bundle_path
      )
      if ((paidOneTime || paidSubscription) && !productFile && !hasExistingDeliverable) {
        setError('Paid listings need a product file so buyers receive something after purchase.')
        setLoading(false)
        return
      }

      const listingId = initialListing?.id ?? crypto.randomUUID()

      let fileStoragePath: string | null = initialListing?.file_storage_path ?? null
      let appBundlePath: string | null = initialListing?.app_bundle_path ?? null

      const galleryMedia: ListingGalleryItem[] = []
      for (let i = 0; i < galleryDraft.length; i++) {
        const item = galleryDraft[i]!
        if (item.source === 'existing') {
          galleryMedia.push({ url: item.url, kind: item.kind })
          continue
        }
        const safeExt =
          item.file.name
            .split('.')
            .pop()
            ?.replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 8) || (item.kind === 'video' ? 'mp4' : 'jpg')
        const path = `${user.id}/${listingId}/gallery/${i}_${Date.now()}.${safeExt}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKETS.listingAssets)
          .upload(path, item.file, { upsert: true })
        if (upErr) throw new Error(upErr.message)
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.listingAssets).getPublicUrl(path)
        galleryMedia.push({ url: urlData.publicUrl, kind: item.kind })
      }

      const hasGalleryImage = galleryMedia.some((g) => g.kind === 'image')
      const firstImageUrl = galleryMedia.find((g) => g.kind === 'image')?.url ?? null
      const thumbnailUrl =
        firstImageUrl ??
        (isEdit &&
        galleryMedia.length > 0 &&
        !hasGalleryImage &&
        initialListing?.thumbnail_url
          ? initialListing.thumbnail_url
          : null)
      const demoVideoUrl = galleryMedia.find((g) => g.kind === 'video')?.url ?? null

      if (productFile) {
        const path = `${user.id}/${listingId}/${productFile.name}`
        const bucket =
          listingType === 'web_app' ? STORAGE_BUCKETS.listingApps : STORAGE_BUCKETS.listingFiles
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, productFile, { upsert: true })
        if (upErr) throw new Error(upErr.message)
        if (listingType === 'web_app') {
          appBundlePath = path
          fileStoragePath = null
        } else {
          fileStoragePath = path
          appBundlePath = null
        }
      }

      const editingSnapshot = initialListingRef.current
      const slugForRow =
        editingSnapshot?.id && editingSnapshot.slug?.trim()
          ? editingSnapshot.slug
          : slug || listingId

      const row = {
        title,
        slug: slugForRow,
        description: description || null,
        listing_type: listingType,
        price: isSubscription ? 0 : Math.max(0, priceCents),
        category,
        subcategory,
        thumbnail_url: thumbnailUrl,
        gallery_media: galleryMedia,
        file_storage_path: fileStoragePath,
        app_bundle_path: appBundlePath,
        product_original_filename: productFile
          ? productFile.name
          : initialListingRef.current?.product_original_filename ?? null,
        demo_video_url: demoVideoUrl,
        is_subscription: isSubscription,
        price_per_month_cents: isSubscription ? pricePerMonthCents : null,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      }

      const persistListing = async (payload: typeof row) => {
        if (editingSnapshot?.id) {
          const { data, error: upErr } = await supabase
            .from('listings')
            .update(payload)
            .eq('id', editingSnapshot.id)
            .eq('seller_id', user.id)
            .select('id')
          if (upErr) return upErr
          if (!data?.length) {
            return {
              message:
                'Nothing was saved — the listing was not updated. Refresh the dashboard or sign in again, then retry.',
            }
          }
          return null
        }
        const { data, error: insertErr } = await supabase
          .from('listings')
          .insert({
            id: listingId,
            seller_id: user.id,
            ...payload,
          })
          .select('id')
        if (insertErr) return insertErr
        if (!data?.length) {
          return { message: 'Listing was not created. Check your connection and try again.' }
        }
        return null
      }

      let err = await persistListing(row)
      if (
        err &&
        typeof err.message === 'string' &&
        err.message.includes('product_original_filename')
      ) {
        const { product_original_filename: _drop, ...withoutFilename } = row
        err = await persistListing(withoutFilename as typeof row)
      }
      if (err) {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Could not save listing.'
        throw new Error(msg)
      }

      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const allowedProductExtensions =
    listingType === 'desktop_app'
      ? '.exe, .msi'
      : listingType === 'web_app'
        ? '.zip or web bundle'
        : 'Any (e.g. .xlsx, .pdf)'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-950/85 backdrop-blur-md">
      <div className="flex min-h-full items-start justify-center px-3 py-10 sm:items-center sm:px-6 sm:py-10">
        <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-b from-slate-900/98 to-slate-950 shadow-market-lg ring-1 ring-white/[0.06] sm:max-h-[92vh]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />
          <div
            ref={modalScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 sm:p-8 scroll-py-4"
          >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary-400/90">
                {isEdit ? 'Edit product' : 'New product'}
              </p>
              <h2 className="mt-1 font-display text-2xl font-normal tracking-tight text-white sm:text-3xl">
                {isEdit ? 'Update listing' : 'Create listing'}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Clear titles and accurate files build trust. Buyers get instant delivery after checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {error && (
              <div className="rounded-xl bg-red-950/45 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/25">
                {error}
              </div>
            )}

            <section>
              <h3 className="font-display text-lg text-white">Basics</h3>
              <p className="mt-1 text-xs text-slate-600">How your listing appears in search and on the product page.</p>
              <div className="mt-5 space-y-5">
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Directional survey QC workbook"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="What it does, file format, version requirements…"
                    className={`${inputClass} resize-y min-h-[100px]`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Product type</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as ListingType)}
                    className={inputClass}
                  >
                    {(Object.entries(LISTING_TYPE_LABELS) as [ListingType, string][]).map(([value, lab]) => (
                      <option key={value} value={value}>
                        {lab}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Format category</label>
                    <p className="mb-1.5 text-[10px] text-slate-600">What kind of file or app (for marketplace filters).</p>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className={inputClass}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Discipline / topic</label>
                    <p className="mb-1.5 text-[10px] text-slate-600">e.g. MWD, DD — helps buyers filter by domain.</p>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value as Subcategory)}
                      className={inputClass}
                    >
                      {SUBCATEGORIES.map((s) => (
                        <option key={s} value={s}>
                          {SUBCATEGORY_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-950/30 px-4 py-3 ring-1 ring-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500/30"
                  />
                  <span className="text-sm text-slate-300">Published on marketplace</span>
                </label>
              </div>
            </section>

            <section className="border-t border-white/[0.06] pt-8">
              <h3 className="font-display text-lg text-white">Pricing</h3>
              <p className="mt-1 text-xs text-slate-600">
                On paid sales, the platform keeps {PLATFORM_FEE_PERCENT}% (Stripe Connect application fee).
              </p>
              <div className="mt-5 space-y-5">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSubscription}
                    onChange={(e) => setIsSubscription(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-300">Monthly subscription</span>
                </label>
                {!isSubscription && (
                  <div>
                    <label className={labelClass}>Price (USD)</label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceDollars}
                        onChange={(e) => setPriceDollars(e.target.value)}
                        placeholder="0.00 = free"
                        className={`${inputClass} pl-8 tabular-nums`}
                      />
                    </div>
                  </div>
                )}
                {isSubscription && (
                  <div>
                    <label className={labelClass}>Monthly price (USD)</label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={pricePerMonthDollars}
                        onChange={(e) => setPricePerMonthDollars(e.target.value)}
                        placeholder="0.00"
                        className={`${inputClass} pl-8 tabular-nums`}
                      />
                    </div>
                    <p className="mt-2 text-xs text-amber-200/80">
                      Subscription billing via Stripe may require additional setup; one-time price is fully supported today.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="border-t border-white/[0.06] pt-8">
              <h3 className="font-display text-lg text-white">Media & deliverable</h3>
              <p className="mt-1 text-xs text-slate-600">
                Add multiple photos and short demo videos. Order matters: the first image is used as the listing
                thumbnail in search and cart. The product file below is what buyers receive after purchase.
              </p>
              <div className="relative mt-5 isolate">
                <div className={labelClass}>Photos & videos</div>
                <input
                  ref={galleryInputRef}
                  id="listing-gallery-input"
                  type="file"
                  accept="image/*,video/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    addGalleryFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-primary-500/35 hover:bg-slate-950/70 hover:text-white"
                >
                  + Add photos or videos
                </button>
                {galleryDraft.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {galleryDraft.map((item, idx) => (
                      <li
                        key={item.key}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-slate-950/45 p-3 ring-1 ring-white/[0.04]"
                      >
                        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-white/10">
                          {item.kind === 'video' ? (
                            <video
                              src={item.source === 'new' ? item.previewUrl : item.url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={item.source === 'new' ? item.previewUrl : item.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            {item.kind === 'video' ? 'Video' : 'Image'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 text-xs text-slate-500">
                          {item.source === 'new' ? item.file.name : item.url.split('/').pop() ?? 'Saved file'}
                          {idx === 0 && (
                            <span className="mt-1 block text-primary-400/95">First image → marketplace thumbnail</span>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveGalleryItem(idx, -1)}
                            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === galleryDraft.length - 1}
                            onClick={() => moveGalleryItem(idx, 1)}
                            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryItem(item.key)}
                            className="rounded-lg border border-red-500/25 px-2 py-1.5 text-xs text-red-300 hover:bg-red-950/50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {isEdit && initialListing ? (
                <div className="mt-6 rounded-xl border border-white/[0.08] bg-slate-950/40 px-4 py-3 ring-1 ring-white/[0.04]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={labelClass}>Current deliverable (buyers get this after purchase)</div>
                    {initialListing.file_storage_path || initialListing.app_bundle_path ? (
                      <span className={deliverableBadgeClass}>
                        {productDeliverableBadge({
                          listingType: initialListing.listing_type as ListingType,
                          filenameForExt: displayProductFilename(initialListing),
                        })}
                      </span>
                    ) : null}
                  </div>
                  {initialListing.file_storage_path || initialListing.app_bundle_path ? (
                    <>
                      <p className="mt-2 break-all text-sm font-medium text-white">
                        {displayProductFilename(initialListing) ?? 'File on record'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {listingType === 'web_app'
                          ? 'Stored as your app bundle (ZIP/HTML).'
                          : listingType === 'desktop_app'
                            ? 'Stored as your installer package.'
                            : 'Stored in your private files bucket; buyers use a signed download after purchase.'}
                      </p>
                      <p className="mt-2 break-all font-mono text-[11px] text-slate-600">
                        {initialListing.app_bundle_path
                          ? `Bundle: ${initialListing.app_bundle_path}`
                          : initialListing.file_storage_path
                            ? `Path: ${initialListing.file_storage_path}`
                            : null}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-amber-200/90">
                      No product file is attached yet. Add one below (required if this listing is paid).
                    </p>
                  )}
                </div>
              ) : null}
              <div className="mt-6">
                <FileDrop
                  id="product"
                  label={`Product file (${allowedProductExtensions})`}
                  hint={
                    isEdit && (initialListing?.file_storage_path || initialListing?.app_bundle_path)
                      ? 'Choose a file only if you want to replace the one above.'
                      : 'Required for paid listings'
                  }
                  accept={
                    listingType === 'desktop_app'
                      ? '.exe,.msi'
                      : listingType === 'web_app'
                        ? '.zip,.html'
                        : '*'
                  }
                  listingType={listingType}
                  file={productFile}
                  existingSavedName={
                    isEdit && !productFile && initialListing ? displayProductFilename(initialListing) : null
                  }
                  onFile={(f) =>
                    withPreservedModalScroll(() => {
                      setProductFile(f)
                      if (!f) return
                      if (listingType === 'file') {
                        const inferred = inferCategoryFromProductFilename(f.name)
                        if (inferred) setCategory(inferred)
                      } else if (listingType === 'web_app') {
                        setCategory('web_apps')
                      } else if (listingType === 'desktop_app') {
                        setCategory('desktop_apps')
                      }
                    })
                  }
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/12 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary-600 px-8 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500 disabled:opacity-50"
              >
                {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Publish listing'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
