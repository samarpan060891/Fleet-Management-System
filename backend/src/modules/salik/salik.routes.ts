import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';

export const salikRouter = Router();

salikRouter.get(
  '/',
  authorize('salik', 'read'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.salikTag.findMany({
      include: { vehicle: { select: { plateNumber: true, plateEmirate: true } } },
      orderBy: { balance: 'asc' },
    });
    res.json(rows);
  })
);

// Upsert a Salik tag + balance for a vehicle (manual entry / import).
salikRouter.put(
  '/:vehicleId',
  authorize('salik', 'update'),
  validate({
    params: z.object({ vehicleId: z.string().uuid() }),
    body: z.object({ tagNumber: z.string(), balance: z.number(), lowThreshold: z.number().optional() }),
  }),
  asyncHandler(async (req, res) => {
    const row = await prisma.salikTag.upsert({
      where: { vehicleId: req.params.vehicleId },
      create: { vehicleId: req.params.vehicleId, tagNumber: req.body.tagNumber, balance: req.body.balance, lowThreshold: req.body.lowThreshold ?? 20, updatedBy: req.user!.id },
      update: { tagNumber: req.body.tagNumber, balance: req.body.balance, lowThreshold: req.body.lowThreshold, updatedBy: req.user!.id },
    });
    await audit({ entity: 'salik_tags', entityId: row.id, action: 'update', actor: actorFrom(req), after: row });
    res.json(row);
  })
);
