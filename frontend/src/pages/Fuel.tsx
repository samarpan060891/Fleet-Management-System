import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip, Button, Stack, Alert } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import { fmtCurrency, fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';

export default function Fuel() {
  const qc = useQueryClient();
  const { can } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['fuel'],
    queryFn: async () => (await api.get('/fuel', { params: { pageSize: 200 } })).data,
  });
  const pending = useQuery({
    queryKey: ['fuel-pending'],
    queryFn: async () => (await api.get('/fuel/pending-approvals')).data,
    enabled: can('fuel:approve'),
  });

  const approve = useMutation({
    mutationFn: async ({ id, ok }: { id: string; ok: boolean }) => (await api.post(`/fuel/${id}/approve`, { approve: ok, reason: ok ? undefined : 'Rejected' })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel'] }); qc.invalidateQueries({ queryKey: ['fuel-pending'] }); },
  });

  const columns: GridColDef[] = [
    { field: 'filledAt', headerName: 'Date', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : '—' },
    { field: 'channel', headerName: 'Channel', width: 110, renderCell: (p) => <Chip size="small" variant="outlined" label={String(p.value).replace(/_/g, ' ')} /> },
    { field: 'litres', headerName: 'Litres', width: 90 },
    { field: 'amount', headerName: 'Amount', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'kmPerLitre', headerName: 'km/L', width: 90, valueGetter: (_v, r) => r.kmPerLitre ?? '—' },
    { field: 'odometer', headerName: 'Odometer', width: 110, valueGetter: (_v, r) => r.odometer ?? '⚠ none' },
    { field: 'approvalStatus', headerName: 'Approval', width: 130, renderCell: (p) => p.value ? <StatusChip status={p.value as string} /> : <Chip size="small" label="n/a" variant="outlined" /> },
  ];

  const pendingCols: GridColDef[] = [
    { field: 'filledAt', headerName: 'Date', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 150, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber}` : '—' },
    { field: 'amount', headerName: 'Amount', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'actions', headerName: 'Approve', width: 160, sortable: false, renderCell: (p) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" color="success" variant="contained" startIcon={<CheckIcon />} onClick={() => approve.mutate({ id: p.row.id, ok: true })}>Approve</Button>
        <Button size="small" color="error" variant="outlined" startIcon={<CloseIcon />} onClick={() => approve.mutate({ id: p.row.id, ok: false })}>Reject</Button>
      </Stack>
    ) },
  ];

  return (
    <Box>
      <PageHeader title="Fuel" subtitle="3-channel entry · odometer-linked efficiency · cash approval workflow" />
      {can('fuel:approve') && (pending.data?.length ?? 0) > 0 && (
        <Card sx={{ mb: 2, borderColor: '#ed9c28' }}>
          <Alert severity="warning" sx={{ borderRadius: 0 }}>Cash fills awaiting Fleet Manager approval</Alert>
          <DataGrid autoHeight rows={pending.data ?? []} columns={pendingCols} getRowId={(r) => r.id} hideFooter disableRowSelectionOnClick sx={{ border: 0 }} />
        </Card>
      )}
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>
    </Box>
  );
}
