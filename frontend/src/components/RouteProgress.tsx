import { Stepper, Step, StepLabel, StepContent, Box, Typography, Chip, Stack, Button, Link } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneIcon from '@mui/icons-material/Phone';

export interface StopEmployee {
  employeeId: string;
  name: string;
  phone: string | null;
  status: 'present' | 'absent' | null;
  reachedAt: string | null;
  confirmedAt: string | null;
}
export interface RouteStop {
  pickupPoint: string;
  sequence: number | null;
  employees: StopEmployee[];
}
export interface RouteWithStops {
  id: string;
  code: string;
  name: string;
  direction: string | null;
  scheduledTime: string | null;
  vehicle: { id: string; plate: string } | null;
  driver: { id: string; fullName: string; phone: string | null } | null;
  stops: RouteStop[];
}

const fmtTime = (d: string | null) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);

// Sequential route-progress stepper shared by the driver and staff mobile
// screens: one step per pickup point, in order, showing who boards/alights
// there and whether the vehicle has reached it yet. Driver mode adds a
// "mark reached" action per stop; staff mode highlights the viewer's own
// stop and adds a self "confirm pickup" action.
export default function RouteProgress({
  route, mode, myEmployeeId, onMarkReached, onConfirm, markingPoint, confirming,
}: {
  route: RouteWithStops;
  mode: 'driver' | 'staff';
  myEmployeeId?: string;
  onMarkReached?: (pickupPoint: string) => void;
  onConfirm?: () => void;
  markingPoint?: string | null;
  confirming?: boolean;
}) {
  const stopReached = (s: RouteStop) => s.employees.length > 0 && s.employees.every((e) => !!e.reachedAt);
  const activeIndex = route.stops.findIndex((s) => !stopReached(s));
  const myStop = myEmployeeId ? route.stops.find((s) => s.employees.some((e) => e.employeeId === myEmployeeId)) : undefined;
  const myself = myEmployeeId ? myStop?.employees.find((e) => e.employeeId === myEmployeeId) : undefined;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>{route.code} · {route.name}</Typography>
          {route.direction && <Typography variant="caption" color="text.secondary">{route.direction}</Typography>}
        </Box>
        {route.scheduledTime && <Chip size="small" label={route.scheduledTime} />}
      </Stack>

      {mode === 'staff' && (
        <Stack spacing={0.5} sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="body2">Vehicle: <strong>{route.vehicle?.plate ?? '—'}</strong></Typography>
          <Typography variant="body2">
            Driver: <strong>{route.driver?.fullName ?? '—'}</strong>
            {route.driver?.phone && (
              <Link href={`tel:${route.driver.phone}`} sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                <PhoneIcon sx={{ fontSize: 14 }} /> {route.driver.phone}
              </Link>
            )}
          </Typography>
        </Stack>
      )}

      <Stepper orientation="vertical" activeStep={activeIndex === -1 ? route.stops.length : activeIndex}>
        {route.stops.map((s) => {
          const reached = stopReached(s);
          const isMine = mode === 'staff' && myStop === s;
          return (
            <Step key={s.pickupPoint} completed={reached}>
              <StepLabel>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={isMine ? 700 : 400}>{s.pickupPoint}</Typography>
                  {isMine && <Chip size="small" color="primary" label="Your stop" />}
                </Stack>
              </StepLabel>
              <StepContent TransitionProps={isMine ? { in: true } : undefined}>
                <Stack spacing={0.75} sx={{ mb: 1 }}>
                  {s.employees.map((e) => (
                    <Stack key={e.employeeId} direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={e.employeeId === myEmployeeId ? 700 : 400}>{e.name}</Typography>
                        {mode === 'driver' && e.phone && (
                          <Link href={`tel:${e.phone}`} variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                            <PhoneIcon sx={{ fontSize: 12 }} /> {e.phone}
                          </Link>
                        )}
                      </Box>
                      {e.confirmedAt ? (
                        <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`Confirmed ${fmtTime(e.confirmedAt)}`} />
                      ) : e.reachedAt ? (
                        <Chip size="small" color="warning" label={`Reached ${fmtTime(e.reachedAt)}`} />
                      ) : (
                        <Chip size="small" variant="outlined" label="Pending" />
                      )}
                    </Stack>
                  ))}
                </Stack>
                {mode === 'driver' && onMarkReached && (
                  <Button size="small" variant={reached ? 'outlined' : 'contained'} disabled={reached || markingPoint === s.pickupPoint}
                    onClick={() => onMarkReached(s.pickupPoint)}>
                    {reached ? 'Reached' : markingPoint === s.pickupPoint ? 'Marking…' : 'Mark reached'}
                  </Button>
                )}
                {mode === 'staff' && isMine && onConfirm && (
                  <Button size="small" variant={myself?.confirmedAt ? 'outlined' : 'contained'} disabled={!!myself?.confirmedAt || confirming}
                    onClick={onConfirm}>
                    {myself?.confirmedAt ? 'Confirmed' : confirming ? 'Confirming…' : 'Confirm pickup'}
                  </Button>
                )}
              </StepContent>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
