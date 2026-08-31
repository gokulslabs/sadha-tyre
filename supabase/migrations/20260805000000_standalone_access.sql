-- The standalone demo has no separate sign-in screen. Allow its publishable-key
-- client to use the tyre module tables while retaining RLS as the policy gate.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles, public.tyres, public.tyre_events,
  public.tyre_inventory, public.tyre_fitment, public.teeth_purchase, public.teeth_fitment,
  public.service_entries, public.tyre_audit_log TO anon;

CREATE POLICY "Standalone client reads vehicles" ON public.vehicles FOR SELECT TO anon USING (true);
CREATE POLICY "Standalone client manages tyres" ON public.tyres FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages tyre events" ON public.tyre_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages tyre inventory" ON public.tyre_inventory FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages tyre fitment" ON public.tyre_fitment FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages teeth purchase" ON public.teeth_purchase FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages teeth fitment" ON public.teeth_fitment FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client manages services" ON public.service_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Standalone client reads audit" ON public.tyre_audit_log FOR SELECT TO anon USING (true);
