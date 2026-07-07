import { computeEfficiency, detectAnomalies, rollingAverage } from './fuel.logic';

describe('fuel.logic', () => {
  describe('computeEfficiency', () => {
    it('computes km since last and km/litre', () => {
      expect(computeEfficiency(10400, 40, 10000)).toEqual({ kmSinceLast: 400, kmPerLitre: 10 });
    });
    it('returns nulls when odometer missing', () => {
      expect(computeEfficiency(null, 40, 10000)).toEqual({ kmSinceLast: null, kmPerLitre: null });
    });
    it('returns nulls when no previous reading', () => {
      expect(computeEfficiency(10400, 40, null)).toEqual({ kmSinceLast: null, kmPerLitre: null });
    });
    it('handles a non-increasing odometer gracefully', () => {
      expect(computeEfficiency(9000, 40, 10000)).toEqual({ kmSinceLast: -1000, kmPerLitre: null });
    });
  });

  describe('rollingAverage', () => {
    it('averages the last N valid efficiencies', () => {
      expect(rollingAverage([10, 12, 8, 11, 9, 10], 5)).toBeCloseTo((12 + 8 + 11 + 9 + 10) / 5, 5);
    });
    it('returns null with no data', () => {
      expect(rollingAverage([], 5)).toBeNull();
    });
  });

  describe('detectAnomalies', () => {
    const base = {
      odometer: 10400,
      kmPerLitre: 10,
      rollingAvg: 10,
      channel: 'vip_kit' as const,
      amount: 150,
      deviationPct: 20,
      cashThreshold: 200,
      approved: false,
    };

    it('flags missing odometer', () => {
      expect(detectAnomalies({ ...base, odometer: null })).toContain('missing_odometer');
    });

    it('flags efficiency deviation over threshold', () => {
      // 7 vs avg 10 → 30% deviation > 20%
      expect(detectAnomalies({ ...base, kmPerLitre: 7 })).toContain('efficiency_deviation');
    });

    it('does not flag efficiency within threshold', () => {
      expect(detectAnomalies({ ...base, kmPerLitre: 9 })).not.toContain('efficiency_deviation');
    });

    it('flags unapproved cash over threshold', () => {
      expect(detectAnomalies({ ...base, channel: 'cash', amount: 250, approved: false })).toContain(
        'unapproved_cash_over_threshold'
      );
    });

    it('does not flag approved cash over threshold', () => {
      expect(detectAnomalies({ ...base, channel: 'cash', amount: 250, approved: true })).not.toContain(
        'unapproved_cash_over_threshold'
      );
    });

    it('returns empty for a clean fill', () => {
      expect(detectAnomalies(base)).toEqual([]);
    });
  });
});
