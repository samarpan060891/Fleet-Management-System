import { ReactNode } from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
      <Box>
        <Typography variant="h5">{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

export function StatCard({ label, value, color, sub }: { label: string; value: ReactNode; color?: string; sub?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color ?? 'text.primary' }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

const SEV_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  red: 'error', amber: 'warning', green: 'success',
};
export function SeverityChip({ severity }: { severity: string }) {
  return <Chip size="small" color={SEV_COLOR[severity] ?? 'default'} label={severity.toUpperCase()} />;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  active: 'success', in_workshop: 'warning', vor: 'error', idle: 'default', disposed: 'default',
  free: 'success', committed: 'info', workshop: 'warning', blocked: 'error',
  unpaid: 'error', paid: 'success', pending: 'warning', approved: 'success', rejected: 'error',
  open: 'warning', in_progress: 'info', closed: 'success',
};
const STATUS_LABEL: Record<string, string> = {
  vor: 'Vehicle Off Road (VOR)',
};

export function StatusChip({ status }: { status: string }) {
  return <Chip size="small" color={STATUS_COLOR[status] ?? 'default'} label={STATUS_LABEL[status] ?? status.replace(/_/g, ' ')} variant="outlined" />;
}
