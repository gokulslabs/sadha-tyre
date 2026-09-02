-- Trial dataset: distribute demo vehicles across supported wheel layouts and
-- give every position a realistic sample tyre record.
do $$
declare
  v record;
  idx int;
  w int;
  steer int;
  rear int;
  axle int;
  p int;
  pos text;
  km numeric;
begin
  for v in select id, vehicle_number, wheels, odometer from public.vehicles order by vehicle_number loop
    idx := coalesce(nullif(regexp_replace(v.vehicle_number, '\D', '', 'g'), '')::int, 31);
    if v.vehicle_number like 'DEMO-TYRE-%' then
      w := case
        when idx between 1 and 4 then 4
        when idx between 5 and 8 then 6
        when idx between 9 and 12 then 8
        when idx between 13 and 16 then 10
        when idx between 17 and 20 then 12
        when idx between 21 and 23 then 14
        when idx between 24 and 25 then 16
        when idx between 26 and 27 then 18
        else 22
      end;
      update public.vehicles set wheels = w, odometer = 100000 + (idx * 4500) where id = v.id;
      v.wheels := w;
      v.odometer := 100000 + (idx * 4500);
    end if;

    if v.wheels = 16 then steer := 2; rear := 3;
    elsif v.wheels = 14 then steer := 1; rear := 3;
    elsif v.wheels >= 4 and (v.wheels - 4) % 4 = 0 then steer := 2; rear := (v.wheels - 4) / 4;
    elsif v.wheels >= 2 and (v.wheels - 2) % 4 = 0 then steer := 1; rear := (v.wheels - 2) / 4;
    else steer := 1; rear := greatest(0, floor((v.wheels - 2) / 4)::int);
    end if;

    p := 0;
    for axle in 1..steer loop
      foreach pos in array array[axle::text || 'R', axle::text || 'L'] loop
        p := p + 1;
        km := mod(idx * 5000 + p * 1200, 90000);
        insert into public.tyres (vehicle_id, position_code, axle_label, serial_no, brand, tyre_type, fitted_on, fitted_km, current_km, cost, status, remark)
        values (v.id, pos, 'AXLE ' || axle, 'SADHA-' || replace(v.vehicle_number, '-', '') || '-' || pos, case when p % 3 = 0 then 'Michelin' when p % 3 = 1 then 'Apollo' else 'JK Tyre' end, case when p % 5 = 0 then 'Retread' else 'New' end, current_date - (p * 9), greatest(0, v.odometer - km), km, 18000 + (p % 3) * 2000, 'running', 'Demo fleet sample')
        on conflict (vehicle_id, position_code) do update set axle_label = excluded.axle_label, serial_no = excluded.serial_no, brand = excluded.brand, tyre_type = excluded.tyre_type, fitted_on = excluded.fitted_on, fitted_km = excluded.fitted_km, current_km = excluded.current_km, cost = excluded.cost, status = excluded.status, remark = excluded.remark;
      end loop;
    end loop;
    for axle in (steer + 1)..(steer + rear) loop
      foreach pos in array array[axle::text || 'RI', axle::text || 'RO', axle::text || 'LI', axle::text || 'LO'] loop
        p := p + 1;
        km := mod(idx * 5000 + p * 1200, 90000);
        insert into public.tyres (vehicle_id, position_code, axle_label, serial_no, brand, tyre_type, fitted_on, fitted_km, current_km, cost, status, remark)
        values (v.id, pos, 'AXLE ' || axle, 'SADHA-' || replace(v.vehicle_number, '-', '') || '-' || pos, case when p % 3 = 0 then 'Michelin' when p % 3 = 1 then 'Apollo' else 'JK Tyre' end, case when p % 5 = 0 then 'Retread' else 'New' end, current_date - (p * 9), greatest(0, v.odometer - km), km, 18000 + (p % 3) * 2000, 'running', 'Demo fleet sample')
        on conflict (vehicle_id, position_code) do update set axle_label = excluded.axle_label, serial_no = excluded.serial_no, brand = excluded.brand, tyre_type = excluded.tyre_type, fitted_on = excluded.fitted_on, fitted_km = excluded.fitted_km, current_km = excluded.current_km, cost = excluded.cost, status = excluded.status, remark = excluded.remark;
      end loop;
    end loop;
  end loop;
end $$;
