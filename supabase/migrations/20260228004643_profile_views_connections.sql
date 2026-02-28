-- Profile views (for analytics: who viewed profile, when)
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz default now()
);

create index if not exists profile_views_profile_id on public.profile_views (profile_id);
create index if not exists profile_views_viewed_at on public.profile_views (viewed_at);

alter table public.profile_views enable row level security;

create policy "Users can insert own profile view (when viewing another profile)"
  on public.profile_views for insert
  with check (auth.uid() = viewer_id);

create policy "Profile owners can view their profile views (analytics)"
  on public.profile_views for select
  using (auth.uid() = profile_id);

-- Connections (LinkedIn-style: pending / accepted)
create type connection_status as enum ('pending', 'accepted');

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  status connection_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sender_id, receiver_id),
  check (sender_id != receiver_id)
);

create index if not exists connections_sender_id on public.connections (sender_id);
create index if not exists connections_receiver_id on public.connections (receiver_id);

alter table public.connections enable row level security;

create policy "Users can see connections where they are sender or receiver"
  on public.connections for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send connection request"
  on public.connections for insert
  with check (auth.uid() = sender_id);

create policy "Receiver can update (accept/reject)"
  on public.connections for update
  using (auth.uid() = receiver_id);

create policy "Users can delete own sent request (before accept)"
  on public.connections for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
