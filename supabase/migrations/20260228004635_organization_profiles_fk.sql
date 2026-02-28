-- Allow joining org posts/comments/messages to profiles for display names
alter table public.organization_posts
  add constraint organization_posts_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.organization_post_comments
  add constraint organization_post_comments_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.organization_messages
  add constraint organization_messages_sender_id_profiles_fkey
  foreign key (sender_id) references public.profiles (id) on delete cascade;
