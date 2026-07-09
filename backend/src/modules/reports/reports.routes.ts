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

// Vehicle master list (Excel) — the full fleet as currently shown on the
// Vehicles page. Gated on vehicles:read (not reports:read) since it's the
// same data as that page, just as a download.
reportsRouter.get(
  '/vehicles.xlsx',
  authorize('vehicles', 'read'),
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.status === 'active') where.status = { not: 'disposed' };
    if (req.query.status === 'disposed') where.status = 'disposed';
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { plateNumber: 'asc' },
      include: { store: { select: { code: true, name: true } } },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Vehicles');
    ws.columns = [
      { header: 'Plate Number', key: 'plate', width: 16 },
      { header: 'Emirate', key: 'emirate', width: 12 },
      { header: 'Make', key: 'make', width: 14 },
      { header: 'Model', key: 'model', width: 14 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Vehicle Type', key: 'type', width: 20 },
      { header: 'Ownership', key: 'ownership', width: 16 },
      { header: 'Colour', key: 'colour', width: 12 },
      { header: 'VIN / Chassis', key: 'vin', width: 20 },
      { header: 'Current Odometer (km)', key: 'odo', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Depot / Store', key: 'store', width: 24 },
      { header: 'Warranty End', key: 'warranty', width: 14 },
    ];
    for (const v of vehicles) {
      ws.addRow({
        plate: v.plateNumber, emirate: v.plateEmirate, make: v.make, model: v.model, year: v.year,
        type: v.vehicleType, ownership: v.ownership, colour: v.colour ?? '', vin: v.vin ?? '',
        odo: v.currentOdometer, status: v.status,
        store: v.store ? `${v.store.code} · ${v.store.name}` : '',
        warranty: v.warrantyEndDate ? dayjs(v.warrantyEndDate).format('DD/MM/YYYY') : '',
      });
    }
    ws.getRow(1).font = { bold: true };
    xlsxHeaders(res, 'vehicles.xlsx');
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

// Job cards report (Excel) — full maintenance log with vendor, cost, warranty & parts.
reportsRouter.get(
  '/job-cards.xlsx',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { isActive: true };
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.status) where.status = req.query.status;
    const rows = await prisma.jobCard.findMany({
      where,
      orderBy: { dateIn: 'desc' },
      include: { vehicle: { select: { plateNumber: true, plateEmirate: true } }, vendor: { select: { name: true } }, parts: true },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Job Cards');
    ws.columns = [
      { header: 'Job #', key: 'jobNumber', width: 20 },
      { header: 'Vehicle', key: 'vehicle', width: 18 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Date In', key: 'dateIn', width: 14 },
      { header: 'Date Out', key: 'dateOut', width: 14 },
      { header: 'Downtime (days)', key: 'downtime', width: 16 },
      { header: 'Odometer In', key: 'odoIn', width: 14 },
      { header: 'Odometer Out', key: 'odoOut', width: 14 },
      { header: 'Vendor', key: 'vendor', width: 22 },
      { header: 'Invoice #', key: 'invoice', width: 16 },
      { header: 'Labour Charges', key: 'labour', width: 16 },
      { header: 'Other Charges', key: 'other', width: 16 },
      { header: 'Total Cost', key: 'total', width: 14 },
      { header: 'Warranty Claim', key: 'warranty', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Parts', key: 'parts', width: 40 },
    ];
    for (const j of rows) {
      ws.addRow({
        jobNumber: j.jobNumber,
        vehicle: j.vehicle ? `${j.vehicle.plateNumber} (${j.vehicle.plateEmirate})` : '',
        type: j.type,
        dateIn: dayjs(j.dateIn).format('DD/MM/YYYY'),
        dateOut: j.dateOut ? dayjs(j.dateOut).format('DD/MM/YYYY') : '',
        downtime: j.downtimeDays ?? '',
        odoIn: j.odometerIn ?? '',
        odoOut: j.odometerOut ?? '',
        vendor: j.vendor?.name ?? 'In-house',
        invoice: j.invoiceNumber ?? '',
        labour: Number(j.labourCharges ?? 0),
        other: Number(j.otherCharges ?? 0),
        total: Number(j.totalCost ?? 0),
        warranty: j.isWarrantyClaim ? 'Yes' : 'No',
        status: j.status,
        description: j.description ?? '',
        parts: j.parts.map((p) => `${p.partName} ×${p.qty} @ AED ${p.unitCost}`).join('; '),
      });
    }
    ws.getRow(1).font = { bold: true };
    xlsxHeaders(res, 'job-cards-report.xlsx');
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
    const [jobCards, tyres, fines, incidents, documents] = await Promise.all([
      prisma.jobCard.findMany({ where: { vehicleId: id }, orderBy: { dateIn: 'desc' }, include: { parts: true, vendor: { select: { name: true } } } }),
      prisma.tyre.findMany({ where: { vehicleId: id }, orderBy: { createdAt: 'desc' }, include: { vendor: { select: { name: true } } } }),
      prisma.fine.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { offenceAt: 'desc' } }),
      prisma.incident.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { occurredAt: 'desc' } }),
      prisma.complianceDocument.findMany({ where: { vehicleId: id, isActive: true }, orderBy: { expiryDate: 'asc' } }),
    ]);
    const tco = await computeVehicleTco(id, dayjs().startOf('year').toDate(), new Date());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vehicle-history-${vehicle.plateNumber}.pdf"`);
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    doc.pipe(res);

    const TEAL = '#0f6e6e';
    const TEAL_LIGHT = '#e3f0ef';
    const ROW_ALT = '#f7f9f9';
    const BORDER = '#dbe4e3';
    const TEXT = '#1a1a1a';
    const MUTED = '#666666';

    const left = () => doc.page.margins.left;
    const width = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    // Advance to a new page if `needed` points of vertical space aren't left.
    // Returns true when a page break happened, so callers (e.g. table row
    // loops) know to redraw a repeating header.
    function ensureSpace(needed: number): boolean {
      if (doc.y + needed > bottom()) {
        doc.addPage();
        return true;
      }
      return false;
    }

    // Section headline — a filled teal band with bold white text, so each
    // part of the report is unmistakably highlighted rather than blending
    // into plain body text.
    function section(title: string) {
      // Reserve room for the band plus at least one row of whatever follows,
      // so the headline never gets stranded alone at the bottom of a page.
      ensureSpace(70);
      doc.moveDown(0.6);
      const y = doc.y;
      doc.rect(left(), y, width(), 20).fill(TEAL);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11).text(title, left() + 8, y + 5, { width: width() - 16 });
      doc.y = y + 26;
      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
    }

    // Two-column "Field | Value" table for structured facts.
    function kvTable(pairs: [string, unknown][]) {
      const w = width();
      const labelW = w * 0.32;
      const rowH = 16;
      pairs.forEach(([k, v], i) => {
        ensureSpace(rowH);
        const y = doc.y;
        if (i % 2 === 1) doc.rect(left(), y, w, rowH).fill(ROW_ALT);
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text(String(k), left() + 6, y + 4, { width: labelW - 10 });
        doc.fillColor(TEXT).font('Helvetica').fontSize(8.5).text(String(v ?? '—'), left() + labelW, y + 4, { width: w - labelW - 6 });
        doc.y = y + rowH;
      });
      doc.moveDown(0.4);
    }

    // Bordered data table with a shaded header row; the header is redrawn
    // whenever rows spill onto a new page.
    function table(headers: string[], widths: number[], rows: string[][]) {
      const w = width();
      const rowH = 16;
      const drawHeader = () => {
        ensureSpace(rowH * 2);
        const y = doc.y;
        doc.rect(left(), y, w, rowH).fill(TEAL_LIGHT);
        let x = left();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(TEAL);
        headers.forEach((h, i) => { doc.text(h, x + 5, y + 4, { width: widths[i] - 8, height: rowH - 4, ellipsis: true }); x += widths[i]; });
        doc.y = y + rowH;
      };
      drawHeader();
      if (!rows.length) {
        doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('None', left() + 6, doc.y + 3);
        doc.moveDown(1);
        return;
      }
      rows.forEach((r, ri) => {
        if (ensureSpace(rowH)) drawHeader();
        const y = doc.y;
        if (ri % 2 === 1) doc.rect(left(), y, w, rowH).fill(ROW_ALT);
        let x = left();
        doc.font('Helvetica').fontSize(8).fillColor(TEXT);
        r.forEach((cell, i) => { doc.text(cell, x + 5, y + 4, { width: widths[i] - 8, height: rowH - 4, ellipsis: true }); x += widths[i]; });
        doc.y = y + rowH;
      });
      doc.moveTo(left(), doc.y).lineTo(left() + w, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.moveDown(0.5);
    }

    // Bulleted notes — for free-text detail (descriptions, parts) that
    // doesn't fit cleanly into a table column.
    function bullets(items: string[], heading?: string) {
      if (!items.length) return;
      if (heading) {
        ensureSpace(14);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEXT).text(heading, left(), doc.y);
        doc.moveDown(0.15);
      }
      for (const item of items) {
        ensureSpace(14);
        doc.font('Helvetica').fontSize(8.5).fillColor(TEXT).text(`•  ${item}`, left() + 4, doc.y, { width: width() - 8 });
        doc.moveDown(0.1);
      }
      doc.moveDown(0.3);
    }

    const money = (n: unknown) => Number(n ?? 0).toFixed(2);
    const dt = (d: unknown) => (d ? dayjs(d as string).format('DD/MM/YYYY') : '—');

    // --- Title band ---
    const titleH = 64;
    doc.rect(0, 0, doc.page.width, titleH).fill(TEAL);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(19).text('Vehicle History Report', left(), 15);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#dff5f2').text(`${vehicle.plateNumber} (${vehicle.plateEmirate})`, left(), 40);
    doc.y = titleH + 12;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Generated ${dayjs().format('DD/MM/YYYY HH:mm')}`, left(), doc.y);

    section('Vehicle details');
    kvTable([
      ['Make / Model / Year', `${vehicle.make} ${vehicle.model} ${vehicle.year}`],
      ['Type / Body', `${vehicle.vehicleType} / ${vehicle.bodyType ?? '—'}`],
      ['VIN / Engine', `${vehicle.vin ?? '—'} / ${vehicle.engineNumber ?? '—'}`],
      ['Colour / Seats / Payload', `${vehicle.colour ?? '—'} / ${vehicle.seatingCapacity ?? '—'} / ${vehicle.payloadKg ?? '—'} kg`],
      ['Ownership', `${vehicle.ownership}${vehicle.leaseEnd ? ` (ends ${dt(vehicle.leaseEnd)})` : ''}`],
      ['Depot', vehicle.store ? `${vehicle.store.code} · ${vehicle.store.name}` : '—'],
      ['Current odometer', `${vehicle.currentOdometer} km`],
      ['Status', vehicle.status],
      ['Branding', vehicle.hasBranding ? `Yes — ${vehicle.brandingNotes ?? ''}` : 'No'],
      ['GPS / Fuel-kit', `${vehicle.gpsUnitId ?? '—'} / ${vehicle.fuelKitId ?? '—'}`],
    ]);

    section('Purchase & depreciation');
    const purchasePairs: [string, unknown][] = [
      ['Purchase date / price', vehicle.purchase ? `${dt(vehicle.purchase.purchaseDate)} · AED ${money(vehicle.purchase.purchasePrice)}` : '—'],
      ['Supplier', vehicle.purchase?.supplier?.name ?? '—'],
      ['Useful life / residual', `${vehicle.usefulLifeYears ?? vehicle.purchase?.usefulLifeYears ?? '—'} yrs · AED ${money(vehicle.residualValue ?? vehicle.purchase?.residualValue)}`],
      ['Warranty', `${dt(vehicle.warrantyEndDate)} / ${vehicle.warrantyEndKm ?? '—'} km`],
    ];
    if (vehicle.disposal) {
      purchasePairs.push(['Disposed', `${dt(vehicle.disposal.disposalDate)} · ${vehicle.disposal.method} · sale AED ${money(vehicle.disposal.salePrice)} · gain/loss AED ${money(vehicle.disposal.gainLoss)}`]);
    }
    kvTable(purchasePairs);

    section('Cost summary (YTD)');
    table(['Category', 'Amount (AED)'], [300, 215], [
      ['Fuel', money(tco.buckets.fuel)],
      ['Maintenance', money(tco.buckets.maintenance)],
      ['Tyres', money(tco.buckets.tyres)],
      ['Insurance', money(tco.buckets.insurance)],
      ['Permit', money(tco.buckets.permit)],
      ['Fines', money(tco.buckets.fines)],
      ['Depreciation', money(tco.buckets.depreciation)],
      ['Total', money(tco.totalCost)],
    ]);
    bullets([`Cost per km: ${tco.costPerKm ?? 'n/a'}`]);

    section('PM schedule');
    kvTable([
      ['Last PM', vehicle.pmState ? `${vehicle.pmState.lastPmKm ?? '—'} km · ${dt(vehicle.pmState.lastPmDate)}` : '—'],
      ['Next PM', vehicle.pmState ? `${vehicle.pmState.nextPmKm ?? '—'} km · ${dt(vehicle.pmState.nextPmDate)}` : '—'],
    ]);

    section(`Maintenance log (${jobCards.length} job cards)`);
    table(
      ['Date In', 'Date Out', 'Type', 'Job #', 'Vendor', 'Invoice', 'Cost (AED)', 'Warranty'],
      [55, 55, 60, 65, 100, 60, 65, 55],
      jobCards.map((j) => [
        dt(j.dateIn), dt(j.dateOut), j.type, j.jobNumber, j.vendor?.name ?? 'In-house',
        j.invoiceNumber ?? '—', money(j.totalCost), j.isWarrantyClaim ? 'Yes' : '—',
      ])
    );
    bullets(
      jobCards
        .filter((j) => j.description || j.parts.length)
        .map((j) => {
          const parts = j.parts.length ? j.parts.map((p) => `${p.partName} ×${p.qty} @ AED ${money(p.unitCost)}`).join('; ') : null;
          return `${j.jobNumber}: ${[j.description, parts ? `Parts — ${parts}` : null].filter(Boolean).join(' — ')}`;
        }),
      'Job notes'
    );

    section(`Tyres (${tyres.length})`);
    table(
      ['Serial', 'Brand', 'Position', 'Fitted', 'Fitted Odo (km)', 'Cost (AED)', 'Status'],
      [90, 80, 60, 65, 80, 65, 75],
      tyres.map((t) => [
        t.serial, t.brand ?? '—', t.position ?? '—', dt(t.fitmentDate), String(t.fitmentOdometer ?? '—'),
        money(t.cost), t.scrapDate ? `Scrapped ${dt(t.scrapDate)}` : 'Active',
      ])
    );

    section('Compliance documents');
    table(
      ['Document', 'Reference', 'Expiry', 'Fee (AED)'],
      [140, 160, 120, 95],
      documents.map((d) => [d.docType, d.reference ?? '—', dt(d.expiryDate), d.cost ? money(d.cost) : '—'])
    );

    section(`Fines (${fines.length})`);
    table(
      ['Date', 'Type', 'Reference', 'Amount (AED)', 'Status'],
      [80, 110, 140, 100, 85],
      fines.map((f) => [dt(f.offenceAt), f.type, f.reference, money(f.amount), f.status])
    );

    section(`Incidents (${incidents.length})`);
    table(
      ['Date', 'Location', 'Claim Status', 'Claim Amount (AED)'],
      [80, 180, 140, 115],
      incidents.map((i) => [dt(i.occurredAt), [i.emirate, i.area].filter(Boolean).join(' ') || '—', i.claimStatus, money(i.claimAmount)])
    );
    bullets(incidents.filter((i) => i.description).map((i) => `${dt(i.occurredAt)}: ${i.description}`));

    doc.end();
  })
);
