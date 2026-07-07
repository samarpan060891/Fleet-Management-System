import { Prisma, PrismaClient } from '@prisma/client';
import { BadRequest } from '../../lib/errors';

export type Db = PrismaClient | Prisma.TransactionClient;

// Pure guard: an odometer reading may never decrease below the current value,
// unless it is an explicit Fleet-Manager correction (audited by the caller).
export function assertOdometerNotDecreasing(
  current: number,
  next: number,
  opts: { isManagerCorrection?: boolean } = {}
): void {
  if (next < current && !opts.isManagerCorrection) {
    throw BadRequest(
      `Odometer cannot decrease: current ${current} km, attempted ${next} km. ` +
        `A Fleet Manager correction is required to lower it.`
    );
  }
}

// Applies a new odometer reading to a vehicle if it is greater than current.
// Never silently decreases. Returns the effective odometer.
export async function bumpOdometer(
  db: Db,
  vehicleId: string,
  reading: number | null | undefined,
  opts: { isManagerCorrection?: boolean; actorId?: string } = {}
): Promise<number> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { currentOdometer: true },
  });
  if (!vehicle) throw BadRequest('Vehicle not found');
  if (reading === null || reading === undefined) return vehicle.currentOdometer;

  assertOdometerNotDecreasing(vehicle.currentOdometer, reading, opts);

  // Only move forward (a correction may move it down; a normal event never does).
  if (reading > vehicle.currentOdometer || opts.isManagerCorrection) {
    await db.vehicle.update({
      where: { id: vehicleId },
      data: { currentOdometer: reading, updatedBy: opts.actorId },
    });
    return reading;
  }
  return vehicle.currentOdometer;
}
