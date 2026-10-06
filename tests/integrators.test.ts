import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida4, yoshida6 } from '@/physics/integrators/yoshida';
import { newtonianGravity } from '@/physics/forces/gravity';
import { totalEnergy } from '@/physics/diagnostics';
import type { Integrator } from '@/physics/types';
import { PHASE1_BODIES } from './fixtures/phase1';

const forces = [newtonianGravity];
const model = loadSystem(PHASE1_BODIES);
const S = model.ids.indexOf('sun');
const J = model.ids.indexOf('jupiter');
const A = 5.202887;
const gmS = model.state.gm[S]!;
const gmJ = model.state.gm[J]!;
const T = 2 * Math.PI * Math.sqrt(A ** 3 / (gmS + gmJ));

function maxEnergyError(it: Integrator, dt: number, days: number): number {
  const s = cloneState(model.state);
  const e0 = totalEnergy(s);
  let worst = 0;
  for (let i = 0, n = Math.round(days / dt); i < n; i++) {
    it.step(s, forces, dt);
    worst = Math.max(worst, Math.abs((totalEnergy(s) - e0) / e0));
  }
  return worst;
}

describe('Higher-order Yoshida integrators', () => {
  const y4 = yoshida4(new Leapfrog());
  const y6 = yoshida6(new Leapfrog());

  it('yoshida4 is 4th order', () => {
    const r = maxEnergyError(y4, 8, T) / maxEnergyError(y4, 4, T); // halving dt
    expect(r).toBeGreaterThan(11);
    expect(r).toBeLessThan(22); // ideal 16
  });

  it('yoshida6 is 6th order (skip if both errors are at roundoff)', () => {
    const e1 = maxEnergyError(y6, 20, T);
    const e2 = maxEnergyError(y6, 10, T);
    if (e2 > 1e-13) {
      const r = e1 / e2;
      expect(r).toBeGreaterThan(40);
      expect(r).toBeLessThan(90); // ideal 64
    }
  });
});
