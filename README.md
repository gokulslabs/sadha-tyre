# Sadha Tyre

Standalone tyre-management project extracted from the Sadha Portal. It contains
only the tyre inventory, fitment, excavator-teeth, services, and audit-log
module; the existing portal is not modified.

## Run

Create a new Supabase project, apply the migrations in `supabase/migrations/`,
then create `.env` from `.env.example` and set that new project's URL and
publishable key before running:

```sh
npm install
npm run dev
```

The migrations create only the standalone tyre tables (`vehicles`, `tyres`,
`tyre_events`, `tyre_inventory`, `tyre_fitment`, `teeth_purchase`,
`teeth_fitment`, `service_entries`, and `tyre_audit_log`). The final migration
also creates the `tyre-documents` Storage bucket and its client policies for
replacement-document uploads.

Production authentication and tenant isolation are prepared by
`20260901000000_tenant_isolation.sql`. Add the authenticated user UUID to
`public.organization_members`, then set `VITE_REQUIRE_AUTH=true` in production.

## Critical write workflows and tenant test

Migration `20260930000000_atomic_fleet_workflows_and_audit_lock.sql` moves
vehicle creation/position provisioning, CSV fleet import, tyre fitment,
maintenance, and replacement into transactional Postgres functions. The audit
log is read-only for normal signed-in users. Apply this migration to a test
project first and check existing plates/tenant links before applying it to a
project with customer data.

The mocked browser suite is `npm run test:e2e`. For a real two-organization
Supabase smoke test, create a dedicated disposable Supabase project, apply all
migrations, create two test organizations and one Auth test user in each, and
add each user's UUID to the matching `organization_members` row. Then set
these environment variables in your shell (never commit them):

```sh
SUPABASE_TEST_DISPOSABLE=true
SUPABASE_TEST_URL=https://<test-project-ref>.supabase.co
SUPABASE_TEST_PROJECT_REF=<test-project-ref>
SUPABASE_TEST_PUBLISHABLE_KEY=<test-project-publishable-key>
SUPABASE_TEST_ORG_A_ID=<organization-a-uuid>
SUPABASE_TEST_ORG_B_ID=<organization-b-uuid>
SUPABASE_TEST_USER_A_EMAIL=<organization-a-test-user>
SUPABASE_TEST_USER_A_PASSWORD=<organization-a-test-password>
SUPABASE_TEST_USER_B_EMAIL=<organization-b-test-user>
SUPABASE_TEST_USER_B_PASSWORD=<organization-b-test-password>
npm run test:supabase
```

The API test creates uniquely named fixtures and deliberately leaves them in
the disposable project for inspection. It refuses the known production project
ref. To exercise the actual browser UI against that same test project, also
set `SUPABASE_TEST_USER_A_EMAIL` and `SUPABASE_TEST_USER_A_PASSWORD`, then run
`npm run test:supabase:browser`. That suite performs real inserts and updates,
so do not point it at production or a customer's fleet.
