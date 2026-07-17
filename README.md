# UAE Fleet Management System

A full-stack fleet management platform for a UAE logistics + distribution company
operating 60–80 vehicles across all seven emirates, serving 13 retail stores,
direct-to-home delivery, and staff/labour transport.

It is organised as **three cooperating domains that share one vehicle/driver
master** but are otherwise independent so IT can maintain each without breaking
the others:

1. **Fleet & Asset Core** — vehicles, drivers, compliance, maintenance, fuel,
   incidents, costs, purchase/disposal lifecycle.
2. **Staff Transport** — routes, vehicle/driver assignment, employee mapping,
   attendance (coordinator + driver).
3. **Fleet Availability** — a read-only planning board for delivery/warehouse users.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + TypeScript + MUI, mobile-responsive |
| Backend | Node.js + Express + TypeScript (REST) |
| Database | PostgreSQL via Prisma (migrations) |
| Auth | JWT + role-based access control (bcrypt hashing) |
| Files | local / S3-compatible storage abstraction |
| Notifications | pluggable channels — Email (SMTP) shipped, WhatsApp stub behind a flag |
| Deploy | Docker + docker-compose (on-prem or UAE-region cloud) |

Locale defaults: **AED**, **km**, **litres**, dates **DD/MM/YYYY**, week starts
**Monday**, Gregorian. UI is English but **i18n-ready** (all strings via a
translation layer).

---

## Quick start — Docker (recommended)

```bash
cp .env.example .env         # adjust secrets if you like
docker compose up --build
```

Then open:

- **App:** http://localhost:8080
- **API:** http://localhost:4000/api/health

The backend container runs migrations and seeds a realistic demo fleet on first
start (idempotent — safe to restart).

### Demo logins

| Role | Email | Password |
|---|---|---|
| Fleet Manager | `admin@fleet.local` | `Admin@123` |
| Workshop | `workshop@fleet.local` | `Passw0rd!` |
| Compliance | `compliance@fleet.local` | `Passw0rd!` |
| Finance | `finance@fleet.local` | `Passw0rd!` |
| Transport Coordinator | `coordinator@fleet.local` | `Passw0rd!` |
| Delivery Executive | `ops@fleet.local` | `Passw0rd!` |
| Delivery Manager | `deliverymgr@fleet.local` | `Passw0rd!` |
| Warehouse Manager | `warehouse@fleet.local` | `Passw0rd!` |
| Driver (mobile) | `driver@fleet.local` | `Passw0rd!` |
| Management | `management@fleet.local` | `Passw0rd!` |

---

## Local development (without Docker)

Requires Node 20+ and a running PostgreSQL.

### Backend

```bash
cd backend
cp ../.env.example .env            # set DATABASE_URL to your local Postgres
npm install
npx prisma migrate dev             # create schema
npm run db:seed                    # load demo data
npm run dev                        # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (proxies /api to :4000)
```

---

## Seeding

```bash
cd backend
npm run db:seed
```

Loads ~10 vehicles (owned/leased), ~10 drivers with document dates, vendors,
stores, fuel history, job cards (one open, one warranty-flagged), tyres, fines
(driver-attributed), Salik tags, an incident, routes with employee rosters, and
attendance. Some documents/PM/fuel records are deliberately near expiry / overdue
so the **Alert Centre** lights up immediately.

---

## Tests

```bash
cd backend
npm test
```

Covers the alert engine, cost/TCO calculations, fuel efficiency + anomaly
detection, odometer validation, the RBAC permissions matrix, fine attribution
(via assignment history), and API/RBAC integration (requires a seeded DB).

---

## Feature flags

| Flag | Default | Effect |
|---|---|---|
| `FEATURE_INVENTORY` | `false` | Spare-parts inventory module is built but every route 404s while disabled. |
| `FEATURE_WHATSAPP` | `false` | WhatsApp notification channel stub stays inert; email is the shipped channel. |

---

## Repository layout

```
/backend        Express + Prisma API, tests, Dockerfile
/frontend       React (Vite) SPA, Dockerfile + nginx
/docs           DATA_MODEL.md · API.md · DECISIONS.md · HANDOVER.md
docker-compose.yml
render.yaml
.env.example
```

## Documentation

- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entities and relationships
- [`docs/API.md`](docs/API.md) — REST endpoints per module
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — architecture decisions & assumptions
- [`docs/HANDOVER.md`](docs/HANDOVER.md) — full IT handover & go-live docket (self-hosted Docker Compose, security checklist, day-2 ops)
- [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) — deploy on Render (managed, dashboard-only, no server/Docker skills needed)
- [`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md) — deploy on Railway + PostgreSQL

## Deploy a managed instance (Render or Railway)

The repo-root `Dockerfile` builds a single web service (the API serving the built
SPA) that pairs with a managed PostgreSQL — no server administration required.
See [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) (Blueprint deploy via
[`render.yaml`](render.yaml)) or [`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md)
for a ~5-minute click-through on either platform.
