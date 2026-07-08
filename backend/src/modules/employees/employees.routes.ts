import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { crudRouter } from '../../lib/crud';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { hashPassword } from '../../lib/auth';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { NotFound } from '../../lib/errors';

const createSchema = z.object({
  name: z.string().min(1),
  staffId: z.string().min(1),
  pickupPoint: z.string().optional(),
  homeCamp: z.string().optional(),
  phone: z.string().optional(),
});

export const employeesRouter = crudRouter({
  resource: 'employees',
  delegate: prisma.employee as never,
  entityName: 'employees',
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ['name', 'staffId', 'homeCamp'],
  orderBy: { name: 'asc' },
});

// Provision or reset the staff mobile-login PIN for this employee. Creates
// the linked User (role STAFF) on first use; a synthetic email is stored
// since employees aren't issued one — login is by staff ID + PIN instead
// (see POST /auth/staff-login).
employeesRouter.post(
  '/:id/set-pin',
  authorize('employees', 'update'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits') }),
  }),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) throw NotFound('Employee not found');
    const passwordHash = await hashPassword(req.body.pin);
    const existing = await prisma.user.findUnique({ where: { employeeId: employee.id } });
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true, updatedBy: req.user!.id } })
      : await prisma.user.create({
          data: {
            email: `staff-${employee.staffId}@staff.internal`.toLowerCase(),
            passwordHash,
            fullName: employee.name,
            role: 'STAFF',
            employeeId: employee.id,
            createdBy: req.user!.id,
            updatedBy: req.user!.id,
          },
        });
    await audit({ entity: 'users', entityId: user.id, action: existing ? 'update' : 'create', actor: actorFrom(req), after: { role: 'STAFF', employeeId: employee.id } });
    res.json({ ok: true });
  })
);
