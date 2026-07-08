import { Prisma, PrismaClient } from '@prisma/client';
import { BadRequest } from '../../lib/errors';

export type Db = PrismaClient | Prisma.TransactionClient;

export interface RecordReadingParams {
  vehicleId: string;
  readingDate: Date;
  // Either a plain `odometer` reading, or a trip start/end pair. When trip
  // fields are given, `odometer` is derived as tripEndKm.
  odometer?: number;
  tripStartKm?: number;
  tripEndKm?: number;
  tripStartAt?: Date;
  tripEndAt?: Date;
  source?: string;
  note?: string;
  actorId?: string;
}

// Records a reading (optionally as a trip start/end) and advances the vehicle's
// current odometer if the resulting reading is higher. The current odometer
// never decreases, so a backdated/lower reading is still logged but does not
// move the current value. Because PM "due" is computed as nextPmKm −
// currentOdometer, advancing here drives PM scheduling.
export async function recordReading(
  db: Db,
  params: RecordReadingParams
): Promise<{ id: string; currentOdometer: number; advanced: boolean; distanceKm: number | null }> {
  const vehicle = await db.vehicle.findUnique({
    where: { id: params.vehicleId },
    select: { currentOdometer: true },
  });
  if (!vehicle) throw BadRequest('Vehicle not found');

  const hasTrip = params.tripStartKm != null || params.tripEndKm != null;
  if (hasTrip) {
    if (params.tripStartKm == null || params.tripEndKm == null) {
      throw BadRequest('Both trip start km and trip end km are required for a trip reading');
    }
    if (params.tripEndKm < params.tripStartKm) {
      throw BadRequest(`Trip end km (${params.tripEndKm}) cannot be less than trip start km (${params.tripStartKm})`);
    }
  }
  const odometer = hasTrip ? params.tripEndKm! : params.odometer;
  if (odometer == null) throw BadRequest('Either odometer, or tripStartKm/tripEndKm, is required');

  const reading = await db.odometerReading.create({
    data: {
      vehicleId: params.vehicleId,
      readingDate: params.readingDate,
      odometer,
      tripStartKm: params.tripStartKm,
      tripEndKm: params.tripEndKm,
      tripStartAt: params.tripStartAt,
      tripEndAt: params.tripEndAt,
      source: params.source ?? 'manual',
      note: params.note,
      createdBy: params.actorId,
    },
  });

  let currentOdometer = vehicle.currentOdometer;
  let advanced = false;
  if (odometer > vehicle.currentOdometer) {
    await db.vehicle.update({
      where: { id: params.vehicleId },
      data: { currentOdometer: odometer, updatedBy: params.actorId },
    });
    currentOdometer = odometer;
    advanced = true;
  }
  const distanceKm = hasTrip ? params.tripEndKm! - params.tripStartKm! : null;
  return { id: reading.id, currentOdometer, advanced, distanceKm };
}
