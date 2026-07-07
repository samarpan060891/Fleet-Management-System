import { Prisma, PrismaClient } from '@prisma/client';
import { Resource } from '../../config/permissions';
import { driverOnDate } from '../assignments/assignments.service';
import { recordReading } from '../odometer/odometer.service';

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
      { key: 'type', label: 'Type', required: true, enumValues: ['workshop', 'tyre_supplier', 'insurance', 'fuel_supplier', 'spare_parts', 'lessor', 'other'], example: 'workshop' },
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
      { key: 'odometer', label: 'Odometer (km)', type: 'number', required: true, example: '45200' },
      { key: 'note', label: 'Note' },
    ],
    build: async (row, db) => {
      const vehicleId = await resolveVehicle(db, row.vehiclePlate, row.vehicleEmirate);
      return { vehicleId, readingDate: row.readingDate, odometer: row.odometer, note: row.note };
    },
    // Advances the vehicle's current odometer (which drives PM).
    create: async (data, db, actorId) => {
      const r = await recordReading(db, {
        vehicleId: data.vehicleId as string,
        readingDate: data.readingDate as Date,
        odometer: data.odometer as number,
        source: 'excel',
        note: data.note as string | undefined,
        actorId,
      });
      return r.id;
    },
  },

  fines: {
    label: 'Fines',
    permission: 'fines',
    columns: [
      { key: 'reference', label: 'Fine Reference', required: true, example: 'FINE-778812' },
      { key: 'offenceAt', label: 'Offence Date', type: 'date', required: true, example: '2026-05-01' },
      { key: 'vehiclePlate', label: 'Vehicle Plate', required: true, example: 'A-12345' },
      { key: 'vehicleEmirate', label: 'Vehicle Emirate', example: 'Dubai' },
      { key: 'type', label: 'Type', required: true, enumValues: ['salik', 'speeding', 'parking', 'other'], example: 'speeding' },
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
