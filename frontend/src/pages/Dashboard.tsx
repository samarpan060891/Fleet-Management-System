import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, LinearProgress, Chip, Stack } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency } from '../i18n';

const SEV_COLORS: Record<string, string> = { red: '#c62828', amber: '#ed9c28', green: '#2e7d32' };
const STATUS_COLORS: Record<string, string> = { active: '#2e7d32', in_workshop: '#ed9c28', vor: '#c62828', idle: '#90a4ae', disposed: '#546e7a' };
const ALLOC_LABEL: Record<string, string> = { customer_delivery: 'Customer delivery', store_delivery: 'Store delivery', staff_transport: 'Staff pick & drop' };

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`;
};
const pct = (cur: number, base: number | undefined) => (base ? ((cur - base) / base) * 100 : null);

// Delta indicator — for costs, up = worse (red), down = better (green).
function Delta({ label, value }: { label: string; value: number | null }) {
  if (value == null) return <Typography variant="caption" color="text.secondary">{label}: —</Typography>;
  const up = value >= 0;
  return (
    <Typography variant="caption" sx={{ color: up ? 'error.main' : 'success.main', display: 'inline-flex', alignItems: 'center', mr: 1 }}>
      {label}: {up ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
      {Math.abs(value).toFixed(0)}%
    </Typography>
  );
}

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

function CostCard({ label, value, dMonth, dYear }: { label: string; value: number; dMonth: number | null; dYear: number | null }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label} (this month)</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtCurrency(value)}</Typography>
        <Box sx={{ mt: 1 }}>
          <Delta label="vs last mo" value={dMonth} />
          <Delta label="vs last yr" value={dYear} />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard')).data });
  const trends = useQuery({ queryKey: ['cost-trends'], queryFn: async () => (await api.get('/dashboard/cost-trends', { params: { months: 24 } })).data });

  if (isLoading || !data) return <LinearProgress />;

  const availability = data.availability as Record<string, number>;
  const statusData = Object.entries(availability).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v, key: k }));
  const sev = (data.alertsBySeverity as { severity: string; _count: number }[]) || [];
  const alloc = (data.allocationsToday as { type: string; count: number }[]) || [];
  const u = data.utilization;
  const a = data.assets;
  const age = data.fleetAge;
  const exp = data.experience;

  const t = (trends.data ?? []) as { month: string; fuel: number; maintenance: number; compliance: number; total: number }[];
  const cur = t[t.length - 1];
  const prev = t[t.length - 2];
  const yearAgo = t[t.length - 13];
  const trend12 = t.slice(-12).map((x) => ({ ...x, label: monthLabel(x.month) }));
  const yoy = t.slice(-12).map((x, i) => {
    const idx = t.length - 12 + i;
    const p = t[idx - 12];
    return { label: monthLabel(x.month).slice(0, 3), 'This year': x.total, 'Last year': p ? p.total : 0 };
  });

  return (
    <Box>
      <PageHeader title="Fleet Manager Cockpit" subtitle="Live overview across the fleet" />

      {/* Operational KPIs */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}><StatCard label="Active vehicles" value={availability.active ?? 0} color="#2e7d32" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="In workshop / VOR" value={(availability.in_workshop ?? 0) + (availability.vor ?? 0)} color="#ed9c28" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Compliance due (30d)" value={data.complianceExpiring30d} color="#c62828" /></Grid>
        <Grid item xs={6} md={3}><StatCard label="MTD cost" value={fmtCurrency(data.mtdCost)} sub="fuel + maintenance + fines" /></Grid>
      </Grid>

      {/* Utilization + asset value */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}><Gauge label="Fleet utilization (today)" pct={u.fleetPct} sub={`${u.vehiclesAllocated}/${u.activeVehicles} vehicles`} /></Grid>
        <Grid item xs={6} md={3}><Gauge label="Driver utilization (today)" pct={u.driverPct} sub={`${u.driversAllocated}/${u.activeDrivers} drivers`} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Asset value (purchased)" value={fmtCurrency(a.totalPurchaseValue)} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Net book value" value={fmtCurrency(a.totalBookValue)} color="#0f6e6e" sub={`after ${fmtCurrency(a.totalDepreciation)} dep.`} /></Grid>
      </Grid>

      {/* Fleet age + experience */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Fleet age</Typography>
              <Stack direction="row" spacing={4} sx={{ mb: 1 }}>
                <Box><Typography variant="h4" fontWeight={700}>{age.avgModelYearAge}</Typography><Typography variant="caption" color="text.secondary">avg vehicle age (yrs)</Typography></Box>
                <Box><Typography variant="h4" fontWeight={700}>{age.avgInServiceAge}</Typography><Typography variant="caption" color="text.secondary">avg in-service (yrs)</Typography></Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {Object.entries(age.distribution as Record<string, number>).map(([band, n]) => (
                  <Chip key={band} size="small" variant="outlined" label={`${band}y: ${n}`} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Fleet experience</Typography>
              <Stack direction="row" spacing={4} flexWrap="wrap">
                <Box><Typography variant="h4" fontWeight={700}>{exp.avgDriverTenureYears}</Typography><Typography variant="caption" color="text.secondary">avg driver tenure (yrs)</Typography></Box>
                <Box><Typography variant="h4" fontWeight={700}>{(exp.avgVehicleOdometer / 1000).toFixed(0)}k</Typography><Typography variant="caption" color="text.secondary">avg vehicle km</Typography></Box>
                <Box><Typography variant="h4" fontWeight={700}>{(exp.avgKmPerYear / 1000).toFixed(1)}k</Typography><Typography variant="caption" color="text.secondary">avg km / year</Typography></Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly cost cards with deltas */}
      {cur && (
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} md={4}><CostCard label="Fuel cost" value={cur.fuel} dMonth={pct(cur.fuel, prev?.fuel)} dYear={pct(cur.fuel, yearAgo?.fuel)} /></Grid>
          <Grid item xs={12} md={4}><CostCard label="Maintenance cost" value={cur.maintenance} dMonth={pct(cur.maintenance, prev?.maintenance)} dYear={pct(cur.maintenance, yearAgo?.maintenance)} /></Grid>
          <Grid item xs={12} md={4}><CostCard label="Compliance cost" value={cur.compliance} dMonth={pct(cur.compliance, prev?.compliance)} dYear={pct(cur.compliance, yearAgo?.compliance)} /></Grid>
        </Grid>
      )}

      {/* Trend + YoY charts */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Monthly cost trend (12 months)</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend12}>
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="fuel" stroke="#0f6e6e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="maintenance" stroke="#ed9c28" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="compliance" stroke="#1565c0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Year-on-year (total cost)</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={yoy}>
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Last year" fill="#b0bec5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="This year" fill="#0f6e6e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Availability + allocations */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
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
        <Grid item xs={12} md={6}>
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
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['red', 'amber', 'green'].map((s) => (
                  <Chip key={s} size="small" label={`${s.toUpperCase()}: ${sev.find((x) => x.severity === s)?._count ?? 0}`} sx={{ bgcolor: SEV_COLORS[s], color: '#fff' }} />
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Vehicles due for PM: <strong>{data.pmDue}</strong> · Payables: <strong>{fmtCurrency(data.payablesOutstanding)}</strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
