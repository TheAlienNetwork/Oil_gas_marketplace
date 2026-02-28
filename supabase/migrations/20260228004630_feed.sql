-- Feed: posts, post_likes, post_comments
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_user_id on public.posts (user_id);
create index if not exists posts_created_at on public.posts (created_at desc);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Post likes
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create index if not exists post_likes_post_id on public.post_likes (post_id);

alter table public.post_likes enable row level security;

create policy "Post likes are viewable by everyone"
  on public.post_likes for select using (true);

create policy "Users can like posts"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- Post comments (user_id also links to profiles for feed joins)
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

-- Allow joining post_comments to profiles for display names
alter table public.post_comments
  add constraint post_comments_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

create index if not exists post_comments_post_id on public.post_comments (post_id);

alter table public.post_comments enable row level security;

create policy "Post comments are viewable by everyone"
  on public.post_comments for select using (true);

create policy "Authenticated users can comment"
  on public.post_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.post_comments for delete
  using (auth.uid() = user_id);
