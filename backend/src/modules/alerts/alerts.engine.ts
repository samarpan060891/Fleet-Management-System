import { AlertCategory, AlertSeverity, DocType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getAllSettings } from '../settings/settings.service';
import { notify } from '../../lib/notifications';
import {
  daysUntil,
  evaluateCompliance,
  evaluateFineAging,
  evaluateMaintenance,
  evaluateWarranty,
} from './alerts.logic';

interface UpsertAlertInput {
  category: AlertCategory;
  severity: AlertSeverity;
  dedupeKey: string;
  vehicleId?: string | null;
  driverId?: string | null;
  routeId?: string | null;
  title: string;
  message: string;
  dueDate?: Date | null;
}

// Categories that trigger email delivery for critical (red) alerts.
const EMAIL_CATEGORIES: AlertCategory[] = [
  'compliance_expiry',
  'fuel_anomaly',
  'downtime_vor',
  'fine_aging',
];

const DOC_LABEL: Record<DocType, string> = {
  mulkiya: 'Registration (Mulkiya)',
  insurance: 'Insurance',
  tasjeel: 'Technical inspection (Tasjeel)',
  lease: 'Lease',
  warranty: 'Warranty',
  permit: 'Operating/branding permit',
  licence: 'Driving licence',
  emirates_id: 'Emirates ID',
  visa: 'Visa',
  passport: 'Passport',
};

// Result summary for the daily run / manual trigger.
export interface AlertRunSummary {
  evaluated: number;
  created: number;
  updated: number;
  resolved: number;
  notified: number;
}

export async function runAlertEngine(now: Date = new Date()): Promise<AlertRunSummary> {
  const settings = await getAllSettings();
  const summary: AlertRunSummary = { evaluated: 0, created: 0, updated: 0, resolved: 0, notified: 0 };
  const seenKeys = new Set<string>();
  const renotifyDays = settings['alerts.renotifyDays'] ?? 1;

  const upsert = async (input: UpsertAlertInput) => {
    summary.evaluated++;
    seenKeys.add(input.dedupeKey);
    const existing = await prisma.alert.findUnique({ where: { dedupeKey: input.dedupeKey } });

    let shouldNotify = false;
    if (!existing) {
      await prisma.alert.create({
        data: {
          category: input.category,
          severity: input.severity,
          dedupeKey: input.dedupeKey,
          vehicleId: input.vehicleId ?? null,
          driverId: input.driverId ?? null,
          routeId: input.routeId ?? null,
          title: input.title,
          message: input.message,
          dueDate: input.dueDate ?? null,
        },
      });
      summary.created++;
      shouldNotify = input.severity === 'red';
    } else {
      await prisma.alert.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          title: input.title,
          message: input.message,
          dueDate: input.dueDate ?? null,
          resolved: false,
          resolvedAt: null,
        },
      });
      summary.updated++;
      // Re-notify per cadence for red alerts.
      const last = existing.lastNotifiedAt?.getTime() ?? 0;
      const dueAgain = now.getTime() - last >= renotifyDays * 24 * 60 * 60 * 1000;
      shouldNotify = input.severity === 'red' && dueAgain;
    }

    if (shouldNotify && EMAIL_CATEGORIES.includes(input.category)) {
      const recipients =
        settings['alerts.emailRecipients']?.[input.category] ?? [];
      if (recipients.length) {
        await notify({
          to: recipients,
          subject: `[Fleet Alert] ${input.title}`,
          body: input.message,
          category: input.category,
        });
      }
      await prisma.alert.update({
        where: { dedupeKey: input.dedupeKey },
        data: { lastNotifiedAt: now, notifyCount: { increment: 1 } },
      });
      summary.notified++;
    }
  };

  // --- Rule 1: Compliance expiries ---
  const windows = settings['compliance.windows'] as Record<string, number[]>;
  const docs = await prisma.complianceDocument.findMany({
    where: { isActive: true, expiryDate: { not: null } },
    include: {
      vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } },
      driver: { select: { id: true, fullName: true } },
    },
  });
  for (const doc of docs) {
    const dLeft = daysUntil(doc.expiryDate!, now);
    const win = windows[doc.docType] ?? [60, 30, 15, 7];
    const evalRes = evaluateCompliance(dLeft, win);
    if (!evalRes.shouldAlert) continue;
    const subject = doc.vehicle
      ? `${doc.vehicle.plateNumber} (${doc.vehicle.plateEmirate})`
      : doc.driver?.fullName ?? 'Unknown';
    const label = DOC_LABEL[doc.docType];
    const when = evalRes.overdue
      ? `overdue by ${Math.abs(dLeft)} day(s)`
      : `expires in ${dLeft} day(s)`;
    await upsert({
      category: 'compliance_expiry',
      severity: evalRes.severity,
      dedupeKey: `compliance:${doc.id}`,
      vehicleId: doc.vehicleId,
      driverId: doc.driverId,
      title: `${label} ${evalRes.overdue ? 'OVERDUE' : 'expiring'} — ${subject}`,
      message: `${label} for ${subject} ${when} (expiry ${doc.expiryDate!.toISOString().slice(0, 10)}).`,
      dueDate: doc.expiryDate,
    });
  }

  // --- Rule 2: Maintenance due / overdue ---
  const pmStates = await prisma.pmState.findMany({
    include: { vehicle: { select: { id: true, plateNumber: true, plateEmirate: true, currentOdometer: true, status: true } } },
  });
  for (const pm of pmStates) {
    if (!pm.vehicle || pm.vehicle.status === 'disposed') continue;
    const kmToNext = pm.nextPmKm != null ? pm.nextPmKm - pm.vehicle.currentOdometer : null;
    const daysToNext = pm.nextPmDate != null ? daysUntil(pm.nextPmDate, now) : null;
    if (kmToNext == null && daysToNext == null) continue;
    const evalRes = evaluateMaintenance({
      kmToNext,
      daysToNext,
      dueKm: settings['maintenance.dueKm'],
      dueDays: settings['maintenance.dueDays'],
    });
    if (!evalRes.shouldAlert) continue;
    const subject = `${pm.vehicle.plateNumber} (${pm.vehicle.plateEmirate})`;
    await upsert({
      category: 'maintenance_due',
      severity: evalRes.severity,
      dedupeKey: `pm:${pm.vehicleId}`,
      vehicleId: pm.vehicleId,
      title: `PM ${evalRes.overdue ? 'OVERDUE' : 'due soon'} — ${subject}`,
      message:
        `Preventive maintenance for ${subject} ` +
        `${evalRes.overdue ? 'is overdue' : 'is due soon'} ` +
        `(km to next: ${kmToNext ?? 'n/a'}, days to next: ${daysToNext ?? 'n/a'}).`,
      dueDate: pm.nextPmDate,
    });
  }

  // --- Rule 3: Fuel anomaly — unapproved cash over threshold ---
  const threshold = settings['fuel.cashApprovalThreshold'];
  const unapproved = await prisma.fuelTransaction.findMany({
    where: { isActive: true, channel: 'cash', approvalStatus: 'pending', amount: { gt: threshold } },
    include: { vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } } },
  });
  for (const tx of unapproved) {
    const subject = `${tx.vehicle.plateNumber} (${tx.vehicle.plateEmirate})`;
    await upsert({
      category: 'fuel_anomaly',
      severity: 'red',
      dedupeKey: `fuel-cash:${tx.id}`,
      vehicleId: tx.vehicleId,
      title: `Unapproved cash fuel fill — ${subject}`,
      message: `Cash fuel fill of AED ${tx.amount} for ${subject} exceeds the approval threshold (AED ${threshold}) and is still pending Fleet Manager approval.`,
    });
  }
  // Fuel logged without odometer (recent, last 30 days).
  const noOdo = await prisma.fuelTransaction.findMany({
    where: {
      isActive: true,
      odometer: null,
      filledAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } } },
  });
  for (const tx of noOdo) {
    const subject = `${tx.vehicle.plateNumber} (${tx.vehicle.plateEmirate})`;
    await upsert({
      category: 'fuel_anomaly',
      severity: 'amber',
      dedupeKey: `fuel-noodo:${tx.id}`,
      vehicleId: tx.vehicleId,
      title: `Fuel logged without odometer — ${subject}`,
      message: `A fuel transaction for ${subject} on ${tx.filledAt.toISOString().slice(0, 10)} was recorded without an odometer reading.`,
    });
  }

  // --- Rule 4: Fines aging ---
  const agingDays = settings['fines.agingDays'];
  const unpaidFines = await prisma.fine.findMany({
    where: { isActive: true, status: 'unpaid' },
    include: { vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } } },
  });
  for (const fine of unpaidFines) {
    const age = daysUntil(now, fine.offenceAt) * -1; // days since offence
    if (!evaluateFineAging(age, agingDays)) continue;
    const subject = `${fine.vehicle.plateNumber} (${fine.vehicle.plateEmirate})`;
    await upsert({
      category: 'fine_aging',
      severity: 'red',
      dedupeKey: `fine:${fine.id}`,
      vehicleId: fine.vehicleId,
      driverId: fine.driverId,
      title: `Unpaid fine aging — ${subject}`,
      message: `Fine ${fine.reference} (AED ${fine.amount}) for ${subject} has been unpaid for ${age} days (threshold ${agingDays}).`,
    });
  }

  // --- Rule 5: Salik low balance ---
  const saliks = await prisma.salikTag.findMany({
    include: { vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } } },
  });
  for (const s of saliks) {
    if (Number(s.balance) > Number(s.lowThreshold)) continue;
    const subject = `${s.vehicle.plateNumber} (${s.vehicle.plateEmirate})`;
    await upsert({
      category: 'salik_low',
      severity: 'amber',
      dedupeKey: `salik:${s.vehicleId}`,
      vehicleId: s.vehicleId,
      title: `Low Salik balance — ${subject}`,
      message: `Salik tag ${s.tagNumber} for ${subject} balance is AED ${s.balance} (threshold AED ${s.lowThreshold}).`,
    });
  }

  // --- Rule 6: Downtime / VOR ---
  const vorDays = settings['maintenance.vorDays'];
  const vorVehicles = await prisma.vehicle.findMany({
    where: { isActive: true, status: { in: ['vor', 'in_workshop'] } },
    select: { id: true, plateNumber: true, plateEmirate: true, status: true },
  });
  for (const v of vorVehicles) {
    // Days off-road ≈ days since the open job card started, if any.
    const openJob = await prisma.jobCard.findFirst({
      where: { vehicleId: v.id, status: { not: 'closed' } },
      orderBy: { dateIn: 'asc' },
    });
    const downtime = openJob ? daysUntil(now, openJob.dateIn) * -1 : 0;
    if (downtime <= vorDays) continue;
    const subject = `${v.plateNumber} (${v.plateEmirate})`;
    await upsert({
      category: 'downtime_vor',
      severity: 'red',
      dedupeKey: `vor:${v.id}`,
      vehicleId: v.id,
      title: `Vehicle off-road ${downtime} days — ${subject}`,
      message: `${subject} has been ${v.status} for ${downtime} days, exceeding the ${vorDays}-day threshold.`,
    });
  }

  // --- Rule 7: Contract / warranty ---
  const contractVehicles = await prisma.vehicle.findMany({
    where: { isActive: true, status: { not: 'disposed' } },
    select: {
      id: true,
      plateNumber: true,
      plateEmirate: true,
      currentOdometer: true,
      warrantyEndDate: true,
      warrantyEndKm: true,
      leaseEnd: true,
      ownership: true,
    },
  });
  for (const v of contractVehicles) {
    const subject = `${v.plateNumber} (${v.plateEmirate})`;
    if (v.warrantyEndDate || v.warrantyEndKm != null) {
      const w = evaluateWarranty({
        daysToEnd: v.warrantyEndDate ? daysUntil(v.warrantyEndDate, now) : null,
        kmToEnd: v.warrantyEndKm != null ? v.warrantyEndKm - v.currentOdometer : null,
      });
      if (w.shouldAlert) {
        await upsert({
          category: 'contract_warranty',
          severity: w.severity,
          dedupeKey: `warranty:${v.id}`,
          vehicleId: v.id,
          title: `Warranty ${w.severity === 'red' ? 'expired' : 'expiring'} — ${subject}`,
          message: `Warranty for ${subject} — end date ${v.warrantyEndDate?.toISOString().slice(0, 10) ?? 'n/a'}, end km ${v.warrantyEndKm ?? 'n/a'} (current ${v.currentOdometer} km).`,
          dueDate: v.warrantyEndDate,
        });
      }
    }
    if ((v.ownership === 'leased' || v.ownership === 'rented') && v.leaseEnd) {
      const dLeft = daysUntil(v.leaseEnd, now);
      if (dLeft <= 60) {
        await upsert({
          category: 'contract_warranty',
          severity: dLeft < 0 ? 'red' : 'amber',
          dedupeKey: `lease:${v.id}`,
          vehicleId: v.id,
          title: `${v.ownership === 'leased' ? 'Lease' : 'Rental'} ${dLeft < 0 ? 'ended' : 'ending'} — ${subject}`,
          message: `${v.ownership} contract for ${subject} ends ${v.leaseEnd.toISOString().slice(0, 10)} (${dLeft} days).`,
          dueDate: v.leaseEnd,
        });
      }
    }
  }

  // --- Rule 8: Staff transport — unassigned routes & low attendance ---
  const routes = await prisma.route.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { employees: { where: { isActive: true } } } },
    },
  });
  for (const r of routes) {
    if (!r.vehicleId || !r.driverId) {
      await upsert({
        category: 'transport',
        severity: 'red',
        dedupeKey: `route-unassigned:${r.id}`,
        routeId: r.id,
        title: `Route without vehicle/driver — ${r.code}`,
        message: `Route ${r.code} (${r.name}) has no ${!r.vehicleId ? 'vehicle' : ''}${!r.vehicleId && !r.driverId ? ' and ' : ''}${!r.driverId ? 'driver' : ''} assigned.`,
      });
    }
    // Low attendance over the last 7 days.
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const att = await prisma.attendance.groupBy({
      by: ['status'],
      where: { routeId: r.id, date: { gte: since } },
      _count: true,
    });
    const present = att.find((a) => a.status === 'present')?._count ?? 0;
    const absent = att.find((a) => a.status === 'absent')?._count ?? 0;
    const total = present + absent;
    if (total >= 5) {
      const pct = (present / total) * 100;
      if (pct < settings['transport.lowAttendancePct']) {
        await upsert({
          category: 'transport',
          severity: 'amber',
          dedupeKey: `route-lowatt:${r.id}`,
          routeId: r.id,
          title: `Low attendance — ${r.code}`,
          message: `Route ${r.code} attendance is ${pct.toFixed(0)}% over the last 7 days (threshold ${settings['transport.lowAttendancePct']}%).`,
        });
      }
    }
  }

  // Resolve alerts that no longer fire (were active, not seen this run).
  const stale = await prisma.alert.findMany({
    where: { resolved: false, dedupeKey: { notIn: [...seenKeys] } },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.alert.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { resolved: true, resolvedAt: now },
    });
    summary.resolved += stale.length;
  }

  logger.info({ summary }, 'Alert engine run complete');
  return summary;
}
