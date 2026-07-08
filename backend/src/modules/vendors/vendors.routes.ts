import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { crudRouter } from '../../lib/crud';

// A user-extensible category (see /option-lists/vendor.type) — accept any
// non-empty slug rather than a fixed enum.
const vendorType = z.string().min(1).max(60);

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
