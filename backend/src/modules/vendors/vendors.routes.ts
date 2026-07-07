import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { crudRouter } from '../../lib/crud';

const vendorType = z.enum([
  'workshop',
  'tyre_supplier',
  'insurance',
  'fuel_supplier',
  'spare_parts',
  'lessor',
  'other',
]);

const createSchema = z.object({
  type: vendorType,
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  trn: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const vendorsRouter = crudRouter({
  resource: 'vendors',
  delegate: prisma.vendor as never,
  entityName: 'vendors',
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ['name', 'contactPerson', 'phone', 'email'],
  orderBy: { name: 'asc' },
  buildWhere: (q) => (q.type ? { type: q.type } : {}),
});
