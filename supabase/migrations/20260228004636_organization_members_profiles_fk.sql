-- Allow joining organization_members to profiles for display names
alter table public.organization_members
  add constraint organization_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
