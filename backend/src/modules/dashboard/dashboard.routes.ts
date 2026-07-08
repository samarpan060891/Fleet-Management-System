import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../middleware/errorHandler';
import { computeFleetAssets, computeFleetCostPerKm, resolvePeriod } from '../costs/costs.service';
import { computeCalendarYearCostTrends, computeCostSummary, computeCostTrends, computeDowntimePct, computeFleetProfile } from './dashboard.analytics';
import { Forbidden } from '../../lib/errors';
import { utcToday } from '../../lib/dateOnly';

export const dashboardRouter = Router();

// Fleet Manager cockpit + shared KPIs (role gates which cards the UI shows).
dashboardRouter.get(
  '/',
  authorize('dashboard', 'read'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const { from, to } = resolvePeriod({ period: 'mtd' });
    const ytd = resolvePeriod({ period: 'ytd' });

    const [statusCounts, alertSeverity, expiringSoon, pmDue, costMtd, costYtd, downtimeMtd, downtimeYtd] =
      await Promise.all([
        prisma.vehicle.groupBy({ by: ['status'], where: { isActive: true }, _count: true }),
        prisma.alert.groupBy({ by: ['severity'], where: { resolved: false }, _count: true }),
        prisma.complianceDocument.count({ where: { isActive: true, expiryDate: { gte: now, lte: dayjs(now).add(30, 'day').toDate() } } }),
        prisma.pmState.count({ where: { nextPmDate: { lte: dayjs(now).add(15, 'day').toDate() } } }),
        computeCostSummary(from, to),
        computeCostSummary(ytd.from, ytd.to),
        computeDowntimePct(from, to),
        computeDowntimePct(ytd.from, ytd.to),
      ]);

    const availability: Record<string, number> = {};
    for (const s of statusCounts) availability[s.status] = s._count;

    // --- Today's allocations + utilization ---
    const todayStart = utcToday();
    const [allocByType, activeVehicles, activeDrivers, allocatedVehicles, allocatedDrivers, assets, payablesOpen] = await Promise.all([
      prisma.fleetAllocation.groupBy({ by: ['type'], where: { isActive: true, date: todayStart, status: { in: ['planned', 'active', 'completed'] } }, _count: true }),
      prisma.vehicle.count({ where: { isActive: true, status: { in: ['active', 'idle'] } } }),
      prisma.driver.count({ where: { isActive: true, status: 'active' } }),
      prisma.fleetAllocation.findMany({ where: { isActive: true, date: todayStart, status: { in: ['planned', 'active', 'completed'] } }, select: { vehicleId: true }, distinct: ['vehicleId'] }),
      prisma.fleetAllocation.findMany({ where: { isActive: true, date: todayStart, status: { in: ['planned', 'active', 'completed'] }, driverId: { not: null } }, select: { driverId: true }, distinct: ['driverId'] }),
      computeFleetAssets(),
      prisma.vendorInvoice.aggregate({ where: { isActive: true, status: { in: ['unpaid', 'partial'] } }, _sum: { amount: true, paidAmount: true } }),
    ]);
    const profile = await computeFleetProfile();
    const costPerKm = await computeFleetCostPerKm(from, to);
    const fleetUtilization = activeVehicles > 0 ? Math.round((allocatedVehicles.length / activeVehicles) * 100) : 0;
    const driverUtilization = activeDrivers > 0 ? Math.round((allocatedDrivers.length / activeDrivers) * 100) : 0;
    const payablesOutstanding = Number(payablesOpen._sum.amount ?? 0) - Number(payablesOpen._sum.paidAmount ?? 0);

    res.json({
      availability,
      alertsBySeverity: alertSeverity,
      complianceExpiring30d: expiringSoon,
      pmDue,
      cost: { mtd: costMtd, ytd: costYtd },
      downtime: { mtd: downtimeMtd, ytd: downtimeYtd },
      allocationsToday: allocByType.map((a) => ({ type: a.type, count: a._count })),
      utilization: {
        fleetPct: fleetUtilization, driverPct: driverUtilization,
        vehiclesAllocated: allocatedVehicles.length, activeVehicles,
        driversAllocated: allocatedDrivers.length, activeDrivers,
      },
      assets: {
        totalPurchaseValue: assets.totalPurchaseValue,
        totalBookValue: assets.totalBookValue,
        totalDepreciation: assets.totalDepreciation,
      },
      payablesOutstanding: +payablesOutstanding.toFixed(2),
      fleetAge: profile.fleetAge,
      experience: profile.experience,
      costPerKm,
    });
  })
);

// Monthly cost trends (fuel / maintenance / compliance) for trend + YoY charts.
dashboardRouter.get(
  '/cost-trends',
  authorize('dashboard', 'read'),
  asyncHandler(async (req, res) => {
    const months = Math.min(36, Math.max(6, Number(req.query.months) || 24));
    res.json(await computeCostTrends(months));
  })
);

// Fiscal-year-pinned (Jan-Dec) cost trends: current year + previous year, so
// the monthly trend chart and the year-on-year comparison always align to the
// calendar/fiscal year rather than a rolling window that could span two years.
dashboardRouter.get(
  '/cost-trends-fy',
  authorize('dashboard', 'read'),
  asyncHandler(async (req, res) => {
    const year = Math.max(2000, Number(req.query.year) || new Date().getFullYear());
    const [current, previous] = await Promise.all([
      computeCalendarYearCostTrends(year),
      computeCalendarYearCostTrends(year - 1),
    ]);
    res.json({ year, current, previous });
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

    const today = utcToday();
    const attendance = await prisma.attendance.findMany({
      where: { routeId: { in: routes.map((r) => r.id) }, date: today },
    });

    // Today's allocations for this driver (or their vehicle).
    const allocations = await prisma.fleetAllocation.findMany({
      where: {
        isActive: true, date: today, status: { in: ['planned', 'active'] },
        OR: [{ driverId }, ...(assignment?.vehicleId ? [{ vehicleId: assignment.vehicleId }] : [])],
      },
      include: { store: { select: { code: true, name: true } }, route: { select: { code: true, name: true } } },
      orderBy: { startTime: 'asc' },
    });

    // Past trips — completed/cancelled allocations before today, most recent
    // first. This is the driver's own trip history (dashboard "past trips").
    const pastTrips = await prisma.fleetAllocation.findMany({
      where: {
        isActive: true,
        date: { lt: today },
        status: { in: ['completed', 'cancelled'] },
        OR: [{ driverId }, ...(assignment?.vehicleId ? [{ vehicleId: assignment.vehicleId }] : [])],
      },
      include: { store: { select: { code: true, name: true } }, route: { select: { code: true, name: true } } },
      orderBy: { date: 'desc' },
      take: 20,
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
      allocations: allocations.map((a) => ({
        id: a.id, type: a.type, status: a.status, startTime: a.startTime, endTime: a.endTime,
        destination: a.type === 'store_delivery' ? (a.store ? `${a.store.code} · ${a.store.name}` : null)
          : a.type === 'staff_transport' ? (a.route ? `${a.route.code} · ${a.route.name}` : null)
          : [a.reference, a.area, a.emirate].filter(Boolean).join(' · ') || null,
      })),
      pastTrips: pastTrips.map((a) => ({
        id: a.id, type: a.type, status: a.status, date: a.date,
        startTime: a.startTime, endTime: a.endTime,
        tripStartAt: a.tripStartAt, tripEndAt: a.tripEndAt, waitingMinutes: a.waitingMinutes,
        destination: a.type === 'store_delivery' ? (a.store ? `${a.store.code} · ${a.store.name}` : null)
          : a.type === 'staff_transport' ? (a.route ? `${a.route.code} · ${a.route.name}` : null)
          : [a.reference, a.area, a.emirate].filter(Boolean).join(' · ') || null,
      })),
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
