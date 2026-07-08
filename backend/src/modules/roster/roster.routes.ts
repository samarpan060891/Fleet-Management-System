import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { Forbidden, NotFound } from '../../lib/errors';
import { utcDateOnly, utcToday } from '../../lib/dateOnly';
import { buildRouteWithStops } from './roster.service';

export const rosterRouter = Router();

// A driver may only act on a route their assigned vehicle (or they
// themselves) currently runs — same ownership check attendance.routes.ts uses.
async function driverOwnsRoute(driverId: string, routeId: string): Promise<boolean> {
  const route = await prisma.route.findUnique({ where: { id: routeId }, select: { vehicleId: true, driverId: true } });
  if (!route) return false;
  if (route.driverId === driverId) return true;
  if (!route.vehicleId) return false;
  const asg = await prisma.vehicleDriverAssignment.findFirst({ where: { driverId, vehicleId: route.vehicleId, effectiveTo: null } });
  return !!asg;
}

// Driver marks the vehicle as having reached a pickup/drop point — applies
// to every employee grouped at that stop in one tap (a stop can serve
// several riders). Creates today's attendance rows if they don't exist yet.
const reachedSchema = z.object({
  routeId: z.string().uuid(),
  pickupPoint: z.string().min(1),
  date: z.string().optional(),
});

rosterRouter.post(
  '/reached',
  authorize('roster', 'create'),
  validate({ body: reachedSchema }),
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'DRIVER') {
      const ok = await driverOwnsRoute(req.user!.driverId ?? '', req.body.routeId);
      if (!ok) throw Forbidden('You can only update your own route');
    }
    const date = req.body.date ? utcDateOnly(req.body.date) : utcToday();
    const stop = await buildRouteWithStops(req.body.routeId, date);
    if (!stop) throw NotFound('Route not found');
    const group = stop.stops.find((s) => s.pickupPoint === req.body.pickupPoint);
    if (!group) throw NotFound('Stop not found on this route');

    const now = new Date();
    for (const emp of group.employees) {
      const existing = await prisma.attendance.findUnique({
        where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId: emp.employeeId, date } },
      });
      await prisma.attendance.upsert({
        where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId: emp.employeeId, date } },
        create: { routeId: req.body.routeId, employeeId: emp.employeeId, date, status: 'absent', markedBy: 'driver', markedByUserId: req.user!.id, reachedAt: now },
        update: { reachedAt: existing?.reachedAt ?? now },
      });
    }
    await audit({ entity: 'attendance', entityId: req.body.routeId, action: 'update', actor: actorFrom(req), after: { pickupPoint: req.body.pickupPoint, reachedAt: now } });
    res.json(await buildRouteWithStops(req.body.routeId, date));
  })
);

// Employee confirms they've been picked up (or dropped off, on a return
// route) — self-service, from the staff screen. Captures the system
// timestamp as the attendance record.
const confirmSchema = z.object({
  routeId: z.string().uuid(),
  date: z.string().optional(),
});

rosterRouter.post(
  '/confirm',
  authorize('roster', 'create'),
  validate({ body: confirmSchema }),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'STAFF' || !req.user!.employeeId) throw Forbidden('Only staff can confirm their own pickup');
    const employeeId = req.user!.employeeId;
    const mapped = await prisma.routeEmployee.findFirst({ where: { routeId: req.body.routeId, employeeId, isActive: true, effectiveTo: null } });
    if (!mapped) throw Forbidden('You are not on this route');

    const date = req.body.date ? utcDateOnly(req.body.date) : utcToday();
    const now = new Date();
    const existing = await prisma.attendance.findUnique({
      where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId, date } },
    });
    const row = await prisma.attendance.upsert({
      where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId, date } },
      create: { routeId: req.body.routeId, employeeId, date, status: 'present', markedBy: 'staff', markedByUserId: req.user!.id, confirmedAt: now },
      update: { status: 'present', markedBy: 'staff', markedByUserId: req.user!.id, confirmedAt: now },
    });
    await audit({
      entity: 'attendance', entityId: row.id, action: existing ? 'update' : 'create', actor: actorFrom(req),
      before: existing ? { status: existing.status, confirmedAt: existing.confirmedAt } : undefined,
      after: { status: row.status, confirmedAt: row.confirmedAt },
    });
    res.json(row);
  })
);

// Driver finalizes the route for the day: anyone not confirmed by now is
// marked absent. This is the "final drop off" close-out action.
const completeSchema = z.object({ date: z.string().optional() });

rosterRouter.post(
  '/routes/:id/complete',
  authorize('roster', 'create'),
  validate({ params: z.object({ id: z.string().uuid() }), body: completeSchema }),
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'DRIVER') {
      const ok = await driverOwnsRoute(req.user!.driverId ?? '', req.params.id);
      if (!ok) throw Forbidden('You can only complete your own route');
    }
    const date = req.body.date ? utcDateOnly(req.body.date) : utcToday();
    const mapped = await prisma.routeEmployee.findMany({ where: { routeId: req.params.id, isActive: true, effectiveTo: null } });
    for (const re of mapped) {
      const existing = await prisma.attendance.findUnique({
        where: { routeId_employeeId_date: { routeId: req.params.id, employeeId: re.employeeId, date } },
      });
      if (existing?.confirmedAt) continue; // already confirmed by the rider — leave as-is
      // No self-confirmation by close-out: fall back to the driver's own
      // "reached" mark (present) if given, otherwise the rider never boarded.
      const status = existing?.reachedAt ? 'present' : 'absent';
      await prisma.attendance.upsert({
        where: { routeId_employeeId_date: { routeId: req.params.id, employeeId: re.employeeId, date } },
        create: { routeId: req.params.id, employeeId: re.employeeId, date, status, markedBy: 'driver', markedByUserId: req.user!.id },
        update: { status, markedBy: 'driver', markedByUserId: req.user!.id },
      });
    }
    await audit({ entity: 'routes', entityId: req.params.id, action: 'update', actor: actorFrom(req), after: { completedDate: date } });
    res.json(await buildRouteWithStops(req.params.id, date));
  })
);
