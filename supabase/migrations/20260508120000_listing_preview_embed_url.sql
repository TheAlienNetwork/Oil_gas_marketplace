-- Optional public HTTPS URL for embedding a read-only web demo (buyers see before purchase).

alter table public.listings
  add column if not exists preview_embed_url text;

comment on column public.listings.preview_embed_url is
  'Optional HTTPS URL shown in an iframe on the listing page for web_app previews only; not the paid bundle.';
