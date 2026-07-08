import { Router } from 'express';
import { z } from 'zod';
import { User } from '@prisma/client';
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

function userResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    driverId: user.driverId,
    employeeId: user.employeeId,
    permissions: effectivePermissions(user.role),
  };
}

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
      employeeId: user.employeeId,
    });

    res.json({ token, user: userResponse(user) });
  })
);

// Staff mobile login: staff ID + PIN instead of email/password (employees
// aren't issued an email address). Looks up the Employee, then the User
// account provisioned for them (see POST /employees/:id/set-pin), and
// verifies the PIN against that account's password hash.
const staffLoginSchema = z.object({
  staffId: z.string().min(1),
  pin: z.string().min(1),
});

authRouter.post(
  '/staff-login',
  validate({ body: staffLoginSchema }),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { staffId: req.body.staffId } });
    if (!employee || !employee.isActive) throw Unauthorized('Invalid staff ID or PIN');
    const user = employee ? await prisma.user.findUnique({ where: { employeeId: employee.id } }) : null;
    if (!user || !user.isActive) throw Unauthorized('Invalid staff ID or PIN');
    const ok = await verifyPassword(req.body.pin, user.passwordHash);
    if (!ok) throw Unauthorized('Invalid staff ID or PIN');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
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
      employeeId: user.employeeId,
    });

    res.json({ token, user: userResponse(user) });
  })
);

// Current user + effective permissions (for the frontend to build nav/guards).
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw Unauthorized();
    res.json(userResponse(user));
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
