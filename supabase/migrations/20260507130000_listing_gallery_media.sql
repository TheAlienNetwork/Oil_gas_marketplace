-- Ordered gallery of listing images & videos (public URLs in listing-assets bucket).

alter table public.listings
  add column if not exists gallery_media jsonb not null default '[]'::jsonb;

comment on column public.listings.gallery_media is
  'JSON array of {"url": string, "kind": "image"|"video"} in display order. First image should match thumbnail_url.';
