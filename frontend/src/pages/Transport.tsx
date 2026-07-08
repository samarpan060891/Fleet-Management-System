import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowModel } from '@mui/x-data-grid';
import { Box, Card, CardContent, Typography, Grid, Chip, LinearProgress, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import ImportDialog from '../components/ImportDialog';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

interface Route {
  id: string; code: string; name: string; scheduledTime: string | null;
  vehicle: { plateNumber: string; plateEmirate: string } | null;
  driver: { fullName: string } | null;
  _count: { employees: number };
}
interface RouteEmployeeRow {
  id: string; employeeId: string; pickupPoint: string | null; sequence: number | null;
  employee: { name: string; staffId: string; pickupPoint: string | null; phone: string | null };
}

// Editable stops table for a single route — pickup point and stop order are
// edited inline (double-click a cell), so setting up a route with many
// riders doesn't mean reopening a one-at-a-time dialog for each of them.
function RosterDialog({ route, onClose }: { route: Route; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { employeeOptions } = useLookups();
  const canEdit = can('transport:update');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['route-detail', route.id],
    queryFn: async () => (await api.get(`/transport/routes/${route.id}`)).data,
  });
  const inv = () => qc.invalidateQueries({ queryKey: ['route-detail', route.id] });

  const update = useMutation({
    mutationFn: async ({ mapId, body }: { mapId: string; body: { pickupPoint?: string; sequence?: number | null } }) =>
      (await api.patch(`/transport/routes/${route.id}/employees/${mapId}`, body)).data,
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (mapId: string) => (await api.delete(`/transport/routes/${route.id}/employees/${mapId}`)).data,
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ['routes'] }); },
  });
  const add = useMutation({
    mutationFn: async (b: Record<string, unknown>) => (await api.post(`/transport/routes/${route.id}/employees`, b)).data,
    onSuccess: () => { inv(); qc.invalidateQueries({ queryKey: ['routes'] }); setAddOpen(false); },
  });

  const rows = (data?.employees ?? []) as RouteEmployeeRow[];

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', width: 160, valueGetter: (_v, r) => r.employee.name },
    { field: 'staffId', headerName: 'Staff ID', width: 110, valueGetter: (_v, r) => r.employee.staffId },
    { field: 'pickupPoint', headerName: 'Pickup point', width: 200, editable: canEdit,
      valueGetter: (_v, r) => r.pickupPoint ?? r.employee.pickupPoint ?? '' },
    { field: 'sequence', headerName: 'Stop order', width: 110, editable: canEdit, type: 'number' },
    { field: '__a', type: 'actions', headerName: 'Actions', width: 90, getActions: (p) => canEdit ? [
      <GridActionsCellItem key="d" icon={<DeleteIcon fontSize="small" />} label="Remove from route" onClick={() => { if (confirm(`Remove ${p.row.employee.name} from ${route.code}?`)) remove.mutate(p.row.id); }} />,
    ] : [] },
  ];

  const processRowUpdate = async (newRow: GridRowModel, oldRow: GridRowModel) => {
    const body: { pickupPoint?: string; sequence?: number | null } = {};
    if (newRow.pickupPoint !== oldRow.pickupPoint) body.pickupPoint = newRow.pickupPoint || undefined;
    if (newRow.sequence !== oldRow.sequence) body.sequence = newRow.sequence === '' || newRow.sequence == null ? null : Number(newRow.sequence);
    if (Object.keys(body).length) await update.mutateAsync({ mapId: newRow.id as string, body });
    return newRow;
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Roster — {route.code} · {route.name}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Double-click a cell to edit. Employees sharing the same pickup point + stop order are grouped into one stop on the driver/staff route-progress screen.
        </Typography>
        {isLoading ? <LinearProgress /> : (
          <DataGrid
            autoHeight rows={rows} columns={columns} getRowId={(r) => r.id}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={() => undefined}
            hideFooter disableRowSelectionOnClick sx={{ border: 0 }}
          />
        )}
        {canEdit && (
          <Button sx={{ mt: 2 }} size="small" variant="outlined" startIcon={<GroupAddIcon />} onClick={() => setAddOpen(true)}>
            Add employee to this route
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <FormDialog
        open={addOpen}
        title={`Add employee to ${route.code}`}
        fields={[
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
          { name: 'pickupPoint', label: 'Pickup point (optional override)', half: true },
          { name: 'sequence', label: 'Stop order (1, 2, 3…)', type: 'number', half: true },
          { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true, half: true },
        ]}
        submitting={add.isPending}
        error={add.error ? apiError(add.error) : null}
        onClose={() => setAddOpen(false)}
        onSubmit={(v) => add.mutate(v)}
      />
    </Dialog>
  );
}

export default function Transport() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, driverOptions } = useLookups();
  const [addRoute, setAddRoute] = useState(false);
  const [assign, setAssign] = useState<Route | null>(null);
  const [rosterRoute, setRosterRoute] = useState<Route | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['routes'], queryFn: async () => (await api.get('/transport/routes')).data });
  const inv = () => qc.invalidateQueries({ queryKey: ['routes'] });

  const createRoute = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/transport/routes', b)).data, onSuccess: () => { inv(); setAddRoute(false); } });
  const assignMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/transport/routes/${id}/assign`, b)).data, onSuccess: () => { inv(); setAssign(null); } });

  const routeFields: FieldDef[] = [
    { name: 'code', label: 'Route code', required: true, half: true },
    { name: 'name', label: 'Route name', required: true, half: true },
    { name: 'direction', label: 'Direction (e.g. Camp → Warehouse)', half: true },
    { name: 'scheduledTime', label: 'Scheduled time (e.g. 06:30)', half: true },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', half: true, options: vehicleOptions },
    { name: 'driverId', label: 'Driver', type: 'select', half: true, options: driverOptions },
  ];

  if (isLoading) return <LinearProgress />;
  const routes = (data ?? []) as Route[];
  const canEdit = can('transport:update');

  return (
    <Box>
      <PageHeader
        title="Staff Transport" subtitle="Routes, vehicle/driver assignment and rosters"
        action={
          <Stack direction="row" spacing={1}>
            {canEdit && <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>Import roster</Button>}
            {can('transport:create') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddRoute(true)}>Add route</Button>}
          </Stack>
        }
      />
      <Grid container spacing={2}>
        {routes.map((r) => {
          const unassigned = !r.vehicle || !r.driver;
          return (
            <Grid item xs={12} md={6} lg={4} key={r.id}>
              <Card sx={{ borderLeft: `4px solid ${unassigned ? '#c62828' : '#0f6e6e'}`, height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">{r.code}</Typography>
                    {r.scheduledTime && <Chip size="small" label={r.scheduledTime} />}
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>{r.name}</Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="body2">Vehicle: {r.vehicle ? `${r.vehicle.plateNumber} (${r.vehicle.plateEmirate})` : <Chip size="small" color="error" icon={<WarningIcon />} label="unassigned" />}</Typography>
                    <Typography variant="body2">Driver: {r.driver?.fullName ?? <Chip size="small" color="error" icon={<WarningIcon />} label="unassigned" />}</Typography>
                    <Typography variant="body2">Staff mapped: <strong>{r._count.employees}</strong></Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                    {canEdit && <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setAssign(r)}>Assign</Button>}
                    <Button size="small" variant="outlined" startIcon={<GroupAddIcon />} onClick={() => setRosterRoute(r)}>
                      {canEdit ? 'Manage roster' : 'View roster'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <FormDialog open={addRoute} title="Add route" fields={routeFields} submitting={createRoute.isPending} error={createRoute.error ? apiError(createRoute.error) : null} onClose={() => setAddRoute(false)} onSubmit={(v) => createRoute.mutate(v)} />
      <FormDialog open={!!assign} title={`Assign ${assign?.code ?? ''}`}
        fields={[
          { name: 'vehicleId', label: 'Vehicle', type: 'select', half: true, options: vehicleOptions },
          { name: 'driverId', label: 'Driver', type: 'select', half: true, options: driverOptions },
          { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true, half: true },
        ]}
        submitting={assignMut.isPending} error={assignMut.error ? apiError(assignMut.error) : null}
        onClose={() => setAssign(null)} onSubmit={(v) => assignMut.mutate({ id: assign!.id, b: v })} />
      {rosterRoute && <RosterDialog route={rosterRoute} onClose={() => setRosterRoute(null)} />}
      <ImportDialog open={importOpen} resource="route-roster" label="Route Roster (Pickup Points)"
        onClose={() => setImportOpen(false)} onImported={inv} />
    </Box>
  );
}
