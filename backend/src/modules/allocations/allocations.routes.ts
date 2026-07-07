import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { NotFound } from '../../lib/errors';

export const allocationsRouter = Router();

const allocationType = z.enum(['customer_delivery', 'store_delivery', 'staff_transport']);
const createSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  type: allocationType,
  storeId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  reference: z.string().optional(),
  area: z.string().optional(),
  emirate: z.string().optional(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  tripStartAt: z.string().optional(),
  tripEndAt: z.string().optional(),
  waitingMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// Coerce datetime strings on the trip fields.
function coerceTrips(body: Record<string, any>) {
  const out = { ...body };
  if (out.tripStartAt) out.tripStartAt = new Date(out.tripStartAt);
  if (out.tripEndAt) out.tripEndAt = new Date(out.tripEndAt);
  return out;
}

const includeRefs = {
  vehicle: { select: { plateNumber: true, plateEmirate: true } },
  driver: { select: { fullName: true } },
  store: { select: { code: true, name: true } },
  route: { select: { code: true, name: true } },
};

// LIST with filters (date, type, status, vehicle).
allocationsRouter.get(
  '/',
  authorize('allocations', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.date) {
      const d = dayjs(req.query.date as string).startOf('day').toDate();
      where.date = d;
    }
    const [rows, total] = await Promise.all([
      prisma.fleetAllocation.findMany({ where, skip, take, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], include: includeRefs }),
      prisma.fleetAllocation.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// Summary counts by type + status for a date (default today).
allocationsRouter.get(
  '/summary',
  authorize('allocations', 'read'),
  asyncHandler(async (req, res) => {
    const date = dayjs((req.query.date as string) || undefined).startOf('day').toDate();
    const byType = await prisma.fleetAllocation.groupBy({ by: ['type'], where: { isActive: true, date }, _count: true });
    const byStatus = await prisma.fleetAllocation.groupBy({ by: ['status'], where: { isActive: true, date }, _count: true });
    res.json({ date, byType, byStatus });
  })
);

allocationsRouter.post(
  '/',
  authorize('allocations', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const allocation = await prisma.fleetAllocation.create({
      data: { ...coerceTrips(req.body), date: dayjs(req.body.date).startOf('day').toDate(), createdBy: req.user!.id, updatedBy: req.user!.id } as any,
      include: includeRefs,
    });
    await audit({ entity: 'fleet_allocations', entityId: allocation.id, action: 'create', actor: actorFrom(req), after: allocation });
    res.status(201).json(allocation);
  })
);

allocationsRouter.patch(
  '/:id',
  authorize('allocations', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: createSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fleetAllocation.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Allocation not found');
    const data: any = { ...coerceTrips(req.body), updatedBy: req.user!.id };
    if (req.body.date) data.date = dayjs(req.body.date).startOf('day').toDate();
    const allocation = await prisma.fleetAllocation.update({ where: { id: req.params.id }, data, include: includeRefs });
    await audit({ entity: 'fleet_allocations', entityId: allocation.id, action: 'update', actor: actorFrom(req), before, after: allocation });
    res.json(allocation);
  })
);

// Change status (planned → active → completed, or cancelled).
allocationsRouter.post(
  '/:id/status',
  authorize('allocations', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ status: z.enum(['planned', 'active', 'completed', 'cancelled']) }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fleetAllocation.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Allocation not found');
    // Auto-stamp actual trip start/end when moving through the lifecycle.
    const stamp: Record<string, unknown> = { status: req.body.status, updatedBy: req.user!.id };
    if (req.body.status === 'active' && !before.tripStartAt) stamp.tripStartAt = new Date();
    if (req.body.status === 'completed' && !before.tripEndAt) stamp.tripEndAt = new Date();
    const allocation = await prisma.fleetAllocation.update({ where: { id: req.params.id }, data: stamp, include: includeRefs });
    await audit({ entity: 'fleet_allocations', entityId: allocation.id, action: 'update', actor: actorFrom(req), before: { status: before.status }, after: { status: allocation.status } });
    res.json(allocation);
  })
);

allocationsRouter.delete(
  '/:id',
  authorize('allocations', 'delete'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fleetAllocation.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Allocation not found');
    await prisma.fleetAllocation.update({ where: { id: req.params.id }, data: { isActive: false, status: 'cancelled', updatedBy: req.user!.id } });
    await audit({ entity: 'fleet_allocations', entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
    res.json({ ok: true });
  })
);
