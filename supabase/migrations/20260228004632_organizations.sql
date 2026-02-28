-- Organizations and membership (secure, members-only)
create type organization_role as enum ('owner', 'admin', 'member');

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists organizations_owner_id on public.organizations (owner_id);
create index if not exists organizations_slug on public.organizations (slug);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role organization_role not null default 'member',
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_id on public.organization_members (user_id);

-- Helper: user is member of org (any role)
create or replace function public.is_org_member(org_uuid uuid, user_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where org_id = org_uuid and user_id = user_uuid
  );
$$ language sql security definer stable;

-- Helper: user is owner or admin
create or replace function public.is_org_admin(org_uuid uuid, user_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where org_id = org_uuid and user_id = user_uuid and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Organizations: members can read; owner can update/delete; authenticated can create
create policy "Org members can view organization"
  on public.organizations for select
  using (public.is_org_member(id, auth.uid()));

create policy "Authenticated can create organization"
  on public.organizations for insert
  with check (auth.uid() = owner_id);

create policy "Org owner can update organization"
  on public.organizations for update
  using (auth.uid() = owner_id);

create policy "Org owner can delete organization"
  on public.organizations for delete
  using (auth.uid() = owner_id);

-- Members: members can list; owner/admin can insert/update/delete
create policy "Org members can view members"
  on public.organization_members for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "Org admins can add members"
  on public.organization_members for insert
  with check (public.is_org_admin(org_id, auth.uid()));

create policy "Org admins can update members"
  on public.organization_members for update
  using (public.is_org_admin(org_id, auth.uid()));

create policy "Org admins can remove members"
  on public.organization_members for delete
  using (public.is_org_admin(org_id, auth.uid()));

-- Trigger: add owner as member on create
create or replace function public.add_owner_as_member()
returns trigger as $$
begin
  insert into public.organization_members (org_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.add_owner_as_member();
