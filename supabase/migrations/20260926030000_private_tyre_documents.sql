-- Keep tyre documents private and scoped to members of the tyre's organization.
update storage.buckets
set public = false
where id = 'tyre-documents';

drop policy if exists "Standalone users upload tyre documents" on storage.objects;
drop policy if exists "Standalone users read tyre documents" on storage.objects;
drop policy if exists "Organization members upload tyre documents" on storage.objects;
drop policy if exists "Organization members read tyre documents" on storage.objects;
drop policy if exists "Organization members update tyre documents" on storage.objects;

create policy "Organization members upload tyre documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tyre-documents'
    and exists (
      select 1 from public.tyres t
      where t.id::text = (storage.foldername(name))[2]
        and public.is_organization_member(t.organization_id)
    )
  );

create policy "Organization members read tyre documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tyre-documents'
    and exists (
      select 1 from public.tyres t
      where t.id::text = (storage.foldername(name))[2]
        and public.is_organization_member(t.organization_id)
    )
  );

create policy "Organization members update tyre documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tyre-documents'
    and exists (
      select 1 from public.tyres t
      where t.id::text = (storage.foldername(name))[2]
        and public.is_organization_member(t.organization_id)
    )
  )
  with check (
    bucket_id = 'tyre-documents'
    and exists (
      select 1 from public.tyres t
      where t.id::text = (storage.foldername(name))[2]
        and public.is_organization_member(t.organization_id)
    )
  );
