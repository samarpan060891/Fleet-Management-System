// Pure cost / TCO calculations — no DB, unit-tested directly.

export interface CostBuckets {
  fuel: number;
  maintenance: number;
  tyres: number;
  insurance: number;
  salik: number;
  fines: number;
  depreciation: number;
}

export const emptyBuckets = (): CostBuckets => ({
  fuel: 0,
  maintenance: 0,
  tyres: 0,
  insurance: 0,
  salik: 0,
  fines: 0,
  depreciation: 0,
});

// Straight-line depreciation for a period, prorated by days in the period.
// (purchasePrice - residualValue) / usefulLifeYears, per year → per day × days.
export function depreciationForPeriod(params: {
  purchasePrice: number;
  residualValue: number;
  usefulLifeYears: number;
  periodDays: number;
}): number {
  const { purchasePrice, residualValue, usefulLifeYears, periodDays } = params;
  if (usefulLifeYears <= 0) return 0;
  const annual = Math.max(0, purchasePrice - residualValue) / usefulLifeYears;
  const perDay = annual / 365;
  return +(perDay * periodDays).toFixed(2);
}

// Cash cost excludes depreciation; total cost includes it.
export function cashCost(b: CostBuckets): number {
  return +(b.fuel + b.maintenance + b.tyres + b.insurance + b.salik + b.fines).toFixed(2);
}

export function totalCostWithDepreciation(b: CostBuckets): number {
  return +(cashCost(b) + b.depreciation).toFixed(2);
}

// Cost-per-km = total cost ÷ km run over the period (km from odometer deltas).
export function costPerKm(totalCost: number, kmRun: number): number | null {
  if (kmRun <= 0) return null;
  return +(totalCost / kmRun).toFixed(3);
}
