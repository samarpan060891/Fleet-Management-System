import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import { uploadSpreadsheet } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { roleCan } from '../../config/permissions';
import { audit } from '../../lib/audit';
import { actorFrom } from '../../lib/http';
import { IMPORT_DEFS } from './import.defs';
import { buildTemplate, runImport } from './import.service';

export const importRouter = Router();

// List available import resources (for the UI).
importRouter.get('/', (req, res) => {
  const list = Object.entries(IMPORT_DEFS)
    .filter(([, def]) => roleCan(req.user!.role, def.permission, 'create'))
    .map(([key, def]) => ({ resource: key, label: def.label }));
  res.json(list);
});

function getDef(req: import('express').Request) {
  const def = IMPORT_DEFS[req.params.resource];
  if (!def) throw NotFound('Unknown import resource');
  if (!roleCan(req.user!.role, def.permission, 'create')) throw Forbidden();
  return def;
}

// Download the Excel template for a resource.
importRouter.get(
  '/:resource/template',
  validate({ params: z.object({ resource: z.string() }) }),
  asyncHandler(async (req, res) => {
    const def = getDef(req);
    const wb = await buildTemplate(def);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.resource}-import-template.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

// Upload a filled template. ?commit=true persists; otherwise dry-run preview.
importRouter.post(
  '/:resource',
  validate({ params: z.object({ resource: z.string() }) }),
  uploadSpreadsheet.single('file'),
  asyncHandler(async (req, res) => {
    const def = getDef(req);
    if (!req.file) throw BadRequest('No file uploaded');
    const commit = req.query.commit === 'true';
    const result = await runImport(def, req.file.buffer, commit, req.user!.id);
    if (commit) {
      await audit({
        entity: req.params.resource, entityId: 'bulk-import', action: 'create', actor: actorFrom(req),
        after: { created: result.created, errors: result.errorCount },
      });
    }
    res.json(result);
  })
);
