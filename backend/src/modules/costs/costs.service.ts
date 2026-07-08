import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { getSetting } from '../settings/settings.service';
import {
  CostBuckets,
  cashCost,
  costPerKm,
  depreciationForPeriod,
  emptyBuckets,
  totalCostWithDepreciation,
} from './tco.logic';

export interface VehicleTco {
  vehicleId: string;
  plate: string;
  period: { from: string; to: string; days: number };
  buckets: CostBuckets;
  kmRun: number;
  cashCost: number;
  totalCost: number; // includes depreciation
  costPerKm: number | null; // includes depreciation
  cashCostPerKm: number | null;
}

// Rolls up all cost buckets for a vehicle over a period and computes cost/km.
export async function computeVehicleTco(
  vehicleId: string,
  from: Date,
  to: Date
): Promise<VehicleTco> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { purchase: true },
  });
  if (!vehicle) throw new Error('Vehicle not found');

  const inPeriod = { gte: from, lte: to };
  const buckets: CostBuckets = emptyBuckets();

  const [fuelAgg, jobs, tyres, fines, invoices] = await Promise.all([
    prisma.fuelTransaction.aggregate({
      where: { vehicleId, isActive: true, filledAt: inPeriod, OR: [{ approvalStatus: null }, { approvalStatus: 'approved' }] },
      _sum: { amount: true },
    }),
    prisma.jobCard.aggregate({ where: { vehicleId, isActive: true, dateIn: inPeriod }, _sum: { totalCost: true } }),
    prisma.tyre.aggregate({ where: { vehicleId, fitmentDate: inPeriod }, _sum: { cost: true } }),
    prisma.fine.aggregate({ where: { vehicleId, isActive: true, offenceAt: inPeriod }, _sum: { amount: true } }),
    // Vendor invoices supply insurance & permit/branding charges for the period.
    prisma.vendorInvoice.groupBy({
      by: ['category'],
      where: { vehicleId, isActive: true, invoiceDate: inPeriod, category: { in: ['insurance', 'permit', 'branding'] } },
      _sum: { amount: true },
    }),
  ]);

  buckets.fuel = Number(fuelAgg._sum.amount ?? 0);
  buckets.maintenance = Number(jobs._sum.totalCost ?? 0);
  buckets.tyres = Number(tyres._sum.cost ?? 0);
  buckets.fines = Number(fines._sum.amount ?? 0);
  buckets.insurance = Number(invoices.find((i) => i.category === 'insurance')?._sum.amount ?? 0);
  buckets.permit =
    Number(invoices.find((i) => i.category === 'permit')?._sum.amount ?? 0) +
    Number(invoices.find((i) => i.category === 'branding')?._sum.amount ?? 0);
  buckets.salik = 0; // Salik spend not tracked (balance only); see DECISIONS.md

  // Depreciation (straight-line) prorated across the period.
  const periodDays = Math.max(1, dayjs(to).diff(dayjs(from), 'day') + 1);
  const defaultLife = await getSetting('depreciation.usefulLifeYears');
  const purchasePrice = Number(vehicle.purchase?.purchasePrice ?? 0);
  const residual = Number(vehicle.residualValue ?? vehicle.purchase?.residualValue ?? 0);
  const life = vehicle.usefulLifeYears ?? vehicle.purchase?.usefulLifeYears ?? defaultLife;
  buckets.depreciation = purchasePrice > 0
    ? depreciationForPeriod({ purchasePrice, residualValue: residual, usefulLifeYears: life, periodDays })
    : 0;

  // km run = odometer delta over the period, from fuel readings within it.
  const readings = await prisma.fuelTransaction.findMany({
    where: { vehicleId, isActive: true, filledAt: inPeriod, odometer: { not: null } },
    orderBy: { odometer: 'asc' },
    select: { odometer: true },
  });
  const kmRun = readings.length >= 2 ? (readings[readings.length - 1].odometer! - readings[0].odometer!) : 0;

  const cash = cashCost(buckets);
  const total = totalCostWithDepreciation(buckets);

  return {
    vehicleId,
    plate: `${vehicle.plateNumber} (${vehicle.plateEmirate})`,
    period: { from: from.toISOString(), to: to.toISOString(), days: periodDays },
    buckets,
    kmRun,
    cashCost: cash,
    totalCost: total,
    costPerKm: costPerKm(total, kmRun),
    cashCostPerKm: costPerKm(cash, kmRun),
  };
}

export interface FleetAssets {
  totalPurchaseValue: number;
  totalBookValue: number; // net of accumulated depreciation
  totalDepreciation: number; // accumulated to date
  vehicleCount: number;
  vehicles: {
    vehicleId: string; plate: string; purchasePrice: number; accumulatedDepreciation: number; bookValue: number;
  }[];
}

// Fleet-wide asset value: total purchased vs. net book value after straight-line
// depreciation to date (floored at residual value).
export async function computeFleetAssets(): Promise<FleetAssets> {
  const defaultLife = await getSetting('depreciation.usefulLifeYears');
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true, status: { not: 'disposed' } },
    include: { purchase: true },
  });
  const now = dayjs();
  const rows: FleetAssets['vehicles'] = [];
  for (const v of vehicles) {
    const price = Number(v.purchase?.purchasePrice ?? 0);
    if (price <= 0) continue;
    const residual = Number(v.residualValue ?? v.purchase?.residualValue ?? 0);
    const life = v.usefulLifeYears ?? v.purchase?.usefulLifeYears ?? defaultLife;
    const purchaseDate = v.purchase?.purchaseDate ? dayjs(v.purchase.purchaseDate) : now;
    const yearsElapsed = Math.max(0, now.diff(purchaseDate, 'day') / 365);
    const annual = life > 0 ? Math.max(0, price - residual) / life : 0;
    const accumulated = Math.min(Math.max(0, price - residual), +(annual * yearsElapsed).toFixed(2));
    const bookValue = +(price - accumulated).toFixed(2);
    rows.push({
      vehicleId: v.id, plate: `${v.plateNumber} (${v.plateEmirate})`,
      purchasePrice: price, accumulatedDepreciation: +accumulated.toFixed(2), bookValue,
    });
  }
  return {
    totalPurchaseValue: +rows.reduce((s, r) => s + r.purchasePrice, 0).toFixed(2),
    totalBookValue: +rows.reduce((s, r) => s + r.bookValue, 0).toFixed(2),
    totalDepreciation: +rows.reduce((s, r) => s + r.accumulatedDepreciation, 0).toFixed(2),
    vehicleCount: rows.length,
    vehicles: rows,
  };
}

export interface FleetCostPerKm {
  totalCost: number;
  cashCost: number;
  kmRun: number;
  costPerKm: number | null;
  cashCostPerKm: number | null;
}

// Fleet-wide cost-per-km for a period: sum of every vehicle's cost and km run.
export async function computeFleetCostPerKm(from: Date, to: Date): Promise<FleetCostPerKm> {
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
  let totalCost = 0;
  let cash = 0;
  let kmRun = 0;
  for (const v of vehicles) {
    const t = await computeVehicleTco(v.id, from, to);
    totalCost += t.totalCost;
    cash += t.cashCost;
    kmRun += t.kmRun;
  }
  return {
    totalCost: +totalCost.toFixed(2),
    cashCost: +cash.toFixed(2),
    kmRun,
    costPerKm: costPerKm(totalCost, kmRun),
    cashCostPerKm: costPerKm(cash, kmRun),
  };
}

// Resolve MTD / YTD / custom period from query.
export function resolvePeriod(q: { period?: string; from?: string; to?: string }): { from: Date; to: Date } {
  const now = dayjs();
  if (q.from && q.to) return { from: new Date(q.from), to: new Date(q.to) };
  switch (q.period) {
    case 'ytd':
      return { from: now.startOf('year').toDate(), to: now.toDate() };
    case 'mtd':
    default:
      return { from: now.startOf('month').toDate(), to: now.toDate() };
  }
}
