import { Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;

// Records a reading and advances the vehicle's current odometer if the reading
// is higher. The current odometer never decreases, so a backdated/lower reading
// is still logged but does not move the current value. Because PM "due" is
// computed as nextPmKm − currentOdometer, advancing here drives PM scheduling.
export async function recordReading(
  db: Db,
  params: { vehicleId: string; readingDate: Date; odometer: number; source?: string; note?: string; actorId?: string }
): Promise<{ id: string; currentOdometer: number; advanced: boolean }> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: params.vehicleId },
    select: { currentOdometer: true },
  });
  if (!vehicle) throw new Error('Vehicle not found');

  const reading = await db.odometerReading.create({
    data: {
      vehicleId: params.vehicleId,
      readingDate: params.readingDate,
      odometer: params.odometer,
      source: params.source ?? 'manual',
      note: params.note,
      createdBy: params.actorId,
    },
  });

  let currentOdometer = vehicle.currentOdometer;
  let advanced = false;
  if (params.odometer > vehicle.currentOdometer) {
    await db.vehicle.update({
      where: { id: params.vehicleId },
      data: { currentOdometer: params.odometer, updatedBy: params.actorId },
    });
    currentOdometer = params.odometer;
    advanced = true;
  }
  return { id: reading.id, currentOdometer, advanced };
}
