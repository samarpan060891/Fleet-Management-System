import {
  daysUntil,
  evaluateCompliance,
  evaluateFineAging,
  evaluateMaintenance,
  evaluateWarranty,
} from './alerts.logic';

describe('alerts.logic', () => {
  const now = new Date('2026-01-15T12:00:00Z');

  describe('daysUntil', () => {
    it('is positive for future dates', () => {
      expect(daysUntil(new Date('2026-01-25'), now)).toBe(10);
    });
    it('is negative for past dates', () => {
      expect(daysUntil(new Date('2026-01-05'), now)).toBe(-10);
    });
    it('is zero for the same day', () => {
      expect(daysUntil(new Date('2026-01-15T23:00:00Z'), now)).toBe(0);
    });
  });

  describe('evaluateCompliance', () => {
    const windows = [60, 30, 15, 7];
    it('flags overdue documents red and daily', () => {
      const r = evaluateCompliance(-3, windows);
      expect(r).toMatchObject({ severity: 'red', shouldAlert: true, overdue: true });
    });
    it('flags within smallest window red', () => {
      expect(evaluateCompliance(5, windows)).toMatchObject({ severity: 'red', shouldAlert: true, overdue: false });
      expect(evaluateCompliance(7, windows)).toMatchObject({ severity: 'red', shouldAlert: true });
    });
    it('flags larger windows amber', () => {
      expect(evaluateCompliance(20, windows)).toMatchObject({ severity: 'amber', shouldAlert: true });
      expect(evaluateCompliance(59, windows)).toMatchObject({ severity: 'amber', shouldAlert: true });
    });
    it('does not alert well before the first window', () => {
      expect(evaluateCompliance(90, windows)).toMatchObject({ severity: 'green', shouldAlert: false });
    });
  });

  describe('evaluateMaintenance', () => {
    it('is red when km overdue', () => {
      expect(evaluateMaintenance({ kmToNext: -10, daysToNext: 40, dueKm: 500, dueDays: 15 }))
        .toMatchObject({ severity: 'red', overdue: true });
    });
    it('is red when days overdue', () => {
      expect(evaluateMaintenance({ kmToNext: 2000, daysToNext: -1, dueKm: 500, dueDays: 15 }))
        .toMatchObject({ severity: 'red', overdue: true });
    });
    it('is amber when within due window (km or days)', () => {
      expect(evaluateMaintenance({ kmToNext: 300, daysToNext: 40, dueKm: 500, dueDays: 15 }))
        .toMatchObject({ severity: 'amber', shouldAlert: true });
      expect(evaluateMaintenance({ kmToNext: 3000, daysToNext: 10, dueKm: 500, dueDays: 15 }))
        .toMatchObject({ severity: 'amber', shouldAlert: true });
    });
    it('is green when far from due', () => {
      expect(evaluateMaintenance({ kmToNext: 3000, daysToNext: 100, dueKm: 500, dueDays: 15 }))
        .toMatchObject({ severity: 'green', shouldAlert: false });
    });
  });

  describe('evaluateFineAging', () => {
    it('flags fines older than threshold', () => {
      expect(evaluateFineAging(31, 30)).toBe(true);
      expect(evaluateFineAging(30, 30)).toBe(false);
    });
  });

  describe('evaluateWarranty', () => {
    it('is red when expired by date or km', () => {
      expect(evaluateWarranty({ daysToEnd: -1, kmToEnd: 5000 })).toMatchObject({ severity: 'red' });
      expect(evaluateWarranty({ daysToEnd: 100, kmToEnd: -50 })).toMatchObject({ severity: 'red' });
    });
    it('is amber when near end', () => {
      expect(evaluateWarranty({ daysToEnd: 20, kmToEnd: 5000 })).toMatchObject({ severity: 'amber', shouldAlert: true });
      expect(evaluateWarranty({ daysToEnd: 100, kmToEnd: 800 })).toMatchObject({ severity: 'amber', shouldAlert: true });
    });
    it('is green when far off', () => {
      expect(evaluateWarranty({ daysToEnd: 200, kmToEnd: 5000 })).toMatchObject({ severity: 'green', shouldAlert: false });
    });
  });
});
