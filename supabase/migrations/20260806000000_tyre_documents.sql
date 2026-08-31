-- TMS-style replacement documents for the standalone tyre module.
insert into storage.buckets (id, name, public)
values ('tyre-documents', 'tyre-documents', true)
on conflict (id) do nothing;

create policy "Standalone users upload tyre documents"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'tyre-documents');

create policy "Standalone users read tyre documents"
on storage.objects for select to anon, authenticated
using (bucket_id = 'tyre-documents');
