import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, CardContent, Grid, ToggleButton, ToggleButtonGroup, LinearProgress, Typography, Tabs, Tab, Chip } from '@mui/material';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency, fmtDate } from '../i18n';

export default function Costs() {
  const [period, setPeriod] = useState('mtd');
  const [tab, setTab] = useState(0);
  const { data, isLoading } = useQuery({ queryKey: ['costs', period], queryFn: async () => (await api.get('/costs/summary', { params: { period } })).data });
  const assets = useQuery({ queryKey: ['assets'], queryFn: async () => (await api.get('/costs/assets')).data });
  const disposals = useQuery({ queryKey: ['disposals'], queryFn: async () => (await api.get('/costs/disposals')).data, enabled: tab === 1 });

  const bucket = (key: string): GridColDef => ({ field: key, headerName: key[0].toUpperCase() + key.slice(1), width: 110, valueGetter: (_v, r) => r.buckets[key], valueFormatter: (v) => fmtCurrency(v as number) });
  const columns: GridColDef[] = [
    { field: 'plate', headerName: 'Vehicle', width: 160 },
    bucket('fuel'), bucket('maintenance'), bucket('tyres'), bucket('insurance'), bucket('permit'), bucket('fines'), bucket('depreciation'),
    { field: 'totalCost', headerName: 'Total', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'kmRun', headerName: 'km Run', width: 90 },
    { field: 'costPerKm', headerName: 'Cost/km', width: 100, valueFormatter: (v) => (v == null ? '—' : `AED ${v}`) },
  ];
  const dispCols: GridColDef[] = [
    { field: 'disposalDate', headerName: 'Date', width: 120, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 180, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : '—' },
    { field: 'method', headerName: 'Method', width: 150, renderCell: (p) => <Chip size="small" variant="outlined" label={String(p.value).replace(/_/g, ' ')} /> },
    { field: 'buyer', headerName: 'Buyer', width: 150 },
    { field: 'salePrice', headerName: 'Sale price', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'bookValue', headerName: 'Book value', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'gainLoss', headerName: 'Gain / Loss', width: 130, renderCell: (p) => {
      const v = p.value as number | null; if (v == null) return '—';
      return <Chip size="small" color={v >= 0 ? 'success' : 'error'} label={fmtCurrency(v)} />;
    } },
  ];

  return (
    <Box>
      <PageHeader
        title="Costs & TCO"
        subtitle="Cost-per-km, total cost of ownership, asset value and disposals"
        action={
          <ToggleButtonGroup size="small" exclusive value={period} onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="mtd">MTD</ToggleButton>
            <ToggleButton value="ytd">YTD</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {assets.data && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}><StatCard label="Asset value (purchased)" value={fmtCurrency(assets.data.totalPurchaseValue)} /></Grid>
          <Grid item xs={6} md={3}><StatCard label="Net book value" value={fmtCurrency(assets.data.totalBookValue)} color="#0f6e6e" /></Grid>
          <Grid item xs={6} md={3}><StatCard label="Accumulated depreciation" value={fmtCurrency(assets.data.totalDepreciation)} color="#b5893a" /></Grid>
          <Grid item xs={6} md={3}><StatCard label="Depreciable vehicles" value={assets.data.vehicleCount} /></Grid>
        </Grid>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Cost & TCO" /><Tab label="Disposals (sold/scrapped)" />
      </Tabs>

      {tab === 0 && (isLoading || !data ? <LinearProgress /> : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={4}><StatCard label="Fleet total cost" value={fmtCurrency(data.fleetTotalCost)} sub={period.toUpperCase()} /></Grid>
            <Grid item xs={6} md={4}><StatCard label="Fleet cash cost" value={fmtCurrency(data.fleetCashCost)} sub="excludes depreciation" /></Grid>
            <Grid item xs={6} md={4}><StatCard label="Vehicles" value={data.vehicleCount} /></Grid>
          </Grid>
          <Card>
            <DataGrid autoHeight rows={data.vehicles ?? []} columns={columns} getRowId={(r) => r.vehicleId}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } }, sorting: { sortModel: [{ field: 'totalCost', sort: 'desc' }] } }}
              pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
          </Card>
        </>
      ))}

      {tab === 1 && (
        <Card>
          {(disposals.data?.length ?? 0) === 0 && !disposals.isLoading ? (
            <CardContent><Typography color="text.secondary">No disposed/sold vehicles yet.</Typography></CardContent>
          ) : (
            <DataGrid autoHeight rows={disposals.data ?? []} columns={dispCols} loading={disposals.isLoading} getRowId={(r) => r.id}
              pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
          )}
        </Card>
      )}
    </Box>
  );
}
