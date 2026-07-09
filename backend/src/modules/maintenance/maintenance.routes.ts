import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { BadRequest, NotFound } from '../../lib/errors';
import { bumpOdometer } from '../vehicles/odometer';
import { recomputePmState } from './pm.service';

export const maintenanceRouter = Router();

// ---- Warranty helper: is a vehicle within warranty (date or km)? ----
function withinWarranty(v: { warrantyEndDate: Date | null; warrantyEndKm: number | null; currentOdometer: number }, at: Date, odo: number | null): boolean {
  const byDate = v.warrantyEndDate ? at <= v.warrantyEndDate : false;
  const km = odo ?? v.currentOdometer;
  const byKm = v.warrantyEndKm != null ? km <= v.warrantyEndKm : false;
  return byDate || byKm;
}

const jobType = z.enum(['scheduled', 'breakdown', 'accident', 'tyre']);
const partSchema = z.object({ partName: z.string(), qty: z.number().positive(), unitCost: z.number().nonnegative() });
const createJobSchema = z.object({
  vehicleId: z.string().uuid(),
  odometerIn: z.number().int().optional(),
  dateIn: z.string(),
  type: jobType,
  description: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  labourCharges: z.number().optional(),
  otherCharges: z.number().optional(),
  parts: z.array(partSchema).optional(),
});

// ===== Job cards =====
maintenanceRouter.get(
  '/job-cards',
  authorize('maintenance', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.status) where.status = req.query.status;
    const [rows, total] = await Promise.all([
      prisma.jobCard.findMany({
        where, skip, take, orderBy: { dateIn: 'desc' },
        include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, vendor: { select: { name: true } }, parts: true },
      }),
      prisma.jobCard.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

maintenanceRouter.get(
  '/job-cards/:id',
  authorize('maintenance', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const job = await prisma.jobCard.findUnique({ where: { id: req.params.id }, include: { parts: true, vehicle: true, vendor: true } });
    if (!job) throw NotFound('Job card not found');
    res.json(job);
  })
);

maintenanceRouter.post(
  '/job-cards',
  authorize('maintenance', 'create'),
  validate({ body: createJobSchema }),
  asyncHandler(async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
    if (!vehicle) throw BadRequest('Vehicle not found');
    const dateIn = new Date(req.body.dateIn);
    const isWarrantyClaim = withinWarranty(vehicle, dateIn, req.body.odometerIn ?? null);

    const partsTotal = (req.body.parts ?? []).reduce(
      (s: number, p: z.infer<typeof partSchema>) => s + p.qty * p.unitCost, 0
    );
    const totalCost = partsTotal + (req.body.labourCharges ?? 0) + (req.body.otherCharges ?? 0);
    const jobNumber = `JC-${dayjs().format('YYYYMM')}-${Math.floor(Math.random() * 90000 + 10000)}`;

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.jobCard.create({
        data: {
          jobNumber,
          vehicleId: req.body.vehicleId,
          odometerIn: req.body.odometerIn,
          dateIn,
          type: req.body.type,
          description: req.body.description,
          vendorId: req.body.vendorId,
          invoiceNumber: req.body.invoiceNumber,
          labourCharges: req.body.labourCharges,
          otherCharges: req.body.otherCharges,
          totalCost,
          isWarrantyClaim,
          status: 'open',
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
          parts: req.body.parts ? { create: req.body.parts } : undefined,
        },
        include: { parts: true },
      });
      // Opening a job card moves the vehicle into the workshop.
      await tx.vehicle.update({ where: { id: req.body.vehicleId }, data: { status: 'in_workshop', updatedBy: req.user!.id } });
      await bumpOdometer(tx, req.body.vehicleId, req.body.odometerIn, { actorId: req.user!.id });
      return created;
    });

    await audit({ entity: 'job_cards', entityId: job.id, action: 'create', actor: actorFrom(req), after: job });
    res.status(201).json({ ...job, warrantyBanner: isWarrantyClaim ? 'Possible warranty claim' : null });
  })
);

// Close a job card → date out, downtime days, odometer out, vehicle back active,
// and if type=scheduled, recompute PM state.
maintenanceRouter.post(
  '/job-cards/:id/close',
  authorize('maintenance', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ dateOut: z.string(), odometerOut: z.number().int().optional() }),
  }),
  asyncHandler(async (req, res) => {
    const job = await prisma.jobCard.findUnique({ where: { id: req.params.id } });
    if (!job) throw NotFound('Job card not found');
    const dateOut = new Date(req.body.dateOut);
    const downtimeDays = Math.max(0, dayjs(dateOut).diff(dayjs(job.dateIn), 'day'));

    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.jobCard.update({
        where: { id: req.params.id },
        data: { status: 'closed', dateOut, odometerOut: req.body.odometerOut, downtimeDays, updatedBy: req.user!.id },
      });
      await tx.vehicle.update({ where: { id: job.vehicleId }, data: { status: 'active', updatedBy: req.user!.id } });
      await bumpOdometer(tx, job.vehicleId, req.body.odometerOut, { actorId: req.user!.id });
      if (job.type === 'scheduled' && req.body.odometerOut != null) {
        await recomputePmState(tx, job.vehicleId, { km: req.body.odometerOut, date: dateOut });
      }
      return closed;
    });
    await audit({ entity: 'job_cards', entityId: updated.id, action: 'update', actor: actorFrom(req), before: { status: job.status }, after: { status: 'closed', downtimeDays } });
    res.json(updated);
  })
);

// ===== PM schedules (defaults per vehicle type, editable settings) =====
maintenanceRouter.get(
  '/pm-schedules',
  authorize('maintenance', 'read'),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.pmSchedule.findMany({ orderBy: { vehicleType: 'asc' } }));
  })
);

maintenanceRouter.put(
  '/pm-schedules/:vehicleType',
  authorize('maintenance', 'update'),
  validate({
    params: z.object({ vehicleType: z.string().min(1).max(60) }),
    body: z.object({ kmInterval: z.number().int().positive(), timeIntervalDays: z.number().int().positive() }),
  }),
  asyncHandler(async (req, res) => {
    const row = await prisma.pmSchedule.upsert({
      where: { vehicleType: req.params.vehicleType },
      create: { vehicleType: req.params.vehicleType, ...req.body, updatedBy: req.user!.id },
      update: { ...req.body, updatedBy: req.user!.id },
    });
    await audit({ entity: 'pm_schedules', entityId: row.id, action: 'update', actor: actorFrom(req), after: row });
    res.json(row);
  })
);

// PM-due list (vehicles approaching or overdue PM).
maintenanceRouter.get(
  '/pm-due',
  authorize('maintenance', 'read'),
  asyncHandler(async (_req, res) => {
    const states = await prisma.pmState.findMany({
      include: { vehicle: { select: { plateNumber: true, plateEmirate: true, currentOdometer: true, status: true } } },
    });
    const out = states
      .filter((s) => s.vehicle && s.vehicle.status !== 'disposed')
      .map((s) => ({
        vehicleId: s.vehicleId,
        plate: `${s.vehicle!.plateNumber} (${s.vehicle!.plateEmirate})`,
        nextPmKm: s.nextPmKm,
        nextPmDate: s.nextPmDate,
        kmToNext: s.nextPmKm != null ? s.nextPmKm - s.vehicle!.currentOdometer : null,
        daysToNext: s.nextPmDate != null ? dayjs(s.nextPmDate).diff(dayjs(), 'day') : null,
      }));
    res.json(out);
  })
);

// ===== Tyres (position-wise) =====
const tyreSchema = z.object({
  serial: z.string(),
  brand: z.string().optional(),
  vehicleId: z.string().uuid().optional(),
  position: z.string().optional(),
  fitmentDate: z.string().optional(),
  fitmentOdometer: z.number().int().optional(),
  treadDepthMm: z.number().optional(),
  vendorId: z.string().uuid().optional(),
  cost: z.number().optional(),
});

maintenanceRouter.get(
  '/tyres',
  authorize('tyres', 'read'),
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    const rows = await prisma.tyre.findMany({ where, orderBy: { createdAt: 'desc' }, include: { treadChecks: true, vendor: { select: { name: true } } } });
    res.json(rows);
  })
);

maintenanceRouter.post(
  '/tyres',
  authorize('tyres', 'create'),
  validate({ body: tyreSchema }),
  asyncHandler(async (req, res) => {
    const tyre = await prisma.tyre.create({
      data: {
        ...req.body,
        fitmentDate: req.body.fitmentDate ? new Date(req.body.fitmentDate) : undefined,
        createdBy: req.user!.id, updatedBy: req.user!.id,
      },
    });
    await audit({ entity: 'tyres', entityId: tyre.id, action: 'create', actor: actorFrom(req), after: tyre });
    res.status(201).json(tyre);
  })
);

// Log a tread-depth check (alerts if below threshold of 1.6mm).
maintenanceRouter.post(
  '/tyres/:id/tread-check',
  authorize('tyres', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ checkedAt: z.string(), depthMm: z.number(), note: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const check = await prisma.tyreTreadCheck.create({
      data: { tyreId: req.params.id, checkedAt: new Date(req.body.checkedAt), depthMm: req.body.depthMm, note: req.body.note },
    });
    await prisma.tyre.update({ where: { id: req.params.id }, data: { treadDepthMm: req.body.depthMm, updatedBy: req.user!.id } });
    res.status(201).json({ ...check, lowTread: req.body.depthMm < 1.6 });
  })
);

maintenanceRouter.post(
  '/tyres/:id/scrap',
  authorize('tyres', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ scrapDate: z.string(), scrapReason: z.string() }) }),
  asyncHandler(async (req, res) => {
    const tyre = await prisma.tyre.update({
      where: { id: req.params.id },
      data: { scrapDate: new Date(req.body.scrapDate), scrapReason: req.body.scrapReason, isActive: false, updatedBy: req.user!.id },
    });
    await audit({ entity: 'tyres', entityId: tyre.id, action: 'update', actor: actorFrom(req), after: { scrapped: true } });
    res.json(tyre);
  })
);
