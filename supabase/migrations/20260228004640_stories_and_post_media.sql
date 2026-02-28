-- Stories (24h-style carousel at top of feed)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image', -- 'image' | 'video'
  created_at timestamptz default now()
);

create index if not exists stories_user_id on public.stories (user_id);
create index if not exists stories_created_at on public.stories (created_at desc);

alter table public.stories enable row level security;

create policy "Stories are viewable by everyone"
  on public.stories for select using (true);

create policy "Users can create own stories"
  on public.stories for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own stories"
  on public.stories for delete
  using (auth.uid() = user_id);

-- Posts: add video_url
alter table public.posts
  add column if not exists video_url text;

-- Allow joining stories to profiles
alter table public.stories
  add constraint stories_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
