import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, LinearProgress, Snackbar, Alert, Divider } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';

// Friendly labels for document types (compliance windows) and alert categories
// (email recipients) so users never see raw keys.
const PRETTY: Record<string, string> = {
  mulkiya: 'Registration (Mulkiya)', insurance: 'Insurance', tasjeel: 'Technical inspection (Tasjeel)',
  lease: 'Lease', warranty: 'Warranty', licence: 'Driving licence', emirates_id: 'Emirates ID',
  visa: 'Visa', passport: 'Passport',
  compliance_expiry: 'Compliance expiry', maintenance_due: 'Maintenance due', fuel_anomaly: 'Fuel anomaly',
  fine_aging: 'Fine aging', salik_low: 'Low Salik balance', downtime_vor: 'Downtime / VOR',
  contract_warranty: 'Contract / warranty', transport: 'Staff transport',
};
const pretty = (k: string) => PRETTY[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get('/settings')).data });
  const [values, setValues] = useState<Record<string, unknown>>({});
  // Text drafts for the list editors, keyed `${settingKey}::${subKey}`.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.values) return;
    setValues(data.values);
    const d: Record<string, string> = {};
    for (const key of ['compliance.windows', 'alerts.emailRecipients']) {
      const obj = data.values[key] as Record<string, unknown[]> | undefined;
      if (obj) for (const sub of Object.keys(obj)) d[`${key}::${sub}`] = (obj[sub] as unknown[]).join(', ');
    }
    setDrafts(d);
  }, [data]);

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => (await api.put(`/settings/${key}`, { value })).data,
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  if (isLoading || !data) return <LinearProgress />;
  const labels = data.labels as Record<string, string>;
  const numericKeys = Object.keys(values).filter((k) => typeof values[k] === 'number');

  // Save a keyed list setting by parsing every sub-field draft.
  const saveKeyed = (settingKey: string, kind: 'number' | 'email') => {
    const obj = values[settingKey] as Record<string, unknown[]>;
    const next: Record<string, unknown[]> = {};
    for (const sub of Object.keys(obj)) {
      const raw = drafts[`${settingKey}::${sub}`] ?? '';
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      next[sub] = kind === 'number' ? parts.map(Number).filter((n) => Number.isFinite(n)) : parts;
    }
    save.mutate({ key: settingKey, value: next });
    setValues((v) => ({ ...v, [settingKey]: next }));
  };

  const KeyedEditor = ({ settingKey, kind, help }: { settingKey: string; kind: 'number' | 'email'; help: string }) => {
    const obj = (values[settingKey] as Record<string, unknown[]>) ?? {};
    return (
      <Grid container spacing={2}>
        {Object.keys(obj).sort().map((sub) => {
          const dk = `${settingKey}::${sub}`;
          return (
            <Grid item xs={12} sm={6} key={dk}>
              <TextField
                fullWidth size="small" label={pretty(sub)} value={drafts[dk] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [dk]: e.target.value }))}
                helperText={help}
              />
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Admin-configurable alert windows, PM defaults, and thresholds" />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Thresholds</Typography>
          <Grid container spacing={2}>
            {numericKeys.map((k) => (
              <Grid item xs={12} md={6} key={k}>
                <TextField
                  fullWidth type="number" label={labels[k] ?? k}
                  value={values[k] as number}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: Number(e.target.value) }))}
                  InputProps={{ endAdornment: <Button size="small" onClick={() => save.mutate({ key: k, value: values[k] })}>Save</Button> }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Compliance alert windows</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            How many days before each document expires to start warning (comma-separated). Overdue documents alert daily.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <KeyedEditor settingKey="compliance.windows" kind="number" help="Days before expiry, e.g. 60, 30, 15, 7" />
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => saveKeyed('compliance.windows', 'number')}>
            Save alert windows
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Alert email recipients</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Who receives critical email alerts, per category (comma-separated email addresses).
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <KeyedEditor settingKey="alerts.emailRecipients" kind="email" help="Emails, e.g. fleet.manager@company.com" />
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => saveKeyed('alerts.emailRecipients', 'email')}>
            Save recipients
          </Button>
        </CardContent>
      </Card>

      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)}>
        <Alert severity="success">Setting saved</Alert>
      </Snackbar>
    </Box>
  );
}
