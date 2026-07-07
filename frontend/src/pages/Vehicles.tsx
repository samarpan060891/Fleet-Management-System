import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';
import { StatusChip } from '../components/ui';
import { fmtKm, fmtCurrency } from '../i18n';
import { useLookups } from '../hooks/useLookups';
import { api } from '../api/client';

const TYPES = ['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van'];
const OWNERSHIP = ['owned', 'leased', 'rented'];

const columns: GridColDef[] = [
  { field: 'plateNumber', headerName: 'Plate', width: 130, valueGetter: (_v, r) => `${r.plateNumber} (${r.plateEmirate})` },
  { field: 'make', headerName: 'Make/Model', width: 170, valueGetter: (_v, r) => `${r.make} ${r.model} ${r.year}` },
  { field: 'vehicleType', headerName: 'Type', width: 100, renderCell: (p) => <Chip size="small" label={String(p.value).replace(/_/g, ' ')} variant="outlined" /> },
  { field: 'currentOdometer', headerName: 'Odometer', width: 110, valueFormatter: (v) => fmtKm(v as number) },
  { field: 'purchasePrice', headerName: 'Purchase', width: 120, valueGetter: (_v, r) => r.purchase?.purchasePrice, valueFormatter: (v) => (v ? fmtCurrency(v as number) : '—') },
  { field: 'assignedDriver', headerName: 'Committed to', width: 150, valueGetter: (_v, r) => r.assignments?.[0]?.driver?.fullName ?? '— (free)' },
  { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusChip status={p.value as string} /> },
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
    // Purchase & depreciation
    { name: 'purchaseDate', label: 'Purchase date', type: 'date', half: true },
    { name: 'purchasePrice', label: 'Purchase price (AED)', type: 'number', half: true },
    { name: 'usefulLifeYears', label: 'Useful life (years) — for depreciation', type: 'number', half: true },
    { name: 'residualValue', label: 'Residual value (AED) — for depreciation', type: 'number', half: true },
    { name: 'gpsUnitId', label: 'GPS/tracker unit ID', half: true },
    { name: 'fuelKitId', label: 'Fuel-kit (VIP) ID', half: true },
    { name: 'warrantyEndDate', label: 'Warranty end date', type: 'date', half: true },
    { name: 'warrantyEndKm', label: 'Warranty end km', type: 'number', half: true },
  ];

  return (
    <CrudListPage
      title="Vehicles" subtitle="Fleet master — add, edit and manage vehicles"
      resource="vehicles" queryKey="vehicles" permission="vehicles"
      columns={columns} fields={fields} importable
      toInitial={(r) => ({ ...r, purchaseDate: r.purchase?.purchaseDate, purchasePrice: r.purchase?.purchasePrice })}
      extraActions={(row, refetch) =>
        row.assignments?.length
          ? [
              <GridActionsCellItem
                key="release" icon={<LinkOffIcon />} label="Release driver (free vehicle)" showInMenu
                onClick={async () => {
                  if (confirm(`Release ${row.plateNumber} from its current driver? It will show as free on the availability board.`)) {
                    await api.post(`/vehicles/${row.id}/release-driver`);
                    refetch();
                  }
                }}
              />,
            ]
          : []
      }
    />
  );
}
