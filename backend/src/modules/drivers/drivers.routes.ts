import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { NotFound, Forbidden } from '../../lib/errors';
import { assignDriver } from '../assignments/assignments.service';

export const driversRouter = Router();

const dateOpt = z.string().optional();
const createSchema = z.object({
  fullName: z.string().min(1),
  staffId: z.string().min(1),
  phone: z.string().optional(),
  dob: dateOpt,
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  joiningDate: dateOpt,
  emergencyContact: z.string().optional(),
  licenceNumber: z.string().optional(),
  licenceClass: z.string().optional(),
  licenceExpiry: dateOpt,
  emiratesId: z.string().optional(),
  emiratesIdExpiry: dateOpt,
  visaExpiry: dateOpt,
  passportNumber: z.string().optional(),
  passportExpiry: dateOpt,
  defaultVehicleId: z.string().uuid().optional(),
  status: z.string().optional(),
});

const dateFields = ['dob', 'joiningDate', 'licenceExpiry', 'emiratesIdExpiry', 'visaExpiry', 'passportExpiry'];
const coerceDates = (body: Record<string, unknown>) => {
  const out = { ...body };
  for (const f of dateFields) if (out[f]) out[f] = new Date(out[f] as string);
  return out;
};

driversRouter.get(
  '/',
  authorize('drivers', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    const search = (req.query.search as string) || '';
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { staffId: { contains: search, mode: 'insensitive' } },
        { licenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.driver.findMany({ where, skip, take, orderBy: { fullName: 'asc' } }),
      prisma.driver.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

driversRouter.get(
  '/:id',
  authorize('drivers', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    // Drivers may only view their own record via this endpoint.
    if (req.user!.role === 'DRIVER' && req.user!.driverId !== req.params.id) {
      throw Forbidden();
    }
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: {
        documents: { where: { isActive: true } },
        assignments: {
          orderBy: { effectiveFrom: 'desc' },
          take: 10,
          include: { vehicle: { select: { plateNumber: true, plateEmirate: true } } },
        },
      },
    });
    if (!driver) throw NotFound('Driver not found');
    res.json(driver);
  })
);

driversRouter.post(
  '/',
  authorize('drivers', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const driver = await prisma.driver.create({
      data: { ...coerceDates(req.body), createdBy: req.user!.id, updatedBy: req.user!.id } as never,
    });
    await audit({ entity: 'drivers', entityId: driver.id, action: 'create', actor: actorFrom(req), after: driver });
    res.status(201).json(driver);
  })
);

driversRouter.patch(
  '/:id',
  authorize('drivers', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: createSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Driver not found');
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { ...coerceDates(req.body), updatedBy: req.user!.id } as never,
    });
    await audit({ entity: 'drivers', entityId: driver.id, action: 'update', actor: actorFrom(req), before, after: driver });
    res.json(driver);
  })
);

driversRouter.delete(
  '/:id',
  authorize('drivers', 'delete'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Driver not found');
    await prisma.driver.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user!.id } });
    await audit({ entity: 'drivers', entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
    res.json({ ok: true });
  })
);

// Assign this driver to a vehicle (versions assignment history).
driversRouter.post(
  '/:id/assign',
  authorize('assignments', 'create'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ vehicleId: z.string().uuid(), effectiveFrom: z.string(), note: z.string().optional() }),
  }),
  asyncHandler(async (req, res) => {
    await assignDriver(prisma, {
      vehicleId: req.body.vehicleId,
      driverId: req.params.id,
      effectiveFrom: new Date(req.body.effectiveFrom),
      note: req.body.note,
      actorId: req.user!.id,
    });
    await audit({
      entity: 'vehicle_driver_assignments',
      entityId: req.params.id,
      action: 'create',
      actor: actorFrom(req),
      after: { vehicleId: req.body.vehicleId, driverId: req.params.id, effectiveFrom: req.body.effectiveFrom },
    });
    res.status(201).json({ ok: true });
  })
);
