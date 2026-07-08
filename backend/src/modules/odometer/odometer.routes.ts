import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { Forbidden } from '../../lib/errors';
import { recordReading } from './odometer.service';

export const odometerRouter = Router();

// List readings (optionally per vehicle), newest first.
odometerRouter.get(
  '/',
  authorize('odometer', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    const [rows, total] = await Promise.all([
      prisma.odometerReading.findMany({
        where, skip, take, orderBy: { readingDate: 'desc' },
        include: { vehicle: { select: { plateNumber: true, plateEmirate: true } } },
      }),
      prisma.odometerReading.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// Record a reading, either as a trip (start/end km + start/end time) or a
// plain odometer value. Advances current odometer + drives PM.
const createSchema = z
  .object({
    vehicleId: z.string().uuid(),
    readingDate: z.string(),
    odometer: z.number().int().min(0).optional(),
    tripStartKm: z.number().int().min(0).optional(),
    tripEndKm: z.number().int().min(0).optional(),
    tripStartAt: z.string().optional(), // ISO datetime, or "HH:mm" combined with readingDate
    tripEndAt: z.string().optional(),
    note: z.string().optional(),
  })
  .refine((b) => b.odometer != null || (b.tripStartKm != null && b.tripEndKm != null), {
    message: 'Either odometer, or both tripStartKm and tripEndKm, are required',
  });

// Combine a date-only string with an "HH:mm" time, or pass through a full ISO datetime.
function toDateTime(readingDate: string, time?: string): Date | undefined {
  if (!time) return undefined;
  if (time.includes('T')) return new Date(time);
  return new Date(`${readingDate.slice(0, 10)}T${time}:00`);
}

odometerRouter.post(
  '/',
  authorize('odometer', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    // Drivers may only log readings for their own assigned vehicle.
    if (req.user!.role === 'DRIVER') {
      const own = await prisma.vehicleDriverAssignment.findFirst({
        where: { driverId: req.user!.driverId ?? '', vehicleId: req.body.vehicleId, effectiveTo: null },
      });
      if (!own) throw Forbidden('You can only log readings for your assigned vehicle');
    }
    const result = await recordReading(prisma, {
      vehicleId: req.body.vehicleId,
      readingDate: new Date(req.body.readingDate),
      odometer: req.body.odometer,
      tripStartKm: req.body.tripStartKm,
      tripEndKm: req.body.tripEndKm,
      tripStartAt: toDateTime(req.body.readingDate, req.body.tripStartAt),
      tripEndAt: toDateTime(req.body.readingDate, req.body.tripEndAt),
      note: req.body.note,
      actorId: req.user!.id,
    });
    await audit({ entity: 'odometer_readings', entityId: result.id, action: 'create', actor: actorFrom(req), after: { ...req.body, advancedTo: result.currentOdometer } });
    res.status(201).json(result);
  })
);
