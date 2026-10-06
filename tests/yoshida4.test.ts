import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Yoshida4 } from '@/physics/integrators/yoshida4';
import { newtonianGravity } from '@/physics/forces/gravity';
import { totalEnergy } from '@/physics/diagnostics';
import { PHASE1_BODIES } from './fixtures/phase1';

const forces = [newtonianGravity];
const model = loadSystem(PHASE1_BODIES);
const S = model.ids.indexOf('sun'),
  J = model.ids.indexOf('jupiter');
const A = 5.202887;
const gmS = model.state.gm[S]!,
  gmJ = model.state.gm[J]!;
const keplerPeriod = 2 * Math.PI * Math.sqrt(A ** 3 / (gmS + gmJ));

function maxEnergyError(dt: number, days: number): number {
  const s = cloneState(model.state),
    y4 = new Yoshida4();
  const e0 = totalEnergy(s);
  let worst = 0;
  for (let i = 0, n = Math.round(days / Math.abs(dt)); i < n; i++) {
    y4.step(s, forces, dt);
    worst = Math.max(worst, Math.abs((totalEnergy(s) - e0) / e0));
  }
  return worst;
}

describe('Yoshida4 symplectic integrator', () => {
  it('is 4th order: halving dt cuts energy error by ~16x (2^4)', () => {
    const err2 = maxEnergyError(2, keplerPeriod);
    const err1 = maxEnergyError(1, keplerPeriod);
    const ratio = err2 / err1;
    // 4th order ratio: 2^4 = 16. Allow numerical tolerance between 13 and 19
    expect(ratio).toBeGreaterThan(13);
    expect(ratio).toBeLessThan(19);
  });

  it('is time-reversible: forward then backward returns to start', () => {
    const s = cloneState(model.state),
      y4 = new Yoshida4();
    for (let i = 0; i < 1000; i++) y4.step(s, forces, 1);
    for (let i = 0; i < 1000; i++) y4.step(s, forces, -1);
    for (let k = 0; k < s.pos.length; k++) {
      expect(Math.abs(s.pos[k]! - model.state.pos[k]!)).toBeLessThan(1e-12);
    }
  });

  it('achieves ~1e-10 energy drift over 10 Jupiter orbits', () => {
    const s = cloneState(model.state),
      y4 = new Yoshida4();
    const e0 = totalEnergy(s);
    let worst = 0;
    for (let i = 0; i < Math.round(10 * keplerPeriod); i++) {
      y4.step(s, forces, 1);
      worst = Math.max(worst, Math.abs((totalEnergy(s) - e0) / e0));
    }
    expect(worst).toBeLessThan(1e-9);
  });
});
