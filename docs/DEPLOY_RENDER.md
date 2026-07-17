# Deploying to Render (IT-owned account)

This deploys the whole app as **one web service** (the Express backend serves
the built React SPA, same image as the Railway build) plus a **managed
PostgreSQL** — a single public URL, no Docker/server administration required.

This path exists specifically so IT can run the app on infrastructure they
own and control outright, independent of whoever currently manages the
existing deployment. See [`docs/HANDOVER.md`](HANDOVER.md) for the full
context (§12) and the broader operational handover.

---

## 1. Prerequisites

- A Render account: https://render.com (sign in with GitHub — recommended,
  makes repo access setup automatic).
- This repository accessible on GitHub to the account doing the deploy
  (`samarpan060891/Fleet-Management-System`, branch `main`).

---

## 2. Steps — Blueprint deploy (recommended, ~5 minutes)

The repo includes [`render.yaml`](../render.yaml) — a Blueprint that
describes the whole stack (web service + database) in one file, so Render
provisions everything in one pass instead of manual dashboard clicking.

### 1. Create the Blueprint instance
- Render dashboard → **New** → **Blueprint**.
- Connect your GitHub account if you haven't, then select
  `samarpan060891/Fleet-Management-System`, branch `main`.
- Render detects `render.yaml` and shows a preview of what it will create:
  one **Web Service** (`fleet-management`, Docker runtime) and one
  **PostgreSQL** database (`fleet-postgres`).

### 2. Fill in the secrets Render prompts for
The Blueprint deliberately does **not** commit secrets to the repo. Render
will ask you to fill these in before the first deploy:

| Variable | What to enter |
|---|---|
| `SEED_ADMIN_PASSWORD` | A real password for the seeded admin account (not the repo's demo default). |
| `CORS_ORIGIN` | Leave blank for now — Render doesn't know the assigned URL until after the first deploy. Come back and set this in step 5. |

Everything else (`DATABASE_URL`, `JWT_SECRET`, feature flags, etc.) is wired
automatically by the Blueprint.

### 3. Deploy
- Click **Apply** / **Deploy Blueprint**. Render builds the repo-root
  `Dockerfile` and provisions the database in parallel — first build takes a
  few minutes.
- Watch the web service's **Logs** tab: you'll see migrations apply, the
  seed run, then `Fleet Management API listening…`.

### 4. Verify
- Render assigns a URL like `https://fleet-management-xxxx.onrender.com`.
- Health check: `https://<your-render-url>/api/health` → `{"status":"ok",...}`.
- Open the URL and sign in with a demo login (see root `README.md`), e.g.
  `admin@fleet.local` / the password you set in step 2.

### 5. Close the loop on CORS
Now that you know the real URL (or have added a custom domain — §3
below), go to the web service → **Environment** → set `CORS_ORIGIN` to that
exact URL (e.g. `https://fleet.yourcompany.com`, or the `.onrender.com` one
if you're not using a custom domain), and **Manual Deploy → Deploy latest
commit** to apply it.

Every push to `main` auto-redeploys from here on.

---

## 3. Custom domain + HTTPS

Render provisions and renews TLS certificates automatically — no reverse
proxy or Caddy/Certbot setup needed (unlike the self-hosted Docker Compose
path in `docs/HANDOVER.md` §6).

1. Web service → **Settings** → **Custom Domains** → **+ Add Custom Domain**.
   Use a subdomain (e.g. `fleet.yourcompany.com`) — simpler DNS than an apex
   `yourcompany.com`, which needs an ALIAS/ANAME record most providers handle
   differently.
2. Render shows the CNAME target to create (something like
   `fleet-management-xxxx.onrender.com`). Add that as a **CNAME record** for
   your subdomain at your DNS provider. Don't add an `AAAA` record — Render
   serves over IPv4.
3. Back in Render, click **Verify**. Once DNS resolves, Render automatically
   requests and installs a Let's Encrypt certificate — usually within a few
   minutes.
4. Update `CORS_ORIGIN` (step 5 above) to the final `https://` domain.

---

## 4. File storage — read this before real documents get uploaded

`STORAGE_DRIVER` defaults to `local`, which writes uploaded compliance docs,
invoices, and incident photos to the container's own filesystem. **On
Render, that filesystem is ephemeral** — anything written there is lost on
every redeploy or restart, unless you attach a persistent disk. Two options:

- **Recommended — switch to S3-compatible storage.** Set
  `STORAGE_DRIVER=s3` and the `S3_*` variables (any S3-compatible provider;
  `me-central-1` for UAE data residency). Files then live outside the
  container entirely and survive redeploys, scaling, or even migrating to a
  different host later.
- **Or attach a Render persistent disk**, if you'd rather stay on local
  storage. Add to the web service in `render.yaml`:
  ```yaml
      disk:
        name: fleet-uploads
        mountPath: /app/uploads
        sizeGB: 10
  ```
  Note: disks require a paid plan (not the free tier) and the service **can't
  be horizontally scaled** while a disk is attached — fine for this app's
  scale, just worth knowing.

---

## 5. Migrating data from the current (Railway) deployment

Skip this if you're starting fresh — the Blueprint's seed step already gives
you a working demo fleet.

If there's real data to carry over:

```bash
# 1. Export from the current Railway Postgres. Get its connection string from
#    whoever has access to that Railway project's Postgres service → Connect tab.
pg_dump "$RAILWAY_DATABASE_URL" -Fc -f fleet_backup.dump

# 2. Import into the new Render Postgres. In the Render dashboard, open the
#    fleet-postgres database → Connect → copy the "External Database URL"
#    (the internal one isn't reachable from outside Render's network).
pg_restore --clean --if-exists -d "$RENDER_EXTERNAL_DATABASE_URL" fleet_backup.dump
```

Then set `SEED_ON_START=false` on the web service (Environment tab) before
the next deploy, so the seed script never runs against real data.

For uploaded files: if the old deployment used local storage, someone with
access to it needs to copy the files out (there's no direct volume-to-volume
transfer between unrelated hosts); if it already used S3, just point the new
service at the same bucket/credentials — nothing to copy.

---

## 6. Notes & troubleshooting

- **Build source:** Render builds the repo-root `Dockerfile` — the same one
  used for Railway and referenced by `docs/HANDOVER.md`'s single-container
  path. The `/backend` and `/frontend` Dockerfiles are for the self-hosted
  Docker Compose path only.
- **Port:** Render injects `PORT=10000` into the container automatically; the
  app already reads `process.env.PORT` (see `backend/src/config/env.ts`), so
  no configuration is needed here.
- **DB not ready on first boot:** the entrypoint retries `prisma migrate
  deploy` up to 10× (Render also restarts on failure), so a slow-provisioning
  database self-heals.
- **Re-seeding:** the seed skips if vehicles already exist. Set
  `SEED_ON_START=false` once you have real data.
- **Free plan caveats:** the free web service plan spins down after
  inactivity (slow first request after idle) and the free Postgres plan
  expires after 30 days. Use `starter` or above (as the Blueprint already
  specifies) for anything beyond a quick trial.
