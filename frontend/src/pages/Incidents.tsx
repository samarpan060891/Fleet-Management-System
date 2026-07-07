import { GridColDef } from '@mui/x-data-grid';
import { Chip } from '@mui/material';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';
import { fmtCurrency, fmtDate } from '../i18n';
import { useLookups } from '../hooks/useLookups';

const CLAIM = ['reported', 'under_review', 'approved', 'rejected', 'settled'];
const CLAIM_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  reported: 'default', under_review: 'info', approved: 'success', rejected: 'error', settled: 'success',
};

const columns: GridColDef[] = [
  { field: 'occurredAt', headerName: 'Date', width: 120, valueFormatter: (v) => fmtDate(v as string) },
  { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
  { field: 'driver', headerName: 'Driver', width: 150, valueGetter: (_v, r) => r.driver?.fullName ?? '—' },
  { field: 'emirate', headerName: 'Emirate', width: 110 },
  { field: 'description', headerName: 'Description', width: 200 },
  { field: 'claimStatus', headerName: 'Claim', width: 130, renderCell: (p) => <Chip size="small" color={CLAIM_COLOR[p.value as string]} label={String(p.value).replace(/_/g, ' ')} /> },
  { field: 'claimAmount', headerName: 'Claim Amt', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
];

export default function Incidents() {
  const { vehicleOptions, driverOptions, vendorOptions } = useLookups();

  const fields: FieldDef[] = [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'driverId', label: 'Driver', type: 'select', half: true, options: driverOptions },
    { name: 'occurredAt', label: 'Date of incident', type: 'date', required: true, half: true },
    { name: 'emirate', label: 'Emirate', half: true },
    { name: 'area', label: 'Area', half: true },
    { name: 'policeReportNo', label: 'Police report no.', half: true },
    { name: 'thirdParty', label: 'Third-party details', half: true },
    { name: 'insuranceVendorId', label: 'Insurance vendor', type: 'select', half: true, options: vendorOptions },
    { name: 'description', label: 'Description', type: 'multiline' },
    { name: 'claimStatus', label: 'Claim status', type: 'select', half: true, options: CLAIM.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })) },
    { name: 'claimAmount', label: 'Claim amount (AED)', type: 'number', half: true },
    { name: 'settlementAmount', label: 'Settlement amount (AED)', type: 'number', half: true },
  ];

  return (
    <CrudListPage
      title="Incidents & Claims" subtitle="Accident register with claim lifecycle"
      resource="incidents" queryKey="incidents" permission="incidents"
      columns={columns} fields={fields} hideDelete
    />
  );
}
