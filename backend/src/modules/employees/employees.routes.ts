import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { crudRouter } from '../../lib/crud';

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
