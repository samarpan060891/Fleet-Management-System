import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../middleware/errorHandler';
import { resolvePeriod } from '../costs/costs.service';
import { Forbidden } from '../../lib/errors';

export const dashboardRouter = Router();

// Fleet Manager cockpit + shared KPIs (role gates which cards the UI shows).
dashboardRouter.get(
  '/',
  authorize('dashboard', 'read'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const { from, to } = resolvePeriod({ period: 'mtd' });

    const [statusCounts, alertSeverity, expiringSoon, pmDue, fuelMtd, maintMtd, finesMtd] =
      await Promise.all([
        prisma.vehicle.groupBy({ by: ['status'], where: { isActive: true }, _count: true }),
        prisma.alert.groupBy({ by: ['severity'], where: { resolved: false }, _count: true }),
        prisma.complianceDocument.count({ where: { isActive: true, expiryDate: { gte: now, lte: dayjs(now).add(30, 'day').toDate() } } }),
        prisma.pmState.count({ where: { nextPmDate: { lte: dayjs(now).add(15, 'day').toDate() } } }),
        prisma.fuelTransaction.aggregate({ where: { isActive: true, filledAt: { gte: from, lte: to } }, _sum: { amount: true } }),
        prisma.jobCard.aggregate({ where: { isActive: true, dateIn: { gte: from, lte: to } }, _sum: { totalCost: true } }),
        prisma.fine.aggregate({ where: { isActive: true, offenceAt: { gte: from, lte: to } }, _sum: { amount: true } }),
      ]);

    const availability: Record<string, number> = {};
    for (const s of statusCounts) availability[s.status] = s._count;

    const mtdCost =
      Number(fuelMtd._sum.amount ?? 0) + Number(maintMtd._sum.totalCost ?? 0) + Number(finesMtd._sum.amount ?? 0);

    res.json({
      availability,
      alertsBySeverity: alertSeverity,
      complianceExpiring30d: expiringSoon,
      pmDue,
      mtdCost: +mtdCost.toFixed(2),
      mtdBreakdown: {
        fuel: Number(fuelMtd._sum.amount ?? 0),
        maintenance: Number(maintMtd._sum.totalCost ?? 0),
        fines: Number(finesMtd._sum.amount ?? 0),
      },
    });
  })
);

// Driver mobile screen: own vehicle + status, own documents, mapped staff today.
dashboardRouter.get(
  '/driver',
  authorize('dashboard', 'read'),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'DRIVER' || !req.user!.driverId) throw Forbidden('Driver screen is for drivers');
    const driverId = req.user!.driverId;

    const assignment = await prisma.vehicleDriverAssignment.findFirst({
      where: { driverId, effectiveTo: null },
      include: { vehicle: { include: { documents: { where: { isActive: true } }, pmState: true } } },
    });
    const docs = await prisma.complianceDocument.findMany({ where: { isActive: true, driverId } });

    // Routes for the driver's vehicle + today's roster.
    const routes = assignment?.vehicleId
      ? await prisma.route.findMany({
          where: { isActive: true, vehicleId: assignment.vehicleId },
          include: { employees: { where: { isActive: true }, include: { employee: true } } },
        })
      : [];

    const today = dayjs().startOf('day').toDate();
    const attendance = await prisma.attendance.findMany({
      where: { routeId: { in: routes.map((r) => r.id) }, date: today },
    });

    res.json({
      vehicle: assignment?.vehicle
        ? {
            id: assignment.vehicle.id,
            plate: `${assignment.vehicle.plateNumber} (${assignment.vehicle.plateEmirate})`,
            status: assignment.vehicle.status,
            odometer: assignment.vehicle.currentOdometer,
            documents: assignment.vehicle.documents,
            pmState: assignment.vehicle.pmState,
          }
        : null,
      myDocuments: docs,
      routes: routes.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        scheduledTime: r.scheduledTime,
        staff: r.employees.map((e) => ({
          employeeId: e.employeeId,
          name: e.employee.name,
          pickupPoint: e.pickupPoint ?? e.employee.pickupPoint,
          status: attendance.find((a) => a.employeeId === e.employeeId)?.status ?? null,
        })),
      })),
    });
  })
);
