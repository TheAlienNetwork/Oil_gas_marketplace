-- Ensure profiles has bio, headline, location, open_to_work (fix schema cache error)
alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists open_to_work boolean default false;
