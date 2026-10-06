import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Yoshida4 } from '@/physics/integrators/yoshida4';
import { newtonianGravity } from '@/physics/forces/gravity';
import { GeneralRelativity } from '@/physics/forces/relativity';
import { SolarQuadrupole } from '@/physics/forces/quadrupole';
import { AU_KM } from '@/data/constants';
import type { SystemState } from '@/physics/types';
import reference from './fixtures/horizons-reference.json';

const DT = 0.1;
const model = loadSystem();
type Ref = { offsetDays: number; bodies: Record<string, number[]> };
const samples = reference.samples as unknown as Ref[];

const forces = [newtonianGravity, new GeneralRelativity(0), new SolarQuadrupole(0)];

function advanceTo(s: SystemState, y4: Yoshida4, t: number): void {
  const n = Math.max(1, Math.ceil(Math.abs(t - s.t) / DT));
  const h = (t - s.t) / n;
  for (let i = 0; i < n; i++) y4.step(s, forces, h);
}

function run(group: Ref[]) {
  const s = cloneState(model.state),
    y4 = new Yoshida4();
  const rows: { offsetDays: number; id: string; errAu: number; errKm: number }[] = [];
  for (const r of group) {
    advanceTo(s, y4, r.offsetDays);
    model.ids.forEach((id, i) => {
      const p = r.bodies[id]!;
      const err = Math.hypot(s.pos[3 * i]! - p[0]!, s.pos[3 * i + 1]! - p[1]!, s.pos[3 * i + 2]! - p[2]!);
      rows.push({ offsetDays: r.offsetDays, id, errAu: err, errKm: Math.round(err * AU_KM) });
    });
  }
  return rows;
}

describe('Phase 3 N-body vs JPL Horizons (Yoshida-4 + 1PN + J2)', () => {
  it('measures high-precision position errors across all planets', () => {
    const fwd = samples.filter((r) => r.offsetDays > 0).sort((a, b) => a.offsetDays - b.offsetDays);
    const rows = run(fwd);
    console.log('--- Phase 3 (Yoshida-4 + 1PN + J2) vs Horizons ---');
    console.table(rows.map((r) => ({ ...r, errAu: r.errAu.toExponential(2) })));

    // Mercury at +10 yr error must be substantially smaller
    const merc10 = rows.find((r) => r.id === 'mercury' && r.offsetDays === 3652.5)!;
    expect(merc10.errAu).toBeLessThan(1.5e-3);
  }, 120_000);
});
