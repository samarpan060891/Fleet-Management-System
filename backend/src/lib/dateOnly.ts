// Parses a date-only string (e.g. "2026-07-08") as UTC midnight, for use with
// Prisma `@db.Date` columns. The server runs with TZ=Asia/Dubai (UTC+4) so that
// `dayjs(str).startOf('day')` — which parses in local time — resolves to the
// previous UTC day once stored, causing off-by-one bugs against date-only
// columns (fleet_allocations.date, attendance.date). Always use this instead.
export function utcDateOnly(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
  }
  // Accept "YYYY-MM-DD" (optionally with a time/offset — we only keep the date part).
  const datePart = input.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Today at UTC midnight.
export function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
