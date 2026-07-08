import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, LinearProgress, Alert, Typography } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import RouteProgress, { RouteWithStops } from '../components/RouteProgress';

export default function StaffScreen() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isStaff = user?.role === 'STAFF';
  const { data, isLoading } = useQuery({
    queryKey: ['staff-screen'],
    queryFn: async () => (await api.get('/dashboard/staff')).data,
    enabled: isStaff,
  });

  const confirm = useMutation({
    mutationFn: async (routeId: string) => (await api.post('/roster/confirm', { routeId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-screen'] }),
  });

  if (!isStaff) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <PageHeader title="My Roster" subtitle="Staff mobile screen" />
        <Alert severity="info">
          This screen is for transport staff — it shows which vehicle/driver is picking them up and their route progress.
          Sign in with a staff account (Staff ID + PIN) to use it.
        </Alert>
      </Box>
    );
  }

  if (isLoading || !data) return <LinearProgress />;
  const routes = (data.routes ?? []) as RouteWithStops[];

  return (
    <Box>
      <PageHeader title="My Roster" subtitle="Today's pickup/drop route" />
      {routes.length === 0 && <Alert severity="info">You're not mapped to a route today.</Alert>}
      {routes.map((route) => (
        <Card key={route.id} sx={{ mb: 2 }}>
          <CardContent>
            <RouteProgress
              route={route}
              mode="staff"
              myEmployeeId={data.employeeId}
              onConfirm={() => confirm.mutate(route.id)}
              confirming={confirm.isPending}
            />
          </CardContent>
        </Card>
      ))}
      {confirm.isError && <Alert severity="error">Could not confirm pickup — please try again.</Alert>}
      {confirm.isSuccess && <Typography variant="caption" color="success.main">Pickup confirmed.</Typography>}
    </Box>
  );
}
