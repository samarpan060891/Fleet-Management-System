import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, LinearProgress, Chip, Stack } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency } from '../i18n';

const SEV_COLORS: Record<string, string> = { red: '#c62828', amber: '#ed9c28', green: '#2e7d32' };
const STATUS_COLORS: Record<string, string> = { active: '#2e7d32', in_workshop: '#ed9c28', vor: '#c62828', idle: '#90a4ae', disposed: '#546e7a' };
const ALLOC_LABEL: Record<string, string> = { customer_delivery: 'Customer delivery', store_delivery: 'Store delivery', staff_transport: 'Staff pick & drop' };

function Gauge({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  const color = pct >= 70 ? '#2e7d32' : pct >= 40 ? '#ed9c28' : '#c62828';
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color }}>{pct}%</Typography>
        <LinearProgress variant="determinate" value={Math.min(100, pct)} sx={{ mt: 1, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: color } }} />
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard')).data });
  if (isLoading || !data) return <LinearProgress />;

  const availability = data.availability as Record<string, number>;
  const statusData = Object.entries(availability).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v, key: k }));
  const sev = (data.alertsBySeverity as { severity: string; _count: number }[]) || [];
  const breakdown = [
    { name: 'Fuel', value: data.mtdBreakdown.fuel },
    { name: 'Maintenance', value: data.mtdBreakdown.maintenance },
    { name: 'Fines', value: data.mtdBreakdown.fines },
  ];
  const alloc = (data.allocationsToday as { type: string; count: number }[]) || [];
  const u = data.utilization;
  const a = data.assets;

  return (
    <Box>
      <PageHeader title="Fleet Manager Cockpit" subtitle="Live overview across the fleet" />

      {/* Row 1 — operational KPIs */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}><StatCard label="Active vehicles" value={availability.active ?? 0} color="#2e7d32" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="In workshop / VOR" value={(availability.in_workshop ?? 0) + (availability.vor ?? 0)} color="#ed9c28" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Compliance due (30d)" value={data.complianceExpiring30d} color="#c62828" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="MTD cost" value={fmtCurrency(data.mtdCost)} sub="fuel + maintenance + fines" /></Grid>
      </Grid>

      {/* Row 2 — utilization + asset value */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}><Gauge label="Fleet utilization (today)" pct={u.fleetPct} sub={`${u.vehiclesAllocated}/${u.activeVehicles} vehicles allocated`} /></Grid>
        <Grid item xs={6} md={3}><Gauge label="Driver utilization (today)" pct={u.driverPct} sub={`${u.driversAllocated}/${u.activeDrivers} drivers allocated`} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Asset value (purchased)" value={fmtCurrency(a.totalPurchaseValue)} sub="total purchase cost" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Net book value" value={fmtCurrency(a.totalBookValue)} color="#0f6e6e" sub={`after ${fmtCurrency(a.totalDepreciation)} depreciation`} /></Grid>
      </Grid>

      {/* Row 3 — charts + allocations */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Fleet availability</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label>
                    {statusData.map((s) => <Cell key={s.key} fill={STATUS_COLORS[s.key] ?? '#90a4ae'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Today's allocations</Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {alloc.length === 0 && <Typography variant="body2" color="text.secondary">No allocations today.</Typography>}
                {alloc.map((x) => (
                  <Box key={x.type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">{ALLOC_LABEL[x.type] ?? x.type}</Typography>
                    <Chip size="small" color="primary" label={x.count} />
                  </Box>
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">Open alerts</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                {['red', 'amber', 'green'].map((s) => (
                  <Chip key={s} size="small" label={`${s.toUpperCase()}: ${sev.find((x) => x.severity === s)?._count ?? 0}`} sx={{ bgcolor: SEV_COLORS[s], color: '#fff' }} />
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Vehicles due for PM: <strong>{data.pmDue}</strong> · Payables outstanding: <strong>{fmtCurrency(data.payablesOutstanding)}</strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>MTD cost breakdown</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={breakdown}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Bar dataKey="value" fill="#0f6e6e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
