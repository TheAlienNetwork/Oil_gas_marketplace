-- Featured ads shown occasionally in the feed (sponsored content)
create table if not exists public.featured_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  link_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists featured_ads_active on public.featured_ads (active) where active = true;

alter table public.featured_ads enable row level security;

create policy "Active featured ads are viewable by everyone"
  on public.featured_ads for select
  using (active = true);

-- Only service role / dashboard can insert/update/delete; no policy for anon/authenticated
-- So regular users cannot modify ads. Use Supabase Dashboard or service key to manage.
