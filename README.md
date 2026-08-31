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
`teeth_fitment`, `service_entries`, and `tyre_audit_log`).
