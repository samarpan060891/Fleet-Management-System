import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, LinearProgress, Chip, Stack, Divider } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SpeedIcon from '@mui/icons-material/Speed';
import BuildIcon from '@mui/icons-material/Build';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency } from '../i18n';
import { titleCase } from '../lib/text';

const SEV_COLORS: Record<string, string> = { red: '#c62828', amber: '#ed9c28', green: '#2e7d32' };
const STATUS_COLORS: Record<string, string> = { active: '#2e7d32', in_workshop: '#ed9c28', vor: '#c62828', idle: '#90a4ae', disposed: '#546e7a' };
const ALLOC_LABEL: Record<string, string> = { customer_delivery: 'Customer delivery', store_delivery: 'Store delivery', staff_transport: 'Staff pick & drop' };

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`;
};
const pct = (cur: number, base: number | undefined) => (base ? ((cur - base) / base) * 100 : null);

// Section heading — gives the cockpit visual structure instead of one long
// stack of same-looking cards.
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="overline" sx={{ letterSpacing: 1, fontWeight: 700, color: 'primary.main' }}>
          {title}
        </Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>{subtitle}</Typography>}
      </Box>
      {children}
    </Box>
  );
}

// Delta indicator — for costs, up = worse (red), down = better (green).
function Delta({ label, value }: { label: string; value: number | null }) {
  if (value == null) return <Typography variant="caption" color="text.secondary">{label}: —</Typography>;
  const up = value >= 0;
  return (
    <Typography variant="caption" sx={{ color: up ? 'error.main' : 'success.main', display: 'inline-flex', alignItems: 'center', mr: 1.5 }}>
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
        <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>{pct}%</Typography>
        <LinearProgress variant="determinate" value={Math.min(100, pct)} sx={{ mt: 1.5, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: color } }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{sub}</Typography>
      </CardContent>
    </Card>
  );
}

function CostCard({ label, value, dMonth, dYear }: { label: string; value: number; dMonth: number | null; dYear: number | null }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label} · this month</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{fmtCurrency(value)}</Typography>
        <Box sx={{ mt: 1.5 }}>
          <Delta label="vs last mo" value={dMonth} />
          <Delta label="vs last yr" value={dYear} />
        </Box>
      </CardContent>
    </Card>
  );
}

// Small labelled stat pair used inside the age/experience/profile cards.
function StatPair({ value, label }: { value: string | number; label: string }) {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} lineHeight={1.2}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

function BandChips({ bands, suffix }: { bands: Record<string, number>; suffix: string }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {Object.entries(bands).map(([band, n]) => (
        <Chip key={band} size="small" variant="outlined" label={`${band}${suffix}: ${n}`} />
      ))}
    </Stack>
  );
}

const COST_LABEL: Record<'fuel' | 'maintenance' | 'compliance', string> = { fuel: 'Fuel', maintenance: 'Maintenance', compliance: 'Compliance' };
const COST_COLOR: Record<'fuel' | 'maintenance' | 'compliance', string> = { fuel: '#0f6e6e', maintenance: '#ed9c28', compliance: '#1565c0' };

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/dashboard')).data });
  const fyQuery = useQuery({ queryKey: ['cost-trends-fy'], queryFn: async () => (await api.get('/dashboard/cost-trends-fy')).data });

  if (isLoading || !data) return <LinearProgress />;

  const availability = data.availability as Record<string, number>;
  const statusData = Object.entries(availability).map(([k, v]) => ({ name: titleCase(k), value: v, key: k }));
  const sev = (data.alertsBySeverity as { severity: string; _count: number }[]) || [];
  const alloc = (data.allocationsToday as { type: string; count: number }[]) || [];
  const u = data.utilization;
  const a = data.assets;
  const age = data.fleetAge;
  const exp = data.experience;
  const cpk = data.costPerKm;
  type CostSummary = { fuel: number; maintenance: number; fines: number; total: number };
  const cost = data.cost as { mtd: CostSummary; ytd: CostSummary };
  const downtime = data.downtime as { mtd: { pct: number }; ytd: { pct: number } };

  // Fiscal year = calendar year (Jan-Dec). `current`/`previous` are each
  // exactly 12 months, Jan through Dec, so trend/YoY charts never straddle
  // two different fiscal years.
  type MonthCost = { month: string; fuel: number; maintenance: number; compliance: number; total: number };
  const fyYear = (fyQuery.data?.year ?? new Date().getFullYear()) as number;
  const current = (fyQuery.data?.current ?? []) as MonthCost[];
  const previous = (fyQuery.data?.previous ?? []) as MonthCost[];
  const now = new Date();
  const curMonthIdx = fyYear === now.getFullYear() ? now.getMonth() : 11;
  const curFy = current[curMonthIdx];
  const prevFyMonth = current[curMonthIdx - 1];
  const fyTotal = {
    fuel: current.reduce((s, m) => s + m.fuel, 0),
    maintenance: current.reduce((s, m) => s + m.maintenance, 0),
    compliance: current.reduce((s, m) => s + m.compliance, 0),
  };
  const prevFyTotal = {
    fuel: previous.reduce((s, m) => s + m.fuel, 0),
    maintenance: previous.reduce((s, m) => s + m.maintenance, 0),
    compliance: previous.reduce((s, m) => s + m.compliance, 0),
  };
  const fyMonths = current.map((x) => ({ ...x, label: monthLabel(x.month) }));
  const fyYoy = (k: 'fuel' | 'maintenance' | 'compliance') =>
    current.map((x, i) => ({ label: monthLabel(x.month).slice(0, 3), 'This FY': x[k], 'Last FY': previous[i]?.[k] ?? 0 }));

  return (
    <Box>
      <PageHeader title="Fleet Manager Cockpit" subtitle="Live overview across the fleet" />

      {/* ---------- Snapshot ---------- */}
      <Section title="Snapshot">
        <Grid container spacing={2}>
          <Grid item xs={6} md={2.4}><StatCard label="Active vehicles" value={availability.active ?? 0} color="#2e7d32" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="In workshop / Vehicle Off Road (VOR)" value={(availability.in_workshop ?? 0) + (availability.vor ?? 0)} color="#ed9c28" /></Grid>
          <Grid item xs={6} md={2.4}><StatCard label="Compliance due (30d)" value={data.complianceExpiring30d} color="#c62828" /></Grid>
          <Grid item xs={12} md={2.4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <BuildIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Downtime %</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{downtime.mtd.pct}%</Typography>
                <Typography variant="caption" color="text.secondary">MTD · YTD {downtime.ytd.pct}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <SpeedIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Cost per km · MTD</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {cpk.costPerKm != null ? `AED ${cpk.costPerKm}` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cpk.kmRun.toLocaleString()} km run · cash AED {cpk.cashCostPerKm ?? '—'}/km
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>

      {/* ---------- Utilization & Asset Value ---------- */}
      <Section title="Utilization & Asset Value">
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}><Gauge label="Fleet utilization (today)" pct={u.fleetPct} sub={`${u.vehiclesAllocated}/${u.activeVehicles} vehicles`} /></Grid>
          <Grid item xs={6} md={3}><Gauge label="Driver utilization (today)" pct={u.driverPct} sub={`${u.driversAllocated}/${u.activeDrivers} drivers`} /></Grid>
          <Grid item xs={6} md={3}><StatCard label="Asset value (purchased)" value={fmtCurrency(a.totalPurchaseValue)} /></Grid>
          <Grid item xs={6} md={3}><StatCard label="Net book value" value={fmtCurrency(a.totalBookValue)} color="#0f6e6e" sub={`after ${fmtCurrency(a.totalDepreciation)} dep.`} /></Grid>
        </Grid>
      </Section>

      {/* ---------- Fleet Profile ---------- */}
      <Section title="Fleet Profile" subtitle="Age of vehicles and experience of drivers operating the fleet">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Fleet age</Typography>
                <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                  <StatPair value={age.avgModelYearAge} label="avg vehicle age (yrs)" />
                  <StatPair value={age.avgInServiceAge} label="avg in-service (yrs)" />
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Age distribution</Typography>
                <BandChips bands={age.distribution} suffix="y" />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Driver experience</Typography>
                <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                  <StatPair value={exp.avgDriverTenureYears} label="avg driver tenure (yrs)" />
                  <StatPair value={exp.driverCount} label="active drivers" />
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Driver tenure distribution</Typography>
                <BandChips bands={exp.tenureDistribution} suffix="y" />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Vehicle usage</Typography>
                <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                  <StatPair value={`${(exp.avgVehicleOdometer / 1000).toFixed(0)}k`} label="avg vehicle km" />
                  <StatPair value={`${(exp.avgKmPerYear / 1000).toFixed(1)}k`} label="avg km / year" />
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Across {age.vehicleCount} active vehicles</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>

      {/* ---------- Cost Trends ---------- */}
      <Section title="Cost Trends" subtitle={`Financial year ${fyYear}: January – December`}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>Total cost · MTD</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{fmtCurrency(cost.mtd.total)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Fuel {fmtCurrency(cost.mtd.fuel)} · Maintenance {fmtCurrency(cost.mtd.maintenance)} · Fines {fmtCurrency(cost.mtd.fines)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>Total cost · YTD</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{fmtCurrency(cost.ytd.total)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Fuel {fmtCurrency(cost.ytd.fuel)} · Maintenance {fmtCurrency(cost.ytd.maintenance)} · Fines {fmtCurrency(cost.ytd.fines)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {curFy && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}><CostCard label="Fuel cost" value={curFy.fuel} dMonth={pct(curFy.fuel, prevFyMonth?.fuel)} dYear={pct(fyTotal.fuel, prevFyTotal.fuel)} /></Grid>
            <Grid item xs={12} md={4}><CostCard label="Maintenance cost" value={curFy.maintenance} dMonth={pct(curFy.maintenance, prevFyMonth?.maintenance)} dYear={pct(fyTotal.maintenance, prevFyTotal.maintenance)} /></Grid>
            <Grid item xs={12} md={4}><CostCard label="Compliance cost" value={curFy.compliance} dMonth={pct(curFy.compliance, prevFyMonth?.compliance)} dYear={pct(fyTotal.compliance, prevFyTotal.compliance)} /></Grid>
          </Grid>
        )}
        {(['fuel', 'maintenance', 'compliance'] as const).map((k) => (
          <Grid container spacing={2} key={k} sx={{ mb: 2 }}>
            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>{COST_LABEL[k]} trend (FY {fyYear})</Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={fyMonths}>
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                      <Line type="monotone" dataKey={k} name={COST_LABEL[k]} stroke={COST_COLOR[k]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>{COST_LABEL[k]} year-on-year</Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={fyYoy(k)}>
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                      <Legend />
                      <Bar dataKey="Last FY" fill="#b0bec5" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="This FY" fill={COST_COLOR[k]} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ))}
      </Section>

      {/* ---------- Operations ---------- */}
      <Section title="Operations">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Fleet availability</Typography>
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
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Today's allocations</Typography>
                <Stack spacing={1}>
                  {alloc.length === 0 && <Typography variant="body2" color="text.secondary">No allocations today.</Typography>}
                  {alloc.map((x) => (
                    <Box key={x.type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">{ALLOC_LABEL[x.type] ?? x.type}</Typography>
                      <Chip size="small" color="primary" label={x.count} />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Alerts & follow-ups</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {['red', 'amber', 'green'].map((s) => (
                    <Chip key={s} size="small" label={`${s.toUpperCase()}: ${sev.find((x) => x.severity === s)?._count ?? 0}`} sx={{ bgcolor: SEV_COLORS[s], color: '#fff' }} />
                  ))}
                </Box>
                <Stack spacing={0.75}>
                  <Typography variant="body2" color="text.secondary">Vehicles due for PM: <strong>{data.pmDue}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">Payables outstanding: <strong>{fmtCurrency(data.payablesOutstanding)}</strong></Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>
    </Box>
  );
}
