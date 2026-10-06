import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { newtonianGravity } from '@/physics/forces/gravity';
import { angularMomentum, centerOfMass, totalEnergy } from '@/physics/diagnostics';
import { Engine } from '@/sim/engine';
import { AU_KM } from '@/data/constants';
import { PHASE1_BODIES } from './fixtures/phase1';

const forces = [newtonianGravity];
const model = loadSystem(PHASE1_BODIES);
const S = model.ids.indexOf('sun'),
  J = model.ids.indexOf('jupiter');
const A = 5.202887,
  E = 0.04838624;
const gmS = model.state.gm[S]!,
  gmJ = model.state.gm[J]!;
const mu = gmJ / (gmS + gmJ); // Sun's share of the separation
const keplerPeriod = 2 * Math.PI * Math.sqrt(A ** 3 / (gmS + gmJ));
const sunDist = (s: ReturnType<typeof cloneState>) =>
  Math.hypot(s.pos[3 * S]!, s.pos[3 * S + 1]!, s.pos[3 * S + 2]!);

function maxEnergyError(dt: number, days: number): number {
  const s = cloneState(model.state),
    lf = new Leapfrog();
  const e0 = totalEnergy(s);
  let worst = 0;
  for (let i = 0, n = Math.round(days / dt); i < n; i++) {
    lf.step(s, forces, dt);
    worst = Math.max(worst, Math.abs((totalEnergy(s) - e0) / e0));
  }
  return worst;
}

describe('Sun + Jupiter, leapfrog', () => {
  it('Kepler period is about 11.86 years (sanity check on data + units)', () => {
    expect(keplerPeriod / 365.25).toBeGreaterThan(11.8);
    expect(keplerPeriod / 365.25).toBeLessThan(11.9);
  });

  it('conserves energy, angular momentum, and barycenter over ~100 Jupiter orbits', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    const e0 = totalEnergy(s),
      l0 = angularMomentum(s);
    let worstE = 0;
    for (let i = 0; i < Math.round(100 * keplerPeriod); i++) {
      lf.step(s, forces, 1);
      if (i % 100 === 0) worstE = Math.max(worstE, Math.abs((totalEnergy(s) - e0) / e0));
    }
    const l1 = angularMomentum(s);
    const dL =
      Math.hypot(l1[0]! - l0[0]!, l1[1]! - l0[1]!, l1[2]! - l0[2]!) / Math.hypot(...l0);
    expect(worstE).toBeLessThan(1e-5); // expect ~1e-7; much worse means a bug
    expect(dL).toBeLessThan(1e-10);
    expect(Math.hypot(...centerOfMass(s).pos)).toBeLessThan(1e-10);
  });

  it('is 2nd order: halving dt cuts the energy error ~4x', () => {
    const ratio = maxEnergyError(2, 2 * keplerPeriod) / maxEnergyError(1, 2 * keplerPeriod);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(5);
  });

  it('is time-reversible: forward then backward returns to the start', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    for (let i = 0; i < 2000; i++) lf.step(s, forces, 1);
    for (let i = 0; i < 2000; i++) lf.step(s, forces, -1);
    for (let k = 0; k < s.pos.length; k++)
      expect(Math.abs(s.pos[k]! - model.state.pos[k]!)).toBeLessThan(1e-11);
  });

  it('simulated orbital period matches Kepler to 1e-5', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    const ang = () =>
      Math.atan2(s.pos[3 * J + 1]! - s.pos[3 * S + 1]!, s.pos[3 * J]! - s.pos[3 * S]!);
    let prev = ang(),
      total = 0,
      measured = NaN;
    for (let i = 0; i < 6000; i++) {
      const tBefore = s.t;
      lf.step(s, forces, 1);
      let d = ang() - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      if (total + d >= 2 * Math.PI) {
        measured = tBefore + ((2 * Math.PI - total) / d) * 1;
        break;
      }
      total += d;
      prev = ang();
    }
    expect(Math.abs(measured - keplerPeriod) / keplerPeriod).toBeLessThan(1e-5);
  });

  it('Sun wobble: stays 1.0-1.13 solar radii from the barycenter, matching mu*a*(1±e)', () => {
    const s = cloneState(model.state),
      lf = new Leapfrog();
    let min = Infinity,
      max = 0;
    for (let i = 0; i < Math.ceil(keplerPeriod) + 5; i++) {
      lf.step(s, forces, 1);
      const d = sunDist(s);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(Math.abs(max - mu * A * (1 + E)) / max).toBeLessThan(1e-4);
    expect(Math.abs(min - mu * A * (1 - E)) / min).toBeLessThan(1e-4);
    const rSunAu = model.radiusKm[S]! / AU_KM;
    expect(min).toBeGreaterThan(rSunAu); // barycenter is outside the Sun's surface
    expect(max / rSunAu).toBeLessThan(1.13);
  });
});

describe('Engine', () => {
  it('advance() splits large intervals and respects the step cap', () => {
    const eng = new Engine(cloneState(model.state), forces, new Leapfrog(), 1, 5000);
    expect(eng.advance(10)).toBe(10);
    expect(eng.advance(1e9)).toBe(5000);
    expect(eng.advance(-3)).toBe(-3);
  });
  it('reset() restores the initial state', () => {
    const eng = new Engine(cloneState(model.state), forces, new Leapfrog());
    eng.advance(500);
    eng.reset();
    expect(eng.state.t).toBe(0);
    expect(eng.state.pos[0]).toBe(model.state.pos[0]);
  });
});
