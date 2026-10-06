import { describe, it, expect } from 'vitest';
import { ALL_BODIES, buildModel, buildSolver } from '@/sim/registry';
import { Engine } from '@/sim/engine';
import { DEFAULT_CONFIG } from '@/sim/config';
import { cloneState } from '@/physics/system';
import { compose } from '@/physics/hierarchy';
import { yoshida6 } from '@/physics/integrators/yoshida';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { newtonianGravity } from '@/physics/forces/gravity';
import type { SystemState } from '@/physics/types';
import { AU_KM } from '@/data/constants';

describe('Hierarchical Multi-Rate Integrator (Phase 5)', () => {
  it(
    'hierarchical multi-rate matches a brute-force flat N-body (Sun, Earth, Moon, Jupiter)',
    () => {
      const sub = ALL_BODIES.filter((b) =>
        ['sun', 'earth', 'moon', 'jupiter'].includes(b.id),
      );
      const model = buildModel(sub, {});
      const cfg = {
        ...DEFAULT_CONFIG,
        integrator: 'yoshida4',
        dt: 0.5,
        gr: false,
        sunJ2: false,
        planetJ2: false,
      } as const;

      const solver = buildSolver(model, cfg, {});
      const eng = new Engine(solver.level0, solver.forces, solver.integrator, 0.5, 100_000);
      eng.advanceFixed(730.5, 0.5); // 2 years
      const hier = cloneState(model.global);
      compose(solver.level0, solver.slots, hier);

      // Brute-force flat N-body with tiny 0.01 d steps (73,050 steps)
      const flat = cloneState(model.global);
      const lf = yoshida6(new Leapfrog());
      const flatDt = 0.01;
      const flatSteps = Math.round(730.5 / flatDt);
      for (let i = 0; i < flatSteps; i++) {
        lf.step(flat, [newtonianGravity], flatDt);
      }

      const e = model.ids.indexOf('earth');
      const m = model.ids.indexOf('moon');
      const rel = (s: SystemState) =>
        [0, 1, 2].map((k) => s.pos[3 * m + k]! - s.pos[3 * e + k]!);
      const dAu = Math.hypot(...rel(hier).map((x, k) => x - rel(flat)[k]!));
      const dKm = dAu * AU_KM;

      console.log(
        `Hierarchical vs Flat Earth-Moon relative position discrepancy after 2 yr: ${dAu.toExponential(2)} AU (${dKm.toFixed(2)} km)`,
      );

      // Verify that hierarchical multi-rate agrees with brute force to within tight tolerance
      expect(dAu).toBeLessThan(1e-5); // measured ~4.6e-6 AU (693 km)
    },
    120_000,
  );

  it(
    'halving level-0 dt from 0.5 to 0.25 demonstrates higher-order convergence',
    () => {
      const sub = ALL_BODIES.filter((b) =>
        ['sun', 'earth', 'moon', 'jupiter'].includes(b.id),
      );
      const model = buildModel(sub, {});

      // Reference: high-resolution flat run for 1 year (365.25 d)
      const flat = cloneState(model.global);
      const lf = yoshida6(new Leapfrog());
      const flatDt = 0.005;
      const flatSteps = Math.round(365.25 / flatDt);
      for (let i = 0; i < flatSteps; i++) lf.step(flat, [newtonianGravity], flatDt);

      const e = model.ids.indexOf('earth');
      const m = model.ids.indexOf('moon');
      const rel = (s: SystemState) =>
        [0, 1, 2].map((k) => s.pos[3 * m + k]! - s.pos[3 * e + k]!);

      // Run with dt = 0.5
      const cfg1 = {
        ...DEFAULT_CONFIG,
        integrator: 'yoshida4',
        dt: 0.5,
        gr: false,
        sunJ2: false,
        planetJ2: false,
      } as const;
      const solver1 = buildSolver(model, cfg1, {});
      const eng1 = new Engine(solver1.level0, solver1.forces, solver1.integrator, 0.5, 100_000);
      eng1.advanceFixed(365.25, 0.5);
      const hier1 = cloneState(model.global);
      compose(solver1.level0, solver1.slots, hier1);
      const err1 = Math.hypot(...rel(hier1).map((x, k) => x - rel(flat)[k]!));

      // Run with dt = 0.25
      const cfg2 = {
        ...DEFAULT_CONFIG,
        integrator: 'yoshida4',
        dt: 0.25,
        gr: false,
        sunJ2: false,
        planetJ2: false,
      } as const;
      const solver2 = buildSolver(model, cfg2, {});
      const eng2 = new Engine(solver2.level0, solver2.forces, solver2.integrator, 0.25, 100_000);
      eng2.advanceFixed(365.25, 0.25);
      const hier2 = cloneState(model.global);
      compose(solver2.level0, solver2.slots, hier2);
      const err2 = Math.hypot(...rel(hier2).map((x, k) => x - rel(flat)[k]!));

      const ratio = err1 / err2;
      console.log(`dt=0.5 err: ${err1.toExponential(2)} AU, dt=0.25 err: ${err2.toExponential(2)} AU, ratio: ${ratio.toFixed(2)}`);
      expect(err2).toBeLessThan(err1);
      expect(ratio).toBeGreaterThan(5); // Clean convergence
    },
    120_000,
  );
});
