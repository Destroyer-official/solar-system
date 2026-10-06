import { describe, it, expect } from 'vitest';
import { SolarQuadrupole } from '@/physics/forces/quadrupole';
import type { SystemState } from '@/physics/types';

describe('SolarQuadrupole (J2)', () => {
  it('conserves total system momentum (Newton third law reaction on Sun)', () => {
    const s: SystemState = {
      t: 0,
      n: 2,
      gm: new Float64Array([1000, 1]),
      pos: new Float64Array([0, 0, 0, 1, 0.5, 0.2]),
      vel: new Float64Array(6),
    };
    const acc = new Float64Array(6);
    const j2 = new SolarQuadrupole(0);
    j2.apply(s, acc);

    // Sum of m * a should be zero
    const pX = s.gm[0]! * acc[0]! + s.gm[1]! * acc[3]!;
    const pY = s.gm[0]! * acc[1]! + s.gm[1]! * acc[4]!;
    const pZ = s.gm[0]! * acc[2]! + s.gm[1]! * acc[5]!;
    expect(Math.hypot(pX, pY, pZ)).toBeCloseTo(0, 14);
  });

  it('equatorial acceleration is inward toward Sun, polar perturbation is outward', () => {
    const j2 = new SolarQuadrupole(0, 2.2e-7, 695700, [0, 0, 1]);

    // Body on equatorial plane (+x axis)
    const sEq: SystemState = {
      t: 0,
      n: 2,
      gm: new Float64Array([1000, 1]),
      pos: new Float64Array([0, 0, 0, 1, 0, 0]),
      vel: new Float64Array(6),
    };
    const accEq = new Float64Array(6);
    j2.apply(sEq, accEq);
    expect(accEq[3]).toBeLessThan(0); // extra mass at equator pulls inward (-x)

    // Body on polar axis (+z axis)
    const sPole: SystemState = {
      t: 0,
      n: 2,
      gm: new Float64Array([1000, 1]),
      pos: new Float64Array([0, 0, 0, 0, 0, 1]),
      vel: new Float64Array(6),
    };
    const accPole = new Float64Array(6);
    j2.apply(sPole, accPole);
    expect(accPole[5]).toBeGreaterThan(0); // polar perturbation opposes Newtonian pull (+z)
  });
});
