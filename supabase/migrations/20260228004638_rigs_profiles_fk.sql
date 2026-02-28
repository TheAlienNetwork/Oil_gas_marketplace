-- Allow joining rig tables to profiles for display names
alter table public.rig_members
  add constraint rig_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.rig_posts
  add constraint rig_posts_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.rig_post_comments
  add constraint rig_post_comments_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.rig_messages
  add constraint rig_messages_sender_id_profiles_fkey
  foreign key (sender_id) references public.profiles (id) on delete cascade;
