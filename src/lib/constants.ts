export const LISTING_TYPES = {
  file: 'file',
  web_app: 'web_app',
  desktop_app: 'desktop_app',
} as const

export type ListingType = keyof typeof LISTING_TYPES

export const CATEGORIES = [
  'directional_calculator',
  'manual',
  'excel',
  'project',
  'tool',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  directional_calculator: 'Directional Drilling Calculator',
  manual: 'Manual / Procedures',
  excel: 'Excel Tool',
  project: 'Project / Study',
  tool: 'Tool',
  other: 'Other',
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
