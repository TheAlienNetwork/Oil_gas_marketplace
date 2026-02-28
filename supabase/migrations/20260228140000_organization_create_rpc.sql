-- Create organization via RPC so owner_id is set from auth.uid() server-side.
-- Avoids RLS "new row violates row-level security" when session/JWT context is strict.
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.organizations (name, slug, description, owner_id)
  values (p_name, p_slug, nullif(trim(p_description), ''), v_uid)
  returning id into v_org_id;

  return v_org_id;
end;
$$;

comment on function public.create_organization(text, text, text) is
  'Creates an organization with the authenticated user as owner. Trigger adds owner to organization_members.';
