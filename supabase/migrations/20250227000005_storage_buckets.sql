-- Storage buckets (run via Supabase Dashboard or API; here we document policy)
-- Buckets: listing-assets, listing-files, listing-apps
-- listing-assets: public read, authenticated upload (own path)
-- listing-files: no public read; signed URLs only via Edge Function
-- listing-apps: public read for app bundle paths (or signed via Edge Function)

insert into storage.buckets (id, name, public)
values
  ('listing-assets', 'listing-assets', true),
  ('listing-files', 'listing-files', false),
  ('listing-apps', 'listing-apps', true)
on conflict (id) do nothing;

create policy "Listing assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-assets');

create policy "Authenticated users can upload listing assets"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-assets'
    and auth.role() = 'authenticated'
  );

create policy "Users can update own listing assets"
  on storage.objects for update
  using (
    bucket_id = 'listing-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Listing files: authenticated upload"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-files'
    and auth.role() = 'authenticated'
  );

create policy "Listing apps: public read"
  on storage.objects for select
  using (bucket_id = 'listing-apps');

create policy "Authenticated users can upload listing apps"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-apps'
    and auth.role() = 'authenticated'
  );
