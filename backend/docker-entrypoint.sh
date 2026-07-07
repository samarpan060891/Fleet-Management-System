#!/bin/sh
set -e

# Wait for the database, then migrate. On managed hosts (e.g. Railway) the DB
# may not accept connections the instant the container starts.
echo "Applying database migrations…"
i=1
until npx prisma migrate deploy; do
  if [ "$i" -ge 10 ]; then
    echo "Database not reachable after $i attempts — giving up."
    exit 1
  fi
  echo "Migration attempt $i failed (DB not ready?). Retrying in 3s…"
  i=$((i + 1))
  sleep 3
done

# Seed only when empty (the seed self-guards on existing data).
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "Seeding database (safe/idempotent)…"
  npx ts-node --transpile-only prisma/seed.ts || echo "Seed skipped or already applied"
fi

echo "Starting API…"
exec node dist/index.js
