import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { computeVehicleTco, resolvePeriod } from './costs.service';

export const costsRouter = Router();

// TCO for a single vehicle.
costsRouter.get(
  '/vehicle/:vehicleId',
  authorize('costs', 'read'),
  validate({ params: z.object({ vehicleId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { from, to } = resolvePeriod(req.query as Record<string, string>);
    res.json(await computeVehicleTco(req.params.vehicleId, from, to));
  })
);

// Fleet-wide cost roll-up + cost-per-km, grouped and top-costliest.
costsRouter.get(
  '/summary',
  authorize('costs', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to } = resolvePeriod(req.query as Record<string, string>);
    const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
    const rows = [];
    for (const v of vehicles) {
      rows.push(await computeVehicleTco(v.id, from, to));
    }
    const fleetTotal = rows.reduce((s, r) => s + r.totalCost, 0);
    const fleetCash = rows.reduce((s, r) => s + r.cashCost, 0);
    const topCostliest = [...rows].sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);
    res.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      fleetTotalCost: +fleetTotal.toFixed(2),
      fleetCashCost: +fleetCash.toFixed(2),
      vehicleCount: rows.length,
      topCostliest,
      vehicles: rows,
    });
  })
);
