-- Favorites (wishlist)
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

create index if not exists favorites_listing_id on public.favorites (listing_id);

alter table public.favorites enable row level security;

create policy "Users can view own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can favorite"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can unfavorite"
  on public.favorites for delete
  using (auth.uid() = user_id);

