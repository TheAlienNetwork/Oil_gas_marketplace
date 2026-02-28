-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  body text,
  created_at timestamptz default now()
);

create unique index if not exists reviews_user_listing_unique on public.reviews (user_id, listing_id);
create index if not exists reviews_listing_id on public.reviews (listing_id);

alter table public.reviews enable row level security;

create policy "Reviews are viewable for published listings"
  on public.reviews for select
  using (
    exists (
      select 1
      from public.listings l
      where l.id = reviews.listing_id
        and l.is_published = true
    )
  );

create policy "Users can create reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);

