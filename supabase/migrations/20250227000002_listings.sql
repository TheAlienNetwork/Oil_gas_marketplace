-- Listings
create type listing_type as enum ('file', 'web_app', 'desktop_app');
create type category_enum as enum (
  'directional_calculator', 'manual', 'excel', 'project', 'tool', 'other'
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  listing_type listing_type not null,
  price integer not null default 0,
  category category_enum not null default 'other',
  thumbnail_url text,
  file_storage_path text,
  app_bundle_path text,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists listings_seller_id on public.listings (seller_id);
create index if not exists listings_is_published on public.listings (is_published);
create index if not exists listings_category on public.listings (category);
create unique index if not exists listings_slug on public.listings (slug);

alter table public.listings enable row level security;

create policy "Published listings are viewable by everyone"
  on public.listings for select
  using (
    is_published = true
    or auth.uid() = seller_id
  );

create policy "Sellers can insert own listings"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on public.listings for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete own listings"
  on public.listings for delete
  using (auth.uid() = seller_id);
