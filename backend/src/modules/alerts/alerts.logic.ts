import { AlertSeverity } from '@prisma/client';

// Pure alert-rule helpers — unit-tested directly.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days from `now` until `date` (negative if past).
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / MS_PER_DAY);
}

export interface ComplianceEval {
  severity: AlertSeverity;
  shouldAlert: boolean;
  daysLeft: number;
  overdue: boolean;
}

// Given days-left and configured alert windows (e.g. [60,30,15,7]), decide
// whether an alert fires and its colour. Overdue → red + daily. Otherwise the
// nearest crossed window fires; the smallest window (or overdue) is red, the
// next amber, further out green/no-alert.
export function evaluateCompliance(daysLeft: number, windows: number[]): ComplianceEval {
  const sorted = [...windows].sort((a, b) => b - a); // descending, e.g. [60,30,15,7]
  const smallest = sorted[sorted.length - 1] ?? 7;

  if (daysLeft < 0) {
    return { severity: 'red', shouldAlert: true, daysLeft, overdue: true };
  }
  // Within the smallest (most urgent) window → red.
  if (daysLeft <= smallest) {
    return { severity: 'red', shouldAlert: true, daysLeft, overdue: false };
  }
  // Within any larger window → amber.
  const maxWindow = sorted[0] ?? 60;
  if (daysLeft <= maxWindow) {
    return { severity: 'amber', shouldAlert: true, daysLeft, overdue: false };
  }
  return { severity: 'green', shouldAlert: false, daysLeft, overdue: false };
}

export interface MaintenanceEval {
  severity: AlertSeverity;
  shouldAlert: boolean;
  overdue: boolean;
}

// PM due within X km OR X days → amber; overdue on either → red.
export function evaluateMaintenance(params: {
  kmToNext: number | null; // nextPmKm - currentOdometer
  daysToNext: number | null; // days until nextPmDate
  dueKm: number;
  dueDays: number;
}): MaintenanceEval {
  const { kmToNext, daysToNext, dueKm, dueDays } = params;
  const overdue =
    (kmToNext != null && kmToNext < 0) || (daysToNext != null && daysToNext < 0);
  if (overdue) return { severity: 'red', shouldAlert: true, overdue: true };

  const dueSoon =
    (kmToNext != null && kmToNext <= dueKm) || (daysToNext != null && daysToNext <= dueDays);
  if (dueSoon) return { severity: 'amber', shouldAlert: true, overdue: false };

  return { severity: 'green', shouldAlert: false, overdue: false };
}

// Fine aging: unpaid and older than threshold → red.
export function evaluateFineAging(ageDays: number, agingDays: number): boolean {
  return ageDays > agingDays;
}

// Warranty by date or km.
export function evaluateWarranty(params: {
  daysToEnd: number | null;
  kmToEnd: number | null; // warrantyEndKm - currentOdometer
}): { severity: AlertSeverity; shouldAlert: boolean } {
  const { daysToEnd, kmToEnd } = params;
  const expired = (daysToEnd != null && daysToEnd < 0) || (kmToEnd != null && kmToEnd < 0);
  if (expired) return { severity: 'red', shouldAlert: true };
  const near = (daysToEnd != null && daysToEnd <= 30) || (kmToEnd != null && kmToEnd <= 1000);
  if (near) return { severity: 'amber', shouldAlert: true };
  return { severity: 'green', shouldAlert: false };
}
