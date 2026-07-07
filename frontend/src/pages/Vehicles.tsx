import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SellIcon from '@mui/icons-material/Sell';
import CrudListPage from '../components/CrudListPage';
import FormDialog, { FieldDef } from '../components/FormDialog';
import { StatusChip } from '../components/ui';
import { fmtKm, fmtCurrency } from '../i18n';
import { useLookups, apiError } from '../hooks/useLookups';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';

const TYPES = ['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van'];
const OWNERSHIP = ['owned', 'leased', 'rented'];

const columns: GridColDef[] = [
  { field: 'plateNumber', headerName: 'Plate', width: 130, valueGetter: (_v, r) => `${r.plateNumber} (${r.plateEmirate})` },
  { field: 'make', headerName: 'Make/Model', width: 160, valueGetter: (_v, r) => `${r.make} ${r.model} ${r.year}` },
  { field: 'vehicleType', headerName: 'Type', width: 100, renderCell: (p) => <Chip size="small" label={String(p.value).replace(/_/g, ' ')} variant="outlined" /> },
  { field: 'currentOdometer', headerName: 'Odometer', width: 110, valueFormatter: (v) => fmtKm(v as number) },
  { field: 'hasBranding', headerName: 'Branding', width: 100, renderCell: (p) => p.value ? <Chip size="small" color="secondary" label="Branded" /> : '—' },
  { field: 'assignedDriver', headerName: 'Committed to', width: 140, valueGetter: (_v, r) => r.assignments?.[0]?.driver?.fullName ?? '— (free)' },
  { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusChip status={p.value as string} /> },
];

export default function Vehicles() {
  const qc = useQueryClient();
  const { storeOptions, vendorOptions } = useLookups();
  const [disposeRow, setDisposeRow] = useState<any | null>(null);

  const dispose = useMutation({
    mutationFn: async ({ id, b }: { id: string; b: Record<string, unknown> }) => (await api.post(`/vehicles/${id}/disposal`, b)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setDisposeRow(null); },
  });

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
    { name: 'purchaseDate', label: 'Purchase date', type: 'date', half: true },
    { name: 'purchasePrice', label: 'Purchase price (AED)', type: 'number', half: true },
    { name: 'usefulLifeYears', label: 'Useful life (years) — depreciation', type: 'number', half: true },
    { name: 'residualValue', label: 'Residual value (AED) — depreciation', type: 'number', half: true },
    { name: 'hasBranding', label: 'Vehicle carries branding (permit applicable)', type: 'checkbox' },
    { name: 'brandingNotes', label: 'Branding details', half: true, showIf: (v) => !!v.hasBranding },
    { name: 'gpsUnitId', label: 'GPS/tracker unit ID', half: true },
    { name: 'fuelKitId', label: 'Fuel-kit (VIP) ID', half: true },
    { name: 'warrantyEndDate', label: 'Warranty end date', type: 'date', half: true },
    { name: 'warrantyEndKm', label: 'Warranty end km', type: 'number', half: true },
  ];

  return (
    <>
      <CrudListPage
        title="Vehicles" subtitle="Fleet master — add, edit and manage vehicles"
        resource="vehicles" queryKey="vehicles" permission="vehicles"
        columns={columns} fields={fields} importable
        toInitial={(r) => ({ ...r, purchaseDate: r.purchase?.purchaseDate, purchasePrice: r.purchase?.purchasePrice })}
        extraActions={(row, refetch) => {
          const items = [];
          if (row.assignments?.length) {
            items.push(
              <GridActionsCellItem key="release" icon={<LinkOffIcon />} label="Release driver (free vehicle)" showInMenu
                onClick={async () => { if (confirm(`Release ${row.plateNumber} from its current driver?`)) { await api.post(`/vehicles/${row.id}/release-driver`); refetch(); } }} />
            );
          }
          if (row.status !== 'disposed') {
            items.push(<GridActionsCellItem key="dispose" icon={<SellIcon />} label="Sell / dispose" showInMenu onClick={() => setDisposeRow(row)} />);
          }
          return items;
        }}
      />
      <FormDialog
        open={!!disposeRow}
        title={`Sell / dispose ${disposeRow?.plateNumber ?? ''}`}
        fields={[
          { name: 'disposalDate', label: 'Disposal date', type: 'date', required: true, half: true },
          { name: 'method', label: 'Method', type: 'select', required: true, half: true, options: [
            { value: 'sold', label: 'Sold' }, { value: 'scrapped', label: 'Scrapped' }, { value: 'returned_to_lessor', label: 'Returned to lessor' }] },
          { name: 'buyer', label: 'Buyer', half: true },
          { name: 'salePrice', label: 'Sale price (AED)', type: 'number', half: true },
          { name: 'bookValue', label: 'Book value at sale (AED)', type: 'number', half: true },
        ]}
        submitting={dispose.isPending} error={dispose.error ? apiError(dispose.error) : null}
        onClose={() => setDisposeRow(null)} onSubmit={(v) => dispose.mutate({ id: disposeRow.id, b: v })}
      />
    </>
  );
}
