import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, Grid, Chip, LinearProgress, Stack, Button } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import FormDialog, { FieldDef } from '../components/FormDialog';
import { useAuth } from '../auth/AuthContext';
import { useLookups, apiError } from '../hooks/useLookups';

interface Route {
  id: string; code: string; name: string; scheduledTime: string | null;
  vehicle: { plateNumber: string; plateEmirate: string } | null;
  driver: { fullName: string } | null;
  _count: { employees: number };
}

export default function Transport() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { vehicleOptions, driverOptions, employeeOptions } = useLookups();
  const [addRoute, setAddRoute] = useState(false);
  const [assign, setAssign] = useState<Route | null>(null);
  const [addStaff, setAddStaff] = useState<Route | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['routes'], queryFn: async () => (await api.get('/transport/routes')).data });
  const inv = () => qc.invalidateQueries({ queryKey: ['routes'] });

  const createRoute = useMutation({ mutationFn: async (b: Record<string, unknown>) => (await api.post('/transport/routes', b)).data, onSuccess: () => { inv(); setAddRoute(false); } });
  const assignMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/transport/routes/${id}/assign`, b)).data, onSuccess: () => { inv(); setAssign(null); } });
  const staffMut = useMutation({ mutationFn: async ({ id, b }: { id: string; b: any }) => (await api.post(`/transport/routes/${id}/employees`, b)).data, onSuccess: () => { inv(); setAddStaff(null); } });

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
        action={can('transport:create') && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddRoute(true)}>Add route</Button>}
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
                  {canEdit && (
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setAssign(r)}>Assign</Button>
                      <Button size="small" variant="outlined" startIcon={<GroupAddIcon />} onClick={() => setAddStaff(r)}>Add staff</Button>
                    </Stack>
                  )}
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
      <FormDialog open={!!addStaff} title={`Add staff to ${addStaff?.code ?? ''}`}
        fields={[
          { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
          { name: 'pickupPoint', label: 'Pickup point (optional override)', half: true },
          { name: 'sequence', label: 'Stop order (1, 2, 3…) — for the route progress screen', type: 'number', half: true },
          { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true, half: true },
        ]}
        submitting={staffMut.isPending} error={staffMut.error ? apiError(staffMut.error) : null}
        onClose={() => setAddStaff(null)} onSubmit={(v) => staffMut.mutate({ id: addStaff!.id, b: v })} />
    </Box>
  );
}
