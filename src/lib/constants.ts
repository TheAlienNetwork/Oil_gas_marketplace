export const LISTING_TYPES = {
  file: 'file',
  web_app: 'web_app',
  desktop_app: 'desktop_app',
} as const

export type ListingType = keyof typeof LISTING_TYPES

/** Product format / asset type (matches DB `category_enum`). MWD & DD are subcategories, not top-level. */
export const CATEGORIES = [
  'desktop_apps',
  'web_apps',
  'excel',
  'pdf',
  'word',
  'manuals',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  desktop_apps: 'Desktop apps',
  web_apps: 'Web-based apps',
  excel: 'Excel',
  pdf: 'PDF',
  word: 'Word',
  manuals: 'Manuals',
}

/** O&G discipline / topic for filtering (matches DB `listing_subcategory`). */
export const SUBCATEGORIES = [
  'general',
  'mwd',
  'dd',
  'lwd',
  'directional',
  'drilling',
  'completions',
  'production',
  'reservoir',
  'operations',
  'hse',
  'other',
] as const

export type Subcategory = (typeof SUBCATEGORIES)[number]

export const SUBCATEGORY_LABELS: Record<Subcategory, string> = {
  general: 'General',
  mwd: 'MWD',
  dd: 'DD',
  lwd: 'LWD',
  directional: 'Directional drilling',
  drilling: 'Drilling',
  completions: 'Completions',
  production: 'Production',
  reservoir: 'Reservoir',
  operations: 'Operations',
  hse: 'HSE',
  other: 'Other',
}

export function coerceCategory(raw: string | null | undefined): Category {
  if (raw && (CATEGORIES as readonly string[]).includes(raw)) return raw as Category
  return 'manuals'
}

export function coerceSubcategory(raw: string | null | undefined): Subcategory {
  if (raw && (SUBCATEGORIES as readonly string[]).includes(raw)) return raw as Subcategory
  return 'general'
}

/**
 * Shown in the UI for seller/buyer disclosure. Must match Supabase Edge Function env
 * `STRIPE_CONNECT_PLATFORM_FEE_PERCENT` (default 10 in create-checkout if unset) — keep in sync.
 */
export const PLATFORM_FEE_PERCENT = 10

export const STORAGE_BUCKETS = {
  listingAssets: 'listing-assets',
  listingFiles: 'listing-files',
  listingApps: 'listing-apps',
  profileAvatars: 'profile-avatars',
  organizationFiles: 'organization-files',
  feedMedia: 'feed-media',
} as const
