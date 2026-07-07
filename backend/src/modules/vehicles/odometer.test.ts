import { assertOdometerNotDecreasing } from './odometer';
import { AppError } from '../../lib/errors';

describe('odometer validation', () => {
  it('allows an increasing odometer', () => {
    expect(() => assertOdometerNotDecreasing(10000, 10500)).not.toThrow();
  });

  it('allows an equal odometer', () => {
    expect(() => assertOdometerNotDecreasing(10000, 10000)).not.toThrow();
  });

  it('rejects a decreasing odometer', () => {
    expect(() => assertOdometerNotDecreasing(10000, 9000)).toThrow(AppError);
  });

  it('allows a decrease only for an explicit manager correction', () => {
    expect(() => assertOdometerNotDecreasing(10000, 9000, { isManagerCorrection: true })).not.toThrow();
  });
});
