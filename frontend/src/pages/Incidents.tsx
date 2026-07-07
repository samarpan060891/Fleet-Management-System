import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { fmtCurrency, fmtDate } from '../i18n';

const CLAIM_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  reported: 'default', under_review: 'info', approved: 'success', rejected: 'error', settled: 'success',
};

export default function Incidents() {
  const { data, isLoading } = useQuery({ queryKey: ['incidents'], queryFn: async () => (await api.get('/incidents', { params: { pageSize: 200 } })).data });
  const columns: GridColDef[] = [
    { field: 'occurredAt', headerName: 'Date', width: 120, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'driver', headerName: 'Driver', width: 150, valueGetter: (_v, r) => r.driver?.fullName ?? '—' },
    { field: 'emirate', headerName: 'Emirate', width: 120 },
    { field: 'description', headerName: 'Description', width: 220 },
    { field: 'claimStatus', headerName: 'Claim', width: 130, renderCell: (p) => <Chip size="small" color={CLAIM_COLOR[p.value as string]} label={String(p.value).replace(/_/g, ' ')} /> },
    { field: 'claimAmount', headerName: 'Claim Amt', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
  ];
  return (
    <Box>
      <PageHeader title="Incidents & Claims" subtitle="Accident register with claim lifecycle" />
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>
    </Box>
  );
}
