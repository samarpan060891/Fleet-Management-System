import { Router } from 'express';
import { z, ZodTypeAny } from 'zod';
import { Resource, Action } from '../config/permissions';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFound } from './errors';
import { audit } from './audit';
import { actorFrom, paged, paging } from './http';

// A minimal Prisma-delegate shape the CRUD helper relies on.
interface Delegate {
  findMany(args: unknown): Promise<unknown[]>;
  count(args: unknown): Promise<number>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
}

interface CrudOptions {
  resource: Resource;
  delegate: Delegate;
  entityName: string; // audit entity + used for messages
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  // Whether the model supports soft delete via is_active.
  softDelete?: boolean;
  // Default ordering and searchable text fields.
  orderBy?: Record<string, 'asc' | 'desc'>;
  searchFields?: string[];
  include?: Record<string, unknown>;
  // Extra where clause builder from query.
  buildWhere?: (query: Record<string, unknown>) => Record<string, unknown>;
}

// Builds a standard master-data router: list, get, create, update, delete.
// Every mutation is audited (who/when/before/after).
export function crudRouter(opts: CrudOptions): Router {
  const router = Router();
  const {
    resource,
    delegate,
    entityName,
    createSchema,
    updateSchema,
    softDelete = true,
  } = opts;

  // LIST (paginated + optional search)
  router.get(
    '/',
    authorize(resource, 'read'),
    asyncHandler(async (req, res) => {
      const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
      const where: Record<string, unknown> = softDelete ? { isActive: true } : {};
      if (opts.buildWhere) Object.assign(where, opts.buildWhere(req.query as Record<string, unknown>));
      const search = (req.query.search as string) || '';
      if (search && opts.searchFields?.length) {
        where.OR = opts.searchFields.map((f) => ({
          [f]: { contains: search, mode: 'insensitive' },
        }));
      }
      const [rows, total] = await Promise.all([
        delegate.findMany({ where, skip, take, orderBy: opts.orderBy ?? { createdAt: 'desc' }, include: opts.include }),
        delegate.count({ where }),
      ]);
      res.json(paged(rows, total, page, pageSize));
    })
  );

  // GET one
  router.get(
    '/:id',
    authorize(resource, 'read'),
    validate({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      const row = await delegate.findUnique({ where: { id: req.params.id }, include: opts.include });
      if (!row) throw NotFound(`${entityName} not found`);
      res.json(row);
    })
  );

  // CREATE
  router.post(
    '/',
    authorize(resource, 'create'),
    validate({ body: createSchema }),
    asyncHandler(async (req, res) => {
      const row = (await delegate.create({
        data: { ...req.body, createdBy: req.user!.id, updatedBy: req.user!.id },
      })) as { id: string };
      await audit({ entity: entityName, entityId: row.id, action: 'create', actor: actorFrom(req), after: row });
      res.status(201).json(row);
    })
  );

  // UPDATE
  router.patch(
    '/:id',
    authorize(resource, 'update'),
    validate({ params: z.object({ id: z.string().uuid() }), body: updateSchema }),
    asyncHandler(async (req, res) => {
      const before = await delegate.findUnique({ where: { id: req.params.id } });
      if (!before) throw NotFound(`${entityName} not found`);
      const row = (await delegate.update({
        where: { id: req.params.id },
        data: { ...req.body, updatedBy: req.user!.id },
      })) as { id: string };
      await audit({ entity: entityName, entityId: req.params.id, action: 'update', actor: actorFrom(req), before, after: row });
      res.json(row);
    })
  );

  // DELETE (soft by default, reversible)
  router.delete(
    '/:id',
    authorize(resource, 'delete'),
    validate({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      const before = await delegate.findUnique({ where: { id: req.params.id } });
      if (!before) throw NotFound(`${entityName} not found`);
      if (softDelete) {
        await delegate.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user!.id } });
      }
      await audit({ entity: entityName, entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
      res.json({ ok: true });
    })
  );

  return router;
}
