import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { fmtDate } from '../i18n';

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.round((new Date(expiry).getTime() - Date.now()) / 86400000);
}

export default function Compliance() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance'],
    queryFn: async () => (await api.get('/compliance', { params: { pageSize: 300 } })).data,
  });

  const columns: GridColDef[] = [
    { field: 'entity', headerName: 'Entity', width: 200, valueGetter: (_v, r) =>
      r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : r.driver?.fullName ?? '—' },
    { field: 'entityType', headerName: 'Type', width: 90 },
    { field: 'docType', headerName: 'Document', width: 140, valueFormatter: (v) => String(v).replace(/_/g, ' ') },
    { field: 'reference', headerName: 'Reference', width: 130 },
    { field: 'expiryDate', headerName: 'Expiry', width: 120, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'daysLeft', headerName: 'Days Left', width: 140, sortable: true,
      valueGetter: (_v, r) => daysLeft(r.expiryDate),
      renderCell: (p) => {
        const d = p.value as number | null;
        if (d == null) return '—';
        const color = d < 0 ? 'error' : d <= 7 ? 'error' : d <= 60 ? 'warning' : 'success';
        return <Chip size="small" color={color as never} label={d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`} />;
      },
    },
    { field: 'renewalInProgress', headerName: 'Renewal', width: 110, valueFormatter: (v) => (v ? 'In progress' : '—') },
  ];

  return (
    <Box>
      <PageHeader title="Compliance Register" subtitle="All vehicle & driver document expiries in one place" />
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } }, sorting: { sortModel: [{ field: 'expiryDate', sort: 'asc' }] } }}
          pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>
    </Box>
  );
}
