-- Talent ecosystem: profiles visible to employers, open to work flag
alter table public.profiles
  add column if not exists open_to_work boolean default false,
  add column if not exists location text;

-- Profiles are already publicly viewable; no RLS change needed for talent browse
