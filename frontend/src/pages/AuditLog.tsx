import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';

export default function AuditLog() {
  const { data, isLoading } = useQuery({ queryKey: ['audit'], queryFn: async () => (await api.get('/audit', { params: { pageSize: 200 } })).data });
  const columns: GridColDef[] = [
    { field: 'createdAt', headerName: 'When', width: 180, valueFormatter: (v) => new Date(v as string).toLocaleString('en-GB') },
    { field: 'userEmail', headerName: 'User', width: 200 },
    { field: 'action', headerName: 'Action', width: 120, renderCell: (p) => <Chip size="small" label={p.value as string} variant="outlined" /> },
    { field: 'entity', headerName: 'Entity', width: 180 },
    { field: 'entityId', headerName: 'Entity ID', width: 300 },
  ];
  return (
    <Box>
      <PageHeader title="Audit Log" subtitle="Every create/update/delete on financial, compliance, approval and attendance records" />
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }} pageSizeOptions={[50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>
    </Box>
  );
}
