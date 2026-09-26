-- Position-level tyre maintenance, modelled after the TMS maintenance workflow.
create table public.tyre_maintenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id),
  tyre_id uuid not null references public.tyres(id) on delete cascade,
  entry_date date not null default current_date,
  maintenance_type text not null,
  km_reading numeric not null default 0,
  driver_name text,
  expense_account text,
  payment_mode text not null default 'Cash',
  amount numeric not null default 0,
  next_alert_date date,
  next_alert_km numeric,
  remark text,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tyre_maintenance_type_check check (maintenance_type in ('Inspection', 'Puncture repair', 'Rotation', 'Alignment', 'Retread', 'Replacement', 'Other')),
  constraint tyre_maintenance_payment_check check (payment_mode in ('Cash', 'Credit'))
);

create index idx_tyre_maintenance_tyre_date on public.tyre_maintenance (tyre_id, entry_date desc);
create index idx_tyre_maintenance_alert_date on public.tyre_maintenance (next_alert_date) where next_alert_date is not null;

alter table public.tyre_maintenance enable row level security;
grant select, insert, update, delete on public.tyre_maintenance to authenticated;
grant all on public.tyre_maintenance to service_role;
create policy "Organization members manage tyre maintenance" on public.tyre_maintenance
  for all to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

create trigger update_tyre_maintenance_updated_at
  before update on public.tyre_maintenance
  for each row execute function public.update_updated_at_column();
create trigger trg_audit_tyre_maintenance
  after insert or update or delete on public.tyre_maintenance
  for each row execute function public.log_tyre_audit();
