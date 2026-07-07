import { PrismaClient } from '@prisma/client';
import { driverOnDate, assignDriver } from '../assignments/assignments.service';

// Integration test against the database (uses DATABASE_URL). Verifies fine
// attribution picks the driver assigned on the offence date from history.
const prisma = new PrismaClient();

describe('fine attribution via assignment history', () => {
  let vehicleId: string;
  let driverA: string;
  let driverB: string;

  beforeAll(async () => {
    const v = await prisma.vehicle.create({
      data: { plateNumber: `T-${Date.now()}`, plateEmirate: 'Dubai', make: 'Test', model: 'X', year: 2022, vehicleType: 'van', currentOdometer: 1000 },
    });
    vehicleId = v.id;
    const a = await prisma.driver.create({ data: { fullName: 'Driver A', staffId: `A-${Date.now()}` } });
    const b = await prisma.driver.create({ data: { fullName: 'Driver B', staffId: `B-${Date.now()}` } });
    driverA = a.id;
    driverB = b.id;

    // A drove Jan 1 – Jan 31; B from Feb 1 onward.
    await assignDriver(prisma, { vehicleId, driverId: driverA, effectiveFrom: new Date('2026-01-01') });
    await assignDriver(prisma, { vehicleId, driverId: driverB, effectiveFrom: new Date('2026-02-01') });
  });

  afterAll(async () => {
    await prisma.vehicleDriverAssignment.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.driver.deleteMany({ where: { id: { in: [driverA, driverB] } } });
    await prisma.$disconnect();
  });

  it('attributes an offence in January to Driver A', async () => {
    expect(await driverOnDate(prisma, vehicleId, new Date('2026-01-15'))).toBe(driverA);
  });

  it('attributes an offence in February to Driver B', async () => {
    expect(await driverOnDate(prisma, vehicleId, new Date('2026-02-15'))).toBe(driverB);
  });

  it('returns null before any assignment existed', async () => {
    expect(await driverOnDate(prisma, vehicleId, new Date('2025-12-01'))).toBeNull();
  });
});
