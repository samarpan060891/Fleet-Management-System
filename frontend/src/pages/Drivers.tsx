import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { fmtDate } from '../i18n';

export default function Drivers() {
  const { data, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get('/drivers', { params: { pageSize: 200 } })).data,
  });

  const columns: GridColDef[] = [
    { field: 'fullName', headerName: 'Name', width: 180 },
    { field: 'staffId', headerName: 'Staff ID', width: 120 },
    { field: 'nationality', headerName: 'Nationality', width: 120 },
    { field: 'licenceNumber', headerName: 'Licence', width: 120 },
    { field: 'licenceExpiry', headerName: 'Licence Expiry', width: 140, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'emiratesIdExpiry', headerName: 'EID Expiry', width: 130, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'visaExpiry', headerName: 'Visa Expiry', width: 130, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'status', headerName: 'Status', width: 100 },
  ];

  return (
    <Box>
      <PageHeader title="Drivers" subtitle={`${data?.pagination?.total ?? 0} drivers`} />
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>
    </Box>
  );
}
