import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Alert, Stack, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Chip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../api/client';

interface ImportResult {
  dryRun: boolean; totalRows: number; validCount: number; errorCount: number;
  errors: { row: number; message: string }[]; created?: number;
}

interface Props {
  open: boolean;
  resource: string;   // import resource key
  label: string;      // e.g. "Vehicles"
  onClose: () => void;
  onImported: () => void;
}

// Bulk-import flow: download template → upload → dry-run preview → commit.
export default function ImportDialog({ open, resource, label, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => { setFile(null); setResult(null); setError(''); setDone(false); };
  const close = () => { reset(); onClose(); };

  const downloadTemplate = async () => {
    const token = localStorage.getItem('fleet_token');
    const res = await fetch(`/api/import/${resource}/template`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${resource}-import-template.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  // Accept the file explicitly to avoid a stale-closure read of `file` state.
  const upload = async (commit: boolean, theFile: File | null = file) => {
    if (!theFile) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', theFile);
      // Do NOT set Content-Type — the browser adds multipart boundary automatically.
      const res = await api.post(`/import/${resource}${commit ? '?commit=true' : ''}`, fd);
      setResult(res.data);
      if (commit) { setDone(true); onImported(); }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (f: File | null) => { setFile(f); setResult(null); setDone(false); if (f) upload(false, f); };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>Bulk import — {label}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="info">
            1) Download the template · 2) Fill one row per record (see the <strong>Instructions</strong> sheet) ·
            3) Upload to preview · 4) Commit valid rows.
          </Alert>
          <Box>
            <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadTemplate}>Download Excel template</Button>
          </Box>
          <Button component="label" startIcon={<UploadFileIcon />} variant="contained" disabled={busy}>
            {file ? `Selected: ${file.name}` : 'Choose filled file (.xlsx)'}
            <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
          </Button>

          {busy && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}

          {result && (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip label={`${result.totalRows} rows`} />
                <Chip color="success" label={`${result.validCount} valid`} />
                {result.errorCount > 0 && <Chip color="error" label={`${result.errorCount} with errors`} />}
                {done && <Chip color="primary" label={`${result.created} imported`} />}
              </Stack>
              {done ? (
                <Alert severity="success">Imported {result.created} record(s).{result.errorCount ? ` ${result.errorCount} row(s) were skipped due to errors.` : ''}</Alert>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {result.validCount} row(s) ready to import.{result.errorCount ? ' Fix the errors below (or import only the valid rows).' : ''}
                </Typography>
              )}
              {result.errors.length > 0 && (
                <Box sx={{ maxHeight: 240, overflow: 'auto', mt: 1, border: '1px solid #eee', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Error</TableCell></TableRow></TableHead>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.message}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{done ? 'Close' : 'Cancel'}</Button>
        {!done && (
          <Button variant="contained" disabled={busy || !result || result.validCount === 0} onClick={() => upload(true)}>
            Import {result?.validCount ?? 0} valid row(s)
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
