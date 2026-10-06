import { it, expect } from 'vitest';
import { newtonianGravity } from '@/physics/forces/gravity';
import type { SystemState } from '@/physics/types';

it('two-body acceleration matches the analytic value and Newton 3rd law', () => {
  const s: SystemState = {
    t: 0,
    n: 2,
    gm: new Float64Array([3, 1]),
    pos: new Float64Array([0, 0, 0, 2, 0, 0]),
    vel: new Float64Array(6),
  };
  const acc = new Float64Array(6);
  newtonianGravity.apply(s, acc);
  expect(acc[0]).toBeCloseTo((1 * 2) / 8, 14); // body 0 pulled toward +x by gm=1 at r=2
  expect(acc[3]).toBeCloseTo((-3 * 2) / 8, 14);
  expect(3 * acc[0]! + 1 * acc[3]!).toBeCloseTo(0, 14); // momentum conservation
});
