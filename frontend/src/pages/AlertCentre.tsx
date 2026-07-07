import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, LinearProgress, Button, ToggleButtonGroup, ToggleButton, Stack, IconButton, Tooltip } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../api/client';
import { PageHeader, SeverityChip } from '../components/ui';
import { fmtDate } from '../i18n';
import { useAuth } from '../auth/AuthContext';

interface Alert {
  id: string; category: string; severity: string; title: string; message: string; dueDate: string | null;
}

export default function AlertCentre() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [severity, setSeverity] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', severity],
    queryFn: async () => (await api.get('/alerts', { params: { pageSize: 200, ...(severity !== 'all' ? { severity } : {}) } })).data,
  });

  const run = useMutation({
    mutationFn: async () => (await api.post('/alerts/run')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const resolve = useMutation({
    mutationFn: async (id: string) => (await api.post(`/alerts/${id}/resolve`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const alerts: Alert[] = data?.data ?? [];

  return (
    <Box>
      <PageHeader
        title="Alert Centre"
        subtitle="Colour-coded: red = overdue/critical, amber = due soon, green = ok"
        action={
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? 'Running…' : 'Run engine now'}
          </Button>
        }
      />
      <ToggleButtonGroup size="small" value={severity} exclusive onChange={(_, v) => v && setSeverity(v)} sx={{ mb: 2 }}>
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="red">Red</ToggleButton>
        <ToggleButton value="amber">Amber</ToggleButton>
        <ToggleButton value="green">Green</ToggleButton>
      </ToggleButtonGroup>

      {isLoading ? <LinearProgress /> : (
        <Stack spacing={1}>
          {alerts.length === 0 && <Typography color="text.secondary">No active alerts.</Typography>}
          {alerts.map((a) => (
            <Card key={a.id} sx={{ borderLeft: `5px solid ${a.severity === 'red' ? '#c62828' : a.severity === 'amber' ? '#ed9c28' : '#2e7d32'}` }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <SeverityChip severity={a.severity} />
                    <Typography variant="subtitle2">{a.title}</Typography>
                    <Typography variant="caption" color="text.secondary">· {a.category.replace(/_/g, ' ')}</Typography>
                    {a.dueDate && <Typography variant="caption" color="text.secondary">· due {fmtDate(a.dueDate)}</Typography>}
                  </Box>
                  <Typography variant="body2" color="text.secondary">{a.message}</Typography>
                </Box>
                {can('alerts:read') && (
                  <Tooltip title="Mark resolved">
                    <IconButton onClick={() => resolve.mutate(a.id)}><DoneIcon /></IconButton>
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
