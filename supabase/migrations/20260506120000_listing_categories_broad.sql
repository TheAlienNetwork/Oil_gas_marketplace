-- Broad marketplace category filters (desktop/web/file types + domain tags).
-- Migrates existing rows from legacy category_enum values.

create type public.category_enum_new as enum (
  'desktop_apps',
  'web_apps',
  'excel',
  'pdf',
  'word',
  'manuals',
  'mwd',
  'dd'
);

alter table public.listings
  add column category_new public.category_enum_new;

update public.listings
set category_new = case category::text
  when 'directional_calculator' then 'dd'::public.category_enum_new
  when 'manual' then 'manuals'::public.category_enum_new
  when 'excel' then 'excel'::public.category_enum_new
  when 'project' then 'manuals'::public.category_enum_new
  when 'tool' then 'desktop_apps'::public.category_enum_new
  when 'other' then 'manuals'::public.category_enum_new
end;

alter table public.listings
  alter column category_new set not null;

alter table public.listings
  alter column category_new set default 'manuals'::public.category_enum_new;

alter table public.listings drop column category;

alter table public.listings rename column category_new to category;

drop type public.category_enum;

alter type public.category_enum_new rename to category_enum;
