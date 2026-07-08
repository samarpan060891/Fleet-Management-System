import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, CardContent, Typography, Chip, Button, Stack, Alert } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import ImportDialog from '../components/ImportDialog';
import { fmtCurrency, fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

export default function Fuel() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, driverOptions } = useLookups();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fuel'],
    queryFn: async () => (await api.get('/fuel', { params: { pageSize: 200 } })).data,
  });
  const pending = useQuery({
    queryKey: ['fuel-pending'],
    queryFn: async () => (await api.get('/fuel/pending-approvals')).data,
    enabled: can('fuel:approve'),
  });
  const trend = useQuery({ queryKey: ['fuel-price-trend'], queryFn: async () => (await api.get('/fuel/price-trend')).data });

  const approve = useMutation({
    mutationFn: async ({ id, ok }: { id: string; ok: boolean }) => (await api.post(`/fuel/${id}/approve`, { approve: ok, reason: ok ? undefined : 'Rejected' })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel'] }); qc.invalidateQueries({ queryKey: ['fuel-pending'] }); },
  });
  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/fuel', body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel'] }); qc.invalidateQueries({ queryKey: ['fuel-pending'] }); setDialogOpen(false); },
  });

  const fields: FieldDef[] = [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'channel', label: 'Channel', type: 'select', required: true, half: true, options: [
      { value: 'vip_kit', label: 'VIP kit' }, { value: 'fuel_buddy', label: 'Fuel Buddy' }, { value: 'cash', label: 'Cash (needs approval)' }] },
    { name: 'filledAt', label: 'Date', type: 'date', required: true, half: true },
    { name: 'odometer', label: 'Odometer at fill (km)', type: 'number', half: true },
    { name: 'litres', label: 'Litres', type: 'number', required: true, half: true },
    { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, half: true },
    { name: 'rate', label: 'Rate (AED/L)', type: 'number', half: true },
    { name: 'driverId', label: 'Driver (auto if blank)', type: 'select', half: true, options: driverOptions },
  ];

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
    { field: 'actions', headerName: 'Approve', width: 200, sortable: false, renderCell: (p) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" color="success" variant="contained" startIcon={<CheckIcon />} onClick={() => approve.mutate({ id: p.row.id, ok: true })}>Approve</Button>
        <Button size="small" color="error" variant="outlined" startIcon={<CloseIcon />} onClick={() => approve.mutate({ id: p.row.id, ok: false })}>Reject</Button>
      </Stack>
    ) },
  ];

  return (
    <Box>
      <PageHeader
        title="Fuel" subtitle="3-channel entry · odometer-linked efficiency · cash approval workflow"
        action={can('fuel:create') && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>Import</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>Log fuel</Button>
          </Box>
        )}
      />
      {(trend.data?.length ?? 0) > 1 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Fuel price trend (avg AED / litre)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend.data}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis domain={['auto', 'auto']} fontSize={12} />
                <Tooltip formatter={(v: number) => `AED ${v}`} />
                <Line type="monotone" dataKey="avgRate" stroke="#0f6e6e" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      {can('fuel:approve') && (pending.data?.length ?? 0) > 0 && (
        <Card sx={{ mb: 2 }}>
          <Alert severity="warning" sx={{ borderRadius: 0 }}>Cash fills awaiting Fleet Manager approval</Alert>
          <DataGrid autoHeight rows={pending.data ?? []} columns={pendingCols} getRowId={(r) => r.id} hideFooter disableRowSelectionOnClick sx={{ border: 0 }} />
        </Card>
      )}
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>

      <FormDialog
        open={dialogOpen} title="Log fuel fill" fields={fields}
        submitting={create.isPending} error={create.error ? apiError(create.error) : null}
        onClose={() => setDialogOpen(false)} onSubmit={(v) => create.mutate(v)}
      />
      <ImportDialog open={importOpen} resource="fuel" label="Fuel Transactions"
        onClose={() => setImportOpen(false)}
        onImported={() => { qc.invalidateQueries({ queryKey: ['fuel'] }); qc.invalidateQueries({ queryKey: ['fuel-price-trend'] }); }} />
    </Box>
  );
}
