import { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

// Normalizes free text into a stored slug (e.g. "3 Ton Pick up" -> "3_ton_pick_up").
export function normalizeOptionValue(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '_');
}

// Capitalizes the first letter of each word for display (e.g. "truck_3_7t" ->
// "Truck 3 7t"). Applied whenever a user-added label isn't given explicitly.
export function titleCaseOption(s: string): string {
  return s.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normalizes `raw` and makes sure it exists as a picklist option under
// `listKey` (creating it if this is a new value), so it shows up as a
// selectable category going forward — not just a raw string on one record.
// Returns the normalized value to store on the record itself.
export async function ensureOptionListValue(db: Db, listKey: string, raw: string, actorId?: string): Promise<string> {
  const value = normalizeOptionValue(raw);
  if (!value) return value;
  await db.optionListItem.upsert({
    where: { listKey_value: { listKey, value } },
    create: { listKey, value, label: titleCaseOption(raw), createdBy: actorId },
    update: {},
  });
  return value;
}
