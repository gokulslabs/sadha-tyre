-- Avoid PL/pgSQL name resolution conflicts with tyres.position_code in the
-- ON CONFLICT target used by the atomic fitment workflow.
create or replace function public.record_tyre_fitment(p_record jsonb)
returns public.tyre_fitment
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved public.tyre_fitment;
  vehicle_odometer numeric;
  v_position_code text;
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

  v_position_code := upper(trim(coalesce(saved.tyre_place, '')));
  if saved.vehicle_id is not null and v_position_code ~ '^\d+(R|L|RI|RO|LI|LO)$' then
    insert into public.tyres (
      vehicle_id, position_code, axle_label, brand, serial_no,
      current_km, fitted_km, fitted_on, tyre_type, status, remark
    ) values (
      saved.vehicle_id, v_position_code, 'AXLE ' || substring(v_position_code from '^\d+'),
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
