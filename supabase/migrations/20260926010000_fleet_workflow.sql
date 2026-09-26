-- Fleet health capture, odometer freshness, and inventory-linked fitment.
alter table public.vehicles
  add column if not exists odometer_updated_at timestamptz;

update public.vehicles
set odometer_updated_at = updated_at
where odometer_updated_at is null;

alter table public.vehicles
  alter column odometer_updated_at set default now(),
  alter column odometer_updated_at set not null;

alter table public.tyres
  add column if not exists condition text not null default 'unknown',
  add column if not exists tread_depth_mm numeric,
  add constraint tyres_condition_check check (condition in ('unknown', 'good', 'monitor', 'replace'));

alter table public.tyre_maintenance
  add column if not exists condition_after text,
  add column if not exists tread_depth_mm numeric,
  add column if not exists damage_notes text,
  add constraint tyre_maintenance_condition_check check (condition_after is null or condition_after in ('good', 'monitor', 'replace')),
  add constraint tyre_maintenance_tread_depth_check check (tread_depth_mm is null or tread_depth_mm >= 0);

alter table public.tyre_fitment
  add column if not exists tyre_inventory_id uuid references public.tyre_inventory(id);

create index if not exists idx_tyre_fitment_inventory on public.tyre_fitment (tyre_inventory_id) where tyre_inventory_id is not null;
create index if not exists idx_tyres_condition on public.tyres (condition);
