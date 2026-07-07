import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { BadRequest, NotFound } from '../../lib/errors';
import { assertOdometerNotDecreasing } from './odometer';

export const vehiclesRouter = Router();

const vehicleType = z.enum(['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van']);
const ownership = z.enum(['owned', 'leased', 'rented']);
const status = z.enum(['active', 'in_workshop', 'vor', 'idle', 'disposed']);

const isoDate = z.string().datetime().optional().or(z.string().optional());

const createSchema = z.object({
  plateNumber: z.string().min(1),
  plateEmirate: z.string().min(1),
  plateCategory: z.string().optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1950).max(2100),
  vin: z.string().optional(),
  engineNumber: z.string().optional(),
  colour: z.string().optional(),
  vehicleType,
  bodyType: z.string().optional(),
  seatingCapacity: z.number().int().optional(),
  payloadKg: z.number().int().optional(),
  ownership: ownership.default('owned'),
  leaseStart: isoDate,
  leaseEnd: isoDate,
  monthlyCost: z.number().optional(),
  lessorId: z.string().uuid().optional(),
  gpsUnitId: z.string().optional(),
  fuelKitId: z.string().optional(),
  currentOdometer: z.number().int().min(0).default(0),
  storeId: z.string().uuid().optional(),
  warrantyEndDate: isoDate,
  warrantyEndKm: z.number().int().optional(),
  usefulLifeYears: z.number().int().optional(),
  residualValue: z.number().optional(),
});

// LIST with filters (status, type, store) and computed availability info.
vehiclesRouter.get(
  '/',
  authorize('vehicles', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.status) where.status = req.query.status;
    if (req.query.vehicleType) where.vehicleType = req.query.vehicleType;
    if (req.query.storeId) where.storeId = req.query.storeId;
    const search = (req.query.search as string) || '';
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { vin: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take,
        orderBy: { plateNumber: 'asc' },
        include: { store: { select: { code: true, name: true } } },
      }),
      prisma.vehicle.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// GET one with related history.
vehiclesRouter.get(
  '/:id',
  authorize('vehicles', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: {
        store: true,
        documents: { where: { isActive: true } },
        pmState: true,
        purchase: true,
        disposal: true,
        salik: true,
        assignments: {
          orderBy: { effectiveFrom: 'desc' },
          take: 10,
          include: { driver: { select: { fullName: true, staffId: true } } },
        },
      },
    });
    if (!vehicle) throw NotFound('Vehicle not found');
    res.json(vehicle);
  })
);

vehiclesRouter.post(
  '/',
  authorize('vehicles', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const vehicle = await prisma.vehicle.create({
      data: { ...req.body, createdBy: req.user!.id, updatedBy: req.user!.id },
    });
    await audit({ entity: 'vehicles', entityId: vehicle.id, action: 'create', actor: actorFrom(req), after: vehicle });
    res.status(201).json(vehicle);
  })
);

vehiclesRouter.patch(
  '/:id',
  authorize('vehicles', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: createSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Vehicle not found');
    // Guard odometer on generic update — only FM correction endpoint may lower it.
    if (req.body.currentOdometer != null) {
      assertOdometerNotDecreasing(before.currentOdometer, req.body.currentOdometer);
    }
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedBy: req.user!.id },
    });
    await audit({ entity: 'vehicles', entityId: vehicle.id, action: 'update', actor: actorFrom(req), before, after: vehicle });
    res.json(vehicle);
  })
);

// Fleet-Manager odometer correction — the only path that may lower odometer.
vehiclesRouter.post(
  '/:id/odometer-correction',
  authorize('vehicles', 'manage'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ odometer: z.number().int().min(0), reason: z.string().min(1) }),
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Vehicle not found');
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { currentOdometer: req.body.odometer, updatedBy: req.user!.id },
    });
    await audit({
      entity: 'vehicles',
      entityId: vehicle.id,
      action: 'update',
      actor: actorFrom(req),
      before: { currentOdometer: before.currentOdometer },
      after: { currentOdometer: vehicle.currentOdometer, reason: req.body.reason, correction: true },
    });
    res.json(vehicle);
  })
);

// Status change (also used to move to VOR / workshop).
vehiclesRouter.post(
  '/:id/status',
  authorize('vehicles', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ status }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Vehicle not found');
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: req.body.status, updatedBy: req.user!.id },
    });
    await audit({ entity: 'vehicles', entityId: vehicle.id, action: 'update', actor: actorFrom(req), before: { status: before.status }, after: { status: vehicle.status } });
    res.json(vehicle);
  })
);

vehiclesRouter.delete(
  '/:id',
  authorize('vehicles', 'delete'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Vehicle not found');
    await prisma.vehicle.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user!.id } });
    await audit({ entity: 'vehicles', entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
    res.json({ ok: true });
  })
);

// --- Purchase & disposal (asset lifecycle) ---
vehiclesRouter.post(
  '/:id/purchase',
  authorize('vehicles', 'manage'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      purchaseDate: z.string(),
      supplierId: z.string().uuid().optional(),
      purchasePrice: z.number(),
      financing: z.string().optional(),
      usefulLifeYears: z.number().int().optional(),
      residualValue: z.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const purchase = await prisma.vehiclePurchase.upsert({
      where: { vehicleId: req.params.id },
      create: { vehicleId: req.params.id, ...req.body, purchaseDate: new Date(req.body.purchaseDate), createdBy: req.user!.id },
      update: { ...req.body, purchaseDate: new Date(req.body.purchaseDate) },
    });
    await audit({ entity: 'vehicle_purchases', entityId: purchase.id, action: 'create', actor: actorFrom(req), after: purchase });
    res.status(201).json(purchase);
  })
);

vehiclesRouter.post(
  '/:id/disposal',
  authorize('vehicles', 'manage'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      disposalDate: z.string(),
      method: z.enum(['sold', 'scrapped', 'returned_to_lessor']),
      buyer: z.string().optional(),
      salePrice: z.number().optional(),
      bookValue: z.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const gainLoss =
      req.body.salePrice != null && req.body.bookValue != null
        ? req.body.salePrice - req.body.bookValue
        : undefined;
    const result = await prisma.$transaction(async (tx) => {
      const disposal = await tx.vehicleDisposal.upsert({
        where: { vehicleId: req.params.id },
        create: {
          vehicleId: req.params.id,
          ...req.body,
          disposalDate: new Date(req.body.disposalDate),
          gainLoss,
          createdBy: req.user!.id,
        },
        update: { ...req.body, disposalDate: new Date(req.body.disposalDate), gainLoss },
      });
      // Moving to disposed removes it from active availability while keeping history.
      await tx.vehicle.update({ where: { id: req.params.id }, data: { status: 'disposed', updatedBy: req.user!.id } });
      return disposal;
    });
    await audit({ entity: 'vehicle_disposals', entityId: result.id, action: 'create', actor: actorFrom(req), after: result });
    res.status(201).json(result);
  })
);
