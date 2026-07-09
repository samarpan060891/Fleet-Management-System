import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { titleCase } from '../lib/text';
import {
  Drawer, Box, Typography, IconButton, Button, Chip, Divider, LinearProgress,
  Accordion, AccordionSummary, AccordionDetails, Stack, Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api } from '../api/client';
import { fmtCurrency, fmtDate, fmtKm } from '../i18n';
import { StatusChip } from './ui';

// Same straight-line-to-residual formula used server-side for the fleet
// asset value and the vehicle export (costs.service.ts / reports.routes.ts).
function depreciation(purchasePrice: number, residual: number, lifeYears: number, ageYears: number) {
  const annual = lifeYears > 0 ? Math.max(0, purchasePrice - residual) / lifeYears : 0;
  const accumulated = Math.min(Math.max(0, purchasePrice - residual), annual * ageYears);
  return { accumulated, bookValue: purchasePrice - accumulated };
}

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography variant="body2" fontWeight={500}>{value ?? '—'}</Typography>
  </Box>
);

async function downloadPdf(id: string, plate: string) {
  const token = localStorage.getItem('fleet_token');
  const res = await fetch(`/api/reports/vehicle-history/${id}.pdf`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vehicle-history-${plate}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, count, children, defaultOpen }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Accordion defaultExpanded={defaultOpen} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">{title}</Typography>
        <Chip size="small" label={count} sx={{ ml: 1 }} />
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{count === 0 ? <Typography variant="body2" color="text.secondary">None</Typography> : children}</AccordionDetails>
    </Accordion>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ py: 0.5, borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{children}</Box>
);

export default function VehicleHistoryDrawer({ vehicleId, onClose }: { vehicleId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-history', vehicleId],
    queryFn: async () => (await api.get(`/vehicles/${vehicleId}/history`)).data,
    enabled: !!vehicleId,
  });

  const v = data?.vehicle;

  // Management summary — derived client-side from the same consolidated
  // history payload the sections below already render line-by-line.
  const summary = (() => {
    if (!v || !data) return null;
    const purchasePrice = v.purchase?.purchasePrice != null ? Number(v.purchase.purchasePrice) : null;
    const purchaseDate = v.purchase?.purchaseDate ?? null;
    const residual = Number(v.residualValue ?? v.purchase?.residualValue ?? 0);
    const lifeYears = v.usefulLifeYears ?? v.purchase?.usefulLifeYears ?? null;
    const ageYears = purchaseDate ? dayjs().diff(dayjs(purchaseDate), 'day') / 365 : null;
    const lifePendingYears = ageYears != null && lifeYears != null ? Math.max(0, lifeYears - ageYears) : null;
    const dep = purchasePrice != null && purchasePrice > 0 && ageYears != null && lifeYears != null
      ? depreciation(purchasePrice, residual, lifeYears, ageYears) : null;
    const maintenanceCost = data.jobCards.reduce((s: number, j: any) => s + Number(j.totalCost ?? 0), 0);
    const pendingDocs = data.documents.filter((d: any) => d.expiryDate && new Date(d.expiryDate) < new Date());
    const activeTyres = data.tyres.filter((t: any) => !t.scrapDate && t.fitmentDate);
    const latestTyreFitment = activeTyres.length
      ? activeTyres.reduce((max: string, t: any) => (t.fitmentDate > max ? t.fitmentDate : max), activeTyres[0].fitmentDate)
      : null;
    const tyreLifeDays = latestTyreFitment ? dayjs().diff(dayjs(latestTyreFitment), 'day') : null;
    return { purchasePrice, purchaseDate, ageYears, lifeYears, lifePendingYears, bookValue: dep?.bookValue ?? null, maintenanceCost, pendingDocs, tyreLifeDays };
  })();

  return (
    <Drawer anchor="right" open={!!vehicleId} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Vehicle history</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        {isLoading || !v ? <LinearProgress sx={{ mt: 2 }} /> : (
          <>
            <Box sx={{ mt: 1, mb: 1 }}>
              <Typography variant="h5">{v.plateNumber} ({v.plateEmirate})</Typography>
              <Typography variant="body2" color="text.secondary">{v.make} {v.model} {v.year} · {v.vehicleType}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                <StatusChip status={v.status} />
                <Chip size="small" variant="outlined" label={fmtKm(v.currentOdometer)} />
                <Chip size="small" variant="outlined" label={v.ownership} />
                {v.hasBranding && <Chip size="small" color="secondary" label="Branded" />}
                {v.store && <Chip size="small" variant="outlined" label={v.store.code} />}
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Chassis (VIN): {v.vin ?? '—'} · Engine: {v.engineNumber ?? '—'}
              </Typography>
            </Box>
            <Button fullWidth variant="contained" startIcon={<DownloadIcon />} sx={{ mb: 2 }} onClick={() => downloadPdf(v.id, v.plateNumber)}>
              Download full history PDF
            </Button>

            {v.pmState && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f4f6f8', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Next PM</Typography>
                <Typography variant="body2">{fmtKm(v.pmState.nextPmKm)} · {fmtDate(v.pmState.nextPmDate)}</Typography>
              </Box>
            )}

            {summary && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f4f6f8', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Summary</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}><Stat label="Purchase price" value={summary.purchasePrice != null ? fmtCurrency(summary.purchasePrice) : '—'} /></Grid>
                  <Grid item xs={6}><Stat label="Date of purchase" value={summary.purchaseDate ? fmtDate(summary.purchaseDate) : '—'} /></Grid>
                  <Grid item xs={6}><Stat label="Age" value={summary.ageYears != null ? `${summary.ageYears.toFixed(1)} yrs` : '—'} /></Grid>
                  <Grid item xs={6}><Stat label="Life pending" value={summary.lifePendingYears != null ? `${summary.lifePendingYears.toFixed(1)} yrs` : '—'} /></Grid>
                  <Grid item xs={6}><Stat label="Book value (post-dep.)" value={summary.bookValue != null ? fmtCurrency(summary.bookValue) : '—'} /></Grid>
                  <Grid item xs={6}><Stat label="Maintenance cost to date" value={fmtCurrency(summary.maintenanceCost)} /></Grid>
                  <Grid item xs={6}><Stat label="Incidents" value={data.incidents.length} /></Grid>
                  <Grid item xs={6}><Stat label="Tyre life (since last change)" value={summary.tyreLifeDays != null ? `${summary.tyreLifeDays} days` : '—'} /></Grid>
                  <Grid item xs={12}>
                    <Stat
                      label={`Pending compliances (${summary.pendingDocs.length})`}
                      value={summary.pendingDocs.length ? summary.pendingDocs.map((d: any) => titleCase(String(d.docType))).join(', ') : 'None'}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            <Divider sx={{ mb: 1 }} />

            <Section title="Maintenance log" count={data.jobCards.length} defaultOpen>
              {data.jobCards.map((j: any) => (
                <Row key={j.id}>
                  <strong>{fmtDate(j.dateIn)}</strong> · {j.type} · {j.jobNumber} · {j.vendor?.name ?? 'in-house'} · {fmtCurrency(j.totalCost)}
                  {j.isWarrantyClaim && <Chip size="small" color="secondary" label="warranty" sx={{ ml: 1 }} />}
                  {j.description && <Typography variant="caption" display="block" color="text.secondary">{j.description}</Typography>}
                  {j.parts?.map((p: any) => <Typography key={p.id} variant="caption" display="block" color="text.secondary">• {p.partName} ×{p.qty} @ {fmtCurrency(p.unitCost)}</Typography>)}
                </Row>
              ))}
            </Section>

            <Section title="Tyres" count={data.tyres.length}>
              {data.tyres.map((t: any) => (
                <Row key={t.id}>{t.serial} · {t.brand ?? '—'} · pos {t.position ?? '—'} · {fmtDate(t.fitmentDate)} · {fmtCurrency(t.cost)}{t.scrapDate && <Chip size="small" color="error" label="scrapped" sx={{ ml: 1 }} />}</Row>
              ))}
            </Section>

            <Section title="Compliance documents" count={data.documents.length}>
              {data.documents.map((d: any) => (
                <Row key={d.id}>{titleCase(String(d.docType))} · {d.reference ?? '—'} · expires <strong>{fmtDate(d.expiryDate)}</strong>{d.cost ? ` · fee ${fmtCurrency(d.cost)}` : ''}</Row>
              ))}
            </Section>

            <Section title="Fuel (recent)" count={data.fuel.length}>
              {data.fuel.map((f: any) => (
                <Row key={f.id}>{fmtDate(f.filledAt)} · {f.litres}L · {fmtCurrency(f.amount)} · {f.kmPerLitre ?? '—'} km/L · {titleCase(f.channel)}</Row>
              ))}
            </Section>

            <Section title="Fines" count={data.fines.length}>
              {data.fines.map((f: any) => (
                <Row key={f.id}>{fmtDate(f.offenceAt)} · {f.type} · {f.reference} · {fmtCurrency(f.amount)} · {f.status}</Row>
              ))}
            </Section>

            <Section title="Incidents" count={data.incidents.length}>
              {data.incidents.map((i: any) => (
                <Row key={i.id}>{fmtDate(i.occurredAt)} · {i.emirate ?? ''} · {i.claimStatus} · {fmtCurrency(i.claimAmount)}</Row>
              ))}
            </Section>

            <Section title="Odometer readings" count={data.odometer.length}>
              {data.odometer.map((o: any) => (
                <Row key={o.id}>{fmtDate(o.readingDate)} · {fmtKm(o.odometer)} · {o.source}</Row>
              ))}
            </Section>

            <Section title="Driver assignments" count={data.assignments.length}>
              {data.assignments.map((a: any) => (
                <Row key={a.id}>{fmtDate(a.effectiveFrom)} → {a.effectiveTo ? fmtDate(a.effectiveTo) : 'current'} · {a.driver?.fullName ?? '—'}</Row>
              ))}
            </Section>
          </>
        )}
      </Box>
    </Drawer>
  );
}
