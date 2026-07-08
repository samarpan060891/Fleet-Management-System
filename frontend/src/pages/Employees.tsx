import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CrudListPage from '../components/CrudListPage';
import FormDialog, { FieldDef } from '../components/FormDialog';
import { api } from '../api/client';
import { apiError } from '../hooks/useLookups';

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', width: 200 },
  { field: 'staffId', headerName: 'Staff ID', width: 130 },
  { field: 'pickupPoint', headerName: 'Pickup point', width: 180 },
  { field: 'homeCamp', headerName: 'Home / camp', width: 180 },
  { field: 'phone', headerName: 'Phone', width: 150 },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', required: true, half: true },
  { name: 'staffId', label: 'Staff ID', required: true, half: true },
  { name: 'pickupPoint', label: 'Pickup point', half: true },
  { name: 'homeCamp', label: 'Home / camp', half: true },
  { name: 'phone', label: 'Phone', half: true },
];

export default function Employees() {
  const qc = useQueryClient();
  const [pinRow, setPinRow] = useState<any | null>(null);
  const setPin = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => (await api.post(`/employees/${id}/set-pin`, { pin })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setPinRow(null); },
  });

  return (
    <>
      <CrudListPage
        title="Employees" subtitle="Staff-transport passengers (mapped to routes) — set a PIN to enable their mobile roster screen"
        resource="employees" queryKey="employees" permission="employees" columns={columns} fields={fields} importable
        extraActions={(row) => [
          <GridActionsCellItem key="pin" icon={<VpnKeyIcon />} label="Set mobile PIN" showInMenu onClick={() => setPinRow(row)} />,
        ]}
      />
      <FormDialog
        open={!!pinRow}
        title={`Set mobile PIN for ${pinRow?.name ?? ''}`}
        fields={[{ name: 'pin', label: 'PIN (4-6 digits)', required: true, half: true }]}
        submitting={setPin.isPending}
        error={setPin.error ? apiError(setPin.error) : null}
        onClose={() => setPinRow(null)}
        onSubmit={(v) => setPin.mutate({ id: pinRow.id, pin: String(v.pin) })}
      />
    </>
  );
}
