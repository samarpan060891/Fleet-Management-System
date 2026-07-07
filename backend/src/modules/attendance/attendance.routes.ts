import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { Forbidden } from '../../lib/errors';

export const attendanceRouter = Router();

// Ensure a driver is allowed to touch a given route (its assigned vehicle).
async function driverOwnsRoute(driverId: string, routeId: string): Promise<boolean> {
  const route = await prisma.route.findUnique({ where: { id: routeId }, select: { vehicleId: true, driverId: true } });
  if (!route) return false;
  if (route.driverId === driverId) return true;
  if (!route.vehicleId) return false;
  const asg = await prisma.vehicleDriverAssignment.findFirst({ where: { driverId, vehicleId: route.vehicleId, effectiveTo: null } });
  return !!asg;
}

// GET attendance for a route/date.
attendanceRouter.get(
  '/',
  authorize('attendance', 'read'),
  validate({ query: z.object({ routeId: z.string().uuid(), date: z.string() }).partial() as never }),
  asyncHandler(async (req, res) => {
    const routeId = req.query.routeId as string;
    const date = req.query.date ? dayjs(req.query.date as string) : dayjs();
    const rows = await prisma.attendance.findMany({
      where: { routeId, date: date.startOf('day').toDate() },
      include: { employee: { select: { name: true, staffId: true } } },
    });
    res.json(rows);
  })
);

const markSchema = z.object({
  routeId: z.string().uuid(),
  date: z.string(),
  marks: z.array(z.object({ employeeId: z.string().uuid(), status: z.enum(['present', 'absent']), note: z.string().optional() })),
});

// Mark attendance. Coordinator marks take precedence over driver marks for the
// same employee/date; a driver may not overwrite a coordinator mark.
attendanceRouter.post(
  '/mark',
  authorize('attendance', 'create'),
  validate({ body: markSchema }),
  asyncHandler(async (req, res) => {
    const isDriver = req.user!.role === 'DRIVER';
    const markedBy = isDriver ? 'driver' : 'coordinator';
    if (isDriver) {
      const ok = await driverOwnsRoute(req.user!.driverId ?? '', req.body.routeId);
      if (!ok) throw Forbidden('You can only mark attendance for your own route');
    }
    const date = dayjs(req.body.date).startOf('day').toDate();
    const results: unknown[] = [];

    for (const m of req.body.marks) {
      const existing = await prisma.attendance.findUnique({
        where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId: m.employeeId, date } },
      });
      // Precedence: driver cannot overwrite an existing coordinator mark.
      if (existing && isDriver && existing.markedBy === 'coordinator') {
        results.push({ employeeId: m.employeeId, skipped: 'coordinator mark takes precedence' });
        continue;
      }
      const row = await prisma.attendance.upsert({
        where: { routeId_employeeId_date: { routeId: req.body.routeId, employeeId: m.employeeId, date } },
        create: { routeId: req.body.routeId, employeeId: m.employeeId, date, status: m.status, markedBy, markedByUserId: req.user!.id, note: m.note },
        update: { status: m.status, markedBy, markedByUserId: req.user!.id, note: m.note },
      });
      await audit({
        entity: 'attendance', entityId: row.id, action: existing ? 'update' : 'create', actor: actorFrom(req),
        before: existing ? { status: existing.status, markedBy: existing.markedBy } : undefined,
        after: { status: row.status, markedBy: row.markedBy },
      });
      results.push(row);
    }
    res.json({ results });
  })
);
