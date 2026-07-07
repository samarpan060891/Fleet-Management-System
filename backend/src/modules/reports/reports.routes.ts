import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/errorHandler';
import { computeVehicleTco, resolvePeriod } from '../costs/costs.service';
import { NotFound } from '../../lib/errors';

export const reportsRouter = Router();

function xlsxHeaders(res: import('express').Response, name: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
}

// Fleet compliance status (Excel).
reportsRouter.get(
  '/compliance.xlsx',
  authorize('reports', 'read'),
  asyncHandler(async (_req, res) => {
    const docs = await prisma.complianceDocument.findMany({
      where: { isActive: true, expiryDate: { not: null } },
      orderBy: { expiryDate: 'asc' },
      include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, driver: { select: { fullName: true } } },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Compliance');
    ws.columns = [
      { header: 'Entity', key: 'entity', width: 28 },
      { header: 'Document', key: 'doc', width: 20 },
      { header: 'Reference', key: 'ref', width: 20 },
      { header: 'Expiry', key: 'expiry', width: 14 },
      { header: 'Days Left', key: 'days', width: 12 },
      { header: 'Renewal In Progress', key: 'renewal', width: 18 },
    ];
    for (const d of docs) {
      const entity = d.vehicle ? `${d.vehicle.plateNumber} (${d.vehicle.plateEmirate})` : d.driver?.fullName ?? '';
      ws.addRow({
        entity,
        doc: d.docType,
        ref: d.reference ?? '',
        expiry: dayjs(d.expiryDate).format('DD/MM/YYYY'),
        days: dayjs(d.expiryDate).diff(dayjs(), 'day'),
        renewal: d.renewalInProgress ? 'Yes' : 'No',
      });
    }
    ws.getRow(1).font = { bold: true };
    xlsxHeaders(res, 'fleet-compliance.xlsx');
    await wb.xlsx.write(res);
    res.end();
  })
);

// Monthly cost report (Excel) — per-vehicle TCO for the period.
reportsRouter.get(
  '/costs.xlsx',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to } = resolvePeriod(req.query as Record<string, string>);
    const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, select: { id: true } });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Costs');
    ws.columns = [
      { header: 'Vehicle', key: 'plate', width: 26 },
      { header: 'Fuel', key: 'fuel', width: 12 },
      { header: 'Maintenance', key: 'maint', width: 14 },
      { header: 'Tyres', key: 'tyres', width: 12 },
      { header: 'Fines', key: 'fines', width: 12 },
      { header: 'Depreciation', key: 'dep', width: 14 },
      { header: 'Cash Cost', key: 'cash', width: 14 },
      { header: 'Total Cost', key: 'total', width: 14 },
      { header: 'km Run', key: 'km', width: 12 },
      { header: 'Cost/km', key: 'cpk', width: 12 },
    ];
    for (const v of vehicles) {
      const t = await computeVehicleTco(v.id, from, to);
      ws.addRow({
        plate: t.plate, fuel: t.buckets.fuel, maint: t.buckets.maintenance, tyres: t.buckets.tyres,
        fines: t.buckets.fines, dep: t.buckets.depreciation, cash: t.cashCost, total: t.totalCost,
        km: t.kmRun, cpk: t.costPerKm ?? '',
      });
    }
    ws.getRow(1).font = { bold: true };
    xlsxHeaders(res, 'monthly-cost-report.xlsx');
    await wb.xlsx.write(res);
    res.end();
  })
);

// Staff-transport attendance report (Excel).
reportsRouter.get(
  '/attendance.xlsx',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(req.query.from as string) : dayjs().startOf('month').toDate();
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const rows = await prisma.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      include: { route: { select: { code: true } }, employee: { select: { name: true, staffId: true } } },
      orderBy: { date: 'asc' },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance');
    ws.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Route', key: 'route', width: 14 },
      { header: 'Employee', key: 'emp', width: 24 },
      { header: 'Staff ID', key: 'staff', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Marked By', key: 'by', width: 14 },
    ];
    for (const r of rows) {
      ws.addRow({ date: dayjs(r.date).format('DD/MM/YYYY'), route: r.route.code, emp: r.employee.name, staff: r.employee.staffId, status: r.status, by: r.markedBy });
    }
    ws.getRow(1).font = { bold: true };
    xlsxHeaders(res, 'attendance-report.xlsx');
    await wb.xlsx.write(res);
    res.end();
  })
);

// Vehicle history sheet (PDF) — full life: services, fuel, fines, incidents, costs.
reportsRouter.get(
  '/vehicle-history/:id.pdf',
  authorize('reports', 'read'),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: { jobCards: { orderBy: { dateIn: 'desc' } }, fines: true, incidents: true },
    });
    if (!vehicle) throw NotFound('Vehicle not found');
    const tco = await computeVehicleTco(vehicle.id, dayjs().startOf('year').toDate(), new Date());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vehicle-${vehicle.plateNumber}.pdf"`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text(`Vehicle History — ${vehicle.plateNumber} (${vehicle.plateEmirate})`);
    doc.moveDown(0.5).fontSize(10).fillColor('#555')
      .text(`${vehicle.make} ${vehicle.model} ${vehicle.year} · ${vehicle.vehicleType} · Odometer ${vehicle.currentOdometer} km · Status ${vehicle.status}`);
    doc.moveDown().fillColor('#000').fontSize(13).text('Cost (YTD)');
    doc.fontSize(10).text(
      `Fuel AED ${tco.buckets.fuel} · Maintenance AED ${tco.buckets.maintenance} · Fines AED ${tco.buckets.fines} · ` +
      `Depreciation AED ${tco.buckets.depreciation} · Total AED ${tco.totalCost} · Cost/km ${tco.costPerKm ?? 'n/a'}`
    );
    doc.moveDown().fontSize(13).text('Maintenance (job cards)');
    doc.fontSize(9);
    if (!vehicle.jobCards.length) doc.text('None');
    for (const j of vehicle.jobCards.slice(0, 20)) {
      doc.text(`${dayjs(j.dateIn).format('DD/MM/YYYY')} · ${j.type} · ${j.jobNumber} · AED ${j.totalCost ?? 0}${j.isWarrantyClaim ? ' · WARRANTY' : ''}`);
    }
    doc.moveDown().fontSize(13).text('Fines');
    doc.fontSize(9);
    if (!vehicle.fines.length) doc.text('None');
    for (const f of vehicle.fines.slice(0, 20)) doc.text(`${dayjs(f.offenceAt).format('DD/MM/YYYY')} · ${f.type} · ${f.reference} · AED ${f.amount} · ${f.status}`);
    doc.moveDown().fontSize(13).text('Incidents');
    doc.fontSize(9);
    if (!vehicle.incidents.length) doc.text('None');
    for (const i of vehicle.incidents.slice(0, 20)) doc.text(`${dayjs(i.occurredAt).format('DD/MM/YYYY')} · ${i.emirate ?? ''} · ${i.claimStatus} · AED ${i.claimAmount ?? 0}`);
    doc.end();
  })
);
