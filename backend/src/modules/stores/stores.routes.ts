import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { crudRouter } from '../../lib/crud';

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  emirate: z.string().min(1),
  address: z.string().optional(),
  contact: z.string().optional(),
  deliveryWindow: z.string().optional(),
});

export const storesRouter = crudRouter({
  resource: 'stores',
  delegate: prisma.store as never,
  entityName: 'stores',
  createSchema,
  updateSchema: createSchema.partial(),
  searchFields: ['code', 'name', 'description', 'emirate'],
  orderBy: { code: 'asc' },
});
