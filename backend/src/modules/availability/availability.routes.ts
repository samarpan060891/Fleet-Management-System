import { Router } from 'express';
import dayjs from 'dayjs';
import { DocType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../middleware/errorHandler';

export const availabilityRouter = Router();

// Mandatory documents whose expiry blocks a vehicle from being planned.
const BLOCKING_DOCS: DocType[] = [DocType.mulkiya, DocType.insurance, DocType.tasjeel];

// Read-only availability board. Vehicles with an expired mandatory document are
// flagged compliance-blocked (greyed out; cannot be planned).
availabilityRouter.get(
  '/',
  authorize('availability', 'read'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const today = dayjs().startOf('day').toDate();
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true, status: { not: 'disposed' } },
      include: {
        store: { select: { code: true, name: true, emirate: true } },
        documents: { where: { isActive: true, docType: { in: BLOCKING_DOCS } }, select: { docType: true, expiryDate: true } },
        assignments: { where: { effectiveTo: null }, include: { driver: { select: { fullName: true } } }, take: 1 },
        // Today's live allocation (what the vehicle is doing).
        allocations: {
          where: { isActive: true, date: today, status: { in: ['planned', 'active'] } },
          orderBy: { createdAt: 'desc' }, take: 1,
        },
      },
      orderBy: { plateNumber: 'asc' },
    });

    const board = vehicles.map((v) => {
      const expired = v.documents.filter((d) => d.expiryDate && d.expiryDate < now);
      const complianceBlocked = expired.length > 0;
      const allocation = v.allocations[0] ?? null;
      // Availability buckets for the planning board.
      let bucket: 'free' | 'committed' | 'workshop' | 'blocked';
      if (complianceBlocked) bucket = 'blocked';
      else if (v.status === 'in_workshop' || v.status === 'vor') bucket = 'workshop';
      else if (allocation || (v.assignments.length > 0 && v.status === 'active')) bucket = 'committed';
      else bucket = 'free';

      return {
        id: v.id,
        plate: `${v.plateNumber} (${v.plateEmirate})`,
        vehicleType: v.vehicleType,
        status: v.status,
        store: v.store,
        seatingCapacity: v.seatingCapacity,
        payloadKg: v.payloadKg,
        assignedDriver: v.assignments[0]?.driver?.fullName ?? null,
        allocationType: allocation?.type ?? null,
        allocationReference: allocation?.reference ?? null,
        complianceBlocked,
        blockingDocs: expired.map((d) => d.docType),
        bucket,
        canPlan: !complianceBlocked && v.status !== 'in_workshop' && v.status !== 'vor',
      };
    });

    const kpis = {
      total: board.length,
      free: board.filter((b) => b.bucket === 'free').length,
      committed: board.filter((b) => b.bucket === 'committed').length,
      workshop: board.filter((b) => b.bucket === 'workshop').length,
      blocked: board.filter((b) => b.bucket === 'blocked').length,
      availablePct: board.length ? Math.round((board.filter((b) => b.canPlan).length / board.length) * 100) : 0,
    };

    res.json({ kpis, vehicles: board });
  })
);
