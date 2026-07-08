import { Box, Card, CardContent, Typography, Button, Grid, Stack } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { PageHeader } from '../components/ui';
import { downloadFile } from '../lib/download';

const REPORTS = [
  { label: 'Fleet Compliance Status', desc: 'All document expiries with days-left', path: '/reports/compliance.xlsx', file: 'fleet-compliance.xlsx' },
  { label: 'Monthly Cost Report', desc: 'Per-vehicle TCO for the period', path: '/reports/costs.xlsx?period=mtd', file: 'monthly-cost.xlsx' },
  { label: 'Staff Transport Attendance', desc: 'Attendance for the current month', path: '/reports/attendance.xlsx', file: 'attendance.xlsx' },
  { label: 'Job Cards Report', desc: 'Full maintenance log — vendor, cost, warranty & parts', path: '/reports/job-cards.xlsx', file: 'job-cards-report.xlsx' },
];

export default function Reports() {
  return (
    <Box>
      <PageHeader title="Reports" subtitle="Exportable Excel & PDF reports" />
      <Grid container spacing={2}>
        {REPORTS.map((r) => (
          <Grid item xs={12} md={4} key={r.path}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack sx={{ height: '100%' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6">{r.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{r.desc}</Typography>
                  </Box>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadFile(r.path, r.file)}>Download Excel</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Vehicle history sheets (PDF) are available per vehicle at <code>/api/reports/vehicle-history/&lt;id&gt;.pdf</code>.
      </Typography>
    </Box>
  );
}
