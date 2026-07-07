import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, Grid, Chip, LinearProgress, Stack } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';

interface Route {
  id: string; code: string; name: string; scheduledTime: string | null;
  vehicle: { plateNumber: string; plateEmirate: string } | null;
  driver: { fullName: string } | null;
  _count: { employees: number };
}

export default function Transport() {
  const { data, isLoading } = useQuery({ queryKey: ['routes'], queryFn: async () => (await api.get('/transport/routes')).data });
  if (isLoading) return <LinearProgress />;
  const routes = (data ?? []) as Route[];

  return (
    <Box>
      <PageHeader title="Staff Transport" subtitle="Routes, vehicle/driver assignment and rosters" />
      <Grid container spacing={2}>
        {routes.map((r) => {
          const unassigned = !r.vehicle || !r.driver;
          return (
            <Grid item xs={12} md={6} lg={4} key={r.id}>
              <Card sx={{ borderLeft: `4px solid ${unassigned ? '#c62828' : '#0f6e6e'}` }}>
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
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
