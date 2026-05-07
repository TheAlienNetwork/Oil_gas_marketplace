-- Original upload filename for buyer-facing file type / extension display.
alter table public.listings
  add column if not exists product_original_filename text;

comment on column public.listings.product_original_filename is
  'Original filename when seller uploaded the deliverable (shown to buyers).';

-- Backfill display name from storage path for older listings.
update public.listings
set product_original_filename = regexp_replace(file_storage_path, '^(.*/)', '')
where product_original_filename is null
  and file_storage_path is not null
  and length(trim(file_storage_path)) > 0;

update public.listings
set product_original_filename = regexp_replace(app_bundle_path, '^(.*/)', '')
where product_original_filename is null
  and app_bundle_path is not null
  and length(trim(app_bundle_path)) > 0;
