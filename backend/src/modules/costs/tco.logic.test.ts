import {
  cashCost,
  costPerKm,
  depreciationForPeriod,
  emptyBuckets,
  totalCostWithDepreciation,
} from './tco.logic';

describe('tco.logic', () => {
  it('straight-line depreciation prorates over the period', () => {
    // (100000 - 20000) / 5 = 16000/yr → /365 * 365 = 16000 for a full year
    const dep = depreciationForPeriod({ purchasePrice: 100000, residualValue: 20000, usefulLifeYears: 5, periodDays: 365 });
    expect(dep).toBeCloseTo(16000, 0);
  });

  it('depreciation is zero with non-positive life', () => {
    expect(depreciationForPeriod({ purchasePrice: 100000, residualValue: 0, usefulLifeYears: 0, periodDays: 365 })).toBe(0);
  });

  it('cash cost excludes depreciation; total includes it', () => {
    const b = { ...emptyBuckets(), fuel: 1000, maintenance: 500, tyres: 200, fines: 300, depreciation: 4000 };
    expect(cashCost(b)).toBe(2000);
    expect(totalCostWithDepreciation(b)).toBe(6000);
  });

  it('cost-per-km divides total cost by km run', () => {
    expect(costPerKm(2000, 5000)).toBe(0.4);
  });

  it('cost-per-km is null when no distance', () => {
    expect(costPerKm(2000, 0)).toBeNull();
  });

  it('reconciles a manual spot check', () => {
    // Vehicle ran 4000 km; fuel 1200, maintenance 800, fine 200; dep 2000.
    const b = { ...emptyBuckets(), fuel: 1200, maintenance: 800, fines: 200, depreciation: 2000 };
    const total = totalCostWithDepreciation(b); // 4200
    expect(total).toBe(4200);
    expect(costPerKm(total, 4000)).toBeCloseTo(1.05, 2);
    expect(costPerKm(cashCost(b), 4000)).toBeCloseTo(0.55, 2); // cash 2200 / 4000
  });
});
