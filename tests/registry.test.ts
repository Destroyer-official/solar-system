import { it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { centerOfMass } from '@/physics/diagnostics';

it('loaded system is barycentric: COM at origin and at rest', () => {
  const { state } = loadSystem();
  const c = centerOfMass(state);
  for (const v of [...c.pos, ...c.vel]) expect(Math.abs(v)).toBeLessThan(1e-12);
});

it('Sun is first (heaviest) and is NOT at the origin', () => {
  const m = loadSystem();
  expect(m.ids[0]).toBe('sun');
  expect(Math.hypot(m.state.pos[0]!, m.state.pos[1]!, m.state.pos[2]!)).toBeGreaterThan(1e-3);
});
