import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
  MenuItem, FormControlLabel, Checkbox, Alert, Autocomplete,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { titleCase } from '../lib/text';

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
  // When set, this select becomes user-extensible: options are merged with
  // custom values previously added under this key (GET/POST /option-lists/:key),
  // and the field shows a "+ Add ..." option to create a new one inline.
  optionListKey?: string;
}

type Option = { value: string; label: string };

// Select field backed by a fixed seed list plus any user-added values for
// `optionListKey`. Typing a value that doesn't exist yet offers "+ Add …",
// which persists it via the option-lists API and selects it immediately.
function CreatableSelectField({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  const qc = useQueryClient();
  const extra = useQuery({
    queryKey: ['option-list', f.optionListKey],
    queryFn: async () => (await api.get(`/option-lists/${f.optionListKey}`)).data as Option[],
    enabled: !!f.optionListKey,
  });
  const addOption = useMutation({
    mutationFn: async (raw: string) => (await api.post(`/option-lists/${f.optionListKey}`, { value: raw })).data as Option,
    onSuccess: (item) => {
      qc.setQueryData(['option-list', f.optionListKey], (old: Option[] | undefined) => {
        const list = old ?? [];
        if (list.some((o) => o.value === item.value)) return list;
        return [...list, item];
      });
      onChange(item.value);
    },
  });

  const seed = (f.options ?? []).map((o) => ({ value: o.value, label: o.label || titleCase(o.value) }));
  const merged = [...seed];
  for (const e of extra.data ?? []) if (!merged.some((m) => m.value === e.value)) merged.push(e);
  merged.sort((a, b) => a.label.localeCompare(b.label));

  const current = merged.find((o) => o.value === value) ?? (value ? { value, label: titleCase(value) } : null);

  return (
    <Autocomplete
      fullWidth
      options={merged}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
      isOptionEqualToValue={(o, v) => o.value === (typeof v === 'string' ? v : v.value)}
      value={current}
      onChange={(_, newVal) => {
        if (!newVal) { onChange(''); return; }
        if (typeof newVal === 'string') { addOption.mutate(newVal); return; }
        if ((newVal as Option & { __add?: boolean }).__add) { addOption.mutate((newVal as Option).value); return; }
        onChange(newVal.value);
      }}
      filterOptions={(options, params) => {
        const input = params.inputValue.trim();
        const filtered = options.filter((o) => o.label.toLowerCase().includes(input.toLowerCase()));
        if (input && !options.some((o) => o.label.toLowerCase() === input.toLowerCase())) {
          filtered.push({ value: input, label: `+ Add "${titleCase(input)}"`, __add: true } as Option & { __add: boolean });
        }
        return filtered;
      }}
      renderInput={(params) => <TextField {...params} label={f.label} required={f.required} />}
      freeSolo
    />
  );
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
              ) : f.type === 'select' && f.optionListKey ? (
                <CreatableSelectField f={f} value={(values[f.name] as string) ?? ''} onChange={(v) => set(f.name, v)} />
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
