import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Grid, ToggleButton, ToggleButtonGroup, LinearProgress } from '@mui/material';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency } from '../i18n';

export default function Costs() {
  const [period, setPeriod] = useState('mtd');
  const { data, isLoading } = useQuery({
    queryKey: ['costs', period],
    queryFn: async () => (await api.get('/costs/summary', { params: { period } })).data,
  });

  const columns: GridColDef[] = [
    { field: 'plate', headerName: 'Vehicle', width: 170 },
    { field: 'fuel', headerName: 'Fuel', width: 110, valueGetter: (_v, r) => r.buckets.fuel, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'maintenance', headerName: 'Maintenance', width: 120, valueGetter: (_v, r) => r.buckets.maintenance, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'fines', headerName: 'Fines', width: 100, valueGetter: (_v, r) => r.buckets.fines, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'depreciation', headerName: 'Depreciation', width: 120, valueGetter: (_v, r) => r.buckets.depreciation, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'totalCost', headerName: 'Total', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'kmRun', headerName: 'km Run', width: 100 },
    { field: 'costPerKm', headerName: 'Cost/km', width: 110, valueFormatter: (v) => (v == null ? '—' : `AED ${v}`) },
  ];

  return (
    <Box>
      <PageHeader
        title="Costs & TCO"
        subtitle="Cost-per-km and total cost of ownership (incl. straight-line depreciation)"
        action={
          <ToggleButtonGroup size="small" exclusive value={period} onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="mtd">MTD</ToggleButton>
            <ToggleButton value="ytd">YTD</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {isLoading || !data ? <LinearProgress /> : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={4}><StatCard label="Fleet total cost" value={fmtCurrency(data.fleetTotalCost)} /></Grid>
            <Grid item xs={6} md={4}><StatCard label="Fleet cash cost" value={fmtCurrency(data.fleetCashCost)} sub="excludes depreciation" /></Grid>
            <Grid item xs={6} md={4}><StatCard label="Vehicles" value={data.vehicleCount} /></Grid>
          </Grid>
          <Card>
            <DataGrid autoHeight rows={data.vehicles ?? []} columns={columns} getRowId={(r) => r.vehicleId}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } }, sorting: { sortModel: [{ field: 'totalCost', sort: 'desc' }] } }}
              pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
          </Card>
        </>
      )}
    </Box>
  );
}
