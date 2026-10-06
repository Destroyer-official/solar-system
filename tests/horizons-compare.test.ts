import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { newtonianGravity } from '@/physics/forces/gravity';
import { AU_KM } from '@/data/constants';
import type { SystemState } from '@/physics/types';
import reference from './fixtures/horizons-reference.json';

const DT = 0.1; // fine step for validation (the app uses 0.5; Phase 3 closes this gap)
// Starting ceilings (AU). First run prints the real errors: then set each to ~3x measured.
const TOL_AU: Record<string, number> = {
  '365.25': 2e-4,
  '3652.5': 2e-3,
  '18262.5': 2e-2,
  '-3652.5': 2e-3,
};

const model = loadSystem();
type Ref = { offsetDays: number; bodies: Record<string, number[]> };
const samples = reference.samples as unknown as Ref[];

function advanceTo(s: SystemState, lf: Leapfrog, t: number): void {
  const n = Math.max(1, Math.ceil(Math.abs(t - s.t) / DT));
  const h = (t - s.t) / n;
  for (let i = 0; i < n; i++) lf.step(s, [newtonianGravity], h);
}

function run(group: Ref[]) {
  const s = cloneState(model.state),
    lf = new Leapfrog();
  const rows: { offsetDays: number; id: string; errAu: number; errKm: number }[] = [];
  for (const r of group) {
    advanceTo(s, lf, r.offsetDays);
    model.ids.forEach((id, i) => {
      const p = r.bodies[id]!;
      const err = Math.hypot(s.pos[3 * i]! - p[0]!, s.pos[3 * i + 1]! - p[1]!, s.pos[3 * i + 2]! - p[2]!);
      rows.push({ offsetDays: r.offsetDays, id, errAu: err, errKm: Math.round(err * AU_KM) });
    });
  }
  return rows;
}

describe('N-body vs JPL Horizons (position error)', () => {
  it('fixture epoch matches the loaded body data', () => {
    expect(reference.epochJd).toBe(model.epochJd);
  });

  const groups: Array<[string, Ref[]]> = [
    ['forward', samples.filter((r) => r.offsetDays > 0).sort((a, b) => a.offsetDays - b.offsetDays)],
    ['backward', samples.filter((r) => r.offsetDays < 0).sort((a, b) => b.offsetDays - a.offsetDays)],
  ];
  it.each(groups)('%s', (_name, group) => {
    const rows = run(group);
    console.table(rows.map((r) => ({ ...r, errAu: r.errAu.toExponential(2) })));
    for (const r of rows) {
      expect(r.errAu, `${r.id} at ${r.offsetDays} d`).toBeLessThan(TOL_AU[String(r.offsetDays)]!);
    }
  }, 120_000);
});
