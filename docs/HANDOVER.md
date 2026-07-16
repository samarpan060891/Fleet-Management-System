# IT Handover & Go-Live Docket — UAE Fleet Management System

This is the complete pack for taking this application from its current hosting
and running it on your own server, under your own domain. Follow the sections
in order the first time; after go-live, use it as a reference.

**Repository:** `samarpan060891/Fleet-Management-System` (branch `main`)

---

## 1. What you're receiving

A full-stack fleet management platform:

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript + MUI — compiled to static files |
| Backend | Node.js 20+ / Express + TypeScript — REST API |
| Database | PostgreSQL 16 (via Prisma ORM + migrations) |
| Auth | JWT + server-side role-based access control (bcrypt password hashing) |
| File storage | Pluggable — local disk (default) or any S3-compatible bucket |
| Email | Pluggable SMTP channel (off by default — see §8) |
| Scheduled job | One daily cron job (compliance/PM/warranty alert engine) — no external dependency |

No AI/LLM, no third-party SaaS dependency, and no hard dependency on any
specific cloud region — it runs equally well on a company VM, a UAE cloud
region, or any standard Docker host.

Everything needed to run it is already in the repo: Dockerfiles, a
`docker-compose.yml`, an idempotent DB migration + seed entrypoint, and an
`.env.example` documenting every setting.

---

## 2. Architecture at a glance

```
                 ┌─────────────────────────┐
  Browser  ───▶  │  frontend (nginx)  :80   │  serves the built React SPA
                 │  proxies /api, /files ───┼──▶  backend (Express) :4000 ──▶ PostgreSQL :5432
                 └─────────────────────────┘                                  (+ local "uploads"
                                                                                 volume, or S3)
```

Three containers (`db`, `backend`, `frontend`), wired together by
`docker-compose.yml` at the repo root. The backend is stateless (all state is
in Postgres + the uploads volume/S3), so it can be scaled to multiple
instances behind a load balancer later if needed — not required at your
current scale.

---

## 3. Access checklist — get these from us before you start

- [ ] Git access to the repository (or a zip export of the `main` branch)
- [ ] Current admin login (`admin@fleet.local` / see current secrets) — only
      needed if you're migrating **live data** from the current deployment
      (§7). Not needed for a fresh install with demo data.
- [ ] If migrating live data: read access to the current database
      (`DATABASE_URL` / Railway connection string) and, if file uploads are in
      use, access to the current storage (local volume or S3 bucket/keys)
- [ ] Your domain name and DNS control (to point it at the new server)

---

## 4. Server prerequisites

- A Linux VM (Ubuntu 22.04/24.04 LTS recommended) with:
  - **Docker Engine + Docker Compose plugin** (`docker compose version` ≥ 2.x)
  - Minimum **2 vCPU / 4 GB RAM / 40 GB disk** for this fleet size (60–80
    vehicles); comfortably scales down for smaller fleets or up if you expect
    growth
  - Outbound internet access (to pull Docker images and, if configured, send
    SMTP email)
- Inbound firewall: only **80** and **443** need to be open to the internet.
  Everything else (Postgres, the raw API port) should stay internal — see the
  hardening step in §6.
- A domain name (e.g. `fleet.yourcompany.com`) with DNS you control.

---

## 5. Deployment — Docker Compose on your own server (recommended path)

This is the tested, documented path for "our own server." (If you're instead
targeting a PaaS like Railway/Render/Fly, see §12 for the single-container
alternative — same application, different packaging.)

```bash
# 1. Get the code onto the server
git clone https://github.com/samarpan060891/Fleet-Management-System.git
cd Fleet-Management-System

# 2. Configure environment — this step is mandatory, not optional:
#    docker compose refuses to start without a .env file present.
cp .env.example .env
nano .env          # see the checklist in §8 — do this BEFORE first boot

# 3. Build and start everything
docker compose up --build -d

# 4. Watch it come up
docker compose logs -f backend
```

On first boot, the `backend` container automatically:
1. Runs `prisma migrate deploy` (applies the database schema — retries up to
   10× if Postgres isn't ready yet).
2. Runs the seed script **only if the database is empty** (idempotent — safe
   to restart, will never duplicate data). It loads a demo fleet and the
   accounts listed in the README. Set `SEED_ON_START=false` in `.env` if you
   don't want this (e.g. because you're about to restore real data — see §7).

**Verify it's up:**
```bash
curl http://localhost:4000/api/health
# {"status":"ok","time":"...","features":{"inventory":false,"whatsapp":false}}
```
Then open `http://<server-ip>:8080` in a browser — you should see the login
page. At this point the app is reachable but **not yet on your domain and not
yet on HTTPS** — that's §6.

---

## 6. Point your domain at it + enable HTTPS

The bundled `frontend` container only serves plain HTTP on port 80/8080 — it
has no TLS certificate of its own. Add a reverse proxy in front of it that
terminates HTTPS for your domain. The simplest option (automatic Let's
Encrypt certificates, no manual renewal) is **Caddy**:

### 6.1 DNS
Point an **A record** (and AAAA if you have IPv6) for your chosen hostname
(e.g. `fleet.yourcompany.com`) at the server's public IP address. Give it a
few minutes to propagate before continuing.

### 6.2 Add Caddy as a reverse proxy

Create `Caddyfile` in the repo root:
```
fleet.yourcompany.com {
    reverse_proxy frontend:80
}
```

Add a `caddy` service to `docker-compose.yml` and stop publishing the app
containers directly to the internet (Caddy becomes the only public entry
point):

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    command: caddy run --config /etc/caddyfile
    depends_on:
      - frontend
```
And in the same file, remove (or restrict to `127.0.0.1`) the host port
publishing that's no longer needed once Caddy is the front door:
- `frontend` → drop `ports: ['8080:80']` entirely (Caddy reaches it over the
  internal Docker network by service name `frontend`, no host port needed).
- `backend` → drop `ports: ['4000:4000']`, or change to `127.0.0.1:4000:4000`
  if you want to `curl` it directly from the server for debugging. Traffic
  from the browser already reaches it via `frontend`'s nginx proxy rules
  (`/api/`, `/files/`) — a public host port on the API is redundant and an
  unnecessary attack surface.
- `db` → drop `ports: ['5432:5432']`, or change to `127.0.0.1:5432:5432` if
  you need `psql`/backup tools to reach it directly from the server itself.
  Postgres should **never** be reachable from the open internet.

Add the two named volumes at the bottom:
```yaml
volumes:
  db_data:
  uploads:
  caddy_data:
  caddy_config:
```

Update `CORS_ORIGIN` in `.env` to your real domain (`https://fleet.yourcompany.com`),
then bring the stack back up:
```bash
docker compose up -d --build
```
Caddy will automatically obtain and renew a Let's Encrypt certificate for
your domain on first request. `https://fleet.yourcompany.com` should now
serve the app with a valid certificate.

*(If your organisation already runs a corporate reverse proxy / load
balancer / WAF that terminates TLS for all internal apps, skip Caddy and
just point that existing proxy at this server's `frontend:8080`, or drop the
public `frontend` port to `127.0.0.1:8080:80` and let your existing proxy
reach it over your internal network instead.)*

---

## 7. Migrating data from the current deployment (skip if starting fresh)

Only do this if the current deployment already has **real fleet data** you
need to carry over (not just the demo seed). If you're starting clean, skip
straight to §8 — the seed already gives you a working demo fleet to sanity
check with, and you can delete/replace it once real users start.

### 7.1 Database
```bash
# From a machine that can reach BOTH databases (or run in two steps via a local dump file):

# Export from the current deployment (get its DATABASE_URL from wherever it's
# currently hosted — e.g. Railway dashboard → Postgres service → Connect tab)
pg_dump "$OLD_DATABASE_URL" -Fc -f fleet_backup.dump

# Import into the new server's Postgres (run BEFORE first app boot, or after
# stopping the backend container, so nothing writes mid-restore)
pg_restore --clean --if-exists -d "$NEW_DATABASE_URL" fleet_backup.dump
```
Set `SEED_ON_START=false` in `.env` before starting the backend against a
restored database — you don't want the seed script running against real data.

### 7.2 Uploaded files (compliance scans, invoices, accident photos)
- If the current deployment uses `STORAGE_DRIVER=local`: copy the contents of
  its `uploads` volume/directory to the new server's `uploads` volume
  (`docker cp`, `rsync`, or a tar transfer — whichever your current host
  allows access to).
- If it already uses `STORAGE_DRIVER=s3`: nothing to migrate — just configure
  the same `S3_*` credentials on the new server and it points at the same
  bucket. **This is the recommended setup going forward** if you're moving to
  infrastructure you manage, since it decouples file storage from any single
  container/host.

---

## 8. Go-live security checklist — do this before real users log in

All settings are environment variables — see `.env.example` for the full
list, and §14 below for the complete reference table.

- [ ] **`JWT_SECRET`** — replace with a long random string
      (`openssl rand -hex 32`). Anyone with this value can forge login
      sessions.
- [ ] **`POSTGRES_PASSWORD`** — replace the default.
- [ ] **`SEED_ADMIN_PASSWORD`** — set to a real password before first boot, or
      log in with the seeded admin and change it immediately after.
- [ ] **Delete/disable the demo accounts** listed in the README once real
      users are created (`workshop@fleet.local`, `compliance@fleet.local`,
      etc. all share the password `Passw0rd!`) — see §9.1.
- [ ] **`CORS_ORIGIN`** — set to your real domain (`https://fleet.yourcompany.com`),
      not `localhost`.
- [ ] **`SEED_ON_START=false`** once you have real data (prevents the seed
      from ever running again).
- [ ] Postgres and the raw API port are **not** publicly reachable (§6).
- [ ] SMTP configured with `EMAIL_DRY_RUN=false` if you want real alert
      emails sent (compliance expiries, PM due, etc.) — otherwise alerts only
      appear inside the app's Alert Centre and are logged, not emailed.
- [ ] HTTPS is live on your domain (§6) — never run production auth over
      plain HTTP.

None of this requires a code change — it's all `.env` configuration.

---

## 9. Day-2 operations

### 9.1 Users & roles
- Eleven roles enforced by a single server-side permissions matrix:
  `backend/src/config/permissions.ts`. To change what a role can do, edit
  that file — role checks are never scattered across individual route
  handlers, so this is the one place to look.
- Create real users via the app (Users screen, or `POST /api/users` as a
  Fleet Manager), then disable/delete the seeded demo accounts.

### 9.2 Backups
Back up two things on a schedule (daily is reasonable):
```bash
# Database (substitute your POSTGRES_USER / POSTGRES_DB if you changed the defaults)
docker compose exec -T db pg_dump -U fleet fleet_management -Fc > backup-$(date +%F).dump

# Uploaded files (skip if STORAGE_DRIVER=s3 — your S3 provider handles this)
docker compose cp backend:/app/uploads ./uploads-backup-$(date +%F)
```
Store backups off-server (S3, another host, etc.) — a backup that lives only
on the machine it's backing up isn't a real backup.

### 9.3 Monitoring & logs
- `GET /api/health` — unauthenticated liveness check, returns
  `{"status":"ok", ...}` plus active feature flags. Point your uptime
  monitor at this.
- `docker compose logs -f backend` — structured JSON logs (via `pino`) in
  production.
- The nightly alert engine (compliance expiries, PM due, warranty, lease
  expiry, etc.) logs a run summary automatically; it can also be triggered
  manually from the in-app Alert Centre, or `POST /api/alerts/run`.
- Schedule: `ALERT_CRON` (default `0 6 * * *`, i.e. 06:00 daily) and
  `TZ=Asia/Dubai` — both `.env`-configurable.

### 9.4 Updating the app (new code from us)
```bash
git pull origin main
docker compose up -d --build
```
The backend entrypoint re-runs `prisma migrate deploy` automatically on every
boot — this is safe and idempotent (already-applied migrations are skipped),
so this is the only step you need for routine updates.

### 9.5 Database schema changes
Never hand-edit the database. Schema changes go through Prisma migrations
(`backend/prisma/migrations/`), which `prisma migrate deploy` applies in
order on every deploy — that's how §9.4 stays a one-command update.

### 9.6 Tests
```bash
cd backend && npm test
```
Runs the unit + integration suite (alert engine, TCO/cost calculations, fuel
efficiency, odometer validation, the RBAC permissions matrix, fine
attribution, API/RBAC integration). Worth wiring into CI before you start
merging your own changes.

---

## 10. Feature flags

| Flag | Default | Effect |
|---|---|---|
| `FEATURE_INVENTORY` | `false` | Spare-parts inventory module is built but every route 404s while disabled. |
| `FEATURE_WHATSAPP` | `false` | WhatsApp notification channel stays inert; email (once configured) is the shipped channel. |

---

## 11. Security posture (already built in — nothing to configure)

- RBAC is enforced **server-side** on every request — the frontend UI hiding
  a button is a convenience, not the security boundary.
- Passwords are bcrypt-hashed; auth endpoints are rate-limited
  (`AUTH_RATE_WINDOW_MS` / `AUTH_RATE_MAX`).
- File uploads are validated by MIME type and size (`UPLOAD_MAX_SIZE_MB`,
  `UPLOAD_ALLOWED_MIME`).
- An audit log records who/when/before/after on financial, compliance,
  approval, and attendance changes — queryable, not just logged to disk.

---

## 12. Alternative: single-container / PaaS deployment

The repo also ships a **single-container** build (repo-root `Dockerfile` +
`railway.json`) that bundles the API and the built frontend into one
process — this is what the current demo deployment on Railway uses. If your
"own server" is actually a PaaS (Railway, Render, Fly.io, AWS App Runner,
Azure Container Apps, Google Cloud Run) rather than a VM, this single image
is usually the easier fit — point the platform at the repo-root `Dockerfile`,
attach a managed PostgreSQL, and set the same environment variables from §14.

See [`docs/DEPLOY_RAILWAY.md`](DEPLOY_RAILWAY.md) for a concrete walkthrough
of this path (Railway-specific, but the pattern — one Dockerfile, one env var
list, one managed Postgres — transfers directly to any similar PaaS).

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `backend` container restarts in a loop, logs show migration retries | Postgres isn't reachable yet or `DATABASE_URL` is wrong — entrypoint retries 10× then exits; check `docker compose logs db` and the `DATABASE_URL` value. |
| Login works but every other page 403s | `JWT_SECRET` differs between what issued the token and what's validating it now (e.g. changed mid-session after a redeploy) — log out and back in. |
| Browser can't reach the app on your domain but `curl` from the server works | DNS not propagated yet, or the reverse proxy (§6) isn't pointed at the right service/port, or port 80/443 isn't open in the firewall/security group. |
| Uploaded files 404 after redeploy | Confirm the `uploads` named volume is declared and mounted (not accidentally recreated) — see `docker-compose.yml`; if using S3, confirm `S3_*` credentials are unchanged. |
| Alert emails never arrive | `EMAIL_DRY_RUN` is still `true` (default) — set to `false` and fill in `SMTP_*`. Until then, alerts still populate the in-app Alert Centre. |
| Seed re-ran and duplicated demo data | Shouldn't happen — the seed checks for existing vehicles first. If you see this, set `SEED_ON_START=false` and open an issue; don't hand-delete rows without checking foreign keys first. |

---

## 14. Full environment variable reference

All variables live in `.env` (copy from `.env.example`, which documents each
one inline). Grouped summary:

| Group | Variables | Notes |
|---|---|---|
| Database | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` | `DATABASE_URL` is what Prisma actually reads — the `POSTGRES_*` vars are consumed by the `db` service in `docker-compose.yml` to build it. |
| Server | `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `STATIC_DIR` | `STATIC_DIR` is only used by the single-container build (§12) — leave empty for the 3-service Docker Compose path. |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_ROUNDS` | Rotate `JWT_SECRET` before go-live. |
| Storage | `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `S3_*`, `UPLOAD_MAX_SIZE_MB`, `UPLOAD_ALLOWED_MIME` | `local` (default) or `s3`. |
| Email | `SMTP_*`, `EMAIL_DRY_RUN` | Dry-run logs instead of sending until configured. |
| Feature flags | `FEATURE_INVENTORY`, `FEATURE_WHATSAPP` | See §10. |
| Alert engine | `ALERT_CRON`, `TZ` | Cron syntax; default 06:00 Asia/Dubai daily. |
| Locale | `DEFAULT_CURRENCY`, `DEFAULT_LOCALE` | AED / en by default. |
| Rate limiting | `AUTH_RATE_WINDOW_MS`, `AUTH_RATE_MAX` | Applies to `/api/auth/*` only. |
| Seed | `SEED_ON_START`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Set `SEED_ON_START=false` once you have real data. |

---

## 15. Related documents

- [`docs/DATA_MODEL.md`](DATA_MODEL.md) — entities and relationships
- [`docs/API.md`](API.md) — REST endpoints per module
- [`docs/DECISIONS.md`](DECISIONS.md) — architecture decisions & assumptions
- [`docs/DEPLOY_RAILWAY.md`](DEPLOY_RAILWAY.md) — PaaS deployment walkthrough (§12)
- Root [`README.md`](../README.md) — quick start, demo logins, repo layout
