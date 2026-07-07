import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { upload } from '../../middleware/upload';
import { storage } from '../../lib/storage';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { BadRequest, NotFound } from '../../lib/errors';

export const incidentsRouter = Router();

const createSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  occurredAt: z.string(),
  emirate: z.string().optional(),
  area: z.string().optional(),
  description: z.string().optional(),
  policeReportNo: z.string().optional(),
  thirdParty: z.string().optional(),
  insuranceVendorId: z.string().uuid().optional(),
  claimAmount: z.number().optional(),
});

incidentsRouter.get(
  '/',
  authorize('incidents', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.claimStatus) where.claimStatus = req.query.claimStatus;
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    const [rows, total] = await Promise.all([
      prisma.incident.findMany({
        where, skip, take, orderBy: { occurredAt: 'desc' },
        include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, driver: { select: { fullName: true } }, photos: true },
      }),
      prisma.incident.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

incidentsRouter.post(
  '/',
  authorize('incidents', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const incident = await prisma.incident.create({
      data: { ...req.body, occurredAt: new Date(req.body.occurredAt), createdBy: req.user!.id, updatedBy: req.user!.id },
    });
    await audit({ entity: 'incidents', entityId: incident.id, action: 'create', actor: actorFrom(req), after: incident });
    res.status(201).json(incident);
  })
);

// Update claim lifecycle (reported → ... → settled).
incidentsRouter.patch(
  '/:id',
  authorize('incidents', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      claimStatus: z.enum(['reported', 'under_review', 'approved', 'rejected', 'settled']).optional(),
      claimAmount: z.number().optional(),
      settlementAmount: z.number().optional(),
      description: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Incident not found');
    const incident = await prisma.incident.update({ where: { id: req.params.id }, data: { ...req.body, updatedBy: req.user!.id } });
    await audit({ entity: 'incidents', entityId: incident.id, action: 'update', actor: actorFrom(req), before, after: incident });
    res.json(incident);
  })
);

// Upload accident photos.
incidentsRouter.post(
  '/:id/photos',
  authorize('incidents', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  upload.array('photos', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) throw BadRequest('No photos uploaded');
    const created = [];
    for (const f of files) {
      const key = await storage.save(f.buffer, { filename: f.originalname, mime: f.mimetype });
      created.push(await prisma.incidentPhoto.create({ data: { incidentId: req.params.id, fileKey: key } }));
    }
    res.status(201).json(created);
  })
);
