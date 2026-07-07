import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Card, Chip, Button, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import ImportDialog from '../components/ImportDialog';
import { fmtDate, fmtKm } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

export default function Odometer() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions } = useLookups();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['odometer'],
    queryFn: async () => (await api.get('/odometer', { params: { pageSize: 200 } })).data,
  });

  const create = useMutation({
    mutationFn: async (b: Record<string, unknown>) => (await api.post('/odometer', b)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['odometer'] }); qc.invalidateQueries({ queryKey: ['vehicles'] }); setAddOpen(false); },
  });

  const fields: FieldDef[] = [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'readingDate', label: 'Reading date', type: 'date', required: true, half: true },
    { name: 'odometer', label: 'Odometer (km)', type: 'number', required: true, half: true },
    { name: 'note', label: 'Note', half: true },
  ];

  const columns: GridColDef[] = [
    { field: 'readingDate', headerName: 'Date', width: 130, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 170, valueGetter: (_v, r) => r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : '—' },
    { field: 'odometer', headerName: 'Odometer', width: 140, valueFormatter: (v) => fmtKm(v as number) },
    { field: 'source', headerName: 'Source', width: 110, renderCell: (p) => <Chip size="small" variant="outlined" label={p.value as string} /> },
    { field: 'note', headerName: 'Note', width: 220 },
  ];

  return (
    <Box>
      <PageHeader
        title="Odometer Readings"
        subtitle="Daily readings advance each vehicle's odometer and drive preventive-maintenance due dates"
        action={can('odometer:create') && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>Import</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add reading</Button>
          </Box>
        )}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        A reading only ever moves the odometer <strong>forward</strong>. Lower/backdated values are still logged but won't reduce the current odometer.
      </Alert>
      <Card>
        <DataGrid autoHeight rows={data?.data ?? []} columns={columns} loading={isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>

      <FormDialog open={addOpen} title="Add odometer reading" fields={fields}
        submitting={create.isPending} error={create.error ? apiError(create.error) : null}
        onClose={() => setAddOpen(false)} onSubmit={(v) => create.mutate(v)} />
      <ImportDialog open={importOpen} resource="odometer" label="Odometer Readings"
        onClose={() => setImportOpen(false)} onImported={() => { qc.invalidateQueries({ queryKey: ['odometer'] }); qc.invalidateQueries({ queryKey: ['vehicles'] }); }} />
    </Box>
  );
}
