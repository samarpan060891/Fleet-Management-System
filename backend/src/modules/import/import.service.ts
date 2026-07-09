import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import customParse from 'dayjs/plugin/customParseFormat';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ImportColumn, ImportDef } from './import.defs';

dayjs.extend(customParse);

// Turns a raw thrown error into a short, user-facing message instead of a
// Prisma stack trace (e.g. a unique-constraint violation on re-import).
function friendlyErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? 'value';
      const field = Array.isArray(target) ? target.join(', ') : target;
      return `A record with this ${field} already exists`;
    }
    return err.message.split('\n').pop()?.trim() || 'Database error';
  }
  return err instanceof Error ? err.message : 'Invalid row';
}

export interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  created?: number;
}

// Build a downloadable .xlsx template for a resource: a Template sheet with the
// header row, plus an Instructions sheet documenting each column.
export async function buildTemplate(def: ImportDef): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Template');
  ws.columns = def.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(16, c.label.length + 4) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0F0' } };

  const info = wb.addWorksheet('Instructions');
  info.columns = [
    { header: 'Column', key: 'label', width: 26 },
    { header: 'Required', key: 'req', width: 10 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Allowed values', key: 'enum', width: 40 },
    { header: 'Example', key: 'ex', width: 20 },
    { header: 'Notes', key: 'note', width: 44 },
  ];
  info.getRow(1).font = { bold: true };
  for (const c of def.columns) {
    info.addRow({
      label: c.label, req: c.required ? 'Yes' : 'No', type: c.type ?? 'text',
      enum: c.enumValues?.join(', ') ?? '', ex: c.example ?? '', note: c.note ?? '',
    });
  }
  info.addRow({});
  info.addRow({ label: 'Dates', note: 'Use format YYYY-MM-DD (e.g. 2026-12-31).' });
  return wb;
}

// Coerce a raw cell value by column type; returns { value } or { error }.
function coerce(col: ImportColumn, raw: unknown): { value?: unknown; error?: string } {
  const empty = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
  if (empty) {
    if (col.required) return { error: `${col.label} is required` };
    return { value: undefined };
  }
  const type = col.type ?? 'string';
  if (type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: `${col.label} must be a number (got "${raw}")` };
    return { value: n };
  }
  if (type === 'boolean') {
    return { value: ['true', 'yes', '1', 'y'].includes(String(raw).toLowerCase()) };
  }
  if (type === 'date') {
    if (raw instanceof Date) return { value: raw };
    const s = String(raw).trim();
    const d = dayjs(s, ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY/MM/DD', 'D/M/YYYY'], true);
    if (!d.isValid()) return { error: `${col.label} is not a valid date (use YYYY-MM-DD): "${raw}"` };
    return { value: d.toDate() };
  }
  const s = String(raw).trim();
  if (col.enumValues && !col.enumValues.includes(s)) {
    return { error: `${col.label} must be one of: ${col.enumValues.join(', ')} (got "${s}")` };
  }
  return { value: s };
}

// Parse an uploaded workbook into coerced rows keyed by column key.
async function parseRows(def: ImportDef, buffer: Buffer): Promise<{ rowNum: number; raw: Record<string, unknown>; errors: string[] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet found in the uploaded file');

  // Map header columns (row 1) to our column keys by label (case-insensitive).
  const headerRow = ws.getRow(1);
  const colByIndex = new Map<number, ImportColumn>();
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? '').trim().toLowerCase();
    const col = def.columns.find((c) => c.label.toLowerCase() === label || c.key.toLowerCase() === label);
    if (col) colByIndex.set(colNumber, col);
  });

  const out: { rowNum: number; raw: Record<string, unknown>; errors: string[] }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // Skip fully-empty rows.
    const hasValue = Array.isArray(row.values) ? (row.values as unknown[]).some((v) => v !== null && v !== undefined && String(v).trim() !== '') : false;
    if (!hasValue) continue;

    const raw: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const [idx, col] of colByIndex) {
      const cell = row.getCell(idx);
      const cellVal = cell.value instanceof Object && 'result' in (cell.value as object) ? (cell.value as { result: unknown }).result : cell.value;
      const { value, error } = coerce(col, cellVal);
      if (error) errors.push(error);
      else if (value !== undefined) raw[col.key] = value;
    }
    out.push({ rowNum: r, raw, errors });
  }
  return out;
}

// Validate (+ optionally commit) an uploaded file against a resource def.
export async function runImport(def: ImportDef, buffer: Buffer, commit: boolean, actorId: string): Promise<ImportResult> {
  const parsed = await parseRows(def, buffer);
  const errors: { row: number; message: string }[] = [];
  const buildable: { rowNum: number; data: Record<string, unknown> }[] = [];

  for (const p of parsed) {
    if (p.errors.length) {
      errors.push({ row: p.rowNum, message: p.errors.join('; ') });
      continue;
    }
    try {
      const data = await def.build(p.raw, prisma, actorId, commit);
      buildable.push({ rowNum: p.rowNum, data });
    } catch (err) {
      errors.push({ row: p.rowNum, message: friendlyErrorMessage(err) });
    }
  }

  const result: ImportResult = {
    dryRun: !commit,
    totalRows: parsed.length,
    validCount: buildable.length,
    errorCount: errors.length,
    errors: errors.slice(0, 200),
  };

  if (commit) {
    let created = 0;
    for (const b of buildable) {
      try {
        await def.create(b.data, prisma, actorId);
        created++;
      } catch (err) {
        result.errors.push({ row: b.rowNum, message: friendlyErrorMessage(err) });
      }
    }
    result.created = created;
    result.errorCount = result.errors.length;
  }

  return result;
}
