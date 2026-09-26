-- Prevent authenticated users from granting themselves access to arbitrary
-- organizations. Membership changes are limited to owners/admins of the same
-- organization; membership rows remain readable by the member or their org.
create or replace function public.is_organization_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_organization_admin(uuid) from public, anon;
grant execute on function public.is_organization_admin(uuid) to authenticated;

drop policy if exists "Members manage memberships" on public.organization_members;
drop policy if exists "Members can read organization memberships" on public.organization_members;
drop policy if exists "Organization admins manage memberships" on public.organization_members;

create policy "Members can read organization memberships"
  on public.organization_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_organization_member(organization_id)
  );

create policy "Organization admins manage memberships"
  on public.organization_members
  for all
  to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));
