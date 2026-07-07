import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { runAlertEngine } from './alerts.engine';

export const alertsRouter = Router();

// Alert Centre feed (colour-coded, filterable).
alertsRouter.get(
  '/',
  authorize('alerts', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (req.query.resolved !== undefined) where.resolved = req.query.resolved === 'true';
    else where.resolved = false;
    if (req.query.category) where.category = req.query.category;
    if (req.query.severity) where.severity = req.query.severity;
    const [rows, total] = await Promise.all([
      prisma.alert.findMany({
        where, skip, take,
        orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }],
        include: { vehicle: { select: { plateNumber: true, plateEmirate: true } } },
      }),
      prisma.alert.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

// Counts by severity/category for dashboards.
alertsRouter.get(
  '/summary',
  authorize('alerts', 'read'),
  asyncHandler(async (_req, res) => {
    const bySeverity = await prisma.alert.groupBy({ by: ['severity'], where: { resolved: false }, _count: true });
    const byCategory = await prisma.alert.groupBy({ by: ['category'], where: { resolved: false }, _count: true });
    res.json({ bySeverity, byCategory });
  })
);

// Manually run the alert engine (Fleet Manager / Compliance) — useful for demo.
alertsRouter.post(
  '/run',
  authorize('alerts', 'read'),
  asyncHandler(async (req, res) => {
    const summary = await runAlertEngine();
    await audit({ entity: 'alerts', entityId: 'engine-run', action: 'update', actor: actorFrom(req), after: summary });
    res.json(summary);
  })
);

// Manually resolve an alert.
alertsRouter.post(
  '/:id/resolve',
  authorize('alerts', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const alert = await prisma.alert.update({ where: { id: req.params.id }, data: { resolved: true, resolvedAt: new Date() } });
    await audit({ entity: 'alerts', entityId: alert.id, action: 'update', actor: actorFrom(req), after: { resolved: true } });
    res.json(alert);
  })
);
