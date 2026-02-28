-- Internal feed (achievements, posts) - members only
create table if not exists public.organization_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists organization_posts_org_id on public.organization_posts (org_id);
create index if not exists organization_posts_created_at on public.organization_posts (created_at desc);

create table if not exists public.organization_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.organization_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists organization_post_comments_post_id on public.organization_post_comments (post_id);

alter table public.organization_posts enable row level security;
alter table public.organization_post_comments enable row level security;

create policy "Org members can view posts"
  on public.organization_posts for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org members can create posts"
  on public.organization_posts for insert
  with check (public.is_org_member(org_id, auth.uid()));

create policy "Authors can update own posts"
  on public.organization_posts for update
  using (auth.uid() = user_id);

create policy "Authors and admins can delete posts"
  on public.organization_posts for delete
  using (auth.uid() = user_id or public.is_org_admin(org_id, auth.uid()));

create policy "Org members can view comments"
  on public.organization_post_comments for select
  using (
    exists (
      select 1 from public.organization_posts p
      where p.id = post_id and public.is_org_member(p.org_id, auth.uid())
    )
  );

create policy "Org members can comment"
  on public.organization_post_comments for insert
  with check (
    exists (
      select 1 from public.organization_posts p
      where p.id = post_id and public.is_org_member(p.org_id, auth.uid())
    )
  );

create policy "Users can delete own comments"
  on public.organization_post_comments for delete
  using (auth.uid() = user_id);

-- Well information (shared within org)
create table if not exists public.organization_well_info (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  well_name text not null,
  location text,
  notes text,
  data jsonb default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists organization_well_info_org_id on public.organization_well_info (org_id);

alter table public.organization_well_info enable row level security;

create policy "Org members can view well info"
  on public.organization_well_info for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org members can create well info"
  on public.organization_well_info for insert
  with check (public.is_org_member(org_id, auth.uid()));

create policy "Org members can update well info"
  on public.organization_well_info for update
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org members can delete well info"
  on public.organization_well_info for delete
  using (public.is_org_member(org_id, auth.uid()));

-- File metadata (actual files in storage)
create table if not exists public.organization_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists organization_files_org_id on public.organization_files (org_id);

alter table public.organization_files enable row level security;

create policy "Org members can view files"
  on public.organization_files for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org members can upload files"
  on public.organization_files for insert
  with check (public.is_org_member(org_id, auth.uid()));

create policy "Uploader or admin can delete file record"
  on public.organization_files for delete
  using (auth.uid() = uploaded_by or public.is_org_admin(org_id, auth.uid()));

-- Internal messages (channel per org)
create table if not exists public.organization_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists organization_messages_org_id on public.organization_messages (org_id);
create index if not exists organization_messages_created_at on public.organization_messages (created_at);

alter table public.organization_messages enable row level security;

create policy "Org members can view messages"
  on public.organization_messages for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org members can send messages"
  on public.organization_messages for insert
  with check (public.is_org_member(org_id, auth.uid()));
