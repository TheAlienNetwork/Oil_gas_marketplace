-- Purchase grants (what the buyer can access)
create table if not exists public.purchase_grants (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  download_path text,
  app_access_path text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists purchase_grants_user_id on public.purchase_grants (user_id);
create index if not exists purchase_grants_listing_id on public.purchase_grants (listing_id);

alter table public.purchase_grants enable row level security;

create policy "Users can view own grants"
  on public.purchase_grants for select
  using (auth.uid() = user_id);

create policy "Users can insert own grants (free flow)"
  on public.purchase_grants for insert
  with check (auth.uid() = user_id);
