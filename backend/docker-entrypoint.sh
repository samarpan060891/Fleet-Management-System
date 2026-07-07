#!/bin/sh
set -e

echo "Applying database migrations…"
npx prisma migrate deploy

# Seed only when the database is empty (idempotent guard).
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "Seeding database (safe/idempotent)…"
  node -e "require('@prisma/client'); " 2>/dev/null || true
  npx ts-node --transpile-only prisma/seed.ts || echo "Seed skipped or already applied"
fi

echo "Starting API…"
exec node dist/index.js
