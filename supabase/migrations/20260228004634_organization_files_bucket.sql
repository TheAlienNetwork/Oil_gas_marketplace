-- Organization files bucket: private, only org members can read/write by path org_id/...
insert into storage.buckets (id, name, public)
values ('organization-files', 'organization-files', false)
on conflict (id) do nothing;

-- First path segment = org_id (uuid)
create policy "Org members can read org files"
  on storage.objects for select
  using (
    bucket_id = 'organization-files'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Org members can upload to org folder"
  on storage.objects for insert
  with check (
    bucket_id = 'organization-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Org members can update org files"
  on storage.objects for update
  using (
    bucket_id = 'organization-files'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Org members can delete org files"
  on storage.objects for delete
  using (
    bucket_id = 'organization-files'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
