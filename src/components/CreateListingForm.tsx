import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Listing } from '@/lib/types'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PLATFORM_FEE_PERCENT,
  STORAGE_BUCKETS,
  type Category,
  type ListingType,
} from '@/lib/constants'

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

function FileDrop({
  id,
  label,
  hint,
  accept,
  file,
  onFile,
}: {
  id: string
  label: string
  hint: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <label
        htmlFor={id}
        className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-slate-950/40 px-4 py-8 text-center transition hover:border-primary-500/35 hover:bg-slate-950/55"
      >
        <span className="text-sm font-medium text-slate-300">{file ? file.name : 'Click or drop a file'}</span>
        <span className="mt-1 text-xs text-slate-600">{hint}</span>
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
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
  const [category, setCategory] = useState<Category>('tool')
  const [priceDollars, setPriceDollars] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [demoVideoFile, setDemoVideoFile] = useState<File | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [isSubscription, setIsSubscription] = useState(false)
  const [pricePerMonthDollars, setPricePerMonthDollars] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialListing) {
      setTitle('')
      setDescription('')
      setListingType('file')
      setCategory('tool')
      setPriceDollars('')
      setThumbnailFile(null)
      setDemoVideoFile(null)
      setProductFile(null)
      setIsSubscription(false)
      setPricePerMonthDollars('')
      setIsPublished(true)
      return
    }
    setTitle(initialListing.title)
    setDescription(initialListing.description ?? '')
    setListingType(initialListing.listing_type as ListingType)
    setCategory(initialListing.category as Category)
    setPriceDollars(
      !initialListing.is_subscription && initialListing.price > 0
        ? (initialListing.price / 100).toFixed(2)
        : ''
    )
    setIsSubscription(Boolean(initialListing.is_subscription))
    setPricePerMonthDollars(
      initialListing.price_per_month_cents != null && initialListing.price_per_month_cents > 0
        ? (initialListing.price_per_month_cents / 100).toFixed(2)
        : ''
    )
    setIsPublished(initialListing.is_published)
    setThumbnailFile(null)
    setDemoVideoFile(null)
    setProductFile(null)
  }, [initialListing])

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

      let thumbnailUrl: string | null = initialListing?.thumbnail_url ?? null
      let fileStoragePath: string | null = initialListing?.file_storage_path ?? null
      let appBundlePath: string | null = initialListing?.app_bundle_path ?? null
      let demoVideoUrl: string | null = initialListing?.demo_video_url ?? null

      if (thumbnailFile) {
        const ext = thumbnailFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${listingId}/thumb.${ext}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKETS.listingAssets)
          .upload(path, thumbnailFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.listingAssets).getPublicUrl(path)
          thumbnailUrl = urlData.publicUrl
        }
      }
      if (demoVideoFile) {
        const ext = demoVideoFile.name.split('.').pop() || 'mp4'
        const path = `${user.id}/${listingId}/demo.${ext}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKETS.listingAssets)
          .upload(path, demoVideoFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from(STORAGE_BUCKETS.listingAssets).getPublicUrl(path)
          demoVideoUrl = urlData.publicUrl
        }
      }

      if (productFile) {
        const path = `${user.id}/${listingId}/${productFile.name}`
        const bucket =
          listingType === 'web_app' ? STORAGE_BUCKETS.listingApps : STORAGE_BUCKETS.listingFiles
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, productFile, { upsert: true })
        if (!upErr) {
          if (listingType === 'web_app') {
            appBundlePath = path
            fileStoragePath = null
          } else {
            fileStoragePath = path
            appBundlePath = null
          }
        }
      }

      const row = {
        title,
        slug: slug || listingId,
        description: description || null,
        listing_type: listingType,
        price: isSubscription ? 0 : Math.max(0, priceCents),
        category,
        thumbnail_url: thumbnailUrl,
        file_storage_path: fileStoragePath,
        app_bundle_path: appBundlePath,
        demo_video_url: demoVideoUrl,
        is_subscription: isSubscription,
        price_per_month_cents: isSubscription ? pricePerMonthCents : null,
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      }

      if (initialListing) {
        const { error: upErr } = await supabase
          .from('listings')
          .update(row)
          .eq('id', initialListing.id)
          .eq('seller_id', user.id)
        if (upErr) throw upErr
      } else {
        const { error: insertErr } = await supabase.from('listings').insert({
          id: listingId,
          seller_id: user.id,
          ...row,
        })
        if (insertErr) throw insertErr
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-b from-slate-900/98 to-slate-950 shadow-market-lg ring-1 ring-white/[0.06]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />
        <div className="max-h-[92vh] overflow-y-auto overscroll-contain p-6 sm:p-8">
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
                <div className="grid gap-5 sm:grid-cols-2">
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
                  <div>
                    <label className={labelClass}>Category</label>
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
                Strong thumbnails increase clicks. The product file is what buyers download or open after purchase.
              </p>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <FileDrop
                  id="thumb"
                  label="Thumbnail"
                  hint="PNG or JPG, landscape works best"
                  accept="image/*"
                  file={thumbnailFile}
                  onFile={setThumbnailFile}
                />
                <FileDrop
                  id="demo"
                  label="Demo video (optional)"
                  hint="Short walkthrough — MP4 or WebM"
                  accept="video/*"
                  file={demoVideoFile}
                  onFile={setDemoVideoFile}
                />
              </div>
              <div className="mt-6">
                <FileDrop
                  id="product"
                  label={`Product file (${allowedProductExtensions})`}
                  hint={
                    isEdit && (initialListing?.file_storage_path || initialListing?.app_bundle_path)
                      ? 'Leave empty to keep the current file, or upload to replace.'
                      : 'Required for paid listings'
                  }
                  accept={
                    listingType === 'desktop_app'
                      ? '.exe,.msi'
                      : listingType === 'web_app'
                        ? '.zip,.html'
                        : '*'
                  }
                  file={productFile}
                  onFile={setProductFile}
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
  )
}
