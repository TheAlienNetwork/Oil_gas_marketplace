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

/** Platform takes this percentage of each paid purchase (used in create-checkout Edge Function). */
export const PLATFORM_FEE_PERCENT = 5

export const STORAGE_BUCKETS = {
  listingAssets: 'listing-assets',
  listingFiles: 'listing-files',
  listingApps: 'listing-apps',
  profileAvatars: 'profile-avatars',
  organizationFiles: 'organization-files',
  feedMedia: 'feed-media',
} as const
