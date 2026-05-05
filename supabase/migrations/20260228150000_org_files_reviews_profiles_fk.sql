-- PostgREST embeds (e.g. profiles(display_name)) require a FK to public.profiles.
-- uploaded_by / user_id already reference auth.users; profiles.id matches user id.

alter table public.organization_files
  add constraint organization_files_uploaded_by_profiles_fkey
  foreign key (uploaded_by) references public.profiles (id) on delete cascade;

alter table public.reviews
  add constraint reviews_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
