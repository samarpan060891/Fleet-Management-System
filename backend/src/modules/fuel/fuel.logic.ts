// Pure fuel calculations — no DB, unit-tested directly.

export interface PriorFill {
  odometer: number | null;
  kmPerLitre: number | null;
}

// km/litre for a fill given the previous odometer reading.
export function computeEfficiency(
  odometer: number | null,
  litres: number,
  prevOdometer: number | null
): { kmSinceLast: number | null; kmPerLitre: number | null } {
  if (odometer == null || prevOdometer == null || litres <= 0) {
    return { kmSinceLast: null, kmPerLitre: null };
  }
  const kmSinceLast = odometer - prevOdometer;
  if (kmSinceLast <= 0) return { kmSinceLast, kmPerLitre: null };
  return { kmSinceLast, kmPerLitre: +(kmSinceLast / litres).toFixed(3) };
}

// Rolling average km/l over the last N valid fills.
export function rollingAverage(priorEfficiencies: number[], window: number): number | null {
  const vals = priorEfficiencies.filter((v) => v > 0).slice(-window);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface AnomalyInput {
  odometer: number | null;
  kmPerLitre: number | null;
  rollingAvg: number | null;
  channel: 'vip_kit' | 'fuel_buddy' | 'cash';
  amount: number;
  deviationPct: number; // configured threshold
  cashThreshold: number; // configured threshold
  approved: boolean;
}

export type AnomalyReason =
  | 'missing_odometer'
  | 'efficiency_deviation'
  | 'unapproved_cash_over_threshold';

// Detects fuel anomalies per the spec's rules. Returns the list of reasons.
export function detectAnomalies(input: AnomalyInput): AnomalyReason[] {
  const reasons: AnomalyReason[] = [];

  // (b) fuel logged without odometer
  if (input.odometer == null) reasons.push('missing_odometer');

  // (a) km/litre deviates > X% from rolling average
  if (
    input.kmPerLitre != null &&
    input.rollingAvg != null &&
    input.rollingAvg > 0
  ) {
    const deviation = (Math.abs(input.kmPerLitre - input.rollingAvg) / input.rollingAvg) * 100;
    if (deviation > input.deviationPct) reasons.push('efficiency_deviation');
  }

  // (c) cash fill above configured amount without Fleet-Manager approval
  if (input.channel === 'cash' && input.amount > input.cashThreshold && !input.approved) {
    reasons.push('unapproved_cash_over_threshold');
  }

  return reasons;
}
