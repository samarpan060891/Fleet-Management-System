import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signToken, verifyPassword } from '../../lib/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { Unauthorized } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { effectivePermissions } from '../../config/permissions';
import { actorFrom } from '../../lib/http';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) throw Unauthorized('Invalid credentials');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await audit({
      entity: 'users',
      entityId: user.id,
      action: 'login',
      actor: { id: user.id, email: user.email, ip: req.ip },
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      driverId: user.driverId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        driverId: user.driverId,
        permissions: effectivePermissions(user.role),
      },
    });
  })
);

// Current user + effective permissions (for the frontend to build nav/guards).
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw Unauthorized();
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      driverId: user.driverId,
      permissions: effectivePermissions(user.role),
    });
  })
);

// Change own password.
authRouter.post(
  '/change-password',
  authenticate,
  validate({
    body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }),
  }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw Unauthorized();
    const ok = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!ok) throw Unauthorized('Current password is incorrect');
    const { hashPassword } = await import('../../lib/auth');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(req.body.newPassword) },
    });
    await audit({ entity: 'users', entityId: user.id, action: 'update', actor: actorFrom(req) });
    res.json({ ok: true });
  })
);
