-- Rigs: intimate teams within an organization (join as org member, operate in rig feed + messages)
create table if not exists public.rigs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists rigs_org_id on public.rigs (org_id);

create table if not exists public.rig_members (
  rig_id uuid not null references public.rigs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (rig_id, user_id)
);

create index if not exists rig_members_user_id on public.rig_members (user_id);

-- Helper: user is member of rig
create or replace function public.is_rig_member(rig_uuid uuid, user_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.rig_members
    where rig_id = rig_uuid and user_id = user_uuid
  );
$$ language sql security definer stable;

-- Rig feed (posts)
create table if not exists public.rig_posts (
  id uuid primary key default gen_random_uuid(),
  rig_id uuid not null references public.rigs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists rig_posts_rig_id on public.rig_posts (rig_id);
create index if not exists rig_posts_created_at on public.rig_posts (created_at desc);

create table if not exists public.rig_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rig_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists rig_post_comments_post_id on public.rig_post_comments (post_id);

-- Rig messages (intimate channel)
create table if not exists public.rig_messages (
  id uuid primary key default gen_random_uuid(),
  rig_id uuid not null references public.rigs (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists rig_messages_rig_id on public.rig_messages (rig_id);
create index if not exists rig_messages_created_at on public.rig_messages (created_at);

alter table public.rigs enable row level security;
alter table public.rig_members enable row level security;
alter table public.rig_posts enable row level security;
alter table public.rig_post_comments enable row level security;
alter table public.rig_messages enable row level security;

-- Rigs: org members can view; org admins can create/update/delete
create policy "Org members can view org rigs"
  on public.rigs for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org admins can create rigs"
  on public.rigs for insert
  with check (public.is_org_admin(org_id, auth.uid()));

create policy "Org admins can update rigs"
  on public.rigs for update
  using (public.is_org_admin(org_id, auth.uid()));

create policy "Org admins can delete rigs"
  on public.rigs for delete
  using (public.is_org_admin(org_id, auth.uid()));

-- Rig members: org members can view (to show joined/join); org members can join; leave or org admin remove
create policy "Org members can view rig members in their org"
  on public.rig_members for select
  using (
    public.is_org_member((select org_id from public.rigs where id = rig_id), auth.uid())
  );

create policy "Org members can join rigs in their org"
  on public.rig_members for insert
  with check (
    public.is_org_member((select org_id from public.rigs where id = rig_id), auth.uid())
    and auth.uid() = user_id
  );

create policy "Users can leave rig or org admin can remove"
  on public.rig_members for delete
  using (
    auth.uid() = user_id
    or public.is_org_admin((select org_id from public.rigs where id = rig_id), auth.uid())
  );

-- Rig posts: rig members only
create policy "Rig members can view rig posts"
  on public.rig_posts for select
  using (public.is_rig_member(rig_id, auth.uid()));

create policy "Rig members can create rig posts"
  on public.rig_posts for insert
  with check (public.is_rig_member(rig_id, auth.uid()));

create policy "Authors can update own rig posts"
  on public.rig_posts for update
  using (auth.uid() = user_id);

create policy "Authors can delete own rig posts"
  on public.rig_posts for delete
  using (auth.uid() = user_id);

-- Rig post comments
create policy "Rig members can view rig post comments"
  on public.rig_post_comments for select
  using (
    exists (
      select 1 from public.rig_posts p
      where p.id = post_id and public.is_rig_member(p.rig_id, auth.uid())
    )
  );

create policy "Rig members can comment on rig posts"
  on public.rig_post_comments for insert
  with check (
    exists (
      select 1 from public.rig_posts p
      where p.id = post_id and public.is_rig_member(p.rig_id, auth.uid())
    )
  );

create policy "Users can delete own rig post comments"
  on public.rig_post_comments for delete
  using (auth.uid() = user_id);

-- Rig messages
create policy "Rig members can view rig messages"
  on public.rig_messages for select
  using (public.is_rig_member(rig_id, auth.uid()));

create policy "Rig members can send rig messages"
  on public.rig_messages for insert
  with check (public.is_rig_member(rig_id, auth.uid()));
