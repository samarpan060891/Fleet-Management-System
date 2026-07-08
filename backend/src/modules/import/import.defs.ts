import dayjs from 'dayjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { Resource } from '../../config/permissions';
import { driverOnDate } from '../assignments/assignments.service';
import { recordReading } from '../odometer/odometer.service';
import { createFuelTransaction } from '../fuel/fuel.service';

export type ColType = 'string' | 'number' | 'date' | 'boolean';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: ColType; // default string
  enumValues?: string[];
  example?: string;
  note?: string;
}

export interface ImportDef {
  label: string;
  permission: Resource;
  columns: ImportColumn[];
  // Validate a coerced row and produce prisma-ready data, resolving natural-key
  // foreign keys (e.g. store code → id). Throw Error(message) for row errors.
  build: (row: Record<string, unknown>, db: PrismaClient) => Promise<Record<string, unknown>>;
  // Persist one record; returns the created id.
  create: (data: Record<string, unknown>, db: PrismaClient, actorId: string) => Promise<string>;
}

// Helpers --------------------------------------------------------------------
async function resolveVehicle(db: PrismaClient, plate: unknown, emirate: unknown): Promise<string> {
  if (!plate) throw new Error('vehiclePlate is required');
  const where = emirate
    ? { plateNumber: String(plate), plateEmirate: String(emirate) }
    : { plateNumber: String(plate) };
  const v = await db.vehicle.findFirst({ where });
  if (!v) throw new Error(`Vehicle not found for plate "${plate}"${emirate ? ` (${emirate})` : ''}`);
  return v.id;
}
async function resolveDriverByStaff(db: PrismaClient, staffId: unknown): Promise<string | undefined> {
  if (!staffId) return undefined;
  const d = await db.driver.findUnique({ where: { staffId: String(staffId) } });
  if (!d) throw new Error(`Driver not found for staff ID "${staffId}"`);
  return d.id;
}
async function resolveStoreByCode(db: PrismaClient, code: unknown): Promise<string | undefined> {
  if (!code) return undefined;
  const s = await db.store.findUnique({ where: { code: String(code) } });
  if (!s) throw new Error(`Store not found for code "${code}"`);
  return s.id;
}
async function resolveVendorByName(db: PrismaClient, name: unknown): Promise<string | undefined> {
  if (!name) return undefined;
  const v = await db.vendor.findFirst({ where: { name: String(name), isActive: true } });
  if (!v) throw new Error(`Vendor not found with name "${name}"`);
  return v.id;
}

const withAudit = (data: Record<string, unknown>, actorId: string) => ({ ...data, createdBy: actorId, updatedBy: actorId });

// Registry -------------------------------------------------------------------
export const IMPORT_DEFS: Record<string, ImportDef> = {
  vehicles: {
    label: 'Vehicles',
    permission: 'vehicles',
    columns: [
      { key: 'plateNumber', label: 'Plate Number', required: true, example: 'A-12345' },
      { key: 'plateEmirate', label: 'Plate Emirate', required: true, example: 'Dubai' },
      { key: 'plateCategory', label: 'Plate Category', example: 'Private' },
      { key: 'make', label: 'Make', required: true, example: 'Toyota' },
      { key: 'model', label: 'Model', required: true, example: 'Hiace' },
      { key: 'year', label: 'Year', type: 'number', required: true, example: '2022' },
      { key: 'vehicleType', label: 'Vehicle Type', required: true, enumValues: ['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van'], example: 'van' },
      { key: 'vin', label: 'VIN / Chassis', example: 'JT123...' },
      { key: 'colour', label: 'Colour', example: 'White' },
      { key: 'bodyType', label: 'Body Type', example: 'panel van' },
      { key: 'seatingCapacity', label: 'Seating Capacity', type: 'number' },
      { key: 'payloadKg', label: 'Payload (kg)', type: 'number' },
      { key: 'ownership', label: 'Ownership', enumValues: ['owned', 'leased', 'rented'], example: 'owned' },
      { key: 'currentOdometer', label: 'Current Odometer (km)', type: 'number', example: '45000' },
      { key: 'storeCode', label: 'Depot/Store Code', note: 'Must match an existing store code', example: 'DXB01' },
      { key: 'warrantyEndDate', label: 'Warranty End Date', type: 'date', example: '2027-01-31' },
      { key: 'warrantyEndKm', label: 'Warranty End (km)', type: 'number' },
    ],
    build: async (row, db) => {
      const storeId = await resolveStoreByCode(db, row.storeCode);
      const { storeCode, ...rest } = row;
      return { ...rest, storeId };
    },
    create: async (data, db, actorId) => (await db.vehicle.create({ data: withAudit(data, actorId) as Prisma.VehicleUncheckedCreateInput })).id,
  },

  drivers: {
    label: 'Drivers',
    permission: 'drivers',
    columns: [
      { key: 'fullName', label: 'Full Name', required: true, example: 'Rahul Sharma' },
      { key: 'staffId', label: 'Staff ID', required: true, example: 'EMP2001' },
      { key: 'nationality', label: 'Nationality', example: 'Indian' },
      { key: 'joiningDate', label: 'Joining Date', type: 'date', example: '2021-05-01' },
      { key: 'licenceNumber', label: 'Licence Number', example: 'DL50001' },
      { key: 'licenceClass', label: 'Licence Class', example: '3' },
      { key: 'licenceExpiry', label: 'Licence Expiry', type: 'date', example: '2026-08-01' },
      { key: 'emiratesId', label: 'Emirates ID', example: '784-1990-1234567-1' },
      { key: 'emiratesIdExpiry', label: 'Emirates ID Expiry', type: 'date' },
      { key: 'visaExpiry', label: 'Visa Expiry', type: 'date' },
      { key: 'passportNumber', label: 'Passport Number' },
      { key: 'passportExpiry', label: 'Passport Expiry', type: 'date' },
    ],
    build: async (row) => row,
    create: async (data, db, actorId) => (await db.driver.create({ data: withAudit(data, actorId) as Prisma.DriverUncheckedCreateInput })).id,
  },

  vendors: {
    label: 'Vendors',
    permission: 'vendors',
    columns: [
      { key: 'name', label: 'Name', required: true, example: 'Al Habtoor Workshop' },
      // User-extensible category — any value is accepted (see /option-lists/vendor.type).
      { key: 'type', label: 'Type', required: true, example: 'workshop' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'phone', label: 'Phone', example: '+97141234567' },
      { key: 'email', label: 'Email' },
      { key: 'trn', label: 'TRN' },
      { key: 'address', label: 'Address' },
    ],
    build: async (row) => row,
    create: async (data, db, actorId) => (await db.vendor.create({ data: withAudit(data, actorId) as Prisma.VendorUncheckedCreateInput })).id,
  },

  stores: {
    label: 'Stores',
    permission: 'stores',
    columns: [
      { key: 'code', label: 'Code', required: true, example: 'DXB01' },
      { key: 'name', label: 'Name', required: true, example: 'Dubai Festival City' },
      { key: 'emirate', label: 'Emirate', required: true, example: 'Dubai' },
      { key: 'address', label: 'Address' },
      { key: 'contact', label: 'Contact' },
      { key: 'deliveryWindow', label: 'Delivery Window' },
    ],
    build: async (row) => row,
    create: async (data, db, actorId) => (await db.store.create({ data: withAudit(data, actorId) as Prisma.StoreUncheckedCreateInput })).id,
  },

  employees: {
    label: 'Employees',
    permission: 'employees',
    columns: [
      { key: 'name', label: 'Name', required: true, example: 'Worker 1' },
      { key: 'staffId', label: 'Staff ID', required: true, example: 'LAB3001' },
      { key: 'pickupPoint', label: 'Pickup Point', example: 'Camp Gate 1' },
      { key: 'homeCamp', label: 'Home / Camp', example: 'Al Quoz Camp' },
      { key: 'phone', label: 'Phone' },
    ],
    build: async (row) => row,
    create: async (data, db, actorId) => (await db.employee.create({ data: withAudit(data, actorId) as Prisma.EmployeeUncheckedCreateInput })).id,
  },

  compliance: {
    label: 'Compliance Documents',
    permission: 'compliance',
    columns: [
      { key: 'entityType', label: 'Applies To', required: true, enumValues: ['vehicle', 'driver'], example: 'vehicle' },
      { key: 'vehiclePlate', label: 'Vehicle Plate', note: 'Required when Applies To = vehicle', example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'driverStaffId', label: 'Driver Staff ID', note: 'Required when Applies To = driver', example: 'EMP2001' },
      { key: 'docType', label: 'Document Type', required: true, enumValues: ['mulkiya', 'insurance', 'tasjeel', 'lease', 'warranty', 'licence', 'emirates_id', 'visa', 'passport'], example: 'mulkiya' },
      { key: 'reference', label: 'Reference', example: 'MLK-001' },
      { key: 'issueDate', label: 'Issue Date', type: 'date' },
      { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true, example: '2026-12-31' },
    ],
    build: async (row, db) => {
      const entityType = row.entityType;
      const data: Record<string, unknown> = {
        entityType, docType: row.docType, reference: row.reference,
        issueDate: row.issueDate, expiryDate: row.expiryDate,
      };
      if (entityType === 'vehicle') data.vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      else if (entityType === 'driver') data.driverId = await resolveDriverByStaff(db, row.driverStaffId);
      else throw new Error('Applies To must be "vehicle" or "driver"');
      return data;
    },
    create: async (data, db, actorId) => (await db.complianceDocument.create({ data: withAudit(data, actorId) as Prisma.ComplianceDocumentUncheckedCreateInput })).id,
  },

  odometer: {
    label: 'Odometer Readings',
    permission: 'odometer',
    columns: [
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'readingDate', label: 'Reading Date', type: 'date', required: true, example: '2026-07-01' },
      { key: 'tripStartKm', label: 'Trip Start Km', type: 'number', required: true, example: '45000' },
      { key: 'tripEndKm', label: 'Trip End Km', type: 'number', required: true, example: '45200' },
      { key: 'tripStartTime', label: 'Trip Start Time (HH:mm)', example: '08:00' },
      { key: 'tripEndTime', label: 'Trip End Time (HH:mm)', example: '17:30' },
      { key: 'note', label: 'Note' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      const readingDate = row.readingDate as Date;
      const combine = (time?: string) => {
        if (!time) return undefined;
        const datePart = readingDate.toISOString().slice(0, 10);
        return new Date(`${datePart}T${time}:00`);
      };
      return {
        vehicleId,
        readingDate,
        tripStartKm: row.tripStartKm,
        tripEndKm: row.tripEndKm,
        tripStartAt: combine(row.tripStartTime as string | undefined),
        tripEndAt: combine(row.tripEndTime as string | undefined),
        note: row.note,
      };
    },
    // Advances the vehicle's current odometer (which drives PM).
    create: async (data, db, actorId) => {
      const r = await recordReading(db, {
        vehicleId: data.vehicleId as string,
        readingDate: data.readingDate as Date,
        tripStartKm: data.tripStartKm as number,
        tripEndKm: data.tripEndKm as number,
        tripStartAt: data.tripStartAt as Date | undefined,
        tripEndAt: data.tripEndAt as Date | undefined,
        source: 'excel',
        note: data.note as string | undefined,
        actorId,
      });
      return r.id;
    },
  },

  fuel: {
    label: 'Fuel Transactions',
    permission: 'fuel',
    columns: [
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'filledAt', label: 'Fill Date', type: 'date', required: true, example: '2026-06-15' },
      { key: 'odometer', label: 'Odometer (km)', type: 'number', example: '45200' },
      { key: 'litres', label: 'Litres', type: 'number', required: true, example: '48' },
      { key: 'amount', label: 'Amount (AED)', type: 'number', required: true, example: '150' },
      { key: 'rate', label: 'Rate (AED/L)', type: 'number', example: '3.1' },
      { key: 'channel', label: 'Channel', required: true, enumValues: ['vip_kit', 'fuel_buddy', 'cash'], example: 'vip_kit' },
      { key: 'driverStaffId', label: 'Driver Staff ID', note: 'Optional — auto from assignment if blank' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      const driverId = await resolveDriverByStaff(db, row.driverStaffId);
      return {
        vehicleId, filledAt: row.filledAt, odometer: row.odometer, litres: row.litres,
        amount: row.amount, rate: row.rate, channel: row.channel, driverId,
      };
    },
    // Reuses the fuel service (efficiency, anomalies, odometer advance).
    create: async (data, _db, actorId) => {
      const r = await createFuelTransaction(data as any, actorId);
      return r.id;
    },
  },

  maintenance: {
    label: 'Maintenance / Job Cards',
    permission: 'maintenance',
    columns: [
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'dateIn', label: 'Date In', type: 'date', required: true, example: '2026-05-01' },
      { key: 'dateOut', label: 'Date Out', type: 'date', example: '2026-05-03' },
      { key: 'type', label: 'Type', required: true, enumValues: ['scheduled', 'breakdown', 'accident', 'tyre'], example: 'scheduled' },
      { key: 'description', label: 'Description / work done', example: 'PM service + oil change' },
      { key: 'vendorName', label: 'Workshop / vendor name', note: 'Must match an existing vendor' },
      { key: 'invoiceNumber', label: 'Invoice number' },
      { key: 'odometerIn', label: 'Odometer In (km)', type: 'number' },
      { key: 'odometerOut', label: 'Odometer Out (km)', type: 'number' },
      { key: 'labourCharges', label: 'Labour charges (AED)', type: 'number' },
      { key: 'otherCharges', label: 'Other charges (AED)', type: 'number' },
      { key: 'totalCost', label: 'Total cost (AED)', type: 'number', example: '650' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      const vendorId = await resolveVendorByName(db, row.vendorName);
      const total = row.totalCost != null ? Number(row.totalCost)
        : Number(row.labourCharges ?? 0) + Number(row.otherCharges ?? 0);
      return {
        vehicleId, vendorId, dateIn: row.dateIn, dateOut: row.dateOut, type: row.type,
        description: row.description, invoiceNumber: row.invoiceNumber,
        odometerIn: row.odometerIn, odometerOut: row.odometerOut,
        labourCharges: row.labourCharges, otherCharges: row.otherCharges, totalCost: total,
      };
    },
    // Historical job cards import as closed (if dateOut) without changing vehicle status.
    create: async (data, db, actorId) => {
      const d: any = data;
      const jobNumber = `JC-${dayjs(d.dateIn as Date).format('YYYYMM')}-${Math.floor(Math.random() * 90000 + 10000)}`;
      const created = await db.jobCard.create({
        data: {
          jobNumber, vehicleId: d.vehicleId, vendorId: d.vendorId ?? undefined,
          dateIn: d.dateIn, dateOut: d.dateOut ?? undefined,
          downtimeDays: d.dateOut ? Math.max(0, dayjs(d.dateOut).diff(dayjs(d.dateIn), 'day')) : undefined,
          type: d.type, description: d.description, invoiceNumber: d.invoiceNumber,
          odometerIn: d.odometerIn ?? undefined, odometerOut: d.odometerOut ?? undefined,
          labourCharges: d.labourCharges ?? undefined, otherCharges: d.otherCharges ?? undefined,
          totalCost: d.totalCost ?? undefined,
          status: d.dateOut ? 'closed' : 'open',
          createdBy: actorId, updatedBy: actorId,
        },
      });
      return created.id;
    },
  },

  tyres: {
    label: 'Tyres',
    permission: 'tyres',
    columns: [
      { key: 'serial', label: 'Tyre Serial', required: true, example: 'TY-0001' },
      { key: 'brand', label: 'Brand', example: 'Bridgestone' },
      { key: 'vehiclePlate', label: 'Vehicle Plate', example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'position', label: 'Fitment Position', note: 'e.g. FL, FR, RL, RR', example: 'FL' },
      { key: 'fitmentDate', label: 'Fitment Date', type: 'date', example: '2026-01-15' },
      { key: 'fitmentOdometer', label: 'Fitment Odometer (km)', type: 'number' },
      { key: 'treadDepthMm', label: 'Tread Depth (mm)', type: 'number', example: '7.5' },
      { key: 'vendorName', label: 'Supplier / vendor name', note: 'Must match an existing vendor' },
      { key: 'cost', label: 'Cost (AED)', type: 'number', example: '420' },
    ],
    build: async (row, db) => {
      const vehicleId = row.vehiclePlate ? await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate) : undefined;
      const vendorId = await resolveVendorByName(db, row.vendorName);
      return {
        serial: row.serial, brand: row.brand, vehicleId, position: row.position,
        fitmentDate: row.fitmentDate, fitmentOdometer: row.fitmentOdometer,
        treadDepthMm: row.treadDepthMm, vendorId, cost: row.cost,
      };
    },
    create: async (data, db, actorId) => (await db.tyre.create({ data: withAudit(data, actorId) as Prisma.TyreUncheckedCreateInput })).id,
  },

  incidents: {
    label: 'Incidents & Claims',
    permission: 'incidents',
    columns: [
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'driverStaffId', label: 'Driver Staff ID', note: 'Optional' },
      { key: 'occurredAt', label: 'Date of Incident', type: 'date', required: true, example: '2026-02-10' },
      { key: 'emirate', label: 'Emirate', example: 'Sharjah' },
      { key: 'area', label: 'Area', example: 'Industrial 5' },
      { key: 'description', label: 'Description' },
      { key: 'policeReportNo', label: 'Police Report No.' },
      { key: 'thirdParty', label: 'Third-Party Details' },
      { key: 'insuranceVendorName', label: 'Insurance Vendor Name', note: 'Must match an existing vendor' },
      { key: 'claimStatus', label: 'Claim Status', enumValues: ['reported', 'under_review', 'approved', 'rejected', 'settled'], example: 'reported' },
      { key: 'claimAmount', label: 'Claim Amount (AED)', type: 'number' },
      { key: 'settlementAmount', label: 'Settlement Amount (AED)', type: 'number' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      const driverId = await resolveDriverByStaff(db, row.driverStaffId);
      const insuranceVendorId = await resolveVendorByName(db, row.insuranceVendorName);
      return {
        vehicleId, driverId, occurredAt: row.occurredAt, emirate: row.emirate, area: row.area,
        description: row.description, policeReportNo: row.policeReportNo, thirdParty: row.thirdParty,
        insuranceVendorId, claimStatus: row.claimStatus ?? 'reported',
        claimAmount: row.claimAmount, settlementAmount: row.settlementAmount,
      };
    },
    create: async (data, db, actorId) => (await db.incident.create({ data: withAudit(data, actorId) as Prisma.IncidentUncheckedCreateInput })).id,
  },

  fines: {
    label: 'Fines',
    permission: 'fines',
    columns: [
      { key: 'reference', label: 'Fine Reference', required: true, example: 'FINE-778812' },
      { key: 'offenceAt', label: 'Offence Date', type: 'date', required: true, example: '2026-05-01' },
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      // User-extensible category — any value is accepted (see /option-lists/fine.type).
      { key: 'type', label: 'Type', required: true, example: 'speeding' },
      { key: 'amount', label: 'Amount (AED)', type: 'number', required: true, example: '600' },
      { key: 'authority', label: 'Issuing Authority', example: 'Dubai Police' },
      { key: 'emirate', label: 'Emirate', example: 'Dubai' },
      { key: 'driverStaffId', label: 'Driver Staff ID', note: 'Optional — auto-attributed from assignment if blank' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      const offenceAt = row.offenceAt as Date;
      let driverId = await resolveDriverByStaff(db, row.driverStaffId);
      const overridden = !!driverId;
      if (!driverId) driverId = (await driverOnDate(db, vehicleId, offenceAt)) ?? undefined;
      return {
        reference: row.reference, offenceAt, vehicleId, type: row.type, amount: row.amount,
        authority: row.authority, emirate: row.emirate, driverId, driverOverridden: overridden,
      };
    },
    create: async (data, db, actorId) => (await db.fine.create({ data: withAudit(data, actorId) as Prisma.FineUncheckedCreateInput })).id,
  },
};
