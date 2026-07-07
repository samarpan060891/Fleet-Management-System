import { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { getAllSettings, setSetting } from './settings.service';
import { SETTING_LABELS } from './settings.defaults';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  authorize('settings', 'read'),
  asyncHandler(async (_req, res) => {
    const values = await getAllSettings();
    res.json({ values, labels: SETTING_LABELS });
  })
);

// Update one setting key (admin-configurable alert windows, thresholds, etc.).
settingsRouter.put(
  '/:key',
  authorize('settings', 'update'),
  validate({ params: z.object({ key: z.string() }), body: z.object({ value: z.unknown() }) }),
  asyncHandler(async (req, res) => {
    await setSetting(req.params.key, (req.body as { value: unknown }).value, req.user!.id);
    await audit({ entity: 'settings', entityId: req.params.key, action: 'update', actor: actorFrom(req), after: req.body });
    res.json({ ok: true });
  })
);
