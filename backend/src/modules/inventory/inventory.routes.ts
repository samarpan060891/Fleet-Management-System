import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { NotFound } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';

export const inventoryRouter = Router();

// Feature flag guard — the module is fully built but shipped disabled.
// When FEATURE_INVENTORY=false every route returns 404 as if it did not exist.
inventoryRouter.use((_req, _res, next) => {
  if (!env.features.inventory) return next(NotFound('Inventory module is disabled'));
  next();
});

inventoryRouter.get(
  '/parts',
  authorize('inventory', 'read'),
  asyncHandler(async (_req, res) => {
    const parts = await prisma.part.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, include: { movements: { take: 5, orderBy: { createdAt: 'desc' } } } });
    // Reorder-level alerts when enabled.
    const withAlerts = parts.map((p) => ({ ...p, belowReorder: Number(p.stockOnHand) <= Number(p.reorderLevel) }));
    res.json(withAlerts);
  })
);

inventoryRouter.post(
  '/parts',
  authorize('inventory', 'create'),
  validate({ body: z.object({ code: z.string(), name: z.string(), category: z.string().optional(), unit: z.string().optional(), reorderLevel: z.number().optional() }) }),
  asyncHandler(async (req, res) => {
    const part = await prisma.part.create({ data: req.body });
    await audit({ entity: 'parts', entityId: part.id, action: 'create', actor: actorFrom(req), after: part });
    res.status(201).json(part);
  })
);

inventoryRouter.post(
  '/parts/:id/movement',
  authorize('inventory', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ direction: z.enum(['in', 'out']), qty: z.number().positive(), reference: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { id: req.params.id } });
      if (!part) throw NotFound('Part not found');
      const delta = req.body.direction === 'in' ? req.body.qty : -req.body.qty;
      const updated = await tx.part.update({ where: { id: req.params.id }, data: { stockOnHand: { increment: delta } } });
      await tx.partMovement.create({ data: { partId: req.params.id, direction: req.body.direction, qty: req.body.qty, reference: req.body.reference, createdBy: req.user!.id } });
      return updated;
    });
    res.json(result);
  })
);
