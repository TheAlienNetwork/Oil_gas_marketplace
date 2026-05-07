-- Discipline / topic subcategory (MWD, DD, etc.) separate from product format category.

create type public.listing_subcategory as enum (
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
  'other'
);

alter table public.listings
  add column subcategory public.listing_subcategory not null default 'general';

comment on column public.listings.subcategory is
  'O&G discipline or topic for filtering; independent of category (file/product type).';

-- Legacy: listings that used category mwd/dd only as a discipline tag
update public.listings
set subcategory = 'mwd'::public.listing_subcategory
where category::text = 'mwd';

update public.listings
set subcategory = 'dd'::public.listing_subcategory
where category::text = 'dd';

update public.listings
set category = 'manuals'::public.category_enum
where category::text in ('mwd', 'dd');

create index if not exists listings_subcategory_idx on public.listings (subcategory);
