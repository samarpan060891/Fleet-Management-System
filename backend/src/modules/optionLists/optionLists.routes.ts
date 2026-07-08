import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { BadRequest } from '../../lib/errors';

export const optionListsRouter = Router();

// Capitalize the first letter of each word for display (e.g. "truck_3_7t" ->
// "Truck 3 7t"). Applied whenever a user-added label isn't given explicitly.
function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Extra, user-added picklist values for a given dropdown (e.g. fine type,
// vehicle type). Any authenticated user can read/add — this only ever
// extends a picklist, it never grants access to underlying resource data.
optionListsRouter.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const items = await prisma.optionListItem.findMany({
      where: { listKey: req.params.key },
      orderBy: { label: 'asc' },
    });
    res.json(items.map((i) => ({ value: i.value, label: i.label })));
  })
);

const createSchema = z.object({ value: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(80).optional() });

optionListsRouter.post(
  '/:key',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const raw = req.body.value as string;
    const value = raw.toLowerCase().trim().replace(/\s+/g, '_');
    if (!value) throw BadRequest('A value is required');
    const label = (req.body.label as string | undefined)?.trim() || titleCase(raw);

    const item = await prisma.optionListItem.upsert({
      where: { listKey_value: { listKey: req.params.key, value } },
      create: { listKey: req.params.key, value, label, createdBy: req.user!.id },
      update: {},
    });
    await audit({ entity: 'option_list_items', entityId: item.id, action: 'create', actor: actorFrom(req), after: item });
    res.status(201).json({ value: item.value, label: item.label });
  })
);
