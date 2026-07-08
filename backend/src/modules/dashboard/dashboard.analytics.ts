import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';

const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// Fleet age (model-year + in-service) and experience (driver tenure + usage).
export async function computeFleetProfile() {
  const now = dayjs();
  const currentYear = now.year();

  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true, status: { not: 'disposed' } },
    select: { year: true, currentOdometer: true, purchase: { select: { purchaseDate: true } } },
  });
  const drivers = await prisma.driver.findMany({
    where: { isActive: true, status: 'active', joiningDate: { not: null } },
    select: { joiningDate: true },
  });

  const modelAges = vehicles.map((v) => Math.max(0, currentYear - v.year));
  const inServiceAges = vehicles
    .filter((v) => v.purchase?.purchaseDate)
    .map((v) => now.diff(dayjs(v.purchase!.purchaseDate), 'day') / 365);
  const kmPerYear = vehicles.map((v) => v.currentOdometer / Math.max(1, currentYear - v.year));

  const bands = { '0-3': 0, '3-6': 0, '6-10': 0, '10+': 0 };
  for (const a of modelAges) {
    if (a < 3) bands['0-3']++;
    else if (a < 6) bands['3-6']++;
    else if (a < 10) bands['6-10']++;
    else bands['10+']++;
  }

  const tenures = drivers.map((d) => now.diff(dayjs(d.joiningDate!), 'day') / 365);
  const tenureBands = { '0-1': 0, '1-3': 0, '3-5': 0, '5+': 0 };
  for (const t of tenures) {
    if (t < 1) tenureBands['0-1']++;
    else if (t < 3) tenureBands['1-3']++;
    else if (t < 5) tenureBands['3-5']++;
    else tenureBands['5+']++;
  }

  return {
    fleetAge: {
      avgModelYearAge: +mean(modelAges).toFixed(1),
      avgInServiceAge: +mean(inServiceAges).toFixed(1),
      distribution: bands,
      vehicleCount: vehicles.length,
    },
    experience: {
      avgDriverTenureYears: +mean(tenures).toFixed(1),
      driverCount: drivers.length,
      avgVehicleOdometer: Math.round(mean(vehicles.map((v) => v.currentOdometer))),
      avgKmPerYear: Math.round(mean(kmPerYear)),
      tenureDistribution: tenureBands,
    },
  };
}

export interface CostSummary {
  fuel: number;
  maintenance: number;
  fines: number;
  total: number;
}

// Fuel + maintenance (job card) + fines cost over an arbitrary period —
// shared by the MTD and YTD cost cards on the cockpit.
export async function computeCostSummary(from: Date, to: Date): Promise<CostSummary> {
  const [fuel, maint, fines] = await Promise.all([
    prisma.fuelTransaction.aggregate({ where: { isActive: true, filledAt: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.jobCard.aggregate({ where: { isActive: true, dateIn: { gte: from, lte: to } }, _sum: { totalCost: true } }),
    prisma.fine.aggregate({ where: { isActive: true, offenceAt: { gte: from, lte: to } }, _sum: { amount: true } }),
  ]);
  const fuelAmt = Number(fuel._sum.amount ?? 0);
  const maintAmt = Number(maint._sum.totalCost ?? 0);
  const finesAmt = Number(fines._sum.amount ?? 0);
  return {
    fuel: +fuelAmt.toFixed(2),
    maintenance: +maintAmt.toFixed(2),
    fines: +finesAmt.toFixed(2),
    total: +(fuelAmt + maintAmt + finesAmt).toFixed(2),
  };
}

export interface DowntimeStat {
  pct: number;
  downDays: number;
  vehicleDays: number;
}

// Fleet-wide downtime % over a period: each job card's in-workshop span
// (dateIn → dateOut, or → now if still open) clipped to the period, summed
// across all vehicles, divided by (active vehicles × period days). This is
// the same "days in workshop" signal the VOR alert threshold uses, just
// aggregated fleet-wide instead of per-vehicle.
export async function computeDowntimePct(from: Date, to: Date): Promise<DowntimeStat> {
  const now = new Date();
  const periodEnd = to.getTime() < now.getTime() ? to : now;
  const [activeVehicles, jobCards] = await Promise.all([
    prisma.vehicle.count({ where: { isActive: true, status: { not: 'disposed' } } }),
    prisma.jobCard.findMany({
      where: { isActive: true, dateIn: { lte: periodEnd }, OR: [{ dateOut: null }, { dateOut: { gte: from } }] },
      select: { dateIn: true, dateOut: true },
    }),
  ]);

  const fromMs = from.getTime();
  const toMs = periodEnd.getTime();
  let downDays = 0;
  for (const j of jobCards) {
    const startMs = Math.max(j.dateIn.getTime(), fromMs);
    const endMs = Math.min((j.dateOut ?? now).getTime(), toMs);
    downDays += Math.max(0, (endMs - startMs) / 86400000);
  }
  const periodDays = Math.max(1, (toMs - fromMs) / 86400000);
  const vehicleDays = activeVehicles * periodDays;
  const pct = vehicleDays > 0 ? (downDays / vehicleDays) * 100 : 0;
  return { pct: +pct.toFixed(1), downDays: Math.round(downDays), vehicleDays: Math.round(vehicleDays) };
}

export interface MonthCost {
  month: string; // YYYY-MM
  fuel: number;
  maintenance: number;
  compliance: number;
  total: number;
}

// Monthly fuel / maintenance / compliance cost over the last `months` months.
export async function computeCostTrends(months = 24): Promise<MonthCost[]> {
  const start = dayjs().subtract(months - 1, 'month').startOf('month');
  const startDate = start.toDate();

  const [fuel, jobs, docs] = await Promise.all([
    prisma.fuelTransaction.findMany({
      where: { isActive: true, filledAt: { gte: startDate }, OR: [{ approvalStatus: null }, { approvalStatus: 'approved' }] },
      select: { filledAt: true, amount: true },
    }),
    prisma.jobCard.findMany({ where: { isActive: true, dateIn: { gte: startDate } }, select: { dateIn: true, totalCost: true } }),
    prisma.complianceDocument.findMany({ where: { isActive: true, cost: { not: null }, issueDate: { gte: startDate } }, select: { issueDate: true, cost: true } }),
  ]);

  const buckets = new Map<string, MonthCost>();
  for (let i = 0; i < months; i++) {
    const key = start.add(i, 'month').format('YYYY-MM');
    buckets.set(key, { month: key, fuel: 0, maintenance: 0, compliance: 0, total: 0 });
  }
  const add = (date: Date, field: 'fuel' | 'maintenance' | 'compliance', amount: number) => {
    const key = dayjs(date).format('YYYY-MM');
    const b = buckets.get(key);
    if (b) { b[field] += amount; b.total += amount; }
  };
  for (const f of fuel) add(f.filledAt, 'fuel', Number(f.amount));
  for (const j of jobs) add(j.dateIn, 'maintenance', Number(j.totalCost ?? 0));
  for (const d of docs) add(d.issueDate!, 'compliance', Number(d.cost ?? 0));

  return [...buckets.values()].map((b) => ({
    month: b.month,
    fuel: +b.fuel.toFixed(2),
    maintenance: +b.maintenance.toFixed(2),
    compliance: +b.compliance.toFixed(2),
    total: +b.total.toFixed(2),
  }));
}

// Fiscal year here is the calendar year (Jan-Dec). Returns exactly 12 months,
// Jan through Dec, for the given year — used so YTD/trend charts always align
// to Jan-Dec rather than a rolling window that could straddle two years.
export async function computeCalendarYearCostTrends(year: number): Promise<MonthCost[]> {
  const yearStart = dayjs(`${year}-01-01`).startOf('year');
  const yearEnd = yearStart.endOf('year');

  const [fuel, jobs, docs] = await Promise.all([
    prisma.fuelTransaction.findMany({
      where: { isActive: true, filledAt: { gte: yearStart.toDate(), lte: yearEnd.toDate() }, OR: [{ approvalStatus: null }, { approvalStatus: 'approved' }] },
      select: { filledAt: true, amount: true },
    }),
    prisma.jobCard.findMany({ where: { isActive: true, dateIn: { gte: yearStart.toDate(), lte: yearEnd.toDate() } }, select: { dateIn: true, totalCost: true } }),
    prisma.complianceDocument.findMany({ where: { isActive: true, cost: { not: null }, issueDate: { gte: yearStart.toDate(), lte: yearEnd.toDate() } }, select: { issueDate: true, cost: true } }),
  ]);

  const buckets = new Map<string, MonthCost>();
  for (let m = 0; m < 12; m++) {
    const key = yearStart.add(m, 'month').format('YYYY-MM');
    buckets.set(key, { month: key, fuel: 0, maintenance: 0, compliance: 0, total: 0 });
  }
  const add = (date: Date, field: 'fuel' | 'maintenance' | 'compliance', amount: number) => {
    const key = dayjs(date).format('YYYY-MM');
    const b = buckets.get(key);
    if (b) { b[field] += amount; b.total += amount; }
  };
  for (const f of fuel) add(f.filledAt, 'fuel', Number(f.amount));
  for (const j of jobs) add(j.dateIn, 'maintenance', Number(j.totalCost ?? 0));
  for (const d of docs) add(d.issueDate!, 'compliance', Number(d.cost ?? 0));

  return [...buckets.values()].map((b) => ({
    month: b.month,
    fuel: +b.fuel.toFixed(2),
    maintenance: +b.maintenance.toFixed(2),
    compliance: +b.compliance.toFixed(2),
    total: +b.total.toFixed(2),
  }));
}
