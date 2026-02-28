-- Allow joining connections to profiles for display names
alter table public.connections
  add constraint connections_sender_id_profiles_fkey
  foreign key (sender_id) references public.profiles (id) on delete cascade;

alter table public.connections
  add constraint connections_receiver_id_profiles_fkey
  foreign key (receiver_id) references public.profiles (id) on delete cascade;
