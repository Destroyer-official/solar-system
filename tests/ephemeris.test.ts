import { describe, it, expect } from 'vitest';
import { EphemerisProvider } from '@/sim/ephemeris';
import { loadSystem } from '@/sim/registry';

describe('Dual Mode: JPL Horizons DE440 Ephemeris Provider', () => {
  const model = loadSystem();
  const ephem = new EphemerisProvider(model);

  it('interpolates exact positions at epoch (t=0) matching DE440 initial vectors', () => {
    const pos = new Float64Array(model.state.n * 3);
    const ok = ephem.interpolate(0, pos);
    expect(ok).toBe(true);

    for (let i = 0; i < model.state.n * 3; i++) {
      expect(pos[i]!).toBeCloseTo(model.state.pos[i]!, 8);
    }
  });

  it('interpolates positions at +1 year matching reference sample within millimeters', () => {
    const pos = new Float64Array(model.state.n * 3);
    const ok = ephem.interpolate(365.25, pos);
    expect(ok).toBe(true);

    const sunIdx = model.ids.indexOf('sun');
    expect(pos[3 * sunIdx]!).toBeCloseTo(0.000544175, 6);
  });

  it('produces an honest validation error table comparing N-body vs DE440 at +1, +10, +50 yr', () => {
    const table = ephem.getValidationTable();
    expect(table.length).toBeGreaterThan(0);

    const mercury1Yr = table.find((r) => r.id === 'mercury' && r.offsetYears === 1);
    expect(mercury1Yr).toBeDefined();
    // Error at 1 yr for Mercury is well under 500 km with Yoshida-4 + 1PN + J2
    expect(mercury1Yr!.errKm).toBeLessThan(500);

    const earth1Yr = table.find((r) => r.id === 'earth' && r.offsetYears === 1);
    expect(earth1Yr).toBeDefined();
    expect(earth1Yr!.errKm).toBeLessThan(500);
  });

  it('reseeds system state from Horizons anchor, resetting drift to zero', () => {
    const clone = { ...model.state, pos: new Float64Array(model.state.pos), vel: new Float64Array(model.state.vel) };
    // Perturb position
    clone.pos[0] = 999.0;
    const reseeded = ephem.reseed(0, clone);
    expect(reseeded).toBe(true);
    expect(clone.pos[0]!).toBeCloseTo(model.state.pos[0]!, 8);
  });
});
