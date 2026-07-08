import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, LinearProgress, Chip, Tooltip } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import { api } from '../api/client';
import { PageHeader, StatCard } from '../components/ui';
import VehicleHistoryDrawer from '../components/VehicleHistoryDrawer';

interface BoardVehicle {
  id: string; plate: string; vehicleType: string; status: string; bucket: string;
  assignedDriver: string | null; complianceBlocked: boolean; blockingDocs: string[]; canPlan: boolean;
  seatingCapacity: number | null; payloadKg: number | null;
  store: { code: string; name: string } | null;
  allocationType: string | null; allocationReference: string | null;
}

const ALLOC_LABEL: Record<string, string> = {
  customer_delivery: 'Customer delivery', store_delivery: 'Store delivery', staff_transport: 'Staff pick & drop',
};

const BUCKET_LABEL: Record<string, string> = { free: 'Free', committed: 'Committed', workshop: 'Workshop / VOR', blocked: 'Compliance-blocked' };
const BUCKET_COLOR: Record<string, string> = { free: '#2e7d32', committed: '#1565c0', workshop: '#ed9c28', blocked: '#c62828' };

export default function Availability() {
  const { data, isLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: async () => (await api.get('/availability')).data,
  });
  const [historyId, setHistoryId] = useState<string | null>(null);
  if (isLoading || !data) return <LinearProgress />;

  const vehicles = data.vehicles as BoardVehicle[];
  const buckets = ['free', 'committed', 'workshop', 'blocked'];

  return (
    <Box>
      <PageHeader title="Fleet Availability Board" subtitle="Read-only planning view · click a vehicle for its history · compliance-blocked vehicles are greyed out and cannot be planned" />
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={2.4}><StatCard label="Total" value={data.kpis.total} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Free" value={data.kpis.free} color="#2e7d32" /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Committed" value={data.kpis.committed} color="#1565c0" /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Workshop/VOR" value={data.kpis.workshop} color="#ed9c28" /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Available %" value={`${data.kpis.availablePct}%`} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        {buckets.map((b) => (
          <Grid item xs={12} md={3} key={b}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: BUCKET_COLOR[b] }}>
              {BUCKET_LABEL[b]} ({vehicles.filter((v) => v.bucket === b).length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {vehicles.filter((v) => v.bucket === b).map((v) => (
                <Card
                  key={v.id}
                  onClick={() => setHistoryId(v.id)}
                  sx={{ opacity: v.canPlan ? 1 : 0.55, borderLeft: `4px solid ${BUCKET_COLOR[b]}`, cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2">{v.plate}</Typography>
                      {v.complianceBlocked && (
                        <Tooltip title={`Expired: ${v.blockingDocs.join(', ')}`}>
                          <BlockIcon fontSize="small" color="error" />
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {v.vehicleType} · {v.store?.code ?? 'No depot'}
                    </Typography>
                    {v.assignedDriver && <Chip size="small" label={v.assignedDriver} sx={{ mt: 0.5, mr: 0.5 }} variant="outlined" />}
                    {v.allocationType && <Chip size="small" color="primary" label={ALLOC_LABEL[v.allocationType] ?? v.allocationType} sx={{ mt: 0.5 }} />}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Grid>
        ))}
      </Grid>
      <VehicleHistoryDrawer vehicleId={historyId} onClose={() => setHistoryId(null)} />
    </Box>
  );
}
