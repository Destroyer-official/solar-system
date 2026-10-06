import { newtonianGravity } from '@/physics/forces/gravity';
import { GeneralRelativity } from '@/physics/forces/relativity';
import { SolarQuadrupole } from '@/physics/forces/quadrupole';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { Yoshida4 } from '@/physics/integrators/yoshida4';
import type { ForceModel, Integrator, SystemState } from '@/physics/types';
import { Engine } from './engine';
import type { Frame, ToWorker } from './protocol';
import { Recorder } from './recorder';

function buildForces(relativity = false, quadrupole = false): ForceModel[] {
  const forces: ForceModel[] = [newtonianGravity];
  if (relativity) forces.push(new GeneralRelativity(0));
  if (quadrupole) forces.push(new SolarQuadrupole(0));
  return forces;
}

function buildIntegrator(name?: 'leapfrog' | 'yoshida4'): Integrator {
  if (name === 'yoshida4') return new Yoshida4();
  return new Leapfrog();
}

export class SimCore {
  private engine: Engine | null = null;
  private rec: Recorder | null = null;
  private gen = 0;
  private recording = true;

  handle(msg: ToWorker): Frame | null {
    if (msg.type === 'init') {
      const n = msg.gm.length;
      const state: SystemState = { t: msg.t, n, gm: msg.gm, pos: msg.pos, vel: msg.vel };
      const forces = buildForces(msg.relativity, msg.quadrupole);
      const integrator = buildIntegrator(msg.integrator);
      const engine = new Engine(
        state,
        forces,
        integrator,
        msg.maxDt,
        msg.maxSteps,
        msg.fixedDt,
      );
      const rec = new Recorder(n, msg.historyIntervalDays, msg.maxSteps + 2);
      engine.onStep = (s) => {
        if (this.recording) rec.sample(s);
      };
      this.engine = engine;
      this.rec = rec;
      this.gen = 0;
      this.recording = true;
      rec.sample(state);
      return this.frame(0);
    }

    const engine = this.engine,
      rec = this.rec;
    if (!engine || !rec) return null;

    /** A new generation means the main thread cleared its history: restart recording from "now". */
    const syncGen = (gen: number) => {
      if (gen === this.gen) return;
      this.gen = gen;
      rec.reset();
      rec.sample(engine.state);
    };

    switch (msg.type) {
      case 'setPhysics': {
        const hasRel = engine.forces.some((f) => f.name === 'general-relativity-1pn');
        const hasJ2 = engine.forces.some((f) => f.name === 'solar-quadrupole-j2');
        const rel = msg.relativity !== undefined ? msg.relativity : hasRel;
        const j2 = msg.quadrupole !== undefined ? msg.quadrupole : hasJ2;
        engine.forces = buildForces(rel, j2);
        if (msg.integrator) engine.integrator = buildIntegrator(msg.integrator);
        if (msg.fixedDt !== undefined) engine.fixedDt = msg.fixedDt;
        return this.frame(0);
      }
      case 'advance':
        syncGen(msg.gen);
        return this.frame(engine.advance(msg.days));
      case 'reset':
        engine.reset();
        this.gen = msg.gen;
        rec.reset();
        rec.sample(engine.state);
        return this.frame(0);
      case 'seek': {
        if (!Number.isFinite(msg.t)) return this.frame(0);
        syncGen(msg.gen);
        const start = engine.state.t;
        this.recording = false; // a 100-year jump must not flood the history
        for (let guard = 0; guard < 100_000; guard++) {
          const remaining = msg.t - engine.state.t;
          if (Math.abs(remaining) < 1e-9) break;
          engine.advance(remaining);
        }
        this.recording = true;
        rec.reset();
        rec.sample(engine.state);
        return this.frame(engine.state.t - start);
      }
    }
  }

  private frame(advanced: number): Frame {
    const engine = this.engine!,
      rec = this.rec!,
      s = engine.state;
    const d = engine.diagnostics();
    const baryDist = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) baryDist[i] = d.baryDistAu(i);
    return {
      type: 'frame',
      gen: this.gen,
      t: s.t,
      advanced,
      pos: s.pos.slice(),
      vel: s.vel.slice(), // copies: safe to transfer
      samples: rec.drain(),
      stride: rec.stride,
      energyDrift: d.energyDrift,
      angMomDrift: d.angMomDrift,
      baryDist,
    };
  }
}
