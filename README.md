# Sadha Tyre

Standalone tyre-management project extracted from the Sadha Portal. It contains
only the tyre inventory, fitment, excavator-teeth, services, and audit-log
module; the existing portal is not modified.

## Run

Create `.env` from `.env.example` and set the Supabase URL and publishable key
for the existing Sadha project, then run:

```sh
npm install
npm run dev
```

The module uses the existing Supabase tyre tables (`tyres`, `tyre_events`,
`tyre_inventory`, `tyre_fitment`, `teeth_purchase`, `teeth_fitment`,
`service_entries`, and `tyre_audit_log`).
