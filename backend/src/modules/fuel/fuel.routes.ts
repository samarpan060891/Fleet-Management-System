import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { getSetting } from '../settings/settings.service';
import { bumpOdometer } from '../vehicles/odometer';
import { driverOnDate } from '../assignments/assignments.service';
import { computeEfficiency, detectAnomalies, rollingAverage } from './fuel.logic';

export const fuelRouter = Router();

const channel = z.enum(['vip_kit', 'fuel_buddy', 'cash']);
const createSchema = z.object({
  vehicleId: z.string().uuid(),
  filledAt: z.string(),
  odometer: z.number().int().min(0).optional(),
  litres: z.number().positive(),
  amount: z.number().nonnegative(),
  rate: z.number().optional(),
  channel,
  driverId: z.string().uuid().optional(),
});

// Core create used by manual entry and bulk import.
async function createFuelTx(
  input: z.infer<typeof createSchema>,
  actorId: string
): Promise<{ id: string; anomalies: string[] }> {
  const cashThreshold = await getSetting('fuel.cashApprovalThreshold');
  const deviationPct = await getSetting('fuel.anomalyDeviationPct');
  const rollingWindow = await getSetting('fuel.rollingWindow');
  const filledAt = new Date(input.filledAt);

  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw BadRequest('Vehicle not found');

    // Previous fill for efficiency computation.
    const prev = await tx.fuelTransaction.findFirst({
      where: { vehicleId: input.vehicleId, isActive: true, filledAt: { lt: filledAt } },
      orderBy: { filledAt: 'desc' },
    });
    const { kmSinceLast, kmPerLitre } = computeEfficiency(
      input.odometer ?? null,
      input.litres,
      prev?.odometer ?? null
    );

    // Rolling average from prior valid efficiencies.
    const priors = await tx.fuelTransaction.findMany({
      where: { vehicleId: input.vehicleId, isActive: true, kmPerLitre: { not: null }, filledAt: { lt: filledAt } },
      orderBy: { filledAt: 'desc' },
      take: rollingWindow,
      select: { kmPerLitre: true },
    });
    const rollingAvg = rollingAverage(
      priors.map((p) => Number(p.kmPerLitre)).reverse(),
      rollingWindow
    );

    // Cash approval workflow.
    const isCash = input.channel === 'cash';
    const approvalStatus: Prisma.FuelTransactionCreateInput['approvalStatus'] = isCash
      ? 'pending'
      : null;

    const anomalies = detectAnomalies({
      odometer: input.odometer ?? null,
      kmPerLitre,
      rollingAvg,
      channel: input.channel,
      amount: input.amount,
      deviationPct,
      cashThreshold,
      approved: false,
    });

    // Auto driver from assignment if not provided.
    const driverId = input.driverId ?? (await driverOnDate(tx, input.vehicleId, filledAt));

    const created = await tx.fuelTransaction.create({
      data: {
        vehicleId: input.vehicleId,
        filledAt,
        odometer: input.odometer,
        litres: input.litres,
        amount: input.amount,
        rate: input.rate,
        channel: input.channel,
        driverId: driverId ?? undefined,
        kmSinceLast,
        kmPerLitre,
        approvalStatus,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });

    // Odometer never decreases; fuel entries push it forward.
    await bumpOdometer(tx, input.vehicleId, input.odometer, { actorId });

    return { id: created.id, anomalies };
  });
}

fuelRouter.get(
  '/',
  authorize('fuel', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.channel) where.channel = req.query.channel;
    if (req.query.approvalStatus) where.approvalStatus = req.query.approvalStatus;
    const [rows, total] = await Promise.all([
      prisma.fuelTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { filledAt: 'desc' },
        include: {
          vehicle: { select: { plateNumber: true, plateEmirate: true } },
          driver: { select: { fullName: true } },
        },
      }),
      prisma.fuelTransaction.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// Pending cash approvals queue (Fleet Manager).
fuelRouter.get(
  '/pending-approvals',
  authorize('fuel', 'approve'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.fuelTransaction.findMany({
      where: { isActive: true, channel: 'cash', approvalStatus: 'pending' },
      orderBy: { filledAt: 'desc' },
      include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, driver: { select: { fullName: true } } },
    });
    res.json(rows);
  })
);

fuelRouter.post(
  '/',
  authorize('fuel', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    // Drivers may only log fuel for their own assigned vehicle.
    if (req.user!.role === 'DRIVER') {
      const own = await prisma.vehicleDriverAssignment.findFirst({
        where: { driverId: req.user!.driverId ?? '', vehicleId: req.body.vehicleId, effectiveTo: null },
      });
      if (!own) throw Forbidden('You can only log fuel for your assigned vehicle');
    }
    const result = await createFuelTx(req.body, req.user!.id);
    await audit({ entity: 'fuel_transactions', entityId: result.id, action: 'create', actor: actorFrom(req), after: req.body });
    res.status(201).json(result);
  })
);

// Bulk import (vip_kit / fuel_buddy) — validated dry-run + commit.
const importSchema = z.object({
  commit: z.boolean().default(false),
  rows: z.array(createSchema),
});
fuelRouter.post(
  '/import',
  authorize('fuel', 'create'),
  validate({ body: importSchema }),
  asyncHandler(async (req, res) => {
    const errors: { row: number; message: string }[] = [];
    req.body.rows.forEach((r: z.infer<typeof createSchema>, i: number) => {
      if (r.channel === 'cash') errors.push({ row: i, message: 'Cash fills must be entered manually for approval' });
      if (r.odometer == null) errors.push({ row: i, message: 'Missing odometer (will be flagged as anomaly)' });
    });
    if (!req.body.commit) {
      return res.json({ dryRun: true, totalRows: req.body.rows.length, errors });
    }
    let imported = 0;
    for (const r of req.body.rows) {
      if (r.channel === 'cash') continue;
      await createFuelTx(r, req.user!.id);
      imported++;
    }
    await audit({ entity: 'fuel_transactions', entityId: 'bulk', action: 'create', actor: actorFrom(req), after: { imported } });
    res.json({ dryRun: false, imported, errors });
  })
);

// Approve / reject a cash fill (Fleet Manager) — audited.
fuelRouter.post(
  '/:id/approve',
  authorize('fuel', 'approve'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ approve: z.boolean(), reason: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.fuelTransaction.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Fuel transaction not found');
    if (before.channel !== 'cash') throw BadRequest('Only cash fills require approval');
    const updated = await prisma.fuelTransaction.update({
      where: { id: req.params.id },
      data: {
        approvalStatus: req.body.approve ? 'approved' : 'rejected',
        approvedById: req.user!.id,
        approvedAt: new Date(),
        rejectionReason: req.body.approve ? null : req.body.reason,
        updatedBy: req.user!.id,
      },
    });
    // Resolve the related unapproved-cash alert if approved.
    if (req.body.approve) {
      await prisma.alert.updateMany({ where: { dedupeKey: `fuel-cash:${req.params.id}` }, data: { resolved: true, resolvedAt: new Date() } });
    }
    await audit({
      entity: 'fuel_transactions',
      entityId: req.params.id,
      action: req.body.approve ? 'approve' : 'reject',
      actor: actorFrom(req),
      before: { approvalStatus: before.approvalStatus },
      after: { approvalStatus: updated.approvalStatus, reason: req.body.reason },
    });
    res.json(updated);
  })
);

// Efficiency series for a vehicle (charts).
fuelRouter.get(
  '/efficiency/:vehicleId',
  authorize('fuel', 'read'),
  validate({ params: z.object({ vehicleId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const rows = await prisma.fuelTransaction.findMany({
      where: { vehicleId: req.params.vehicleId, isActive: true, kmPerLitre: { not: null } },
      orderBy: { filledAt: 'asc' },
      select: { filledAt: true, kmPerLitre: true, litres: true, odometer: true },
    });
    res.json(rows);
  })
);
