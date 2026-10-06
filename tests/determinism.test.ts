import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida6 } from '@/physics/integrators/yoshida';
import { newtonianGravity } from '@/physics/forces/gravity';
import { Engine } from '@/sim/engine';
import { PHASE1_BODIES } from './fixtures/phase1';

const forces = [newtonianGravity];
const model = loadSystem(PHASE1_BODIES);

describe('Determinism and Fixed-Step Stepping', () => {
  it('fixed-step results do not depend on how time is chunked', () => {
    const mk = () => new Engine(cloneState(model.state), forces, yoshida6(new Leapfrog()), 1, 4000);
    const a = mk(),
      b = mk();
    a.advanceFixed(100.5, 1);
    for (let i = 0; i < 335; i++) b.advanceFixed(0.3, 1); // 100.5 days in tiny chunks
    expect(b.state.pos).toEqual(a.state.pos); // bit-identical
    expect(b.carry).toBeCloseTo(0.5, 12);
  });
});
