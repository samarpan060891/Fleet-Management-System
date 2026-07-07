import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, LinearProgress, Chip, Stack, Divider,
  ToggleButton, ToggleButtonGroup, Button, Alert,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';
import { fmtDate, fmtKm } from '../i18n';
import { useAuth } from '../auth/AuthContext';

interface Staff { employeeId: string; name: string; pickupPoint: string | null; status: string | null }
interface RouteT { id: string; code: string; name: string; scheduledTime: string | null; staff: Staff[] }

export default function DriverScreen() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDriver = user?.role === 'DRIVER';
  const { data, isLoading } = useQuery({
    queryKey: ['driver-screen'],
    queryFn: async () => (await api.get('/dashboard/driver')).data,
    enabled: isDriver,
  });

  // This screen is the driver's personal mobile view; nothing to show for other roles.
  if (!isDriver) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <PageHeader title="My Vehicle" subtitle="Driver mobile screen" />
        <Alert severity="info">
          This screen is for drivers — it shows a driver's own assigned vehicle, documents and route staff.
          Sign in with a driver account (e.g. <strong>driver@fleet.local</strong>) to use it.
        </Alert>
      </Box>
    );
  }
  const [marks, setMarks] = useState<Record<string, 'present' | 'absent'>>({});

  const save = useMutation({
    mutationFn: async (route: RouteT) => {
      const routeMarks = route.staff
        .map((s) => ({ employeeId: s.employeeId, status: marks[s.employeeId] ?? (s.status as 'present' | 'absent' | null) }))
        .filter((m) => m.status) as { employeeId: string; status: 'present' | 'absent' }[];
      return (await api.post('/attendance/mark', { routeId: route.id, date: new Date().toISOString(), marks: routeMarks })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-screen'] }),
  });

  if (isLoading || !data) return <LinearProgress />;
  const v = data.vehicle;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <PageHeader title="My Vehicle" subtitle="Today's assignment and staff" />

      {v ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography variant="h6">{v.plate}</Typography>
              <Chip size="small" label={v.status.replace(/_/g, ' ')} color={v.status === 'active' ? 'success' : 'warning'} />
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

      {(data.allocations ?? []).length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>My allocations today</Typography>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack spacing={1}>
                {(data.allocations as { id: string; type: string; status: string; startTime: string | null; destination: string | null }[]).map((a) => (
                  <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2">
                        {a.type === 'customer_delivery' ? 'Customer delivery' : a.type === 'store_delivery' ? 'Store delivery' : 'Staff pick & drop'}
                        {a.startTime ? ` · ${a.startTime}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{a.destination ?? '—'}</Typography>
                    </Box>
                    <Chip size="small" color={a.status === 'active' ? 'info' : 'default'} label={a.status} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
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
                  <Typography variant="body2">{d.docType.replace(/_/g, ' ')}</Typography>
                  <Chip size="small" label={fmtDate(d.expiryDate)} color={days < 0 ? 'error' : days <= 30 ? 'warning' : 'default'} variant="outlined" />
                </Box>
              );
            })}
            {(data.myDocuments ?? []).length === 0 && <Typography variant="body2" color="text.secondary">No documents.</Typography>}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Staff on my routes today — mark attendance</Typography>
      {(data.routes as RouteT[]).map((route) => (
        <Card key={route.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">{route.code} · {route.name}</Typography>
              {route.scheduledTime && <Chip size="small" label={route.scheduledTime} />}
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Stack spacing={1}>
              {route.staff.map((s) => {
                const current = marks[s.employeeId] ?? s.status;
                return (
                  <Box key={s.employeeId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="body2">{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.pickupPoint ?? '—'}</Typography>
                    </Box>
                    <ToggleButtonGroup size="small" exclusive value={current}
                      onChange={(_, val) => val && setMarks((m) => ({ ...m, [s.employeeId]: val }))}>
                      <ToggleButton value="present" color="success">Present</ToggleButton>
                      <ToggleButton value="absent" color="error">Absent</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                );
              })}
              {route.staff.length === 0 && <Typography variant="body2" color="text.secondary">No staff mapped.</Typography>}
            </Stack>
            {route.staff.length > 0 && (
              <Button sx={{ mt: 2 }} variant="contained" fullWidth onClick={() => save.mutate(route)} disabled={save.isPending}>
                Save attendance
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {save.isSuccess && <Alert severity="success">Attendance saved (marked by driver).</Alert>}
    </Box>
  );
}
