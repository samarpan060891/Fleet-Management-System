import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, LinearProgress, Snackbar, Alert } from '@mui/material';
import { api } from '../api/client';
import { PageHeader } from '../components/ui';

// Numeric/threshold settings are editable inline; complex ones (windows,
// recipients) are edited as JSON.
export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get('/settings')).data });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data?.values) setValues(data.values); }, [data]);

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => (await api.put(`/settings/${key}`, { value })).data,
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  if (isLoading || !data) return <LinearProgress />;
  const labels = data.labels as Record<string, string>;

  const numericKeys = Object.keys(values).filter((k) => typeof values[k] === 'number');
  const jsonKeys = Object.keys(values).filter((k) => typeof values[k] === 'object');

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

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Alert windows & recipients (JSON)</Typography>
          {jsonKeys.map((k) => (
            <Box key={k} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>{labels[k] ?? k}</Typography>
              <TextField
                fullWidth multiline minRows={3}
                value={JSON.stringify(values[k], null, 2)}
                onChange={(e) => { try { setValues((v) => ({ ...v, [k]: JSON.parse(e.target.value) })); } catch { /* keep typing */ } }}
                sx={{ fontFamily: 'monospace' }}
              />
              <Button size="small" sx={{ mt: 1 }} onClick={() => save.mutate({ key: k, value: values[k] })}>Save</Button>
            </Box>
          ))}
        </CardContent>
      </Card>

      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)}>
        <Alert severity="success">Setting saved</Alert>
      </Snackbar>
    </Box>
  );
}
