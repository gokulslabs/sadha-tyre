-- Resolve tenant ownership from the authenticated user's membership rather
-- than assigning every newly-created record to the legacy Sadha tenant.
-- Accounts with multiple memberships must select an active organization in
-- the application before inserts are enabled; never guess which fleet owns it.
create or replace function public.current_user_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  membership_count integer;
  resolved_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated organization member is required to create fleet records.';
  end if;

  select count(*), min(membership.organization_id::text)::uuid
    into membership_count, resolved_organization_id
  from public.organization_members as membership
  where membership.user_id = auth.uid();

  if membership_count = 0 then
    raise exception using
      errcode = '42501',
      message = 'Your account is not assigned to an organization.';
  elsif membership_count > 1 then
    raise exception using
      errcode = '42501',
      message = 'Your account belongs to multiple organizations; select an active organization before creating fleet records.';
  end if;

  return resolved_organization_id;
end;
$$;

revoke all on function public.current_user_organization_id() from public, anon;
grant execute on function public.current_user_organization_id() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vehicles',
    'tyres',
    'tyre_events',
    'tyre_inventory',
    'tyre_fitment',
    'teeth_purchase',
    'teeth_fitment',
    'service_entries',
    'tyre_audit_log',
    'tyre_maintenance'
  ] loop
    execute format(
      'alter table public.%I alter column organization_id set default public.current_user_organization_id()',
      table_name
    );
  end loop;
end;
$$;
