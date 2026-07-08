import { useState } from 'react';
import { titleCase } from '../lib/text';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, LinearProgress, Chip, Stack, Button, Alert,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { fmtDate, fmtKm } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import RouteProgress, { RouteWithStops } from '../components/RouteProgress';

interface Allocation {
  id: string; type: string; status: string; date: string;
  startTime: string | null; endTime: string | null; destination: string | null;
}
interface PastTrip {
  id: string; type: string; status: string; date: string;
  startTime: string | null; endTime: string | null;
  tripStartAt: string | null; tripEndAt: string | null; waitingMinutes: number | null;
  destination: string | null;
}

const TRIP_TYPE_LABEL: Record<string, string> = {
  customer_delivery: 'Customer delivery', store_delivery: 'Store delivery', staff_transport: 'Staff pick & drop',
};
const fmtTime = (d: string | null) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);

function TripRow({ trip }: { trip: Allocation }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
      <Box>
        <Typography variant="body2">
          {TRIP_TYPE_LABEL[trip.type] ?? titleCase(trip.type)}
          {trip.startTime ? ` · ${trip.startTime}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">{fmtDate(trip.date)} · {trip.destination ?? '—'}</Typography>
      </Box>
      <Chip size="small" color={trip.status === 'active' ? 'info' : 'default'} label={titleCase(trip.status)} />
    </Box>
  );
}

function PastTripCard({ trip }: { trip: PastTrip }) {
  const started = fmtTime(trip.tripStartAt);
  const ended = fmtTime(trip.tripEndAt);
  const durationMin = trip.tripStartAt && trip.tripEndAt
    ? Math.round((new Date(trip.tripEndAt).getTime() - new Date(trip.tripStartAt).getTime()) / 60000)
    : null;
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid #eee', '&:last-child': { borderBottom: 0 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{TRIP_TYPE_LABEL[trip.type] ?? titleCase(trip.type)}</Typography>
          <Typography variant="caption" color="text.secondary">{trip.destination ?? '—'}</Typography>
        </Box>
        <Chip size="small" color={trip.status === 'completed' ? 'success' : 'default'} label={titleCase(trip.status)} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {fmtDate(trip.date)}
        {started && ended ? ` · ${started} – ${ended} (${durationMin} min)` : trip.startTime ? ` · planned ${trip.startTime}${trip.endTime ? `–${trip.endTime}` : ''}` : ''}
        {trip.waitingMinutes ? ` · waiting ${trip.waitingMinutes} min` : ''}
      </Typography>
    </Box>
  );
}

export default function DriverScreen() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDriver = user?.role === 'DRIVER';
  const { data, isLoading } = useQuery({
    queryKey: ['driver-screen'],
    queryFn: async () => (await api.get('/dashboard/driver')).data,
    enabled: isDriver,
  });
  const [markingRoute, setMarkingRoute] = useState<string | null>(null);
  const [markingPoint, setMarkingPoint] = useState<string | null>(null);

  const markReached = useMutation({
    mutationFn: async ({ routeId, pickupPoint }: { routeId: string; pickupPoint: string }) => {
      setMarkingRoute(routeId);
      setMarkingPoint(pickupPoint);
      return (await api.post('/roster/reached', { routeId, pickupPoint })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-screen'] }),
    onSettled: () => { setMarkingRoute(null); setMarkingPoint(null); },
  });
  const completeRoute = useMutation({
    mutationFn: async (routeId: string) => (await api.post(`/roster/routes/${routeId}/complete`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-screen'] }),
  });

  // This screen is the driver's personal mobile view; nothing to show for other roles.
  if (!isDriver) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <PageHeader title="My Vehicle" subtitle="Driver mobile screen" />
        <Alert severity="info">
          This screen is for drivers — it shows a driver's own assigned vehicle, documents and route progress.
          Sign in with a driver account (e.g. <strong>driver@fleet.local</strong>) to use it.
        </Alert>
      </Box>
    );
  }

  if (isLoading || !data) return <LinearProgress />;
  const v = data.vehicle;
  const allocations = (data.allocations ?? []) as Allocation[];
  const ongoing = allocations.filter((a) => a.status === 'active');
  const upcoming = allocations.filter((a) => a.status === 'planned');
  const routes = (data.routes ?? []) as RouteWithStops[];

  return (
    <Box>
      <PageHeader title="My Vehicle" subtitle="Today's assignment and route" />

      {v ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography variant="h6">{v.plate}</Typography>
              <Chip size="small" label={titleCase(v.status)} color={v.status === 'active' ? 'success' : 'warning'} />
            </Stack>
            <Typography variant="body2" color="text.secondary">Odometer: {fmtKm(v.odometer)}</Typography>
            {v.pmState?.nextPmDate && (
              <Typography variant="body2" color="text.secondary">Next PM: {fmtDate(v.pmState.nextPmDate)} / {fmtKm(v.pmState.nextPmKm)}</Typography>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>No vehicle currently assigned to you.</Alert>
      )}

      {ongoing.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Ongoing trip</Typography>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack divider={<Box sx={{ borderBottom: '1px solid #eee' }} />}>
                {ongoing.map((a) => <TripRow key={a.id} trip={a} />)}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Upcoming trips</Typography>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack divider={<Box sx={{ borderBottom: '1px solid #eee' }} />}>
                {upcoming.map((a) => <TripRow key={a.id} trip={a} />)}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {routes.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>My route today</Typography>
          {routes.map((route) => {
            const allReached = route.stops.length > 0 && route.stops.every((s) => s.employees.every((e) => !!e.reachedAt));
            return (
              <Card key={route.id} sx={{ mb: 2 }}>
                <CardContent>
                  <RouteProgress
                    route={route}
                    mode="driver"
                    onMarkReached={(pickupPoint) => markReached.mutate({ routeId: route.id, pickupPoint })}
                    markingPoint={markingRoute === route.id ? markingPoint : null}
                  />
                  <Button sx={{ mt: 2 }} variant="contained" fullWidth color="secondary"
                    disabled={!allReached || completeRoute.isPending}
                    onClick={() => completeRoute.mutate(route.id)}>
                    {completeRoute.isPending ? 'Completing…' : 'Complete route / final drop-off'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      <Typography variant="subtitle2" sx={{ mb: 1 }}>My documents</Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={0.5}>
            {(data.myDocuments ?? []).map((d: { id: string; docType: string; expiryDate: string }) => {
              const days = Math.round((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
              return (
                <Box key={d.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{titleCase(d.docType)}</Typography>
                  <Chip size="small" label={fmtDate(d.expiryDate)} color={days < 0 ? 'error' : days <= 30 ? 'warning' : 'default'} variant="outlined" />
                </Box>
              );
            })}
            {(data.myDocuments ?? []).length === 0 && <Typography variant="body2" color="text.secondary">No documents.</Typography>}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>My past trips</Typography>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {(data.pastTrips as PastTrip[] ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">No past trips yet.</Typography>
          ) : (
            (data.pastTrips as PastTrip[]).map((trip) => <PastTripCard key={trip.id} trip={trip} />)
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
