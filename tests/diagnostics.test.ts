import { describe, it, expect } from 'vitest';
import { centerOfMass } from '@/physics/diagnostics';
import type { SystemState } from '@/physics/types';

describe('diagnostics', () => {
  it('center of mass of two equal bodies is the midpoint', () => {
    const s: SystemState = {
      t: 0,
      n: 2,
      gm: new Float64Array([1, 1]),
      pos: new Float64Array([0, 0, 0, 2, 4, 6]),
      vel: new Float64Array(6),
    };
    expect(centerOfMass(s).pos).toEqual([1, 2, 3]);
  });
});
