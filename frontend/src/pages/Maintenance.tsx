import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import { fmtCurrency, fmtDate, fmtKm } from '../i18n';

export default function Maintenance() {
  const [tab, setTab] = useState(0);
  const jobs = useQuery({ queryKey: ['job-cards'], queryFn: async () => (await api.get('/maintenance/job-cards', { params: { pageSize: 200 } })).data });
  const pmDue = useQuery({ queryKey: ['pm-due'], queryFn: async () => (await api.get('/maintenance/pm-due')).data, enabled: tab === 1 });

  const jobCols: GridColDef[] = [
    { field: 'jobNumber', headerName: 'Job #', width: 150 },
    { field: 'vehicle', headerName: 'Vehicle', width: 150, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber}` : '—' },
    { field: 'type', headerName: 'Type', width: 110, renderCell: (p) => <Chip size="small" variant="outlined" label={p.value as string} /> },
    { field: 'dateIn', headerName: 'Date In', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'totalCost', headerName: 'Cost', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'isWarrantyClaim', headerName: 'Warranty', width: 120, renderCell: (p) => p.value ? <Chip size="small" color="secondary" label="Possible claim" /> : '—' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusChip status={p.value as string} /> },
  ];

  const pmCols: GridColDef[] = [
    { field: 'plate', headerName: 'Vehicle', width: 180 },
    { field: 'nextPmKm', headerName: 'Next PM (km)', width: 140, valueFormatter: (v) => fmtKm(v as number) },
    { field: 'nextPmDate', headerName: 'Next PM Date', width: 140, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'kmToNext', headerName: 'km to next', width: 120 },
    { field: 'daysToNext', headerName: 'Days to next', width: 120,
      renderCell: (p) => { const d = p.value as number; return <Chip size="small" color={d < 0 ? 'error' : d <= 15 ? 'warning' : 'success'} label={d} />; } },
  ];

  return (
    <Box>
      <PageHeader title="Maintenance" subtitle="Outsourced job cards, PM schedules and warranty flagging" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Job Cards" />
        <Tab label="PM Due" />
      </Tabs>
      <Card>
        {tab === 0 ? (
          <DataGrid autoHeight rows={jobs.data?.data ?? []} columns={jobCols} loading={jobs.isLoading} getRowId={(r) => r.id}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
        ) : (
          <DataGrid autoHeight rows={pmDue.data ?? []} columns={pmCols} loading={pmDue.isLoading} getRowId={(r) => r.vehicleId}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } }, sorting: { sortModel: [{ field: 'daysToNext', sort: 'asc' }] } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
        )}
      </Card>
    </Box>
  );
}
