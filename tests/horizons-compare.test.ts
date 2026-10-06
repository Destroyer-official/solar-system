import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { cloneState } from '@/physics/system';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida4, yoshida6 } from '@/physics/integrators/yoshida';
import { newtonianGravity } from '@/physics/forces/gravity';
import { buildForces } from '@/sim/forces';
import { DEFAULT_CONFIG } from '@/sim/config';
import { AU_KM } from '@/data/constants';
import type { ForceModel, Integrator, SystemState } from '@/physics/types';
import reference from './fixtures/horizons-reference.json';

const TOL_AU: Record<string, number> = {
  '365.25': 2e-4,
  '3652.5': 2e-3,
  '18262.5': 2e-2,
  '-3652.5': 2e-3,
};

const model = loadSystem();
type Ref = { offsetDays: number; bodies: Record<string, number[]> };
const samples = reference.samples as unknown as Ref[];

function advanceTo(
  s: SystemState,
  it: Integrator,
  forces: ForceModel[],
  dt: number,
  t: number,
): void {
  const n = Math.max(1, Math.ceil(Math.abs(t - s.t) / dt));
  const h = (t - s.t) / n;
  for (let i = 0; i < n; i++) it.step(s, forces, h);
}

function runSim(it: Integrator, forces: ForceModel[], dt: number, group: Ref[]) {
  const s = cloneState(model.state);
  const rows: { offsetDays: number; id: string; errAu: number; errKm: number }[] = [];
  for (const r of group) {
    advanceTo(s, it, forces, dt, r.offsetDays);
    model.ids.forEach((id, i) => {
      const p = r.bodies[id]!;
      const err = Math.hypot(
        s.pos[3 * i]! - p[0]!,
        s.pos[3 * i + 1]! - p[1]!,
        s.pos[3 * i + 2]! - p[2]!,
      );
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
    [
      'forward',
      samples.filter((r) => r.offsetDays > 0).sort((a, b) => a.offsetDays - b.offsetDays),
    ],
    [
      'backward',
      samples.filter((r) => r.offsetDays < 0).sort((a, b) => b.offsetDays - a.offsetDays),
    ],
  ];

  it.each(groups)(
    '%s (baseline leapfrog)',
    (_name, group) => {
      const rows = runSim(new Leapfrog(), [newtonianGravity], 0.1, group);
      console.table(rows.map((r) => ({ ...r, errAu: r.errAu.toExponential(2) })));
      for (const r of rows) {
        expect(r.errAu, `${r.id} at ${r.offsetDays} d`).toBeLessThan(TOL_AU[String(r.offsetDays)]!);
      }
    },
    120_000,
  );

  it(
    'Horizons comparison matrix across integrators and physics models at +10 years',
    () => {
      const targetSample = samples.find((s) => s.offsetDays === 3652.5)!;
      const matrixConfigs = [
        {
          name: 'leapfrog, no GR (baseline)',
          integrator: new Leapfrog(),
          forces: [newtonianGravity],
          dt: 0.1,
        },
        {
          name: 'yoshida4 + GR',
          integrator: yoshida4(new Leapfrog()),
          forces: buildForces(model.ids, { ...DEFAULT_CONFIG, gr: true, sunJ2: false }),
          dt: 0.5,
        },
        {
          name: 'yoshida6 + GR + Sun J2',
          integrator: yoshida6(new Leapfrog()),
          forces: buildForces(model.ids, { ...DEFAULT_CONFIG, gr: true, sunJ2: true }),
          dt: 1.0,
        },
      ];

      const summaryTable: Record<string, Record<string, string>> = {};
      for (const id of model.ids) summaryTable[id] = {};

      for (const cfg of matrixConfigs) {
        const rows = runSim(cfg.integrator, cfg.forces, cfg.dt, [targetSample]);
        for (const r of rows) {
          summaryTable[r.id]![cfg.name] = `${r.errAu.toExponential(2)} AU (${r.errKm} km)`;
        }
      }

      console.log('--- Horizons Comparison Matrix at +10 Years (3652.5 days) ---');
      console.table(summaryTable);

      const baseMerc = runSim(new Leapfrog(), [newtonianGravity], 0.1, [targetSample]).find(
        (r) => r.id === 'mercury',
      )!;
      const y4Merc = runSim(
        yoshida4(new Leapfrog()),
        buildForces(model.ids, { ...DEFAULT_CONFIG, gr: true, sunJ2: false }),
        0.5,
        [targetSample],
      ).find((r) => r.id === 'mercury')!;
      const y6Merc = runSim(
        yoshida6(new Leapfrog()),
        buildForces(model.ids, { ...DEFAULT_CONFIG, gr: true, sunJ2: true }),
        1.0,
        [targetSample],
      ).find((r) => r.id === 'mercury')!;

      // Both higher order configurations with GR improve over baseline
      expect(y4Merc.errAu).toBeLessThan(baseMerc.errAu);
      expect(y6Merc.errAu).toBeLessThan(baseMerc.errAu);
      expect(y6Merc.errAu).toBeLessThan(1e-3);
    },
    120_000,
  );
});
