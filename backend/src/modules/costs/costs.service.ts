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

  const [fuelAgg, jobs, tyres, fines] = await Promise.all([
    prisma.fuelTransaction.aggregate({
      where: { vehicleId, isActive: true, filledAt: inPeriod, OR: [{ approvalStatus: null }, { approvalStatus: 'approved' }] },
      _sum: { amount: true },
    }),
    prisma.jobCard.aggregate({ where: { vehicleId, isActive: true, dateIn: inPeriod }, _sum: { totalCost: true } }),
    prisma.tyre.aggregate({ where: { vehicleId, fitmentDate: inPeriod }, _sum: { cost: true } }),
    prisma.fine.aggregate({ where: { vehicleId, isActive: true, offenceAt: inPeriod }, _sum: { amount: true } }),
  ]);

  buckets.fuel = Number(fuelAgg._sum.amount ?? 0);
  buckets.maintenance = Number(jobs._sum.totalCost ?? 0);
  buckets.tyres = Number(tyres._sum.cost ?? 0);
  buckets.fines = Number(fines._sum.amount ?? 0);
  buckets.insurance = 0; // premium not tracked as a cost line; see DECISIONS.md
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
