import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Card, Chip, Tabs, Tab, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import StraightenIcon from '@mui/icons-material/Straighten';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import ImportDialog from '../components/ImportDialog';
import { fmtCurrency, fmtDate, fmtKm } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

export default function Maintenance() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, vendorOptions } = useLookups();
  const [tab, setTab] = useState(0);
  const [addJob, setAddJob] = useState(false);
  const [importJobs, setImportJobs] = useState(false);
  const [closeJob, setCloseJob] = useState<any | null>(null);
  const [addTyre, setAddTyre] = useState(false);
  const [scrapTyre, setScrapTyre] = useState<any | null>(null);
  const [treadTyre, setTreadTyre] = useState<any | null>(null);

  const jobs = useQuery({ queryKey: ['job-cards'], queryFn: async () => (await api.get('/maintenance/job-cards', { params: { pageSize: 200 } })).data });
  const pmDue = useQuery({ queryKey: ['pm-due'], queryFn: async () => (await api.get('/maintenance/pm-due')).data, enabled: tab === 1 });
  const tyres = useQuery({ queryKey: ['tyres'], queryFn: async () => (await api.get('/maintenance/tyres')).data, enabled: tab === 2 });

  const invJobs = () => qc.invalidateQueries({ queryKey: ['job-cards'] });
  const invTyres = () => qc.invalidateQueries({ queryKey: ['tyres'] });
  const createJob = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/maintenance/job-cards', b)).data, onSuccess: () => { invJobs(); setAddJob(false); } });
  const closeJobMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/maintenance/job-cards/${id}/close`, b)).data, onSuccess: () => { invJobs(); setCloseJob(null); } });
  const createTyre = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/maintenance/tyres', b)).data, onSuccess: () => { invTyres(); setAddTyre(false); } });
  const scrapMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/maintenance/tyres/${id}/scrap`, b)).data, onSuccess: () => { invTyres(); setScrapTyre(null); } });
  const treadMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/maintenance/tyres/${id}/tread-check`, b)).data, onSuccess: () => { invTyres(); setTreadTyre(null); } });

  const jobFields: FieldDef[] = [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: ['scheduled', 'breakdown', 'accident', 'tyre'].map((t) => ({ value: t, label: t })) },
    { name: 'dateIn', label: 'Date in', type: 'date', required: true, half: true },
    { name: 'odometerIn', label: 'Odometer in (km)', type: 'number', half: true },
    { name: 'vendorId', label: 'Workshop / vendor', type: 'select', half: true, options: vendorOptions },
    { name: 'invoiceNumber', label: 'Invoice number', half: true },
    { name: 'labourCharges', label: 'Labour charges (AED)', type: 'number', half: true },
    { name: 'otherCharges', label: 'Other charges (AED)', type: 'number', half: true },
    { name: 'description', label: 'Symptoms / description', type: 'multiline' },
  ];
  const tyreFields: FieldDef[] = [
    { name: 'serial', label: 'Tyre serial', required: true, half: true },
    { name: 'brand', label: 'Brand', half: true },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', half: true, options: vehicleOptions },
    { name: 'position', label: 'Fitment position (e.g. FL, RR)', half: true },
    { name: 'fitmentDate', label: 'Fitment date', type: 'date', half: true },
    { name: 'fitmentOdometer', label: 'Fitment odometer (km)', type: 'number', half: true },
    { name: 'treadDepthMm', label: 'Tread depth (mm)', type: 'number', half: true },
    { name: 'vendorId', label: 'Supplier', type: 'select', half: true, options: vendorOptions },
    { name: 'cost', label: 'Cost (AED)', type: 'number', half: true },
  ];

  const jobCols: GridColDef[] = [
    { field: 'jobNumber', headerName: 'Job #', width: 150 },
    { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'type', headerName: 'Type', width: 100, renderCell: (p) => <Chip size="small" variant="outlined" label={p.value as string} /> },
    { field: 'dateIn', headerName: 'Date In', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'totalCost', headerName: 'Cost', width: 110, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'isWarrantyClaim', headerName: 'Warranty', width: 120, renderCell: (p) => p.value ? <Chip size="small" color="secondary" label="Possible claim" /> : '—' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusChip status={p.value as string} /> },
    { field: '__a', type: 'actions', headerName: '', width: 60, getActions: (p) => (can('maintenance:update') && p.row.status !== 'closed')
      ? [<GridActionsCellItem key="c" icon={<CheckCircleIcon />} label="Close job" onClick={() => setCloseJob(p.row)} />] : [] },
  ];
  const pmCols: GridColDef[] = [
    { field: 'plate', headerName: 'Vehicle', width: 180 },
    { field: 'nextPmKm', headerName: 'Next PM (km)', width: 140, valueFormatter: (v) => fmtKm(v as number) },
    { field: 'nextPmDate', headerName: 'Next PM Date', width: 140, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'kmToNext', headerName: 'km to next', width: 120 },
    { field: 'daysToNext', headerName: 'Days to next', width: 120, renderCell: (p) => { const d = p.value as number; return <Chip size="small" color={d < 0 ? 'error' : d <= 15 ? 'warning' : 'success'} label={d} />; } },
  ];
  const tyreCols: GridColDef[] = [
    { field: 'serial', headerName: 'Serial', width: 130 },
    { field: 'brand', headerName: 'Brand', width: 130 },
    { field: 'position', headerName: 'Position', width: 100 },
    { field: 'treadDepthMm', headerName: 'Tread (mm)', width: 110, renderCell: (p) => <Chip size="small" color={Number(p.value) < 1.6 ? 'error' : 'default'} variant="outlined" label={p.value ?? '—'} /> },
    { field: 'cost', headerName: 'Cost', width: 110, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: '__a', type: 'actions', headerName: '', width: 70, getActions: (p) => can('tyres:update') ? [
      <GridActionsCellItem key="t" icon={<StraightenIcon />} label="Tread check" onClick={() => setTreadTyre(p.row)} />,
      <GridActionsCellItem key="s" icon={<DeleteSweepIcon />} label="Scrap" showInMenu onClick={() => setScrapTyre(p.row)} />,
    ] : [] },
  ];

  return (
    <Box>
      <PageHeader
        title="Maintenance" subtitle="Outsourced job cards, PM schedules and tyres"
        action={tab === 0
          ? can('maintenance:create') && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportJobs(true)}>Import</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddJob(true)}>New job card</Button>
            </Box>
          )
          : tab === 2
          ? can('tyres:create') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddTyre(true)}>Add tyre</Button>
          : undefined}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}><Tab label="Job Cards" /><Tab label="PM Due" /><Tab label="Tyres" /></Tabs>
      <Card>
        {tab === 0 && <DataGrid autoHeight rows={jobs.data?.data ?? []} columns={jobCols} loading={jobs.isLoading} getRowId={(r) => r.id} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />}
        {tab === 1 && <DataGrid autoHeight rows={pmDue.data ?? []} columns={pmCols} loading={pmDue.isLoading} getRowId={(r) => r.vehicleId} initialState={{ pagination: { paginationModel: { pageSize: 25 } }, sorting: { sortModel: [{ field: 'daysToNext', sort: 'asc' }] } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />}
        {tab === 2 && <DataGrid autoHeight rows={tyres.data ?? []} columns={tyreCols} loading={tyres.isLoading} getRowId={(r) => r.id} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />}
      </Card>

      <FormDialog open={addJob} title="New job card" fields={jobFields} submitting={createJob.isPending} error={createJob.error ? apiError(createJob.error) : null} onClose={() => setAddJob(false)} onSubmit={(v) => createJob.mutate(v)} />
      <FormDialog open={!!closeJob} title={`Close ${closeJob?.jobNumber ?? 'job card'}`}
        fields={[{ name: 'dateOut', label: 'Date out', type: 'date', required: true, half: true }, { name: 'odometerOut', label: 'Odometer out (km)', type: 'number', half: true }]}
        submitting={closeJobMut.isPending} error={closeJobMut.error ? apiError(closeJobMut.error) : null}
        onClose={() => setCloseJob(null)} onSubmit={(v) => closeJobMut.mutate({ id: closeJob.id, b: v })} />
      <FormDialog open={addTyre} title="Add tyre" fields={tyreFields} submitting={createTyre.isPending} error={createTyre.error ? apiError(createTyre.error) : null} onClose={() => setAddTyre(false)} onSubmit={(v) => createTyre.mutate(v)} />
      <FormDialog open={!!treadTyre} title="Log tread-depth check"
        fields={[{ name: 'checkedAt', label: 'Checked at', type: 'date', required: true, half: true }, { name: 'depthMm', label: 'Depth (mm)', type: 'number', required: true, half: true }, { name: 'note', label: 'Note' }]}
        submitting={treadMut.isPending} error={treadMut.error ? apiError(treadMut.error) : null}
        onClose={() => setTreadTyre(null)} onSubmit={(v) => treadMut.mutate({ id: treadTyre.id, b: v })} />
      <FormDialog open={!!scrapTyre} title="Scrap tyre"
        fields={[{ name: 'scrapDate', label: 'Scrap date', type: 'date', required: true, half: true }, { name: 'scrapReason', label: 'Reason', required: true }]}
        submitting={scrapMut.isPending} error={scrapMut.error ? apiError(scrapMut.error) : null}
        onClose={() => setScrapTyre(null)} onSubmit={(v) => scrapMut.mutate({ id: scrapTyre.id, b: v })} />
      <ImportDialog open={importJobs} resource="maintenance" label="Maintenance / Job Cards"
        onClose={() => setImportJobs(false)} onImported={invJobs} />
    </Box>
  );
}
