import { describe, it, expect } from 'vitest';
import { buildDefs } from '@/sim/registry';
import { createState, recenterToBarycenter } from '@/physics/system';
import { stateToElements } from '@/physics/kepler';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida6 } from '@/physics/integrators/yoshida';
import { PHASE1_BODIES } from './fixtures/phase1';
import { DEFAULT_CONFIG } from '@/sim/config';
import { buildForces } from '@/sim/forces';
import { oblateness } from '@/physics/forces/oblateness';
import { newtonianGravity } from '@/physics/forces/gravity';
import type { Vec3, SystemState } from '@/physics/types';

describe('Relativistic and Quadrupole Precession', () => {
  const mercury = {
    id: 'mercury',
    name: 'Mercury',
    gmKm3S2: 22031.868551,
    radiusKm: 2439.7,
    color: '#aaa',
    initial: { type: 'elements', parent: 'sun', aAu: 0.38709927, e: 0.20563593, incDeg: 0 },
  } as const;

  function varpi(gr: boolean, years: number): number {
    const defs = buildDefs([PHASE1_BODIES[0]!, mercury as never]);
    const s = createState(defs);
    recenterToBarycenter(s);
    const forces = buildForces(
      defs.map((d) => d.id),
      { ...DEFAULT_CONFIG, gr, sunJ2: false },
    );
    const it = yoshida6(new Leapfrog()),
      dt = 0.5;
    const N = Math.round((years * 365.25) / dt),
      tail = 400;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      it.step(s, forces, dt);
      if (i >= N - tail) {
        const r = [0, 1, 2].map((k) => s.pos[3 + k]! - s.pos[k]!) as [number, number, number];
        const v = [0, 1, 2].map((k) => s.vel[3 + k]! - s.vel[k]!) as [number, number, number];
        const el = stateToElements(s.gm[0]! + s.gm[1]!, r, v);
        let angle = el.node + el.argPeri;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        sum += angle;
      }
    }
    return sum / tail;
  }

  it(
    'GR adds 42.98 arcsec/century to Mercury perihelion precession',
    () => {
      const rad = varpi(true, 100) - varpi(false, 100);
      const arcsec = (rad * 180 * 3600) / Math.PI;
      expect(arcsec).toBeGreaterThan(42.5);
      expect(arcsec).toBeLessThan(43.4);
    },
    120_000,
  );

  it('Sun J2 oblateness matches closed-form precession rate within 3%', () => {
    // Large J2 = 1e-3, R = 0.1, GM = 1, e = 0.05, a = 1.0, pole = +z
    const gmHost = 1.0;
    const j2 = 1e-3;
    const R = 0.1;
    const a = 1.0;
    const e = 0.05;
    const p = a * (1 - e * e);
    const n = Math.sqrt(gmHost / (a * a * a));
    const theoreticalRate = 1.5 * n * j2 * ((R / p) * (R / p)); // rad per unit time

    // State with host at index 0, test body at index 1
    const rPeri = a * (1 - e);
    const vPeri = Math.sqrt((gmHost * (1 + e)) / rPeri);
    const s: SystemState = {
      t: 0,
      n: 2,
      gm: new Float64Array([gmHost, 0]),
      pos: new Float64Array([0, 0, 0, rPeri, 0, 0]),
      vel: new Float64Array([0, 0, 0, 0, vPeri, 0]),
    };

    const pole = (): Vec3 => [0, 0, 1];
    const forces = [newtonianGravity, oblateness(0, j2, R, pole)];
    const it = yoshida6(new Leapfrog());
    const dt = 0.05;
    const orbits = 200;
    const period = (2 * Math.PI) / n;
    const totalTime = orbits * period;
    const steps = Math.round(totalTime / dt);

    for (let i = 0; i < steps; i++) {
      it.step(s, forces, dt);
    }

    const r = [s.pos[3]!, s.pos[4]!, s.pos[5]!] as Vec3;
    const v = [s.vel[3]!, s.vel[4]!, s.vel[5]!] as Vec3;
    const el = stateToElements(gmHost, r, v);
    let measuredPrecession = el.node + el.argPeri;
    while (measuredPrecession < 0) measuredPrecession += 2 * Math.PI;

    const expectedPrecession = theoreticalRate * totalTime;
    const relDiff = Math.abs(measuredPrecession - expectedPrecession) / expectedPrecession;
    expect(relDiff).toBeLessThan(0.03); // Within 3% tolerance
  });
});
