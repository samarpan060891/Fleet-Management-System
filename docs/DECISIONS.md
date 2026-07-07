# Architecture Decisions & Assumptions

Where the brief left a detail unspecified, we chose the mainstream, maintainable
option and recorded it here.

## Stack & structure
- **Prisma** (over Knex) for migrations + a typed client, matching the
  TypeScript-throughout requirement. Never hand-edit schema — use migrations.
- **Monorepo** with independent `/backend` and `/frontend`. Modules under
  `backend/src/modules/*` are self-contained (routes + service + pure logic +
  tests) so IT can maintain one without touching others.
- **MUI** for the component library — mature, accessible, mobile-responsive,
  good data grid. A UAE-friendly teal/sand theme.

## Auth & RBAC
- **JWT** bearer tokens, `bcryptjs` password hashing (argon2 also listed as a
  dependency if a stronger KDF is desired later).
- RBAC is a **central permissions matrix** (`config/permissions.ts`) of
  `resource:action` grants, enforced server-side by an `authorize()` middleware.
  The client receives its effective permissions and hides nav/actions
  accordingly, but the server never trusts the client.
- Drivers are self-scoped in service logic (own vehicle, own docs, own routes).

## Business rules
- **Odometer** never decreases on normal events; the only path that may lower it
  is a Fleet-Manager correction endpoint, which is audited.
- **Fuel cash approval**: cash fills are created `pending`; amounts over the
  configurable threshold raise a red alert and email until approved.
- **Fuel anomalies**: missing odometer, >X% efficiency deviation from a rolling
  average, and unapproved cash over threshold (all thresholds in Settings).
- **Fine attribution** reads the effective-dated `vehicle_driver_assignment`
  history to find who was driving on the offence date; overridable + audited.
- **Attendance precedence**: coordinator marks override driver marks for the same
  employee/date; a driver cannot overwrite a coordinator mark.
- **Availability board** greys out and blocks any vehicle with an **expired**
  mandatory document (mulkiya / insurance / tasjeel).

## Cost / TCO
- **Straight-line depreciation** over a configurable useful life (default 5y) and
  residual value, prorated by days in the period. Both **cash-cost** and
  **including-depreciation** views are exposed.
- **km run** for a period is derived from odometer readings on fuel transactions
  within the period (min→max). This keeps cost-per-km reconcilable against source
  records without a separate trip module (which is out of scope).
- **Insurance premium** and **Salik spend** are **not** modelled as cost lines
  because the brief tracks insurance as documents/claims and Salik as a balance,
  not per-period spend. Their buckets are present (and default to 0) so they can
  be populated later without schema change.

## Alert engine
- A single daily scheduled job (`node-cron`, Asia/Dubai) evaluates all rules and
  upserts into `alerts` with a **dedupe key** per entity+rule, re-notifying on a
  configurable cadence and auto-resolving alerts that no longer fire. It can also
  be run on demand from the Alert Centre.
- Pure rule logic lives in `alerts.logic.ts` (unit-tested); DB wiring in
  `alerts.engine.ts`.

## Storage & notifications
- **Storage abstraction** with a `local` driver shipped. An S3 driver shares the
  same interface (implement + add `@aws-sdk/client-s3` when `STORAGE_DRIVER=s3`);
  region defaults to `me-central-1` for UAE residency. No hard dependency on a
  non-UAE region.
- **NotificationChannel** interface with `EmailChannel` (SMTP; dry-run logs to
  console so the app is demoable without a mail server) and a `WhatsAppChannel`
  stub gated by `FEATURE_WHATSAPP`.

## Feature flags
- `FEATURE_INVENTORY=false` — the spare-parts module is fully built but its routes
  404 while disabled.
- `FEATURE_WHATSAPP=false` — channel stays inert.

## Out of scope (per brief, deliberately not built)
- Order management / customer-delivery records.
- Route optimization / TMS.
- Carpenters/crew as tracked records (drivers only).
- In-house maintenance labour (invoices are captured; work is outsourced).
