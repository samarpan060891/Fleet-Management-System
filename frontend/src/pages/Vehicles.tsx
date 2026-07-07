import { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';
import { StatusChip } from '../components/ui';
import { fmtKm } from '../i18n';
import { useLookups } from '../hooks/useLookups';

const TYPES = ['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van'];
const OWNERSHIP = ['owned', 'leased', 'rented'];

const columns: GridColDef[] = [
  { field: 'plateNumber', headerName: 'Plate', width: 130, valueGetter: (_v, r) => `${r.plateNumber} (${r.plateEmirate})` },
  { field: 'make', headerName: 'Make/Model', width: 180, valueGetter: (_v, r) => `${r.make} ${r.model} ${r.year}` },
  { field: 'vehicleType', headerName: 'Type', width: 110, renderCell: (p) => <Chip size="small" label={String(p.value).replace(/_/g, ' ')} variant="outlined" /> },
  { field: 'ownership', headerName: 'Ownership', width: 110 },
  { field: 'currentOdometer', headerName: 'Odometer', width: 120, valueFormatter: (v) => fmtKm(v as number) },
  { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => <StatusChip status={p.value as string} /> },
];

export default function Vehicles() {
  const { storeOptions, vendorOptions } = useLookups();

  const fields: FieldDef[] = [
    { name: 'plateNumber', label: 'Plate number', required: true, half: true },
    { name: 'plateEmirate', label: 'Plate emirate', required: true, half: true },
    { name: 'plateCategory', label: 'Plate category', half: true },
    { name: 'vehicleType', label: 'Vehicle type', type: 'select', required: true, half: true, options: TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })) },
    { name: 'make', label: 'Make', required: true, half: true },
    { name: 'model', label: 'Model', required: true, half: true },
    { name: 'year', label: 'Year', type: 'number', required: true, half: true },
    { name: 'colour', label: 'Colour', half: true },
    { name: 'vin', label: 'VIN / chassis', half: true },
    { name: 'engineNumber', label: 'Engine number', half: true },
    { name: 'bodyType', label: 'Body type', half: true },
    { name: 'seatingCapacity', label: 'Seating capacity', type: 'number', half: true },
    { name: 'payloadKg', label: 'Payload (kg)', type: 'number', half: true },
    { name: 'currentOdometer', label: 'Current odometer (km)', type: 'number', half: true },
    { name: 'ownership', label: 'Ownership', type: 'select', half: true, options: OWNERSHIP.map((o) => ({ value: o, label: o })) },
    { name: 'storeId', label: 'Depot / store', type: 'select', half: true, options: storeOptions },
    { name: 'leaseStart', label: 'Lease/rental start', type: 'date', half: true, showIf: (v) => v.ownership === 'leased' || v.ownership === 'rented' },
    { name: 'leaseEnd', label: 'Lease/rental end', type: 'date', half: true, showIf: (v) => v.ownership === 'leased' || v.ownership === 'rented' },
    { name: 'monthlyCost', label: 'Monthly cost (AED)', type: 'number', half: true, showIf: (v) => v.ownership === 'leased' || v.ownership === 'rented' },
    { name: 'lessorId', label: 'Lessor', type: 'select', half: true, options: vendorOptions, showIf: (v) => v.ownership === 'leased' || v.ownership === 'rented' },
    { name: 'gpsUnitId', label: 'GPS/tracker unit ID', half: true },
    { name: 'fuelKitId', label: 'Fuel-kit (VIP) ID', half: true },
    { name: 'warrantyEndDate', label: 'Warranty end date', type: 'date', half: true },
    { name: 'warrantyEndKm', label: 'Warranty end km', type: 'number', half: true },
    { name: 'usefulLifeYears', label: 'Useful life (years)', type: 'number', half: true },
    { name: 'residualValue', label: 'Residual value (AED)', type: 'number', half: true },
  ];

  return (
    <CrudListPage
      title="Vehicles" subtitle="Fleet master — add, edit and manage vehicles"
      resource="vehicles" queryKey="vehicles" permission="vehicles"
      columns={columns} fields={fields} importable
    />
  );
}
