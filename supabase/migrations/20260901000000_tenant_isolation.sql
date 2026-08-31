-- Tenant isolation for production deployments.
-- Add the authenticated user's UUID to public.organization_members before
-- enabling VITE_REQUIRE_AUTH.
create table if not exists public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists public.organization_members (organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'member', created_at timestamptz not null default now(), primary key (organization_id, user_id));
insert into public.organizations (id, name) values ('00000000-0000-0000-0000-000000000001', 'Sadha') on conflict (id) do nothing;

do $$ declare table_name text; begin
  foreach table_name in array array['vehicles','tyres','tyre_events','tyre_inventory','tyre_fitment','teeth_purchase','teeth_fitment','service_entries','tyre_audit_log'] loop
    execute format('alter table public.%I add column if not exists organization_id uuid references public.organizations(id)', table_name);
    execute format('update public.%I set organization_id = %L where organization_id is null', table_name, '00000000-0000-0000-0000-000000000001');
    execute format('alter table public.%I alter column organization_id set default %L', table_name, '00000000-0000-0000-0000-000000000001');
  end loop;
end $$;

create or replace function public.is_organization_member(target uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.organization_members where organization_id = target and user_id = auth.uid()); $$;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
grant select on public.organizations, public.organization_members to authenticated;
grant insert, update, delete on public.organization_members to authenticated;
create policy "Members can view their organization" on public.organizations for select to authenticated using (public.is_organization_member(id));
create policy "Members manage memberships" on public.organization_members for all to authenticated using (user_id = auth.uid() or public.is_organization_member(organization_id)) with check (user_id = auth.uid() or public.is_organization_member(organization_id));

do $$ declare table_name text; begin
  foreach table_name in array array['vehicles','tyres','tyre_events','tyre_inventory','tyre_fitment','teeth_purchase','teeth_fitment','service_entries','tyre_audit_log'] loop
    execute format('drop policy if exists "Standalone client manages vehicles" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage vehicles" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage tyres" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage tyre events" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage tyre inventory" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage tyre fitment" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage teeth purchases" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage teeth fitment" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users manage service entries" on public.%I', table_name);
    execute format('drop policy if exists "Signed-in users can view audit log" on public.%I', table_name);
    execute format('create policy "Organization members manage records" on public.%I for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id))', table_name);
  end loop;
end $$;
