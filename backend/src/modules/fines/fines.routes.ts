import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { NotFound } from '../../lib/errors';
import { driverOnDate } from '../assignments/assignments.service';

export const finesRouter = Router();

const createSchema = z.object({
  reference: z.string().min(1),
  offenceAt: z.string(),
  vehicleId: z.string().uuid(),
  type: z.enum(['salik', 'speeding', 'parking', 'other']),
  amount: z.number().nonnegative(),
  authority: z.string().optional(),
  emirate: z.string().optional(),
  // Optional manual override of the auto-attributed driver.
  driverId: z.string().uuid().optional(),
});

finesRouter.get(
  '/',
  authorize('fines', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.status) where.status = req.query.status;
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    const [rows, total] = await Promise.all([
      prisma.fine.findMany({
        where, skip, take, orderBy: { offenceAt: 'desc' },
        include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, driver: { select: { fullName: true } } },
      }),
      prisma.fine.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// Create — auto-attribute to the driver assigned on the offence date.
finesRouter.post(
  '/',
  authorize('fines', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const offenceAt = new Date(req.body.offenceAt);
    const overridden = !!req.body.driverId;
    const driverId = req.body.driverId ?? (await driverOnDate(prisma, req.body.vehicleId, offenceAt));
    const fine = await prisma.fine.create({
      data: {
        reference: req.body.reference,
        offenceAt,
        vehicleId: req.body.vehicleId,
        type: req.body.type,
        amount: req.body.amount,
        authority: req.body.authority,
        emirate: req.body.emirate,
        driverId: driverId ?? undefined,
        driverOverridden: overridden,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      },
    });
    await audit({ entity: 'fines', entityId: fine.id, action: 'create', actor: actorFrom(req), after: { ...fine, autoAttributedDriver: driverId } });
    res.status(201).json(fine);
  })
);

// Override the attributed driver (audited).
finesRouter.post(
  '/:id/reassign',
  authorize('fines', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ driverId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fine.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Fine not found');
    const fine = await prisma.fine.update({
      where: { id: req.params.id },
      data: { driverId: req.body.driverId, driverOverridden: true, updatedBy: req.user!.id },
    });
    await audit({ entity: 'fines', entityId: fine.id, action: 'update', actor: actorFrom(req), before: { driverId: before.driverId }, after: { driverId: fine.driverId, overridden: true } });
    res.json(fine);
  })
);

// Mark paid / unpaid.
finesRouter.post(
  '/:id/pay',
  authorize('fines', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ paymentDate: z.string() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fine.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Fine not found');
    const fine = await prisma.fine.update({
      where: { id: req.params.id },
      data: { status: 'paid', paymentDate: new Date(req.body.paymentDate), updatedBy: req.user!.id },
    });
    await prisma.alert.updateMany({ where: { dedupeKey: `fine:${fine.id}` }, data: { resolved: true, resolvedAt: new Date() } });
    await audit({ entity: 'fines', entityId: fine.id, action: 'update', actor: actorFrom(req), before: { status: before.status }, after: { status: 'paid' } });
    res.json(fine);
  })
);
