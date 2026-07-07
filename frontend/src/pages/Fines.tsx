import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import { fmtCurrency, fmtDate } from '../i18n';

export default function Fines() {
  const [tab, setTab] = useState(0);
  const fines = useQuery({ queryKey: ['fines'], queryFn: async () => (await api.get('/fines', { params: { pageSize: 200 } })).data });
  const salik = useQuery({ queryKey: ['salik'], queryFn: async () => (await api.get('/salik')).data, enabled: tab === 1 });

  const fineCols: GridColDef[] = [
    { field: 'reference', headerName: 'Reference', width: 140 },
    { field: 'offenceAt', headerName: 'Offence Date', width: 130, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 140, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'driver', headerName: 'Driver (attributed)', width: 170, valueGetter: (_v, r) => r.driver?.fullName ?? '—',
      renderCell: (p) => <span>{p.value}{p.row.driverOverridden ? ' *' : ''}</span> },
    { field: 'type', headerName: 'Type', width: 110 },
    { field: 'amount', headerName: 'Amount', width: 110, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'status', headerName: 'Status', width: 100, renderCell: (p) => <StatusChip status={p.value as string} /> },
  ];
  const salikCols: GridColDef[] = [
    { field: 'vehicle', headerName: 'Vehicle', width: 180, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'tagNumber', headerName: 'Tag', width: 140 },
    { field: 'balance', headerName: 'Balance', width: 130, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'lowThreshold', headerName: 'Threshold', width: 130, valueFormatter: (v) => fmtCurrency(v as number),
      renderCell: (p) => <Chip size="small" color={Number(p.row.balance) <= Number(p.row.lowThreshold) ? 'error' : 'default'} label={fmtCurrency(p.row.lowThreshold)} variant="outlined" /> },
  ];

  return (
    <Box>
      <PageHeader title="Fines & Salik" subtitle="Manual entry · fines auto-attributed to the assigned driver (* = overridden)" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Fines" /><Tab label="Salik" />
      </Tabs>
      <Card>
        {tab === 0 ? (
          <DataGrid autoHeight rows={fines.data?.data ?? []} columns={fineCols} loading={fines.isLoading} getRowId={(r) => r.id}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
        ) : (
          <DataGrid autoHeight rows={salik.data ?? []} columns={salikCols} loading={salik.isLoading} getRowId={(r) => r.id}
            pageSizeOptions={[25]} disableRowSelectionOnClick sx={{ border: 0 }} />
        )}
      </Card>
    </Box>
  );
}
