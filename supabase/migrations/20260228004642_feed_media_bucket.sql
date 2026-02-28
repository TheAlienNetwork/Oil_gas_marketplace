-- Feed media: post images/videos and stories (path: user_id/filename or user_id/stories/filename)
insert into storage.buckets (id, name, public)
values ('feed-media', 'feed-media', true)
on conflict (id) do nothing;

create policy "Feed media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'feed-media');

create policy "Authenticated users can upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'feed-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own feed media"
  on storage.objects for update
  using (
    bucket_id = 'feed-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own feed media"
  on storage.objects for delete
  using (
    bucket_id = 'feed-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
