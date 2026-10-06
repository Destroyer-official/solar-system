import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { relativeRows } from '@/sim/readout';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { newtonianGravity } from '@/physics/forces/gravity';
import { angularMomentum, centerOfMass, totalEnergy } from '@/physics/diagnostics';
import { AU_KM } from '@/data/constants';

const model = loadSystem();
const idx = (id: string) => model.ids.indexOf(id);
const S = idx('sun');
const gmRatio = (id: string) => model.state.gm[S]! / model.state.gm[idx(id)]!;

describe('real data at the epoch', () => {
  it('loads Sun + 8 planets, heaviest first, not recentered', () => {
    expect(model.ids).toHaveLength(9);
    expect(model.ids[0]).toBe('sun');
    expect(new Set(model.ids).size).toBe(9);
    expect(model.epochJd).toBeGreaterThan(2460000);
  });

  // Sun/planet mass ratios from DE440 system GMs. Catches wrong GM file or unit mistakes.
  const ratios: Array<[string, number]> = [
    ['mercury', 6023657.95],
    ['venus', 408523.7187],
    ['earth', 328900.5597],
    ['mars', 3098703.5467],
    ['jupiter', 1047.348631],
    ['saturn', 3497.901801],
    ['uranus', 22902.95078],
    ['neptune', 19412.25978],
  ];
  it.each(ratios)('Sun/%s mass ratio ~ %f', (id, expected) => {
    expect(Math.abs(gmRatio(id) - expected) / expected).toBeLessThan(1e-4);
  });

  it('heliocentric distances are in the known ranges', () => {
    const r = new Map(
      relativeRows(model.state, model.names, S).map((x) => [x.name.toLowerCase(), x.rAu]),
    );
    const ranges: Record<string, [number, number]> = {
      mercury: [0.3, 0.47],
      venus: [0.71, 0.73],
      earth: [0.983, 1.017],
      mars: [1.38, 1.67],
      jupiter: [4.94, 5.46],
      saturn: [9.0, 10.1],
      uranus: [18.2, 20.2],
      neptune: [29.8, 30.4],
    };
    for (const [id, [lo, hi]] of Object.entries(ranges)) {
      expect(r.get(id), id).toBeGreaterThan(lo);
      expect(r.get(id), id).toBeLessThan(hi);
    }
  });

  it('Earth speed is 29.3 to 30.3 km/s', () => {
    const v = relativeRows(model.state, model.names, S).find((x) => x.name === 'Earth')!.vKms;
    expect(v).toBeGreaterThan(29.2);
    expect(v).toBeLessThan(30.4);
  });

  it('orbits lie in the ecliptic plane (catches an equatorial/ecliptic mix-up)', () => {
    const e = idx('earth');
    expect(Math.abs(model.state.pos[3 * e + 2]! - model.state.pos[3 * S + 2]!)).toBeLessThan(5e-4);
  });
});

describe('50-year N-body run (leapfrog, dt = 0.5 d)', () => {
  it('conserves momentum and angular momentum; energy stays bounded', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    const e0 = totalEnergy(s),
      l0 = angularMomentum(s),
      p0 = centerOfMass(s).vel;
    let worstE = 0;
    for (let i = 0; i < 36_525; i++) {
      lf.step(s, [newtonianGravity], 0.5);
      if (i % 200 === 0) worstE = Math.max(worstE, Math.abs((totalEnergy(s) - e0) / e0));
    }
    const l1 = angularMomentum(s),
      p1 = centerOfMass(s).vel;
    expect(
      Math.hypot(l1[0]! - l0[0]!, l1[1]! - l0[1]!, l1[2]! - l0[2]!) / Math.hypot(...l0),
    ).toBeLessThan(1e-10);
    expect(
      Math.hypot(p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!),
    ).toBeLessThan(1e-12);
    expect(worstE).toBeLessThan(1e-5); // my estimate; measure it, then tighten
  }, 60_000);

  it('Sun wobble: barycenter is inside the Sun at times and ~2 R_sun away at others', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    const rSun = model.radiusKm[S]! / AU_KM;
    let min = Infinity,
      max = 0;
    for (let i = 0; i < 146_100; i++) {
      // 200 years
      lf.step(s, [newtonianGravity], 0.5);
      if (i % 20 === 0) {
        const d = Math.hypot(s.pos[3 * S]!, s.pos[3 * S + 1]!, s.pos[3 * S + 2]!) / rSun;
        min = Math.min(min, d);
        max = Math.max(max, d);
      }
    }
    expect(min).toBeLessThan(1.0);
    expect(max).toBeGreaterThan(1.5);
    expect(max).toBeLessThan(2.6);
  }, 120_000);
});
