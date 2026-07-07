import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { hashPassword } from '../../lib/auth';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { NotFound } from '../../lib/errors';

export const usersRouter = Router();

const role = z.enum([
  'FLEET_MANAGER', 'WORKSHOP', 'COMPLIANCE', 'FINANCE', 'TRANSPORT_COORDINATOR',
  'OPS_DELIVERY', 'DELIVERY_MANAGER', 'WAREHOUSE_MANAGER', 'DRIVER', 'MANAGEMENT',
]);

usersRouter.get(
  '/',
  authorize('users', 'read'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, driverId: true, lastLoginAt: true },
    });
    res.json(users);
  })
);

usersRouter.post(
  '/',
  authorize('users', 'create'),
  validate({
    body: z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      role,
      password: z.string().min(8),
      driverId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.create({
      data: {
        email: req.body.email.toLowerCase(),
        fullName: req.body.fullName,
        role: req.body.role,
        passwordHash: await hashPassword(req.body.password),
        driverId: req.body.driverId,
        createdBy: req.user!.id,
      },
      select: { id: true, email: true, fullName: true, role: true },
    });
    await audit({ entity: 'users', entityId: user.id, action: 'create', actor: actorFrom(req), after: user });
    res.status(201).json(user);
  })
);

usersRouter.patch(
  '/:id',
  authorize('users', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ fullName: z.string().optional(), role: role.optional(), isActive: z.boolean().optional(), password: z.string().min(8).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('User not found');
    const data: Record<string, unknown> = { updatedBy: req.user!.id };
    if (req.body.fullName) data.fullName = req.body.fullName;
    if (req.body.role) data.role = req.body.role;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
    if (req.body.password) data.passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, email: true, fullName: true, role: true, isActive: true } });
    await audit({ entity: 'users', entityId: user.id, action: 'update', actor: actorFrom(req), before: { role: before.role, isActive: before.isActive }, after: user });
    res.json(user);
  })
);
