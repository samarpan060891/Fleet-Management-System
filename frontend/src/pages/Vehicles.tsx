import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip } from '@mui/material';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import { fmtKm } from '../i18n';

export default function Vehicles() {
  const { data, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get('/vehicles', { params: { pageSize: 200 } })).data,
  });

  const columns: GridColDef[] = [
    { field: 'plateNumber', headerName: 'Plate', width: 120,
      valueGetter: (_v, row) => `${row.plateNumber} (${row.plateEmirate})` },
    { field: 'make', headerName: 'Make/Model', width: 180, valueGetter: (_v, row) => `${row.make} ${row.model} ${row.year}` },
    { field: 'vehicleType', headerName: 'Type', width: 110, renderCell: (p) => <Chip size="small" label={String(p.value).replace(/_/g, ' ')} variant="outlined" /> },
    { field: 'ownership', headerName: 'Ownership', width: 110 },
    { field: 'currentOdometer', headerName: 'Odometer', width: 120, valueFormatter: (v) => fmtKm(v as number) },
    { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => <StatusChip status={p.value as string} /> },
    { field: 'store', headerName: 'Depot', width: 160, valueGetter: (_v, row) => row.store?.code ?? '—' },
  ];

  return (
    <Box>
      <PageHeader title="Vehicles" subtitle={`${data?.pagination?.total ?? 0} vehicles in the fleet master`} />
      <Card>
        <DataGrid
          autoHeight
          rows={data?.data ?? []}
          columns={columns}
          loading={isLoading}
          getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          sx={{ border: 0 }}
        />
      </Card>
    </Box>
  );
}
