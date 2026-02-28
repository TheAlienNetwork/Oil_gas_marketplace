-- Listings: demo video (how it works) + monthly subscription option
alter table public.listings
  add column if not exists demo_video_url text,
  add column if not exists is_subscription boolean default false,
  add column if not exists price_per_month_cents integer;

-- price is one-time in cents; if is_subscription then price_per_month_cents is used for recurring
comment on column public.listings.price is 'One-time price in cents (0 for free)';
comment on column public.listings.is_subscription is 'If true, product is a monthly subscription';
comment on column public.listings.price_per_month_cents is 'Monthly price in cents when is_subscription is true';
