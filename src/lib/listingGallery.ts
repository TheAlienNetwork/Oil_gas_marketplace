export interface ListingGalleryItem {
  url: string
  kind: 'image' | 'video'
}

export function parseListingGallery(raw: unknown): ListingGalleryItem[] {
  if (!Array.isArray(raw)) return []
  const out: ListingGalleryItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const url = (row as { url?: unknown }).url
    const kind = (row as { kind?: unknown }).kind
    if (typeof url !== 'string' || !url.trim()) continue
    if (kind !== 'image' && kind !== 'video') continue
    out.push({ url: url.trim(), kind })
  }
  return out
}

/** Fallback for listings created before `gallery_media` existed. */
export function listingGalleryFromLegacy(listing: {
  thumbnail_url?: string | null
  demo_video_url?: string | null
}): ListingGalleryItem[] {
  const items = parseListingGallery(
    (listing as { gallery_media?: unknown }).gallery_media
  )
  if (items.length > 0) return items
  const out: ListingGalleryItem[] = []
  if (listing.thumbnail_url) {
    out.push({ url: listing.thumbnail_url, kind: 'image' })
  }
  if (listing.demo_video_url) {
    out.push({ url: listing.demo_video_url, kind: 'video' })
  }
  return out
}
