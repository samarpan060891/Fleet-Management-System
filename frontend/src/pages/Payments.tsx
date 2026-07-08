import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Card, Chip, Button, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PaymentsIcon from '@mui/icons-material/Payments';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import { fmtCurrency, fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';
import { titleCase } from '../lib/text';

const CATEGORY = ['maintenance', 'tyre', 'insurance', 'permit', 'branding', 'salik', 'other'];
const STATUS_COLOR: Record<string, 'error' | 'warning' | 'success'> = { unpaid: 'error', partial: 'warning', paid: 'success' };

export default function Payments() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vendorOptions, vehicleOptions } = useLookups();
  const [addOpen, setAddOpen] = useState(false);
  const [payRow, setPayRow] = useState<any | null>(null);

  const list = useQuery({ queryKey: ['payments'], queryFn: async () => (await api.get('/payments', { params: { pageSize: 300 } })).data });
  const summary = useQuery({ queryKey: ['payments-summary'], queryFn: async () => (await api.get('/payments/summary')).data });

  const inv = () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['payments-summary'] }); };
  const create = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/payments', b)).data, onSuccess: () => { inv(); setAddOpen(false); } });
  const pay = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/payments/${id}/pay`, b)).data, onSuccess: () => { inv(); setPayRow(null); } });

  const fields: FieldDef[] = [
    { name: 'vendorId', label: 'Vendor / garage', type: 'select', required: true, half: true, options: vendorOptions },
    { name: 'category', label: 'Category', type: 'select', required: true, half: true, optionListKey: 'payments.category', options: CATEGORY.map((c) => ({ value: c, label: titleCase(c) })) },
    { name: 'vehicleId', label: 'Vehicle (optional)', type: 'select', half: true, options: vehicleOptions },
    { name: 'invoiceNumber', label: 'Invoice number', half: true },
    { name: 'invoiceDate', label: 'Invoice date', type: 'date', required: true, half: true },
    { name: 'dueDate', label: 'Due date', type: 'date', half: true },
    { name: 'amount', label: 'Amount (AED)', type: 'number', required: true, half: true },
    { name: 'notes', label: 'Notes', type: 'multiline' },
  ];

  const columns: GridColDef[] = [
    { field: 'vendor', headerName: 'Vendor', width: 180, valueGetter: (_v, r) => r.vendor?.name ?? '—' },
    { field: 'category', headerName: 'Category', width: 120, renderCell: (p) => <Chip size="small" variant="outlined" label={titleCase(p.value as string)} /> },
    { field: 'vehicle', headerName: 'Vehicle', width: 130, valueGetter: (_v, r) => r.vehicle?.plateNumber ?? '—' },
    { field: 'invoiceNumber', headerName: 'Invoice #', width: 120 },
    { field: 'amount', headerName: 'Amount', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'outstanding', headerName: 'Outstanding', width: 120, valueFormatter: (v) => fmtCurrency(v as number) },
    { field: 'dueDate', headerName: 'Due', width: 110, valueFormatter: (v) => fmtDate(v as string) },
    { field: 'daysOverdue', headerName: 'Days overdue', width: 130, renderCell: (p) => {
      const d = p.value as number | null;
      if (d == null || d <= 0) return <Chip size="small" color="success" variant="outlined" label={d == null ? '—' : 'on time'} />;
      return <Chip size="small" color={d > 30 ? 'error' : 'warning'} label={`${d}d`} />;
    } },
    { field: 'status', headerName: 'Status', width: 100, renderCell: (p) => <Chip size="small" color={STATUS_COLOR[p.value as string]} label={p.value as string} /> },
    { field: '__a', type: 'actions', headerName: '', width: 60, getActions: (p) => (can('payments:update') && p.row.status !== 'paid')
      ? [<GridActionsCellItem key="pay" icon={<PaymentsIcon />} label="Record payment" onClick={() => setPayRow(p.row)} />] : [] },
  ];

  const s = summary.data;

  return (
    <Box>
      <PageHeader
        title="Vendor Payments" subtitle="Payables to garages & vendors — outstanding amounts and due-days aging"
        action={can('payments:create') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add invoice</Button>}
      />
      {s && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={2.4}><StatCard label="Total outstanding" value={fmtCurrency(s.totalOutstanding)} color="#c62828" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="Not due yet" value={fmtCurrency(s.aging.current)} color="#2e7d32" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="1–30 days" value={fmtCurrency(s.aging.d1_30)} color="#ed9c28" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="31–60 days" value={fmtCurrency(s.aging.d31_60)} color="#ef6c00" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="60+ days" value={fmtCurrency(s.aging.d60plus)} color="#c62828" /></Grid>
        </Grid>
      )}
      <Card>
        <DataGrid autoHeight rows={list.data?.data ?? []} columns={columns} loading={list.isLoading} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0 }} />
      </Card>

      <FormDialog open={addOpen} title="Add vendor invoice" fields={fields}
        submitting={create.isPending} error={create.error ? apiError(create.error) : null}
        onClose={() => setAddOpen(false)} onSubmit={(v) => create.mutate(v)} />
      <FormDialog open={!!payRow} title={`Record payment${payRow ? ` — ${fmtCurrency(payRow.outstanding)} outstanding` : ''}`}
        fields={[
          { name: 'paidAmount', label: 'Amount paid (AED)', type: 'number', required: true, half: true },
          { name: 'paymentDate', label: 'Payment date', type: 'date', required: true, half: true },
        ]}
        submitting={pay.isPending} error={pay.error ? apiError(pay.error) : null}
        onClose={() => setPayRow(null)} onSubmit={(v) => pay.mutate({ id: payRow.id, b: v })} />
    </Box>
  );
}
