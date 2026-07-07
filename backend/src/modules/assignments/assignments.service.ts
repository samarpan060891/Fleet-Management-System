import { Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

// Returns the driver assigned to a vehicle on a given date, using the
// effective-dated assignment history. Powers fine attribution and
// "who was driving when". Returns null if no assignment covers the date.
export async function driverOnDate(
  db: Db,
  vehicleId: string,
  date: Date
): Promise<string | null> {
  const assignment = await db.vehicleDriverAssignment.findFirst({
    where: {
      vehicleId,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return assignment?.driverId ?? null;
}

// Creates a new assignment, closing the previous open assignment for the same
// vehicle. Never overwrites history — always versions.
export async function assignDriver(
  db: Db,
  params: {
    vehicleId: string;
    driverId: string;
    effectiveFrom: Date;
    note?: string;
    actorId?: string;
  }
): Promise<void> {
  // Close any currently-open assignment for this vehicle.
  await db.vehicleDriverAssignment.updateMany({
    where: { vehicleId: params.vehicleId, effectiveTo: null },
    data: { effectiveTo: params.effectiveFrom },
  });
  await db.vehicleDriverAssignment.create({
    data: {
      vehicleId: params.vehicleId,
      driverId: params.driverId,
      effectiveFrom: params.effectiveFrom,
      note: params.note,
      createdBy: params.actorId,
    },
  });
}
