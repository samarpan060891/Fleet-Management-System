# Deploying to Railway (live demo)

This deploys the whole app as **one web service** (the Express backend serves the
built React SPA) plus a **managed PostgreSQL** — a single public URL.

Railway builds the repo-root [`Dockerfile`](../Dockerfile). On boot the container
runs migrations and an idempotent seed, so you get a populated, demoable app.

---

## Prerequisites
- A Railway account: https://railway.com (sign in with GitHub).
- This repository on GitHub with the code on a branch Railway can deploy.
  The code currently lives on `claude/new-session-98pbya` (PR #1). Either
  **merge PR #1 into `main`** first, or pick the feature branch in step 2.

---

## Steps (GitHub deploy — recommended, ~5 minutes)

### 1. Create the project
- Railway dashboard → **New Project** → **Deploy from GitHub repo** →
  select `samarpan060891/Fleet-Management-System`.
- Railway detects the root `Dockerfile` and creates a service. If it asks for a
  branch, choose `main` (after merging) or `claude/new-session-98pbya`.

### 2. Add PostgreSQL
- In the project → **New** → **Database** → **Add PostgreSQL**.
- This creates a `Postgres` service exposing a `DATABASE_URL` variable.

### 3. Wire variables on the web service
Open the web (app) service → **Variables** → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` &nbsp;(reference — adjust name if your DB service isn't called `Postgres`) |
| `JWT_SECRET` | a long random string |
| `SEED_ON_START` | `true` (loads demo data on first boot; set `false` later) |
| `EMAIL_DRY_RUN` | `true` (logs alert emails instead of sending) |
| `SEED_ADMIN_EMAIL` | `admin@fleet.local` |
| `SEED_ADMIN_PASSWORD` | choose a strong password |

You do **not** set `PORT` — Railway injects it and the app reads it.

### 4. Expose a public URL
- Web service → **Settings** → **Networking** → **Generate Domain**.
- Railway assigns e.g. `https://<name>.up.railway.app`.

### 5. Deploy & open
- Railway builds the Dockerfile and deploys. First build takes a few minutes.
- Watch **Deploy Logs**: you'll see migrations apply, the seed run, then
  `Fleet Management API listening…`.
- Health check: `https://<your-domain>/api/health` returns `{"status":"ok"}`.
- Open `https://<your-domain>` and sign in with a demo login (see README), e.g.
  `admin@fleet.local`.

Every push to the deployed branch auto-redeploys.

---

## Alternative: Railway CLI

```bash
npm i -g @railway/cli
railway login
railway init                 # or: railway link  (existing project)
railway add --database postgres
railway variables --set JWT_SECRET=$(openssl rand -hex 32) \
                  --set DATABASE_URL='${{Postgres.DATABASE_URL}}'
railway up                   # builds the root Dockerfile and deploys
railway domain               # generate a public URL
```

---

## Notes & troubleshooting
- **Build source:** Railway uses the repo-root `Dockerfile` and `railway.json`
  (health check `/api/health`). The `/backend` and `/frontend` Dockerfiles are for
  local `docker-compose` only.
- **DB not ready on first boot:** the entrypoint retries `prisma migrate deploy`
  up to 10× (Railway also restarts on failure), so a slow-provisioning DB
  self-heals.
- **Re-seeding:** the seed skips if vehicles already exist. Set
  `SEED_ON_START=false` once you have real data.
- **Turn off demo data emails:** keep `EMAIL_DRY_RUN=true` unless you configure
  real `SMTP_*` variables.
- **Custom domain / UAE region:** add a custom domain under Networking; choose a
  region close to the UAE in project settings. No code depends on a specific region.
