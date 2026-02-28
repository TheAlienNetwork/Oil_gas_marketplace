import type { ListingType, Category } from './constants'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  headline: string | null
  bio: string | null
  open_to_work?: boolean
  location?: string | null
  stripe_connect_account_id: string | null
  stripe_onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface WorkExperience {
  id: string
  user_id: string
  company: string
  job_title: string
  location: string | null
  start_date: string
  end_date: string | null
  is_current: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface ProfileProject {
  id: string
  user_id: string
  title: string
  description: string | null
  url: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  video_url: string | null
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'headline'>
  like_count?: number
  comment_count?: number
  liked_by_me?: boolean
}

export interface Story {
  id: string
  user_id: string
  media_url: string
  media_type: 'image' | 'video'
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export type ConnectionStatus = 'pending' | 'accepted'

export interface Connection {
  id: string
  sender_id: string
  receiver_id: string
  status: ConnectionStatus
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  slug: string
  description: string | null
  listing_type: ListingType
  price: number
  category: Category
  thumbnail_url: string | null
  file_storage_path: string | null
  app_bundle_path: string | null
  demo_video_url: string | null
  is_subscription: boolean
  price_per_month_cents: number | null
  is_published: boolean
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
}

export interface Purchase {
  id: string
  buyer_id: string
  listing_id: string
  stripe_payment_intent_id: string | null
  amount_paid_cents: number
  platform_fee_cents: number
  seller_payout_cents: number
  status: string
  created_at: string
  listings?: Listing
}

export interface PurchaseGrant {
  id: string
  purchase_id: string
  listing_id: string
  user_id: string
  download_path: string | null
  app_access_path: string | null
  expires_at: string | null
  created_at: string
  listings?: Listing
}

export interface Favorite {
  user_id: string
  listing_id: string
  created_at: string
}

export interface Reaction {
  user_id: string
  listing_id: string
  reaction: 'like' | 'dislike'
  created_at: string
}

export interface Review {
  id: string
  listing_id: string
  user_id: string
  rating: number
  body: string | null
  created_at: string
}

export interface Conversation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}

// Organizations (secure, members-only)
export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  owner_id: string
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface OrganizationMember {
  org_id: string
  user_id: string
  role: OrganizationRole
  joined_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface OrganizationPost {
  id: string
  org_id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface OrganizationPostComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface OrganizationWellInfo {
  id: string
  org_id: string
  well_name: string
  location: string | null
  notes: string | null
  data: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrganizationFile {
  id: string
  org_id: string
  file_name: string
  storage_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface OrganizationMessage {
  id: string
  org_id: string
  sender_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

// Rigs (intimate teams within an organization)
export interface Rig {
  id: string
  org_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface RigMember {
  rig_id: string
  user_id: string
  joined_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface RigPost {
  id: string
  rig_id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface RigPostComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface RigMessage {
  id: string
  rig_id: string
  sender_id: string
  body: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}
