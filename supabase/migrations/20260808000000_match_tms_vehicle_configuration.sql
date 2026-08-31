-- TMS Prime identifies MH12TV1254 as a 14-wheeler (four axles).
update public.vehicles
set wheels = 14, odometer = 200600
where vehicle_number = 'MH12TV1254';
