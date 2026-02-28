-- Profile extended fields (headline, bio) + work experience + projects
alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text;

-- Work experience
create table if not exists public.work_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  job_title text not null,
  location text,
  start_date date not null,
  end_date date,
  is_current boolean default false,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists work_experience_user_id on public.work_experience (user_id);

alter table public.work_experience enable row level security;

create policy "Work experience is viewable by everyone"
  on public.work_experience for select using (true);

create policy "Users can manage own work experience"
  on public.work_experience for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profile projects
create table if not exists public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  url text,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profile_projects_user_id on public.profile_projects (user_id);

alter table public.profile_projects enable row level security;

create policy "Profile projects are viewable by everyone"
  on public.profile_projects for select using (true);

create policy "Users can manage own profile projects"
  on public.profile_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
