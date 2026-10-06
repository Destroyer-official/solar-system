import { describe, it, expect } from 'vitest';
import { gmToInternal, GM_SUN_KM3_S2, kmsToAuDay, auDayToKms } from '@/data/constants';

describe('units', () => {
  it('Sun GM matches the Gaussian constant k^2 to ~1e-8 relative', () => {
    const k2 = 0.01720209895 ** 2;
    expect(Math.abs(gmToInternal(GM_SUN_KM3_S2) - k2) / k2).toBeLessThan(1e-8);
  });
  it('Earth orbital speed ~29.78 km/s is ~0.0172 AU/day', () => {
    expect(kmsToAuDay(29.78)).toBeCloseTo(0.0172, 4);
  });
  it('velocity conversion round-trips', () => {
    expect(auDayToKms(kmsToAuDay(12.3456))).toBeCloseTo(12.3456, 12);
  });
});
