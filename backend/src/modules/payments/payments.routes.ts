import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { audit } from '../../lib/audit';
import { actorFrom, paged, paging } from '../../lib/http';
import { NotFound } from '../../lib/errors';

export const paymentsRouter = Router();

const category = z.enum(['maintenance', 'tyre', 'insurance', 'permit', 'branding', 'salik', 'other']);
const createSchema = z.object({
  vendorId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  category,
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  amount: z.number().nonnegative(),
  notes: z.string().optional(),
});

const includeRefs = {
  vendor: { select: { name: true, type: true } },
  vehicle: { select: { plateNumber: true, plateEmirate: true } },
};

// Annotate each invoice with outstanding amount + days overdue.
function annotate(row: any) {
  const outstanding = Number(row.amount) - Number(row.paidAmount);
  const daysOverdue = row.dueDate && row.status !== 'paid'
    ? dayjs().startOf('day').diff(dayjs(row.dueDate).startOf('day'), 'day')
    : null;
  return { ...row, outstanding: +outstanding.toFixed(2), daysOverdue };
}

// LIST payables with filters.
paymentsRouter.get(
  '/',
  authorize('payments', 'read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = paging(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.vendorId) where.vendorId = req.query.vendorId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;
    const [rows, total] = await Promise.all([
      prisma.vendorInvoice.findMany({ where, skip, take, orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'desc' }], include: includeRefs }),
      prisma.vendorInvoice.count({ where }),
    ]);
    res.json(paged(rows.map(annotate), total, page, pageSize));
  })
);

// Summary: total outstanding + aging buckets + pending by vendor.
paymentsRouter.get(
  '/summary',
  authorize('payments', 'read'),
  asyncHandler(async (_req, res) => {
    const open = await prisma.vendorInvoice.findMany({
      where: { isActive: true, status: { in: ['unpaid', 'partial'] } },
      include: { vendor: { select: { name: true } } },
    });
    let totalOutstanding = 0;
    const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
    const byVendor = new Map<string, { vendor: string; outstanding: number; count: number }>();
    for (const inv of open) {
      const outstanding = Number(inv.amount) - Number(inv.paidAmount);
      totalOutstanding += outstanding;
      const days = inv.dueDate ? dayjs().diff(dayjs(inv.dueDate), 'day') : 0;
      if (days <= 0) aging.current += outstanding;
      else if (days <= 30) aging.d1_30 += outstanding;
      else if (days <= 60) aging.d31_60 += outstanding;
      else aging.d60plus += outstanding;
      const key = inv.vendorId;
      const cur = byVendor.get(key) ?? { vendor: inv.vendor.name, outstanding: 0, count: 0 };
      cur.outstanding += outstanding;
      cur.count += 1;
      byVendor.set(key, cur);
    }
    res.json({
      totalOutstanding: +totalOutstanding.toFixed(2),
      aging: {
        current: +aging.current.toFixed(2), d1_30: +aging.d1_30.toFixed(2),
        d31_60: +aging.d31_60.toFixed(2), d60plus: +aging.d60plus.toFixed(2),
      },
      byVendor: [...byVendor.values()].sort((a, b) => b.outstanding - a.outstanding),
    });
  })
);

paymentsRouter.post(
  '/',
  authorize('payments', 'create'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const inv = await prisma.vendorInvoice.create({
      data: {
        ...req.body,
        invoiceDate: new Date(req.body.invoiceDate),
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        createdBy: req.user!.id, updatedBy: req.user!.id,
      },
      include: includeRefs,
    });
    await audit({ entity: 'vendor_invoices', entityId: inv.id, action: 'create', actor: actorFrom(req), after: inv });
    res.status(201).json(annotate(inv));
  })
);

paymentsRouter.patch(
  '/:id',
  authorize('payments', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: createSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vendorInvoice.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Invoice not found');
    const data: Record<string, unknown> = { ...req.body, updatedBy: req.user!.id };
    if (req.body.invoiceDate) data.invoiceDate = new Date(req.body.invoiceDate);
    if (req.body.dueDate) data.dueDate = new Date(req.body.dueDate);
    const inv = await prisma.vendorInvoice.update({ where: { id: req.params.id }, data, include: includeRefs });
    await audit({ entity: 'vendor_invoices', entityId: inv.id, action: 'update', actor: actorFrom(req), before, after: inv });
    res.json(annotate(inv));
  })
);

// Record a payment (full or partial).
paymentsRouter.post(
  '/:id/pay',
  authorize('payments', 'update'),
  validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ paidAmount: z.number().nonnegative(), paymentDate: z.string() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vendorInvoice.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Invoice not found');
    const newPaid = Number(before.paidAmount) + req.body.paidAmount;
    const status = newPaid >= Number(before.amount) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const inv = await prisma.vendorInvoice.update({
      where: { id: req.params.id },
      data: { paidAmount: newPaid, status, paymentDate: new Date(req.body.paymentDate), updatedBy: req.user!.id },
      include: includeRefs,
    });
    await audit({ entity: 'vendor_invoices', entityId: inv.id, action: 'update', actor: actorFrom(req), before: { paidAmount: before.paidAmount, status: before.status }, after: { paidAmount: newPaid, status } });
    res.json(annotate(inv));
  })
);

paymentsRouter.delete(
  '/:id',
  authorize('payments', 'delete'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const before = await prisma.vendorInvoice.findUnique({ where: { id: req.params.id } });
    if (!before) throw NotFound('Invoice not found');
    await prisma.vendorInvoice.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user!.id } });
    await audit({ entity: 'vendor_invoices', entityId: req.params.id, action: 'delete', actor: actorFrom(req), before });
    res.json({ ok: true });
  })
);
