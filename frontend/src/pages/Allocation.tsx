import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Card, Chip, Button, Tabs, Tab, TextField, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import { fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

const TYPE_LABEL: Record<string, string> = {
  customer_delivery: 'Direct customer delivery',
  store_delivery: 'Store delivery',
  staff_transport: 'Staff pick & drop',
};
const TYPE_COLOR: Record<string, 'primary' | 'secondary' | 'info'> = {
  customer_delivery: 'primary', store_delivery: 'secondary', staff_transport: 'info',
};
const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  planned: 'default', active: 'info', completed: 'success', cancelled: 'error',
};
const TABS = ['all', 'customer_delivery', 'store_delivery', 'staff_transport'];

export default function Allocation() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, driverOptions, storeOptions } = useLookups();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const routes = useQuery({ queryKey: ['alloc-routes'], queryFn: async () => (await api.get('/transport/routes')).data, staleTime: 60000 });
  const routeOptions = (routes.data ?? []).map((r: any) => ({ value: r.id, label: `${r.code} · ${r.name}` }));

  const type = TABS[tab] === 'all' ? undefined : TABS[tab];
  const list = useQuery({
    queryKey: ['allocations', date, type],
    queryFn: async () => (await api.get('/allocations', { params: { date, ...(type ? { type } : {}), pageSize: 200 } })).data,
  });
  const summary = useQuery({ queryKey: ['alloc-summary', date], queryFn: async () => (await api.get('/allocations/summary', { params: { date } })).data });

  const inv = () => { qc.invalidateQueries({ queryKey: ['allocations'] }); qc.invalidateQueries({ queryKey: ['alloc-summary'] }); qc.invalidateQueries({ queryKey: ['availability'] }); };
  const create = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/allocations', b)).data, onSuccess: () => { inv(); setAddOpen(false); } });
  const setStatus = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.post(`/allocations/${id}/status`, { status })).data, onSuccess: inv });

  const fields: FieldDef[] = [
    { name: 'type', label: 'Allocation type', type: 'select', required: true, half: true, options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })) },
    { name: 'date', label: 'Date', type: 'date', required: true, half: true },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'driverId', label: 'Driver', type: 'select', half: true, options: driverOptions },
    { name: 'storeId', label: 'Store / depot', type: 'select', half: true, options: storeOptions, showIf: (v) => v.type === 'store_delivery' },
    { name: 'routeId', label: 'Route', type: 'select', half: true, options: routeOptions, showIf: (v) => v.type === 'staff_transport' },
    { name: 'reference', label: 'Customer / delivery reference', half: true, showIf: (v) => v.type === 'customer_delivery' },
    { name: 'area', label: 'Area', half: true, showIf: (v) => v.type === 'customer_delivery' },
    { name: 'emirate', label: 'Emirate', half: true, showIf: (v) => v.type === 'customer_delivery' },
    { name: 'startTime', label: 'Start time (e.g. 08:00)', half: true },
    { name: 'endTime', label: 'End time', half: true },
    { name: 'notes', label: 'Notes', type: 'multiline' },
  ];

  const destination = (r: any) => {
    if (r.type === 'store_delivery') return r.store ? `${r.store.code} · ${r.store.name}` : '—';
    if (r.type === 'staff_transport') return r.route ? `${r.route.code} · ${r.route.name}` : '—';
    return [r.reference, r.area, r.emirate].filter(Boolean).join(' · ') || '—';
  };

  const columns: GridColDef[] = [
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'type', headerName: 'Type', width: 190, renderCell: (p) => <Chip size="small" color={TYPE_COLOR[p.value as string]} label={TYPE_LABEL[p.value as string]} /> },
    { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : '—' },
    { field: 'driver', headerName: 'Driver', width: 140, valueGetter: (_v, r) => r.driver?.fullName ?? '—' },
    { field: 'destination', headerName: 'Destination', width: 220, valueGetter: (_v, r) => destination(r) },
    { field: 'time', headerName: 'Time', width: 120, valueGetter: (_v, r) => [r.startTime, r.endTime].filter(Boolean).join(' – ') || '—' },
    { field: 'status', headerName: 'Status', width: 110, renderCell: (p) => <Chip size="small" color={STATUS_COLOR[p.value as string]} label={p.value as string} /> },
    { field: '__a', type: 'actions', headerName: '', width: 60, getActions: (p) => {
      if (!can('allocations:update')) return [];
      const items = [];
      if (p.row.status === 'planned') items.push(<GridActionsCellItem key="s" icon={<PlayArrowIcon />} label="Start" onClick={() => setStatus.mutate({ id: p.row.id, status: 'active' })} />);
      if (p.row.status === 'active') items.push(<GridActionsCellItem key="c" icon={<DoneIcon />} label="Complete" onClick={() => setStatus.mutate({ id: p.row.id, status: 'completed' })} />);
      if (p.row.status !== 'completed' && p.row.status !== 'cancelled') items.push(<GridActionsCellItem key="x" icon={<CancelIcon />} label="Cancel" showInMenu onClick={() => setStatus.mutate({ id: p.row.id, status: 'cancelled' })} />);
      return items;
    } },
  ];

  const countByType = (t: string) => (summary.data?.byType ?? []).find((x: any) => x.type === t)?._count ?? 0;

  return (
    <Box>
      <PageHeader
        title="Fleet Allocation"
        subtitle="Allocate vehicles to daily activities — customer deliveries, store deliveries, staff pick & drop"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            {can('allocations:create') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Allocate</Button>}
          </Box>
        }
      />
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><StatCard label="Customer deliveries" value={countByType('customer_delivery')} color="#0f6e6e" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Store deliveries" value={countByType('store_delivery')} color="#b5893a" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Staff pick & drop" value={countByType('staff_transport')} color="#1565c0" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Total (this day)" value={(list.data?.pagination?.total) ?? 0} /></Grid>
      </Grid>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All" /><Tab label="Customer delivery" /><Tab label="Store delivery" /><Tab label="Staff pick & drop" />
      </Tabs>
      <Card>
        <DataGrid autoHeight rows={list.data?.data ?? []} columns={columns} loading={list.isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>

      <FormDialog open={addOpen} title="Allocate vehicle" fields={fields}
        initial={{ date }}
        submitting={create.isPending} error={create.error ? apiError(create.error) : null}
        onClose={() => setAddOpen(false)} onSubmit={(v) => create.mutate(v)} />
    </Box>
  );
}
