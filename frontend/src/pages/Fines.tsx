import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Card, Chip, Tabs, Tab, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PaidIcon from '@mui/icons-material/Paid';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { api } from '../api/client';
import { PageHeader, StatusChip } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import ImportDialog from '../components/ImportDialog';
import { fmtCurrency, fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';
import { titleCase } from '../lib/text';

export default function Fines() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, driverOptions } = useLookups();
  const [tab, setTab] = useState(0);
  const [addFine, setAddFine] = useState(false);
  const [importFines, setImportFines] = useState(false);
  const [addSalik, setAddSalik] = useState(false);
  const [reassign, setReassign] = useState<any | null>(null);

  const fines = useQuery({ queryKey: ['fines'], queryFn: async () => (await api.get('/fines', { params: { pageSize: 200 } })).data });
  const salik = useQuery({ queryKey: ['salik'], queryFn: async () => (await api.get('/salik')).data, enabled: tab === 1 });

  const inv = () => { qc.invalidateQueries({ queryKey: ['fines'] }); };
  const createFine = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/fines', b)).data, onSuccess: () => { inv(); setAddFine(false); } });
  const pay = useMutation({ mutationFn: async (id: string) => (await api.post(`/fines/${id}/pay`, { paymentDate: new Date().toISOString().slice(0, 10) })).data, onSuccess: inv });
  const reassignMut = useMutation({ mutationFn: async ({ id, driverId }: { id: string; driverId: string }) => (await api.post(`/fines/${id}/reassign`, { driverId })).data, onSuccess: () => { inv(); setReassign(null); } });
  const setSalik = useMutation({ mutationFn: async (b: any) => (await api.put(`/salik/${b.vehicleId}`, { tagNumber: b.tagNumber, balance: b.balance, lowThreshold: b.lowThreshold })).data, onSuccess: () => { qc.invalidateQueries({ queryKey: ['salik'] }); setAddSalik(false); } });

  const fineFields: FieldDef[] = [
    { name: 'reference', label: 'Fine reference', required: true, half: true },
    { name: 'offenceAt', label: 'Offence date', type: 'date', required: true, half: true },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'type', label: 'Type', type: 'select', required: true, half: true, optionListKey: 'fine.type', options: ['salik', 'speeding', 'parking', 'other'].map((t) => ({ value: t, label: titleCase(t) })) },
    { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, half: true },
    { name: 'authority', label: 'Issuing authority', half: true },
    { name: 'emirate', label: 'Emirate', half: true },
    { name: 'driverId', label: 'Driver (auto-attributed if blank)', type: 'select', half: true, options: driverOptions },
  ];
  const salikFields: FieldDef[] = [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, half: true, options: vehicleOptions },
    { name: 'tagNumber', label: 'Salik tag number', required: true, half: true },
    { name: 'balance', label: 'Balance (AED)', type: 'number', required: true, half: true },
    { name: 'lowThreshold', label: 'Low-balance threshold (AED)', type: 'number', half: true },
  ];

  const fineCols: GridColDef[] = [
    { field: 'reference', headerName: 'Reference', width: 130 },
    { field: 'offenceAt', headerName: 'Offence Date', width: 120, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'vehicle', headerName: 'Vehicle', width: 130, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'driver', headerName: 'Driver', width: 150, valueGetter: (_v, r) => r.driver?.fullName ?? '—', renderCell: (p) => <span>{p.value}{p.row.driverOverridden ? ' *' : ''}</span> },
    { field: 'type', headerName: 'Type', width: 100, valueFormatter: (v) => titleCase(v as string) },
    { field: 'amount', headerName: 'Amount', width: 110, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'status', headerName: 'Status', width: 90, renderCell: (p) => <StatusChip status={p.value as string} /> },
    { field: '__a', type: 'actions', headerName: '', width: 60, getActions: (p) => can('fines:update') ? [
      ...(p.row.status === 'unpaid' ? [<GridActionsCellItem key="p" icon={<PaidIcon />} label="Mark paid" onClick={() => pay.mutate(p.row.id)} />] : []),
      <GridActionsCellItem key="r" icon={<SwapHorizIcon />} label="Reassign driver" showInMenu onClick={() => setReassign(p.row)} />,
    ] : [] },
  ];
  const salikCols: GridColDef[] = [
    { field: 'vehicle', headerName: 'Vehicle', width: 180, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'tagNumber', headerName: 'Tag', width: 140 },
    { field: 'balance', headerName: 'Balance', width: 130, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'lowThreshold', headerName: 'Threshold', width: 130, renderCell: (p) => <Chip size="small" color={Number(p.row.balance) <= Number(p.row.lowThreshold) ? 'error' : 'default'} label={fmtCurrency(p.row.lowThreshold)} variant="outlined" /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Fines & Salik" subtitle="Manual entry · fines auto-attributed to the assigned driver (* = overridden)"
        action={tab === 0
          ? can('fines:create') && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportFines(true)}>Import</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddFine(true)}>Add fine</Button>
            </Box>
          )
          : can('salik:update') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddSalik(true)}>Set Salik</Button>}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}><Tab label="Fines" /><Tab label="Salik" /></Tabs>
      <Card>
        {tab === 0 ? (
          <DataGrid autoHeight rows={fines.data?.data ?? []} columns={fineCols} loading={fines.isLoading} getRowId={(r) => r.id}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50]} disableRowSelectionOnClick sx={{ border: 0 }} />
        ) : (
          <DataGrid autoHeight rows={salik.data ?? []} columns={salikCols} loading={salik.isLoading} getRowId={(r) => r.id} pageSizeOptions={[25]} disableRowSelectionOnClick sx={{ border: 0 }} />
        )}
      </Card>

      <FormDialog open={addFine} title="Add fine" fields={fineFields} submitting={createFine.isPending} error={createFine.error ? apiError(createFine.error) : null} onClose={() => setAddFine(false)} onSubmit={(v) => createFine.mutate(v)} />
      <FormDialog open={addSalik} title="Set Salik tag & balance" fields={salikFields} submitting={setSalik.isPending} error={setSalik.error ? apiError(setSalik.error) : null} onClose={() => setAddSalik(false)} onSubmit={(v) => setSalik.mutate(v)} />
      <FormDialog open={!!reassign} title="Reassign fine to driver"
        fields={[{ name: 'driverId', label: 'Driver', type: 'select', required: true, options: driverOptions }]}
        submitting={reassignMut.isPending} error={reassignMut.error ? apiError(reassignMut.error) : null}
        onClose={() => setReassign(null)} onSubmit={(v) => reassignMut.mutate({ id: reassign.id, driverId: v.driverId as string })} />
      <ImportDialog open={importFines} resource="fines" label="Fines" onClose={() => setImportFines(false)} onImported={() => qc.invalidateQueries({ queryKey: ['fines'] })} />
    </Box>
  );
}
