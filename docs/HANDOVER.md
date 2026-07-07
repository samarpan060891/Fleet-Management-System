# IT Handover Pack

Operational notes for the team that will run and maintain this system.

## Running in production
- `docker compose up --build -d` brings up Postgres, the API, and the SPA (nginx).
- The backend entrypoint runs `prisma migrate deploy` then an **idempotent** seed
  (set `SEED_ON_START=false` to disable seeding in real environments).
- Put a TLS-terminating reverse proxy in front of the `frontend` service.

## Configuration (all via env — see `.env.example`)
- **Secrets to change before go-live:** `JWT_SECRET`, `POSTGRES_PASSWORD`,
  `SEED_ADMIN_PASSWORD`.
- **SMTP:** set `SMTP_*` and `EMAIL_DRY_RUN=false` to send real alert emails.
- **Storage:** `STORAGE_DRIVER=local` (default, volume-backed) or `s3` with
  `S3_*` (region `me-central-1` for UAE residency). See DECISIONS.md for wiring S3.
- **Alert schedule:** `ALERT_CRON` (default `0 6 * * *`) and `TZ=Asia/Dubai`.
- **Feature flags:** `FEATURE_INVENTORY`, `FEATURE_WHATSAPP`.

## Data residency
- No hard dependency on any non-UAE region. Deployable on-prem or to a UAE cloud
  region. Object storage defaults to `me-central-1`.

## Backups
- Back up the `db_data` Postgres volume (or use managed Postgres snapshots) and
  the `uploads` volume (document scans, invoices, accident photos).

## Users & roles
- Ten roles enforced by a central permissions matrix
  (`backend/src/config/permissions.ts`). To change what a role can do, edit that
  matrix — do **not** scatter role checks in handlers.
- Create real users via `POST /api/users` (Fleet Manager) and disable the seeded
  demo accounts.

## Maintaining the modules
- Each module lives in `backend/src/modules/<name>/` with its routes, service, and
  pure business logic + tests. They share only the vehicle/driver master, so a
  change in one module should not affect others.
- **Schema changes:** edit `prisma/schema.prisma`, then
  `npx prisma migrate dev --name <change>`. Never hand-edit the database.

## Monitoring & health
- `GET /api/health` returns status + active feature flags.
- Structured logs via `pino` (JSON in production).
- The alert engine writes a run summary to logs each night; it can be triggered
  manually from the Alert Centre or `POST /api/alerts/run`.

## Day-one data load
- Excel/JSON bulk import for fuel is available at `POST /api/fuel/import` with a
  **dry-run preview** (`commit:false`) that returns row-level errors before commit.
  Extend the same pattern for vehicles/drivers/history import templates as needed.

## Tests & CI
- `cd backend && npm test` runs unit + integration tests (integration expects a
  seeded database). Wire this into CI before deploys.

## Security checklist
- RBAC enforced server-side (never trust the client).
- Passwords hashed (bcrypt); auth endpoints rate-limited.
- Uploads validated by MIME type + size (`UPLOAD_*`).
- Audit log records who/when/before/after on financial, compliance, approval, and
  attendance changes.
