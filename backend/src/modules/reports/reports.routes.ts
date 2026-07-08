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
    const id = req.params.id;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { store: true, purchase: { include: { supplier: { select: { name: true } } } }, disposal: true, pmState: true },
    });
    if (!vehicle) throw NotFound('Vehicle not found');
    const [jobCards, tyres, fines, incidents, documents, fuelAgg] = await Promise.all([
      prisma.jobCard.findMany({ where: { vehicleId: id }, orderBy: { dateIn: 'desc' }, include: { parts: true, vendor: { select: { name: true } } } }),
      prisma.tyre.findMany({ where: { vehicleId: id }, orderBy: { createdAt: 'desc' }, include: { vendor: { select: { name: true } } } }),
      prisma.fine.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { offenceAt: 'desc' } }),
      prisma.incident.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { occurredAt: 'desc' } }),
      prisma.complianceDocument.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { expiryDate: 'asc' } }),
      prisma.fuelTransaction.aggregate({ where: { vehicleId: id, isActive: true }, _sum: { amount: true, litres: true }, _count: true }),
    ]);
    const tco = await computeVehicleTco(id, dayjs().startOf('year').toDate(), new Date());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vehicle-history-${vehicle.plateNumber}.pdf"`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const H = (t: string) => doc.moveDown(0.6).fillColor('#0f6e6e').fontSize(13).text(t).fillColor('#000').fontSize(9).moveDown(0.2);
    const line = (t: string) => doc.fontSize(9).fillColor('#000').text(t);
    const kv = (pairs: [string, unknown][]) => {
      for (const [k, v] of pairs) doc.fontSize(9).fillColor('#555').text(k, { continued: true }).fillColor('#000').text(`  ${v ?? '—'}`);
    };

    doc.fontSize(18).fillColor('#0f6e6e').text('Vehicle History Report');
    doc.fontSize(15).fillColor('#000').text(`${vehicle.plateNumber} (${vehicle.plateEmirate})`);
    doc.fontSize(9).fillColor('#777').text(`Generated ${dayjs().format('DD/MM/YYYY HH:mm')}`);

    H('Vehicle details');
    kv([
      ['Make / Model / Year', `${vehicle.make} ${vehicle.model} ${vehicle.year}`],
      ['Type / Body', `${vehicle.vehicleType} / ${vehicle.bodyType ?? '—'}`],
      ['VIN / Engine', `${vehicle.vin ?? '—'} / ${vehicle.engineNumber ?? '—'}`],
      ['Colour / Seats / Payload', `${vehicle.colour ?? '—'} / ${vehicle.seatingCapacity ?? '—'} / ${vehicle.payloadKg ?? '—'} kg`],
      ['Ownership', `${vehicle.ownership}${vehicle.leaseEnd ? ` (ends ${dayjs(vehicle.leaseEnd).format('DD/MM/YYYY')})` : ''}`],
      ['Depot', vehicle.store ? `${vehicle.store.code} · ${vehicle.store.name}` : '—'],
      ['Current odometer', `${vehicle.currentOdometer} km`],
      ['Status', vehicle.status],
      ['Branding', vehicle.hasBranding ? `Yes — ${vehicle.brandingNotes ?? ''}` : 'No'],
      ['GPS / Fuel-kit', `${vehicle.gpsUnitId ?? '—'} / ${vehicle.fuelKitId ?? '—'}`],
    ]);

    H('Purchase & depreciation');
    kv([
      ['Purchase date / price', vehicle.purchase ? `${dayjs(vehicle.purchase.purchaseDate).format('DD/MM/YYYY')} · AED ${vehicle.purchase.purchasePrice}` : '—'],
      ['Supplier', vehicle.purchase?.supplier?.name ?? '—'],
      ['Useful life / residual', `${vehicle.usefulLifeYears ?? vehicle.purchase?.usefulLifeYears ?? '—'} yrs · AED ${vehicle.residualValue ?? vehicle.purchase?.residualValue ?? '—'}`],
      ['Warranty', `${vehicle.warrantyEndDate ? dayjs(vehicle.warrantyEndDate).format('DD/MM/YYYY') : '—'} / ${vehicle.warrantyEndKm ?? '—'} km`],
    ]);
    if (vehicle.disposal) {
      kv([['Disposed', `${dayjs(vehicle.disposal.disposalDate).format('DD/MM/YYYY')} · ${vehicle.disposal.method} · sale AED ${vehicle.disposal.salePrice ?? '—'} · gain/loss AED ${vehicle.disposal.gainLoss ?? '—'}`]]);
    }

    H('Cost summary (YTD)');
    line(`Fuel AED ${tco.buckets.fuel} · Maintenance AED ${tco.buckets.maintenance} · Tyres AED ${tco.buckets.tyres} · Insurance AED ${tco.buckets.insurance} · Permit AED ${tco.buckets.permit} · Fines AED ${tco.buckets.fines}`);
    line(`Depreciation AED ${tco.buckets.depreciation} · Total AED ${tco.totalCost} · Cost/km ${tco.costPerKm ?? 'n/a'} · Fuel lifetime: ${fuelAgg._count} fills, ${Number(fuelAgg._sum.litres ?? 0)} L, AED ${Number(fuelAgg._sum.amount ?? 0)}`);

    H('PM schedule');
    line(vehicle.pmState ? `Last PM: ${vehicle.pmState.lastPmKm ?? '—'} km / ${vehicle.pmState.lastPmDate ? dayjs(vehicle.pmState.lastPmDate).format('DD/MM/YYYY') : '—'}   →   Next PM: ${vehicle.pmState.nextPmKm ?? '—'} km / ${vehicle.pmState.nextPmDate ? dayjs(vehicle.pmState.nextPmDate).format('DD/MM/YYYY') : '—'}` : 'No PM state');

    H(`Maintenance log (${jobCards.length} job cards)`);
    if (!jobCards.length) line('None');
    for (const j of jobCards) {
      doc.fontSize(9).fillColor('#000').text(
        `${dayjs(j.dateIn).format('DD/MM/YYYY')}${j.dateOut ? `–${dayjs(j.dateOut).format('DD/MM/YYYY')}` : ''} · ${j.type} · ${j.jobNumber} · ${j.vendor?.name ?? 'in-house'} · Inv ${j.invoiceNumber ?? '—'} · AED ${j.totalCost ?? 0}${j.isWarrantyClaim ? ' · WARRANTY' : ''}`
      );
      if (j.description) doc.fontSize(8).fillColor('#555').text(`    ${j.description}`);
      for (const p of j.parts) doc.fontSize(8).fillColor('#777').text(`    • ${p.partName} ×${p.qty} @ AED ${p.unitCost}`);
    }

    H(`Tyres (${tyres.length})`);
    if (!tyres.length) line('None');
    for (const t of tyres) line(`${t.serial} · ${t.brand ?? '—'} · pos ${t.position ?? '—'} · fitted ${t.fitmentDate ? dayjs(t.fitmentDate).format('DD/MM/YYYY') : '—'} @ ${t.fitmentOdometer ?? '—'} km · AED ${t.cost ?? '—'}${t.scrapDate ? ` · SCRAPPED ${dayjs(t.scrapDate).format('DD/MM/YYYY')}` : ''}`);

    H('Compliance documents');
    if (!documents.length) line('None');
    for (const d of documents) line(`${d.docType} · ${d.reference ?? '—'} · expires ${d.expiryDate ? dayjs(d.expiryDate).format('DD/MM/YYYY') : '—'}${d.cost ? ` · fee AED ${d.cost}` : ''}`);

    H(`Fines (${fines.length})`);
    if (!fines.length) line('None');
    for (const f of fines) line(`${dayjs(f.offenceAt).format('DD/MM/YYYY')} · ${f.type} · ${f.reference} · AED ${f.amount} · ${f.status}`);

    H(`Incidents (${incidents.length})`);
    if (!incidents.length) line('None');
    for (const i of incidents) line(`${dayjs(i.occurredAt).format('DD/MM/YYYY')} · ${i.emirate ?? ''} ${i.area ?? ''} · ${i.claimStatus} · claim AED ${i.claimAmount ?? 0}${i.description ? ` · ${i.description}` : ''}`);

    doc.end();
  })
);
