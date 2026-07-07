import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
  MenuItem, FormControlLabel, Checkbox, Alert,
} from '@mui/material';

export type FieldType = 'text' | 'multiline' | 'number' | 'date' | 'select' | 'checkbox';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  half?: boolean; // render at half width (md=6)
  // Show the field only when this predicate passes (for conditional fields).
  showIf?: (values: Record<string, unknown>) => boolean;
}

interface Props {
  open: boolean;
  title: string;
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

// Schema-driven create/edit dialog. Coerces values by field type and drops
// empty optional fields so the API receives clean payloads.
export default function FormDialog({ open, title, fields, initial, submitting, error, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    const seed: Record<string, unknown> = {};
    for (const f of fields) {
      const v = initial?.[f.name];
      if (f.type === 'date' && v) seed[f.name] = String(v).slice(0, 10); // yyyy-mm-dd
      else if (v !== undefined && v !== null) seed[f.name] = v;
      else if (f.type === 'checkbox') seed[f.name] = false;
    }
    setValues(seed);
  }, [open, initial, fields]);

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) continue;
      let v = values[f.name];
      if (f.type === 'number') {
        if (v === '' || v === undefined || v === null) v = undefined;
        else v = Number(v);
      }
      if (f.type === 'checkbox') v = !!v;
      if (typeof v === 'string' && v.trim() === '') v = undefined;
      if (v !== undefined) payload[f.name] = v;
    }
    onSubmit(payload);
  };

  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          {visible.map((f) => (
            <Grid item xs={12} md={f.half ? 6 : 12} key={f.name}>
              {f.type === 'checkbox' ? (
                <FormControlLabel
                  control={<Checkbox checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />}
                  label={f.label}
                />
              ) : f.type === 'select' ? (
                <TextField
                  select fullWidth label={f.label} required={f.required}
                  value={(values[f.name] as string) ?? ''}
                  onChange={(e) => set(f.name, e.target.value)}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {(f.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
              ) : (
                <TextField
                  fullWidth label={f.label} required={f.required}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  multiline={f.type === 'multiline'} minRows={f.type === 'multiline' ? 2 : undefined}
                  InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                  value={(values[f.name] as string) ?? ''}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
