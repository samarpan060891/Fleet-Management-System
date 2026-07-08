import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { NotFound } from '../../lib/errors';

export const transportRouter = Router();

const routeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  direction: z.string().optional(),
  scheduledTime: z.string().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
});

transportRouter.get(
  '/routes',
  authorize('transport', 'read'),
  asyncHandler(async (req, res) => {
    // Drivers only see routes for their assigned vehicle.
    const where: Record<string, unknown> = { isActive: true };
    if (req.user!.role === 'DRIVER') {
      const asg = await prisma.vehicleDriverAssignment.findFirst({ where: { driverId: req.user!.driverId ?? '', effectiveTo: null } });
      where.vehicleId = asg?.vehicleId ?? '__none__';
    }
    const rows = await prisma.route.findMany({
      where, orderBy: { code: 'asc' },
      include: {
        vehicle: { select: { plateNumber: true, plateEmirate: true } },
        driver: { select: { fullName: true } },
        _count: { select: { employees: { where: { isActive: true } } } },
      },
    });
    res.json(rows);
  })
);

transportRouter.get(
  '/routes/:id',
  authorize('transport', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: true,
        driver: true,
        employees: { where: { isActive: true }, include: { employee: true } },
      },
    });
    if (!route) throw NotFound('Route not found');
    res.json(route);
  })
);

transportRouter.post(
  '/routes',
  authorize('transport', 'create'),
  validate({ body: routeSchema }),
  asyncHandler(async (req, res) => {
    const route = await prisma.route.create({ data: { ...req.body, createdBy: req.user!.id, updatedBy: req.user!.id } });
    await audit({ entity: 'routes', entityId: route.id, action: 'create', actor: actorFrom(req), after: route });
    res.status(201).json(route);
  })
);

// Assign vehicle/driver to a route (keeps assignment history, effective-dated).
transportRouter.post(
  '/routes/:id/assign',
  authorize('transport', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ vehicleId: z.string().uuid().nullable().optional(), driverId: z.string().uuid().nullable().optional(), effectiveFrom: z.string() }),
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.route.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Route not found');
    await prisma.$transaction(async (tx) => {
      await tx.routeAssignment.updateMany({ where: { routeId: req.params.id, effectiveTo: null }, data: { effectiveTo: new Date(req.body.effectiveFrom) } });
      await tx.routeAssignment.create({
        data: { routeId: req.params.id, vehicleId: req.body.vehicleId ?? null, driverId: req.body.driverId ?? null, effectiveFrom: new Date(req.body.effectiveFrom), createdBy: req.user!.id },
      });
      await tx.route.update({ where: { id: req.params.id }, data: { vehicleId: req.body.vehicleId ?? null, driverId: req.body.driverId ?? null, updatedBy: req.user!.id } });
    });
    await prisma.alert.updateMany({ where: { dedupeKey: `route-unassigned:${req.params.id}` }, data: { resolved: true, resolvedAt: new Date() } });
    await audit({ entity: 'routes', entityId: req.params.id, action: 'update', actor: actorFrom(req), before: { vehicleId: before.vehicleId, driverId: before.driverId }, after: { vehicleId: req.body.vehicleId, driverId: req.body.driverId } });
    res.json({ ok: true });
  })
);

// Map employees to a route (roster, effective-dated).
transportRouter.post(
  '/routes/:id/employees',
  authorize('transport', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ employeeId: z.string().uuid(), pickupPoint: z.string().optional(), sequence: z.number().int().min(1).optional(), effectiveFrom: z.string() }),
  }),
  asyncHandler(async (req, res) => {
    const map = await prisma.routeEmployee.create({
      data: { routeId: req.params.id, employeeId: req.body.employeeId, pickupPoint: req.body.pickupPoint, sequence: req.body.sequence, effectiveFrom: new Date(req.body.effectiveFrom), createdBy: req.user!.id },
    });
    await audit({ entity: 'route_employees', entityId: map.id, action: 'create', actor: actorFrom(req), after: map });
    res.status(201).json(map);
  })
);

// Remove employee from route (effective end date).
transportRouter.delete(
  '/routes/:routeId/employees/:mapId',
  authorize('transport', 'update'),
  validate({ params: z.object({ routeId: z.string().uuid(), mapId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await prisma.routeEmployee.update({ where: { id: req.params.mapId }, data: { isActive: false, effectiveTo: new Date() } });
    await audit({ entity: 'route_employees', entityId: req.params.mapId, action: 'delete', actor: actorFrom(req) });
    res.json({ ok: true });
  })
);
