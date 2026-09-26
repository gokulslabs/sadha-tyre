-- Replace only vehicles created by the repository's demo seeds.
-- Do not broaden this predicate: other vehicle rows may be real customer data.
do $$
declare
  v record;
  idx int;
  steer int;
  rear int;
  axle int;
  p int;
  pos text;
  km numeric;
begin
  delete from public.vehicles
  where vehicle_number like 'DEMO-TYRE-%'
     or vehicle_number in ('MH12TV1254', 'MH12AB4477', 'MH14TR9021',
                           'TN23AB1042', 'TN23CD2861', 'TN23EF3475',
                           'TN23GH4902', 'TN23JK5836', 'TN23LM6219',
                           'TN23NP7643', 'TN23QR8127', 'TN23ST9354');

  -- These are invented, clearly documented demo registrations, not real fleet data.
  insert into public.vehicles (vehicle_number, wheels, odometer) values
    ('TN23AB1042', 4,  58400),
    ('TN23CD2861', 6,  92600),
    ('TN23EF3475', 8, 131800),
    ('TN23GH4902', 10, 168500),
    ('TN23JK5836', 12, 204300),
    ('TN23LM6219', 14, 246700),
    ('TN23NP7643', 16, 289400),
    ('TN23QR8127', 18, 327900),
    ('TN23ST9354', 22, 381200);

  idx := 0;
  for v in
    select id, vehicle_number, wheels, odometer
    from public.vehicles
    where vehicle_number in ('TN23AB1042', 'TN23CD2861', 'TN23EF3475',
                             'TN23GH4902', 'TN23JK5836', 'TN23LM6219',
                             'TN23NP7643', 'TN23QR8127', 'TN23ST9354')
  loop
    idx := idx + 1;
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
        km := mod(idx * 7300 + p * 6100, 90000);
        insert into public.tyres (vehicle_id, position_code, axle_label, serial_no, brand, tyre_type, fitted_on, fitted_km, current_km, cost, status, remark)
        values (v.id, pos, 'AXLE ' || axle, 'DEMO-' || replace(v.vehicle_number, '-', '') || '-' || pos,
          case when p % 3 = 0 then 'Michelin' when p % 3 = 1 then 'Apollo' else 'JK Tyre' end,
          case when p % 5 = 0 then 'Retread' else 'New' end, current_date - (p * 11),
          greatest(0, v.odometer - km), km, 18000 + (p % 3) * 2000, 'running', 'Demo fleet sample');
      end loop;
    end loop;

    for axle in (steer + 1)..(steer + rear) loop
      foreach pos in array array[axle::text || 'RI', axle::text || 'RO', axle::text || 'LI', axle::text || 'LO'] loop
        p := p + 1;
        km := mod(idx * 7300 + p * 6100, 90000);
        insert into public.tyres (vehicle_id, position_code, axle_label, serial_no, brand, tyre_type, fitted_on, fitted_km, current_km, cost, status, remark)
        values (v.id, pos, 'AXLE ' || axle, 'DEMO-' || replace(v.vehicle_number, '-', '') || '-' || pos,
          case when p % 3 = 0 then 'Michelin' when p % 3 = 1 then 'Apollo' else 'JK Tyre' end,
          case when p % 5 = 0 then 'Retread' else 'New' end, current_date - (p * 11),
          greatest(0, v.odometer - km), km, 18000 + (p % 3) * 2000, 'running', 'Demo fleet sample');
      end loop;
    end loop;
  end loop;
end $$;
