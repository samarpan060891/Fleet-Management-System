import { prisma } from '../../lib/prisma';
import { utcToday } from '../../lib/dateOnly';

export interface StopEmployee {
  employeeId: string;
  name: string;
  phone: string | null;
  status: 'present' | 'absent' | null;
  reachedAt: Date | null;
  confirmedAt: Date | null;
}

export interface RouteStop {
  pickupPoint: string;
  sequence: number | null;
  employees: StopEmployee[];
}

export interface RouteWithStops {
  id: string;
  code: string;
  name: string;
  direction: string | null;
  scheduledTime: string | null;
  vehicle: { id: string; plate: string } | null;
  driver: { id: string; fullName: string; phone: string | null } | null;
  stops: RouteStop[];
}

// Builds a route's stop-by-stop progress for a given day: pickup points in
// sequence order, each with the employees boarding/alighting there and
// today's attendance timestamps (driver "reached" + rider "confirmed").
// Shared by the driver dashboard, the staff dashboard, and the roster
// write endpoints so all three agree on exactly the same stop grouping.
export async function buildRouteWithStops(routeId: string, date?: Date): Promise<RouteWithStops | null> {
  const day = date ?? utcToday();
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      vehicle: { select: { id: true, plateNumber: true, plateEmirate: true } },
      driver: { select: { id: true, fullName: true, phone: true } },
      employees: {
        where: { isActive: true, effectiveTo: null },
        include: { employee: { select: { id: true, name: true, phone: true, pickupPoint: true } } },
      },
    },
  });
  if (!route) return null;

  const attendance = await prisma.attendance.findMany({ where: { routeId, date: day } });
  const attByEmployee = new Map(attendance.map((a) => [a.employeeId, a]));

  const groups = new Map<string, RouteStop>();
  for (const re of route.employees) {
    const point = re.pickupPoint ?? re.employee.pickupPoint ?? 'Unspecified';
    if (!groups.has(point)) groups.set(point, { pickupPoint: point, sequence: re.sequence ?? null, employees: [] });
    const g = groups.get(point)!;
    if (re.sequence != null && (g.sequence == null || re.sequence < g.sequence)) g.sequence = re.sequence;
    const a = attByEmployee.get(re.employeeId);
    g.employees.push({
      employeeId: re.employee.id,
      name: re.employee.name,
      phone: re.employee.phone,
      status: (a?.status as 'present' | 'absent' | undefined) ?? null,
      reachedAt: a?.reachedAt ?? null,
      confirmedAt: a?.confirmedAt ?? null,
    });
  }
  const stops = [...groups.values()].sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));

  return {
    id: route.id,
    code: route.code,
    name: route.name,
    direction: route.direction,
    scheduledTime: route.scheduledTime,
    vehicle: route.vehicle ? { id: route.vehicle.id, plate: `${route.vehicle.plateNumber} (${route.vehicle.plateEmirate})` } : null,
    driver: route.driver ? { id: route.driver.id, fullName: route.driver.fullName, phone: route.driver.phone } : null,
    stops,
  };
}
