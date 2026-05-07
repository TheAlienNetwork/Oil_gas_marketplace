-- Allow sellers to overwrite their own deliverables (Supabase Storage upsert updates existing objects).
create policy "Users can update own listing files"
  on storage.objects for update
  using (
    bucket_id = 'listing-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own listing apps"
  on storage.objects for update
  using (
    bucket_id = 'listing-apps'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
