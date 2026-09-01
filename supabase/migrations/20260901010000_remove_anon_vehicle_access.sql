-- All maintenance records are private to signed-in organization members.
drop policy if exists "Standalone client manages vehicles" on public.vehicles;
drop policy if exists "Standalone client reads vehicles" on public.vehicles;
drop policy if exists "Standalone client manages tyres" on public.tyres;
drop policy if exists "Standalone client manages tyre events" on public.tyre_events;
drop policy if exists "Standalone client manages tyre inventory" on public.tyre_inventory;
drop policy if exists "Standalone client manages tyre fitment" on public.tyre_fitment;
drop policy if exists "Standalone client manages teeth purchase" on public.teeth_purchase;
drop policy if exists "Standalone client manages teeth fitment" on public.teeth_fitment;
drop policy if exists "Standalone client manages services" on public.service_entries;
drop policy if exists "Standalone client reads audit" on public.tyre_audit_log;

revoke all on public.vehicles, public.tyres, public.tyre_events,
  public.tyre_inventory, public.tyre_fitment, public.teeth_purchase,
  public.teeth_fitment, public.service_entries, public.tyre_audit_log from anon;

drop policy if exists "Standalone users upload tyre documents" on storage.objects;
drop policy if exists "Standalone users read tyre documents" on storage.objects;
