-- Vehicle creation and odometer edits are part of the standalone client flow.
create policy "Standalone client manages vehicles" on public.vehicles
for all to anon using (true) with check (true);
