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

// Record a single daily reading. Advances current odometer + drives PM.
odometerRouter.post(
  '/',
  authorize('odometer', 'create'),
  validate({
    body: z.object({
      vehicleId: z.string().uuid(),
      readingDate: z.string(),
      odometer: z.number().int().min(0),
      note: z.string().optional(),
    }),
  }),
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
      note: req.body.note,
      actorId: req.user!.id,
    });
    await audit({ entity: 'odometer_readings', entityId: result.id, action: 'create', actor: actorFrom(req), after: { ...req.body, advancedTo: result.currentOdometer } });
    res.status(201).json(result);
  })
);
