import { prisma } from '../../lib/prisma';
import { DEFAULT_SETTINGS, SETTING_LABELS, SettingsShape } from './settings.defaults';

// Settings service: reads fall back to defaults so rules always have a value.
export async function getSetting<K extends keyof SettingsShape>(
  key: K
): Promise<SettingsShape[K]> {
  const row = await prisma.setting.findUnique({ where: { key: key as string } });
  if (row) return row.value as SettingsShape[K];
  return DEFAULT_SETTINGS[key];
}

// Load all settings merged over defaults.
export async function getAllSettings(): Promise<SettingsShape> {
  const rows = await prisma.setting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) merged[r.key] = r.value;
  return merged as unknown as SettingsShape;
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value: value as any,
      label: SETTING_LABELS[key] ?? key,
      updatedBy,
    },
    update: { value: value as any, updatedBy },
  });
}

// Ensure all defaults exist in the table (idempotent; used by seed).
export async function ensureSettingsSeeded(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as any, label: SETTING_LABELS[key] ?? key },
      update: {},
    });
  }
}
