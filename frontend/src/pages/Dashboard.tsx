import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, LinearProgress, Chip } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import { fmtCurrency } from '../i18n';

const SEV_COLORS: Record<string, string> = { red: '#c62828', amber: '#ed9c28', green: '#2e7d32' };
const STATUS_COLORS: Record<string, string> = { active: '#2e7d32', in_workshop: '#ed9c28', vor: '#c62828', idle: '#90a4ae', disposed: '#546e7a' };

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data,
  });

  if (isLoading || !data) return <LinearProgress />;

  const availability = data.availability as Record<string, number>;
  const statusData = Object.entries(availability).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v, key: k }));
  const sev = (data.alertsBySeverity as { severity: string; _count: number }[]) || [];
  const breakdown = [
    { name: 'Fuel', value: data.mtdBreakdown.fuel },
    { name: 'Maintenance', value: data.mtdBreakdown.maintenance },
    { name: 'Fines', value: data.mtdBreakdown.fines },
  ];

  return (
    <Box>
      <PageHeader title="Fleet Manager Cockpit" subtitle="Live overview across the fleet" />
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={6} md={3}>
          <StatCard label="Active vehicles" value={availability.active ?? 0} color="#2e7d32" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="In workshop / VOR" value={(availability.in_workshop ?? 0) + (availability.vor ?? 0)} color="#ed9c28" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Compliance due (30d)" value={data.complianceExpiring30d} color="#c62828" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="MTD cost" value={fmtCurrency(data.mtdCost)} sub="fuel + maintenance + fines" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Fleet availability</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>
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
              <Typography variant="h6" gutterBottom>Open alerts by severity</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {['red', 'amber', 'green'].map((s) => {
                  const count = sev.find((x) => x.severity === s)?._count ?? 0;
                  return <Chip key={s} label={`${s.toUpperCase()}: ${count}`} sx={{ bgcolor: SEV_COLORS[s], color: '#fff' }} />;
                })}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Vehicles due for PM: <strong>{data.pmDue}</strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>MTD cost breakdown</Typography>
              <ResponsiveContainer width="100%" height={240}>
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
