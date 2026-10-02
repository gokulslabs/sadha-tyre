-- Applied to Supabase project sadha-tyre on 2026-10-02.
-- Critical multi-row fleet workflows run in one PostgreSQL transaction. These
-- SECURITY INVOKER RPCs retain RLS and use the caller's organization defaults.


-- Enforce normalized plate uniqueness within each organization.
create unique index if not exists vehicles_org_plate_unique
  on public.vehicles (organization_id, upper(trim(vehicle_number)));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_org_id_id_key') then
    alter table public.vehicles add constraint vehicles_org_id_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyres_org_id_id_key') then
    alter table public.tyres add constraint tyres_org_id_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyre_inventory_org_id_id_key') then
    alter table public.tyre_inventory add constraint tyre_inventory_org_id_id_key unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyres_org_vehicle_fkey') then
    alter table public.tyres add constraint tyres_org_vehicle_fkey
      foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyre_events_org_tyre_fkey') then
    alter table public.tyre_events add constraint tyre_events_org_tyre_fkey
      foreign key (organization_id, tyre_id) references public.tyres (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyre_maintenance_org_tyre_fkey') then
    alter table public.tyre_maintenance add constraint tyre_maintenance_org_tyre_fkey
      foreign key (organization_id, tyre_id) references public.tyres (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyre_fitment_org_vehicle_fkey') then
    alter table public.tyre_fitment add constraint tyre_fitment_org_vehicle_fkey
      foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tyre_fitment_org_inventory_fkey') then
    alter table public.tyre_fitment add constraint tyre_fitment_org_inventory_fkey
      foreign key (organization_id, tyre_inventory_id) references public.tyre_inventory (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_entries_org_vehicle_fkey') then
    alter table public.service_entries add constraint service_entries_org_vehicle_fkey
      foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teeth_fitment_org_vehicle_fkey') then
    alter table public.teeth_fitment add constraint teeth_fitment_org_vehicle_fkey
      foreign key (organization_id, vehicle_id) references public.vehicles (organization_id, id);
  end if;
end;
$$;

create or replace function public.create_fleet_vehicle(p_record jsonb)
returns public.vehicles
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved public.vehicles;
  plate text;
  wheel_count integer;
  odo numeric;
  steer_axles integer;
  rear_axles integer;
  axle integer;
  position text;
begin
  plate := upper(trim(coalesce(p_record ->> 'vehicle_number', '')));
  wheel_count := (p_record ->> 'wheels')::integer;
  odo := coalesce(nullif(p_record ->> 'odometer', '')::numeric, 0);
  if plate = '' or wheel_count not in (4, 6, 8, 10, 12, 14, 16, 18, 22) or odo < 0 then
    raise exception using errcode = '22023', message = 'Vehicle plate, supported wheel count, or odometer is invalid.';
  end if;
  if wheel_count = 16 then steer_axles := 2; rear_axles := 3;
  elsif wheel_count = 14 then steer_axles := 1; rear_axles := 3;
  elsif wheel_count >= 4 and (wheel_count - 4) % 4 = 0 then steer_axles := 2; rear_axles := (wheel_count - 4) / 4;
  else steer_axles := 1; rear_axles := (wheel_count - 2) / 4;
  end if;

  insert into public.vehicles (vehicle_number, wheels, odometer)
  values (plate, wheel_count, odo) returning * into saved;

  for axle in 1..steer_axles loop
    foreach position in array array[axle::text || 'R', axle::text || 'L'] loop
      insert into public.tyres (vehicle_id, position_code, axle_label)
      values (saved.id, position, 'AXLE ' || axle);
    end loop;
  end loop;
  for axle in (steer_axles + 1)..(steer_axles + rear_axles) loop
    foreach position in array array[axle::text || 'RI', axle::text || 'RO', axle::text || 'LI', axle::text || 'LO'] loop
      insert into public.tyres (vehicle_id, position_code, axle_label)
      values (saved.id, position, 'AXLE ' || axle);
    end loop;
  end loop;
  return saved;
end;
$$;

create or replace function public.import_fleet_vehicles(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  plate text;
  wheel_count integer;
  odo numeric;
  inserted_count integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception using errcode = '22023', message = 'Provide at least one vehicle row.';
  end if;

  -- Validate the complete batch before writing any rows. The unique index
  -- handles races with concurrent imports or the single-vehicle form.
  for item in select value from jsonb_array_elements(p_rows) loop
    plate := upper(trim(coalesce(item ->> 'vehicle_number', '')));
    wheel_count := (item ->> 'wheels')::integer;
    odo := coalesce(nullif(item ->> 'odometer', '')::numeric, 0);
    if plate = '' or wheel_count not in (4, 6, 8, 10, 12, 14, 16, 18, 22) or odo < 0 then
      raise exception using errcode = '22023', message = 'A vehicle row has an invalid plate, supported wheel count, or odometer.';
    end if;
    if exists (select 1 from public.vehicles v where upper(trim(v.vehicle_number)) = plate) then
      raise exception using errcode = '23505', message = format('Vehicle %s already exists in this fleet.', plate);
    end if;
    if (select count(*) from jsonb_array_elements(p_rows) as batch(row_value)
        where upper(trim(coalesce(batch.row_value ->> 'vehicle_number', ''))) = plate) > 1 then
      raise exception using errcode = '23505', message = format('Vehicle %s appears more than once in this import.', plate);
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_rows) loop
    perform public.create_fleet_vehicle(item);
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.create_fleet_vehicle(jsonb) from public, anon;
revoke all on function public.import_fleet_vehicles(jsonb) from public, anon;
grant execute on function public.create_fleet_vehicle(jsonb) to authenticated;
grant execute on function public.import_fleet_vehicles(jsonb) to authenticated;


create or replace function public.record_tyre_maintenance(p_record jsonb)
returns public.tyre_maintenance
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved public.tyre_maintenance;
  vehicle_id uuid;
  fitted_km numeric;
  vehicle_odometer numeric;
  reading numeric;
begin
  select t.vehicle_id, t.fitted_km into vehicle_id, fitted_km
  from public.tyres t where t.id = (p_record ->> 'tyre_id')::uuid for update;
  if not found then
    raise exception using errcode = '42501', message = 'Tyre position not found in your organization.';
  end if;

  select v.odometer into vehicle_odometer
  from public.vehicles v where v.id = vehicle_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Vehicle for this tyre position was not found.';
  end if;

  reading := coalesce(nullif(p_record ->> 'km_reading', '')::numeric, vehicle_odometer);
  if reading < 0 then
    raise exception using errcode = '22023', message = 'Odometer reading cannot be negative.';
  end if;

  insert into public.tyre_maintenance (
    tyre_id, entry_date, maintenance_type, km_reading, driver_name,
    expense_account, payment_mode, amount, next_alert_date, next_alert_km,
    remark, document_path, condition_after, tread_depth_mm, damage_notes
  ) values (
    (p_record ->> 'tyre_id')::uuid,
    coalesce(nullif(p_record ->> 'entry_date', '')::date, current_date),
    p_record ->> 'maintenance_type', reading,
    nullif(p_record ->> 'driver_name', ''), nullif(p_record ->> 'expense_account', ''),
    coalesce(nullif(p_record ->> 'payment_mode', ''), 'Cash'),
    coalesce(nullif(p_record ->> 'amount', '')::numeric, 0),
    nullif(p_record ->> 'next_alert_date', '')::date,
    nullif(p_record ->> 'next_alert_km', '')::numeric,
    nullif(p_record ->> 'remark', ''), nullif(p_record ->> 'document_path', ''),
    nullif(p_record ->> 'condition_after', ''),
    nullif(p_record ->> 'tread_depth_mm', '')::numeric,
    nullif(p_record ->> 'damage_notes', '')
  ) returning * into saved;

  update public.tyres
  set current_km = greatest(current_km, greatest(0, reading - coalesce(fitted_km, 0))),
      condition = coalesce(saved.condition_after, condition),
      tread_depth_mm = coalesce(saved.tread_depth_mm, tread_depth_mm)
  where id = saved.tyre_id;

  if reading >= vehicle_odometer then
    update public.vehicles
    set odometer = reading, odometer_updated_at = now()
    where id = vehicle_id;
  end if;

  return saved;
end;
$$;

create or replace function public.record_tyre_fitment(p_record jsonb)
returns public.tyre_fitment
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved public.tyre_fitment;
  vehicle_odometer numeric;
  position_code text;
  tyre_row public.tyres;
  reading numeric;
begin
  if nullif(p_record ->> 'vehicle_id', '') is not null then
    select v.odometer into vehicle_odometer
    from public.vehicles v where v.id = (p_record ->> 'vehicle_id')::uuid for update;
    if not found then
      raise exception using errcode = '42501', message = 'Vehicle not found in your organization.';
    end if;
  end if;

  if nullif(p_record ->> 'tyre_inventory_id', '') is not null and not exists (
    select 1 from public.tyre_inventory i where i.id = (p_record ->> 'tyre_inventory_id')::uuid
  ) then
    raise exception using errcode = '42501', message = 'Selected tyre stock is not available in your organization.';
  end if;

  reading := coalesce(nullif(p_record ->> 'km', '')::numeric, 0);
  if reading < 0 then
    raise exception using errcode = '22023', message = 'Odometer reading cannot be negative.';
  end if;

  insert into public.tyre_fitment (
    entry_date, brand, tyre_no, tyre_size, vehicle_id, driver_name,
    tyre_place, km, remarks, old_tyre_status, old_tyre_stock, tyre_inventory_id
  ) values (
    coalesce(nullif(p_record ->> 'entry_date', '')::date, current_date),
    nullif(p_record ->> 'brand', ''), nullif(p_record ->> 'tyre_no', ''),
    nullif(p_record ->> 'tyre_size', ''), nullif(p_record ->> 'vehicle_id', '')::uuid,
    nullif(p_record ->> 'driver_name', ''), nullif(p_record ->> 'tyre_place', ''),
    reading, nullif(p_record ->> 'remarks', ''),
    coalesce(nullif(p_record ->> 'old_tyre_status', ''), 'NEW'),
    nullif(p_record ->> 'old_tyre_stock', ''),
    nullif(p_record ->> 'tyre_inventory_id', '')::uuid
  ) returning * into saved;

  position_code := upper(trim(coalesce(saved.tyre_place, '')));
  if saved.vehicle_id is not null and position_code ~ '^\d+(R|L|RI|RO|LI|LO)$' then
    insert into public.tyres (
      vehicle_id, position_code, axle_label, brand, serial_no,
      current_km, fitted_km, fitted_on, tyre_type, status, remark
    ) values (
      saved.vehicle_id, position_code, 'AXLE ' || substring(position_code from '^\d+'),
      saved.brand, saved.tyre_no, 0, reading, saved.entry_date, 'New', 'running', saved.remarks
    ) on conflict (vehicle_id, position_code) do update set
      brand = excluded.brand, serial_no = excluded.serial_no,
      current_km = 0, fitted_km = excluded.fitted_km, fitted_on = excluded.fitted_on,
      tyre_type = excluded.tyre_type, status = excluded.status, remark = excluded.remark
    returning * into tyre_row;

    insert into public.tyre_events (tyre_id, event_date, event_type, km_reading, cost, note)
    values (tyre_row.id, saved.entry_date, 'fitted', reading, 0, 'Fitment recorded');
  end if;

  if saved.vehicle_id is not null and reading >= vehicle_odometer then
    update public.vehicles set odometer = reading, odometer_updated_at = now()
    where id = saved.vehicle_id;
  end if;
  return saved;
end;
$$;

create or replace function public.replace_tyre(p_tyre_id uuid, p_record jsonb)
returns public.tyres
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved public.tyres;
  previous_odometer numeric;
  reading numeric;
  event_day date;
  replacement_cost numeric;
begin
  select t.* into saved from public.tyres t where t.id = p_tyre_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Tyre position not found in your organization.';
  end if;
  select v.odometer into previous_odometer from public.vehicles v
  where v.id = saved.vehicle_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Vehicle for this tyre position was not found.';
  end if;

  reading := coalesce(nullif(p_record ->> 'km_reading', '')::numeric, previous_odometer);
  event_day := coalesce(nullif(p_record ->> 'event_date', '')::date, current_date);
  replacement_cost := coalesce(nullif(p_record ->> 'amount', '')::numeric, 0);
  if reading < 0 or replacement_cost < 0 then
    raise exception using errcode = '22023', message = 'Odometer and replacement cost cannot be negative.';
  end if;

  update public.tyres
  set tyre_type = coalesce(nullif(p_record ->> 'tyre_type', ''), tyre_type),
      serial_no = nullif(p_record ->> 'serial_no', ''),
      fitted_on = event_day, fitted_km = reading, current_km = 0,
      cost = replacement_cost, status = 'running',
      remark = nullif(p_record ->> 'remark', '')
  where id = p_tyre_id returning * into saved;

  insert into public.tyre_events (tyre_id, event_date, event_type, km_reading, cost, note)
  values (
    p_tyre_id, event_day, 'replaced', reading, replacement_cost,
    concat_ws(' · ', nullif('Source: ' || nullif(p_record ->> 'source', ''), 'Source: '),
      nullif(p_record ->> 'remark', ''), nullif(p_record ->> 'document_path', ''))
  );

  if reading >= previous_odometer then
    update public.vehicles set odometer = reading, odometer_updated_at = now()
    where id = saved.vehicle_id;
  end if;
  return saved;
end;
$$;

revoke all on function public.record_tyre_maintenance(jsonb) from public, anon;
revoke all on function public.record_tyre_fitment(jsonb) from public, anon;
revoke all on function public.replace_tyre(uuid, jsonb) from public, anon;
grant execute on function public.record_tyre_maintenance(jsonb) to authenticated;
grant execute on function public.record_tyre_fitment(jsonb) to authenticated;
grant execute on function public.replace_tyre(uuid, jsonb) to authenticated;

-- Normal client roles may read but cannot rewrite or erase the audit trail.
drop policy if exists "Organization members manage records" on public.tyre_audit_log;
drop policy if exists "Organization members read audit log" on public.tyre_audit_log;
revoke insert, update, delete, truncate on public.tyre_audit_log from public, anon, authenticated;
grant select on public.tyre_audit_log to authenticated;
create policy "Organization members read audit log"
  on public.tyre_audit_log for select to authenticated
  using (public.is_organization_member(organization_id));

alter function public.log_tyre_audit() set search_path = pg_catalog, public;
