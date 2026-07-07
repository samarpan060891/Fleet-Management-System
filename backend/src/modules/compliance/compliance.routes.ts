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

export const complianceRouter = Router();

const docType = z.enum([
  'mulkiya',
  'insurance',
  'tasjeel',
  'lease',
  'warranty',
  'licence',
  'emirates_id',
  'visa',
  'passport',
]);

const baseSchema = z.object({
  entityType: z.enum(['vehicle', 'driver']),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  docType,
  reference: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  renewalInProgress: z.boolean().optional(),
  notes: z.string().optional(),
});

const createSchema = baseSchema.refine(
  (d) => (d.entityType === 'vehicle' ? !!d.vehicleId : !!d.driverId),
  { message: 'vehicleId is required for vehicle documents; driverId for driver documents' }
);

// Compliance register: all vehicle & driver document expiries in one place.
complianceRouter.get(
  '/',
  authorize('compliance', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.driverId) where.driverId = req.query.driverId;
    if (req.query.docType) where.docType = req.query.docType;
    // Optional: only items expiring within N days.
    if (req.query.expiringInDays) {
      const days = Number(req.query.expiringInDays);
      where.expiryDate = { lte: new Date(Date.now() + days * 86400000) };
    }
    const [rows, total] = await Promise.all([
      prisma.complianceDocument.findMany({
        where,
        skip,
        take,
        orderBy: { expiryDate: 'asc' },
        include: {
          vehicle: { select: { plateNumber: true, plateEmirate: true } },
          driver: { select: { fullName: true, staffId: true } },
        },
      }),
      prisma.complianceDocument.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);

complianceRouter.post(
  '/',
  authorize('compliance', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
    };
    const doc = await prisma.complianceDocument.create({ data });
    await audit({ entity: 'compliance_documents', entityId: doc.id, action: 'create', actor: actorFrom(req), after: doc });
    res.status(201).json(doc);
  })
);

complianceRouter.patch(
  '/:id',
  authorize('compliance', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: baseSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.complianceDocument.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Document not found');
    const data = {
      ...req.body,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      updatedBy: req.user!.id,
    };
    const doc = await prisma.complianceDocument.update({ where: { id: req.params.id }, data });
    await audit({ entity: 'compliance_documents', entityId: doc.id, action: 'update', actor: actorFrom(req), before, after: doc });
    res.json(doc);
  })
);

// Upload a scanned document file to a compliance record.
complianceRouter.post(
  '/:id/file',
  authorize('compliance', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw BadRequest('No file uploaded');
    const key = await storage.save(req.file.buffer, { filename: req.file.originalname, mime: req.file.mimetype });
    const doc = await prisma.complianceDocument.update({ where: { id: req.params.id }, data: { fileKey: key, updatedBy: req.user!.id } });
    await audit({ entity: 'compliance_documents', entityId: doc.id, action: 'update', actor: actorFrom(req), after: { fileKey: key } });
    res.json({ fileKey: key });
  })
);

complianceRouter.delete(
  '/:id',
  authorize('compliance', 'delete'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.complianceDocument.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Document not found');
    await prisma.complianceDocument.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user!.id } });
    await audit({ entity: 'compliance_documents', entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
    res.json({ ok: true });
  })
);
