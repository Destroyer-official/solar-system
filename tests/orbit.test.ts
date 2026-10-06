import { it, expect } from 'vitest';
import { perihelionState } from '@/physics/orbit';

it('circular orbit: r = a, v = sqrt(GM/a)', () => {
  const o = perihelionState(1, 1, 0, 0);
  expect(o.pos).toEqual([1, 0, 0]);
  expect(o.vel[1]).toBeCloseTo(1, 14);
});

it('eccentric orbit satisfies vis-viva energy = -GM/(2a)', () => {
  const o = perihelionState(1, 1, 0.5, 0);
  const energy = 0.5 * o.vel[1]! ** 2 - 1 / o.pos[0]!;
  expect(energy).toBeCloseTo(-0.5, 14);
});
