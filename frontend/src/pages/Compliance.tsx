import { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';
import { fmtDate } from '../i18n';
import { useLookups } from '../hooks/useLookups';

const DOC_TYPES = ['mulkiya', 'insurance', 'tasjeel', 'lease', 'warranty', 'licence', 'emirates_id', 'visa', 'passport'];

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.round((new Date(expiry).getTime() - Date.now()) / 86400000);
}

const columns: GridColDef[] = [
  { field: 'entity', headerName: 'Entity', width: 200, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : r.driver?.fullName ?? '—' },
  { field: 'entityType', headerName: 'Type', width: 90 },
  { field: 'docType', headerName: 'Document', width: 140, valueFormatter: (v) => String(v).replace(/_/g, ' ') },
  { field: 'reference', headerName: 'Reference', width: 130 },
  { field: 'expiryDate', headerName: 'Expiry', width: 120, valueFormatter: (v) => fmtDate(v as string) },
  { field: 'daysLeft', headerName: 'Days Left', width: 130, valueGetter: (_v, r) => daysLeft(r.expiryDate),
    renderCell: (p) => {
      const d = p.value as number | null;
      if (d == null) return '—';
      const color = d < 0 ? 'error' : d <= 7 ? 'error' : d <= 60 ? 'warning' : 'success';
      return <Chip size="small" color={color as never} label={d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`} />;
    },
  },
];

export default function Compliance() {
  const { vehicleOptions, driverOptions } = useLookups();

  const fields: FieldDef[] = [
    { name: 'entityType', label: 'Applies to', type: 'select', required: true, half: true, options: [{ value: 'vehicle', label: 'Vehicle' }, { value: 'driver', label: 'Driver' }] },
    { name: 'docType', label: 'Document type', type: 'select', required: true, half: true, options: DOC_TYPES.map((d) => ({ value: d, label: d.replace(/_/g, ' ') })) },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', half: true, options: vehicleOptions, showIf: (v) => v.entityType === 'vehicle' },
    { name: 'driverId', label: 'Driver', type: 'select', half: true, options: driverOptions, showIf: (v) => v.entityType === 'driver' },
    { name: 'reference', label: 'Reference / policy no.', half: true },
    { name: 'issueDate', label: 'Issue date', type: 'date', half: true },
    { name: 'expiryDate', label: 'Expiry date', type: 'date', half: true },
    { name: 'renewalInProgress', label: 'Renewal in progress', type: 'checkbox' },
    { name: 'notes', label: 'Notes', type: 'multiline' },
  ];

  return (
    <CrudListPage
      title="Compliance Register" subtitle="All vehicle & driver document expiries in one place"
      resource="compliance" queryKey="compliance" permission="compliance"
      columns={columns} fields={fields}
      toInitial={(r) => ({ ...r, vehicleId: r.vehicleId, driverId: r.driverId })}
    />
  );
}
