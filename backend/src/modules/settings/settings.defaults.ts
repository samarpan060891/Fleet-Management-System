import { DocType } from '@prisma/client';

// All admin-configurable thresholds live here as defaults and are seeded into
// the `settings` table. Nothing is hard-coded in rule logic — rules read these.

// Compliance alert windows (days before expiry), then daily once overdue.
// Editable per document type in Settings.
export const DEFAULT_COMPLIANCE_WINDOWS: Record<DocType, number[]> = {
  mulkiya: [60, 30, 15, 7],
  insurance: [60, 30, 15, 7],
  tasjeel: [60, 30, 15, 7],
  lease: [60, 30, 15, 7],
  warranty: [60, 30, 15, 7],
  permit: [60, 30, 15, 7],
  licence: [60, 30, 15, 7],
  emirates_id: [60, 30, 15, 7],
  visa: [60, 30, 15, 7],
  passport: [60, 30, 15, 7],
};

export interface SettingsShape {
  'compliance.windows': Record<string, number[]>;
  'maintenance.dueKm': number; // within X km of next PM
  'maintenance.dueDays': number; // within X days of next PM
  'maintenance.vorDays': number; // vehicle off-road > X days
  'fuel.anomalyDeviationPct': number; // km/l deviation > X% from rolling avg
  'fuel.cashApprovalThreshold': number; // cash fill above this needs approval
  'fuel.rollingWindow': number; // number of prior fills for rolling average
  'fines.agingDays': number; // unpaid fine aging > X days
  'transport.lowAttendancePct': number; // low-attendance flag threshold
  'alerts.renotifyDays': number; // re-notify cadence for active alerts
  'depreciation.usefulLifeYears': number;
  'alerts.emailRecipients': Record<string, string[]>; // per alert category
}

export const DEFAULT_SETTINGS: SettingsShape = {
  'compliance.windows': DEFAULT_COMPLIANCE_WINDOWS,
  'maintenance.dueKm': 500,
  'maintenance.dueDays': 15,
  'maintenance.vorDays': 3,
  'fuel.anomalyDeviationPct': 20,
  'fuel.cashApprovalThreshold': 200,
  'fuel.rollingWindow': 5,
  'fines.agingDays': 30,
  'transport.lowAttendancePct': 70,
  'alerts.renotifyDays': 1,
  'depreciation.usefulLifeYears': 5,
  'alerts.emailRecipients': {
    compliance_expiry: ['compliance@fleet.local'],
    fuel_anomaly: ['fleet.manager@fleet.local'],
    downtime_vor: ['fleet.manager@fleet.local'],
    fine_aging: ['fleet.manager@fleet.local'],
  },
};

// PM schedule defaults per vehicle type (km / days). Seeded into pm_schedules.
export const DEFAULT_PM_SCHEDULES: Record<string, { km: number; days: number }> = {
  sedan: { km: 10000, days: 180 },
  light: { km: 10000, days: 180 },
  pickup: { km: 10000, days: 180 },
  van: { km: 10000, days: 180 },
  truck_3_7t: { km: 15000, days: 180 },
  bus: { km: 10000, days: 120 },
};

export const SETTING_LABELS: Record<string, string> = {
  'compliance.windows': 'Compliance alert windows (days before expiry)',
  'maintenance.dueKm': 'Maintenance due within (km)',
  'maintenance.dueDays': 'Maintenance due within (days)',
  'maintenance.vorDays': 'Vehicle Off Road (VOR) / downtime breach threshold (days)',
  'fuel.anomalyDeviationPct': 'Fuel efficiency deviation threshold (%)',
  'fuel.cashApprovalThreshold': 'Cash fuel approval threshold (AED)',
  'fuel.rollingWindow': 'Fuel rolling-average window (fills)',
  'fines.agingDays': 'Unpaid fine aging threshold (days)',
  'transport.lowAttendancePct': 'Route low-attendance threshold (%)',
  'alerts.renotifyDays': 'Alert re-notify cadence (days)',
  'depreciation.usefulLifeYears': 'Default depreciation useful life (years)',
  'alerts.emailRecipients': 'Email recipients per alert category',
};
