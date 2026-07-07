import { Prisma, PrismaClient, VehicleType } from '@prisma/client';
import dayjs from 'dayjs';

export type Db = PrismaClient | Prisma.TransactionClient;

// Computes and upserts a vehicle's PM state (last + next) given a last-PM event
// and the vehicle-type schedule (km + time interval, whichever comes first).
export async function recomputePmState(
  db: Db,
  vehicleId: string,
  lastPm: { km: number; date: Date }
): Promise<void> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { vehicleType: true },
  });
  if (!vehicle) return;
  const schedule = await db.pmSchedule.findUnique({
    where: { vehicleType: vehicle.vehicleType as VehicleType },
  });
  const kmInterval = schedule?.kmInterval ?? 10000;
  const days = schedule?.timeIntervalDays ?? 180;

  const nextPmKm = lastPm.km + kmInterval;
  const nextPmDate = dayjs(lastPm.date).add(days, 'day').toDate();

  await db.pmState.upsert({
    where: { vehicleId },
    create: {
      vehicleId,
      lastPmKm: lastPm.km,
      lastPmDate: lastPm.date,
      nextPmKm,
      nextPmDate,
    },
    update: { lastPmKm: lastPm.km, lastPmDate: lastPm.date, nextPmKm, nextPmDate },
  });
}
