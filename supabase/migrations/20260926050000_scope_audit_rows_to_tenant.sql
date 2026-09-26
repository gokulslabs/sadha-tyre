-- Preserve the tenant of the source record when writing audit entries.
-- Without this, the audit table's single-org default misattributes events
-- for every other organization to Sadha.
create or replace function public.log_tyre_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_record jsonb;
  new_record jsonb;
  audit_organization_id uuid;
begin
  if (TG_OP = 'INSERT') then
    new_record := to_jsonb(NEW);
    audit_organization_id := coalesce(
      (new_record ->> 'organization_id')::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid
    );
    insert into public.tyre_audit_log (organization_id, table_name, record_id, action, new_data, changed_by)
    values (audit_organization_id, TG_TABLE_NAME, NEW.id::text, 'INSERT', new_record, auth.uid());
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    old_record := to_jsonb(OLD);
    new_record := to_jsonb(NEW);
    audit_organization_id := coalesce(
      (new_record ->> 'organization_id')::uuid,
      (old_record ->> 'organization_id')::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid
    );
    insert into public.tyre_audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
    values (audit_organization_id, TG_TABLE_NAME, NEW.id::text, 'UPDATE', old_record, new_record, auth.uid());
    return NEW;
  elsif (TG_OP = 'DELETE') then
    old_record := to_jsonb(OLD);
    audit_organization_id := coalesce(
      (old_record ->> 'organization_id')::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid
    );
    insert into public.tyre_audit_log (organization_id, table_name, record_id, action, old_data, changed_by)
    values (audit_organization_id, TG_TABLE_NAME, OLD.id::text, 'DELETE', old_record, auth.uid());
    return OLD;
  end if;
  return NULL;
end;
$$;
