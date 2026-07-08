import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest } from '../../lib/errors';
import { getSetting } from '../settings/settings.service';
import { bumpOdometer } from '../vehicles/odometer';
import { driverOnDate } from '../assignments/assignments.service';
import { computeEfficiency, detectAnomalies, rollingAverage } from './fuel.logic';

export interface FuelInput {
  vehicleId: string;
  filledAt: string | Date;
  odometer?: number;
  litres: number;
  amount: number;
  rate?: number;
  channel: 'vip_kit' | 'fuel_buddy' | 'cash';
  driverId?: string;
}

// Core create used by manual entry and bulk import: computes km-since-last and
// km/litre, detects anomalies, applies the cash approval workflow, and advances
// the vehicle odometer (never backward).
export async function createFuelTransaction(
  input: FuelInput,
  actorId: string
): Promise<{ id: string; anomalies: string[] }> {
  const cashThreshold = await getSetting('fuel.cashApprovalThreshold');
  const deviationPct = await getSetting('fuel.anomalyDeviationPct');
  const rollingWindow = await getSetting('fuel.rollingWindow');
  const filledAt = new Date(input.filledAt);

  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw BadRequest('Vehicle not found');

    const prev = await tx.fuelTransaction.findFirst({
      where: { vehicleId: input.vehicleId, isActive: true, filledAt: { lt: filledAt } },
      orderBy: { filledAt: 'desc' },
    });
    const { kmSinceLast, kmPerLitre } = computeEfficiency(input.odometer ?? null, input.litres, prev?.odometer ?? null);

    const priors = await tx.fuelTransaction.findMany({
      where: { vehicleId: input.vehicleId, isActive: true, kmPerLitre: { not: null }, filledAt: { lt: filledAt } },
      orderBy: { filledAt: 'desc' },
      take: rollingWindow,
      select: { kmPerLitre: true },
    });
    const rollingAvg = rollingAverage(priors.map((p) => Number(p.kmPerLitre)).reverse(), rollingWindow);

    const isCash = input.channel === 'cash';
    const approvalStatus: Prisma.FuelTransactionCreateInput['approvalStatus'] = isCash ? 'pending' : null;

    const anomalies = detectAnomalies({
      odometer: input.odometer ?? null,
      kmPerLitre,
      rollingAvg,
      channel: input.channel,
      amount: input.amount,
      deviationPct,
      cashThreshold,
      approved: false,
    });

    const driverId = input.driverId ?? (await driverOnDate(tx, input.vehicleId, filledAt));

    const created = await tx.fuelTransaction.create({
      data: {
        vehicleId: input.vehicleId,
        filledAt,
        odometer: input.odometer,
        litres: input.litres,
        amount: input.amount,
        rate: input.rate,
        channel: input.channel,
        driverId: driverId ?? undefined,
        kmSinceLast,
        kmPerLitre,
        approvalStatus,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    await bumpOdometer(tx, input.vehicleId, input.odometer, { actorId });
    return { id: created.id, anomalies };
  });
}
