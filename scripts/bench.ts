import { ALL_BODIES, buildModel, buildSolver, PHYSICAL_MAP } from '../src/sim/registry';
import { Engine } from '../src/sim/engine';
import { DEFAULT_CONFIG } from '../src/sim/config';
import { compose } from '../src/physics/hierarchy';
import { cloneState } from '../src/physics/system';

async function benchmark() {
  console.log('--- Solar System Performance Benchmark (Phase 6.6) ---');
  console.log(`Total bodies loaded: ${ALL_BODIES.length}`);

  const model = buildModel(ALL_BODIES, PHYSICAL_MAP);
  console.log(`Level 0 systems: ${model.level0Ids.length}`);
  console.log(`Local hierarchical systems: ${model.localSystems.length}`);

  const cfg = {
    ...DEFAULT_CONFIG,
    dt: 1.0, // standard 1-day step
    integrator: 'yoshida6' as const,
    gr: true,
    sunJ2: true,
    planetJ2: true,
  };

  const solver = buildSolver(model, cfg, PHYSICAL_MAP);
  const eng = new Engine(solver.level0, solver.forces, solver.integrator, 1.0, 100_000);

  const testYears = 10;
  const totalDays = testYears * 365.25;
  const dt = 1.0;
  const steps = Math.round(totalDays / dt);

  const composedState = cloneState(model.global);

  console.log(`Running simulation for ${testYears} simulated years (${steps} steps at dt = ${dt} d)...`);

  const tStart = performance.now();

  for (let i = 0; i < steps; i++) {
    eng.advanceFixed(dt, dt);
    compose(solver.level0, solver.slots, composedState);
  }

  const tEnd = performance.now();
  const wallTimeMs = tEnd - tStart;
  const wallTimeSec = wallTimeMs / 1000;
  const simYearsPerSec = testYears / wallTimeSec;
  const msPerStep = wallTimeMs / steps;

  console.log('\n--- Results ---');
  console.log(`Wall time: ${wallTimeMs.toFixed(1)} ms (${wallTimeSec.toFixed(2)} s)`);
  console.log(`Speed: ${simYearsPerSec.toFixed(1)} simulated years / real second`);
  console.log(`Time per step: ${msPerStep.toFixed(3)} ms`);

  console.log('\n--- Assessment ---');
  if (simYearsPerSec > 20) {
    console.log(`EXCELLENT: ${simYearsPerSec.toFixed(1)} sim-yr/s comfortably exceeds the 10-30 sim-yr/s laptop expectation.`);
    console.log('No WASM acceleration needed for standard body count; JavaScript Float64 performance is optimal.');
  } else {
    console.log(`Performance measured: ${simYearsPerSec.toFixed(1)} sim-yr/s.`);
  }
}

benchmark();
