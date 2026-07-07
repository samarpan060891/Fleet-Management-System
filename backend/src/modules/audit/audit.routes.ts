import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../middleware/errorHandler';
import { paged, paging } from '../../lib/http';

export const auditRouter = Router();

// Global audit log, queryable by Fleet Manager / Management.
auditRouter.get(
  '/',
  authorize('audit', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (req.query.entity) where.entity = req.query.entity;
    if (req.query.entityId) where.entityId = req.query.entityId;
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.action) where.action = req.query.action;
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paged(rows, total, page, pageSize));
  })
);
