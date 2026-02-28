import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STORAGE_BUCKETS,
  type Category,
  type ListingType,
} from '@/lib/constants'

interface CreateListingFormProps {
  onClose: () => void
  onSuccess: () => void
}

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  file: 'File (Excel, PDF, etc.)',
  web_app: 'Web app (runs in browser)',
  desktop_app: 'Desktop app (.exe / .msi)',
}

export default function CreateListingForm({
  onClose,
  onSuccess,
}: CreateListingFormProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [listingType, setListingType] = useState<ListingType>('file')
  const [category, setCategory] = useState<Category>('tool')
  const [priceCents, setPriceCents] = useState(0)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [demoVideoFile, setDemoVideoFile] = useState<File | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [isSubscription, setIsSubscription] = useState(false)
  const [pricePerMonthCents, setPricePerMonthCents] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      const listingId = crypto.randomUUID()
      let thumbnailUrl: string | null = null
      let fileStoragePath: string | null = null
      let appBundlePath: string | null = null

      let demoVideoUrl: string | null = null
      if (thumbnailFile) {
        const ext = thumbnailFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${listingId}/thumb.${ext}`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKETS.listingAssets)
          .upload(path, thumbnailFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKETS.listingAssets)
            .getPublicUrl(path)
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
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKETS.listingAssets)
            .getPublicUrl(path)
          demoVideoUrl = urlData.publicUrl
        }
      }

      if (productFile) {
        const path = `${user.id}/${listingId}/${productFile.name}`
        const bucket =
          listingType === 'web_app'
            ? STORAGE_BUCKETS.listingApps
            : STORAGE_BUCKETS.listingFiles
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, productFile, { upsert: true })
        if (!upErr) {
          if (listingType === 'web_app') appBundlePath = path
          else fileStoragePath = path
        }
      }

      const { error: insertErr } = await supabase.from('listings').insert({
        id: listingId,
        seller_id: user.id,
        title,
        slug: slug || listingId,
        description: description || null,
        listing_type: listingType,
        price: isSubscription ? 0 : priceCents,
        category,
        thumbnail_url: thumbnailUrl,
        file_storage_path: fileStoragePath,
        app_bundle_path: appBundlePath,
        demo_video_url: demoVideoUrl,
        is_subscription: isSubscription,
        price_per_month_cents: isSubscription ? pricePerMonthCents : null,
        is_published: true,
      })

      if (insertErr) throw insertErr
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
        ? 'ZIP with index.html or HTML/JS'
        : 'Any (e.g. .xlsx, .pdf)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Create listing</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Type
            </label>
            <select
              value={listingType}
              onChange={(e) => setListingType(e.target.value as ListingType)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            >
              {(Object.entries(LISTING_TYPE_LABELS) as [ListingType, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={isSubscription}
              onChange={(e) => setIsSubscription(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-primary-600"
            />
            Monthly subscription
          </label>
          {!isSubscription && (
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Price (USD cents, 0 = free)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={priceCents}
                onChange={(e) => setPriceCents(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
              />
              <p className="mt-1 text-xs text-slate-500">
                ${(priceCents / 100).toFixed(2)} one-time (platform fee on paid sales)
              </p>
            </div>
          )}
          {isSubscription && (
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Monthly price (USD cents)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={pricePerMonthCents}
                onChange={(e) => setPricePerMonthCents(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
              />
              <p className="mt-1 text-xs text-slate-500">
                ${(pricePerMonthCents / 100).toFixed(2)}/month
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Thumbnail image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Demo video (how it works)
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setDemoVideoFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Optional. Show buyers how the tool works.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Product file ({allowedProductExtensions})
            </label>
            <input
              type="file"
              accept={
                listingType === 'desktop_app'
                  ? '.exe,.msi'
                  : listingType === 'web_app'
                    ? '.zip,.html'
                    : '*'
              }
              onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-slate-400"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
