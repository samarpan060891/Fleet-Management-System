import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Chip, Tabs, Tab, Box, Alert, Typography, Card, CardContent, CardActions, IconButton, Stack } from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SellIcon from '@mui/icons-material/Sell';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CrudListPage from '../components/CrudListPage';
import FormDialog, { FieldDef } from '../components/FormDialog';
import VehicleHistoryDrawer from '../components/VehicleHistoryDrawer';
import { StatusChip } from '../components/ui';
import { fmtKm, fmtCurrency, fmtDate } from '../i18n';
import { useLookups, apiError } from '../hooks/useLookups';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const TYPES = ['light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van'];
const OWNERSHIP = ['owned', 'leased', 'rented'];

const activeColumns: GridColDef[] = [
  { field: 'plateNumber', headerName: 'Plate', width: 130, valueGetter: (_v, r) => `${r.plateNumber} (${r.plateEmirate})` },
  { field: 'make', headerName: 'Make/Model', width: 160, valueGetter: (_v, r) => `${r.make} ${r.model} ${r.year}` },
  { field: 'vehicleType', headerName: 'Type', width: 100, renderCell: (p) => <Chip size="small" label={String(p.value).replace(/_/g, ' ')} variant="outlined" /> },
  { field: 'currentOdometer', headerName: 'Odometer', width: 110, valueFormatter: (v) => fmtKm(v as number) },
  { field: 'hasBranding', headerName: 'Branding', width: 100, renderCell: (p) => p.value ? <Chip size="small" color="secondary" label="Branded" /> : '—' },
  { field: 'assignedDriver', headerName: 'Committed to', width: 140, valueGetter: (_v, r) => r.assignments?.[0]?.driver?.fullName ?? '— (free)' },
  { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusChip status={p.value as string} /> },
];

const disposedColumns: GridColDef[] = [
  { field: 'plateNumber', headerName: 'Plate', width: 130, valueGetter: (_v, r) => `${r.plateNumber} (${r.plateEmirate})` },
  { field: 'make', headerName: 'Make/Model', width: 160, valueGetter: (_v, r) => `${r.make} ${r.model} ${r.year}` },
  { field: 'disposalDate', headerName: 'Disposal date', width: 130, valueGetter: (_v, r) => r.disposal?.disposalDate, valueFormatter: (v) => fmtDate(v as string) },
  { field: 'method', headerName: 'Method', width: 130, valueGetter: (_v, r) => r.disposal?.method, renderCell: (p) => p.value ? <Chip size="small" variant="outlined" label={String(p.value).replace(/_/g, ' ')} /> : '—' },
  { field: 'buyer', headerName: 'Buyer', width: 150, valueGetter: (_v, r) => r.disposal?.buyer ?? '—' },
  { field: 'salePrice', headerName: 'Sale price', width: 120, valueGetter: (_v, r) => r.disposal?.salePrice, valueFormatter: (v) => fmtCurrency(v as number) },
  { field: 'gainLoss', headerName: 'Gain / Loss', width: 120, valueGetter: (_v, r) => r.disposal?.gainLoss, renderCell: (p) => {
    const v = p.value as number | null; if (v == null) return '—';
    return <Chip size="small" color={v >= 0 ? 'success' : 'error'} label={fmtCurrency(v)} />;
  } },
];

function VehicleCard({ row, onEdit, onDelete, onClick, canUpdate, canDelete }: {
  row: any; onEdit: () => void; onDelete: () => void; onClick?: () => void; canUpdate: boolean; canDelete: boolean;
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{row.plateNumber}</Typography>
          <StatusChip status={row.status} />
        </Stack>
        <Typography variant="body2" color="text.secondary">{row.plateEmirate} · {String(row.vehicleType).replace(/_/g, ' ')}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>{row.make} {row.model} {row.year}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{fmtKm(row.currentOdometer)}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {row.hasBranding && <Chip size="small" color="secondary" label="Branded" />}
          <Chip size="small" variant="outlined" label={row.assignments?.[0]?.driver?.fullName ?? '— (free)'} />
        </Stack>
      </CardContent>
      {(canUpdate || canDelete) && (
        <CardActions sx={{ justifyContent: 'flex-end' }}>
          {canUpdate && <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>}
          {canDelete && <IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>}
        </CardActions>
      )}
    </Card>
  );
}

export default function Vehicles() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { storeOptions, vendorOptions } = useLookups();
  const [disposeRow, setDisposeRow] = useState<any | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [tab, setTab] = useState(0); // 0 = active, 1 = disposed

  const dispose = useMutation({
    mutationFn: async ({ id, b }: { id: string; b: Record<string, unknown> }) => (await api.post(`/vehicles/${id}/disposal`, b)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['lookup-vehicles'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      setDisposeRow(null);
    },
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

  const confirmAndDispose = (values: Record<string, unknown>) => {
    const sure = confirm(
      `Dispose ${disposeRow.plateNumber}?\n\nThis is IRREVERSIBLE from the UI:\n` +
      `• Status becomes "disposed" and it disappears from Availability, Fleet Allocation and all vehicle pickers.\n` +
      `• Its current driver assignment is released.\n` +
      `• Any planned/active allocations on or after the disposal date are cancelled.\n\n` +
      `Continue?`
    );
    if (sure) dispose.mutate({ id: disposeRow.id, b: values });
  };

  return (
    <>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Active fleet" />
        <Tab label="Disposed / sold" />
      </Tabs>

      {tab === 0 ? (
        <CrudListPage
          title="Vehicles" subtitle="Fleet master — click a row to see full history · add, edit and manage vehicles"
          resource="vehicles" queryKey="vehicles" permission="vehicles"
          columns={activeColumns} fields={fields} importable
          filterRows={(r) => r.status !== 'disposed'}
          onRowClick={(row) => setHistoryId(row.id)}
          toInitial={(r) => ({ ...r, purchaseDate: r.purchase?.purchaseDate, purchasePrice: r.purchase?.purchasePrice })}
          renderCard={(row, actions) => (
            <VehicleCard row={row} onEdit={actions.onEdit} onDelete={actions.onDelete} onClick={actions.onClick}
              canUpdate={can('vehicles:update')} canDelete={can('vehicles:delete')} />
          )}
          extraActions={(row, refetch) => {
            const items = [];
            if (row.assignments?.length) {
              items.push(
                <GridActionsCellItem key="release" icon={<LinkOffIcon />} label="Release driver (free vehicle)" showInMenu
                  onClick={async () => { if (confirm(`Release ${row.plateNumber} from its current driver?`)) { await api.post(`/vehicles/${row.id}/release-driver`); refetch(); } }} />
              );
            }
            items.push(<GridActionsCellItem key="dispose" icon={<SellIcon />} label="Sell / dispose" showInMenu onClick={() => setDisposeRow(row)} />);
            return items;
          }}
        />
      ) : (
        <Box>
          <Typography variant="h5" sx={{ mb: 0.5 }}>Disposed / sold vehicles</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            These vehicles are excluded from Availability, Fleet Allocation and all vehicle pickers. Full history remains available.
          </Alert>
          <CrudListPage
            title="Disposed vehicles" subtitle=""
            resource="vehicles" queryKey="vehicles" permission="vehicles"
            columns={disposedColumns} fields={[]}
            filterRows={(r) => r.status === 'disposed'}
            onRowClick={(row) => setHistoryId(row.id)}
            hideDelete hideAdd
          />
        </Box>
      )}

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
        onClose={() => setDisposeRow(null)} onSubmit={confirmAndDispose}
      />
      <VehicleHistoryDrawer vehicleId={historyId} onClose={() => setHistoryId(null)} />
    </>
  );
}
