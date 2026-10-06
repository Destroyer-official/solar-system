import { newtonianGravity } from '@/physics/forces/gravity';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida4, yoshida6 } from '@/physics/integrators/yoshida';
import type { Integrator, SystemState, ForceModel } from '@/physics/types';
import { Engine } from './engine';
import type { Frame, ToWorker } from './protocol';
import { Recorder } from './recorder';
import { DEFAULT_CONFIG, type PhysicsConfig } from './config';
import { buildForces } from './forces';
import { loadSystem, buildModel, buildSolver, type ModelData, type SolverData, PHYSICAL_MAP } from './registry';
import { compose } from '@/physics/hierarchy';
import { cloneState } from '@/physics/system';

function buildIntegrator(name?: 'leapfrog' | 'yoshida4' | 'yoshida6'): Integrator {
  if (name === 'yoshida6') return yoshida6(new Leapfrog());
  if (name === 'yoshida4') return yoshida4(new Leapfrog());
  return new Leapfrog();
}

export class SimCore {
  private engine: Engine | null = null;
  private rec: Recorder | null = null;
  private gen = 0;
  private recording = true;
  private config: PhysicsConfig = { ...DEFAULT_CONFIG };
  private fixedDt?: number;
  private bodyIds: string[] = [];
  private modelData: ModelData | null = null;
  private solverData: SolverData | null = null;
  private globalState: SystemState | null = null;

  private prev = { t: 0, pos: new Float64Array(0), vel: new Float64Array(0) };
  private cur = { t: 0, pos: new Float64Array(0), vel: new Float64Array(0) };

  handle(msg: ToWorker): Frame | null {
    if (msg.type === 'init') {
      let state: SystemState;
      let ids: string[] = [];

      this.config = msg.config ?? {
        ...DEFAULT_CONFIG,
        integrator: msg.integrator ?? 'leapfrog',
        dt: msg.fixedDt ?? (msg.maxDt ?? DEFAULT_CONFIG.dt),
        gr: msg.relativity ?? false,
        sunJ2: msg.quadrupole ?? false,
      };
      this.fixedDt = msg.fixedDt;

      let engineForces: ForceModel[] | undefined;
      let engineIntegrator: Integrator | undefined;

      if (msg.bodies && msg.bodies.some((b) => b.parent)) {
        // Hierarchical multi-rate system with sub-cycling for moons
        this.modelData = buildModel(msg.bodies, msg.physical ?? PHYSICAL_MAP);
        this.solverData = buildSolver(this.modelData, this.config, msg.physical ?? PHYSICAL_MAP);
        state = this.solverData.level0;
        this.globalState = cloneState(this.modelData.global);
        ids = this.modelData.ids;
        engineForces = this.solverData.forces;
        engineIntegrator = this.solverData.integrator;
      } else if (msg.bodies) {
        const sys = loadSystem(msg.bodies);
        state = sys.state;
        ids = sys.ids;
        this.modelData = null;
        this.solverData = null;
        this.globalState = null;
      } else if (msg.gm && msg.pos && msg.vel) {
        const n = msg.gm.length;
        state = { t: msg.t ?? 0, n, gm: msg.gm, pos: msg.pos, vel: msg.vel };
        ids = msg.ids ?? ['sun', 'jupiter'];
        this.modelData = null;
        this.solverData = null;
        this.globalState = null;
      } else {
        const sys = loadSystem();
        state = sys.state;
        ids = sys.ids;
        this.modelData = null;
        this.solverData = null;
        this.globalState = null;
      }

      this.bodyIds = ids;
      const hasExplicitConfig = !!msg.config;

      const forces = engineForces ?? (hasExplicitConfig || msg.relativity || msg.quadrupole
        ? buildForces(this.bodyIds, this.config)
        : [newtonianGravity]);
      const integrator = engineIntegrator ?? buildIntegrator(this.config.integrator);

      const engine = new Engine(
        state,
        forces,
        integrator,
        msg.maxDt ?? this.config.dt,
        msg.maxSteps ?? this.config.maxSteps,
      );
      if (this.fixedDt !== undefined) engine.fixedDt = this.fixedDt;
      const recN = this.globalState ? this.globalState.n : state.n;
      const rec = new Recorder(recN, msg.historyIntervalDays, (msg.maxSteps ?? 4000) + 2);

      const initP = this.globalState ? this.globalState.pos : state.pos;
      const initV = this.globalState ? this.globalState.vel : state.vel;
      this.prev = { t: state.t, pos: initP.slice(), vel: initV.slice() };
      this.cur = { t: state.t, pos: initP.slice(), vel: initV.slice() };

      engine.onStep = (s) => {
        if (this.solverData && this.globalState) {
          compose(this.solverData.level0, this.solverData.slots, this.globalState);
          this.globalState.t = s.t;
          this.prev.t = this.cur.t;
          this.prev.pos.set(this.cur.pos);
          this.prev.vel.set(this.cur.vel);

          this.cur.t = s.t;
          this.cur.pos.set(this.globalState.pos);
          this.cur.vel.set(this.globalState.vel);

          if (this.recording) rec.sample(this.globalState);
        } else {
          this.prev.t = this.cur.t;
          this.prev.pos.set(this.cur.pos);
          this.prev.vel.set(this.cur.vel);

          this.cur.t = s.t;
          this.cur.pos.set(s.pos);
          this.cur.vel.set(s.vel);

          if (this.recording) rec.sample(s);
        }
      };

      this.engine = engine;
      this.rec = rec;
      this.gen = 0;
      this.recording = true;
      rec.sample(this.globalState ?? state);
      return this.frame(0);
    }

    const engine = this.engine,
      rec = this.rec;
    if (!engine || !rec) return null;

    const syncGen = (gen: number) => {
      if (gen === this.gen) return;
      this.gen = gen;
      rec.reset();
      rec.sample(this.globalState ?? engine.state);
    };

    switch (msg.type) {
      case 'setPhysics': {
        if (msg.config) this.config = { ...msg.config };
        if (msg.integrator) this.config.integrator = msg.integrator;
        if (msg.relativity !== undefined) this.config.gr = msg.relativity;
        if (msg.quadrupole !== undefined) this.config.sunJ2 = msg.quadrupole;
        if (msg.fixedDt !== undefined) {
          this.fixedDt = msg.fixedDt;
          this.config.dt = msg.fixedDt;
        }

        if (this.modelData) {
          this.solverData = buildSolver(this.modelData, this.config, PHYSICAL_MAP);
          engine.forces = this.solverData.forces;
          engine.integrator = this.solverData.integrator;
        } else {
          engine.forces = buildForces(this.bodyIds, this.config);
          engine.integrator = buildIntegrator(this.config.integrator);
        }
        return this.frame(0);
      }
      case 'advance': {
        syncGen(msg.gen);
        const adv =
          this.fixedDt !== undefined
            ? engine.advanceFixed(msg.days, this.fixedDt)
            : engine.advance(msg.days);
        return this.frame(adv);
      }
      case 'reset': {
        if (this.solverData && this.modelData && this.globalState) {
          this.solverData.level0.t = this.modelData.level0State.t;
          this.solverData.level0.pos.set(this.modelData.level0State.pos);
          this.solverData.level0.vel.set(this.modelData.level0State.vel);
          for (let k = 0; k < this.solverData.systems.length; k++) {
            const ls = this.solverData.systems[k]!;
            const lsd = this.modelData.localSystems[k]!;
            ls.state.t = lsd.initialState.t;
            ls.state.pos.set(lsd.initialState.pos);
            ls.state.vel.set(lsd.initialState.vel);
          }
          compose(this.solverData.level0, this.solverData.slots, this.globalState);
          this.globalState.t = 0;
          engine.reset();
          this.gen = msg.gen;
          this.cur.t = 0;
          this.cur.pos.set(this.globalState.pos);
          this.cur.vel.set(this.globalState.vel);
          this.prev.t = 0;
          this.prev.pos.set(this.cur.pos);
          this.prev.vel.set(this.cur.vel);
          rec.reset();
          rec.sample(this.globalState);
          return this.frame(0);
        }
        engine.reset();
        this.gen = msg.gen;
        this.cur.t = engine.state.t;
        this.cur.pos.set(engine.state.pos);
        this.cur.vel.set(engine.state.vel);
        this.prev.t = this.cur.t;
        this.prev.pos.set(this.cur.pos);
        this.prev.vel.set(this.cur.vel);
        rec.reset();
        rec.sample(engine.state);
        return this.frame(0);
      }
      case 'seek': {
        if (!Number.isFinite(msg.t)) return this.frame(0);
        syncGen(msg.gen);
        const start = engine.state.t;
        this.recording = false;
        const dt = this.fixedDt ?? this.config.dt;
        for (let guard = 0; guard < 100_000; guard++) {
          const remaining = msg.t - engine.state.t;
          if (Math.abs(remaining) < 1e-9) break;
          engine.advanceFixed(remaining, dt);
        }
        this.recording = true;
        const finalP = this.globalState ? this.globalState.pos : engine.state.pos;
        const finalV = this.globalState ? this.globalState.vel : engine.state.vel;
        this.cur.t = engine.state.t;
        this.cur.pos.set(finalP);
        this.cur.vel.set(finalV);
        this.prev.t = this.cur.t;
        this.prev.pos.set(this.cur.pos);
        this.prev.vel.set(this.cur.vel);
        rec.reset();
        rec.sample(this.globalState ?? engine.state);
        return this.frame(engine.state.t - start);
      }
    }
  }

  private frame(advanced: number): Frame {
    const engine = this.engine!,
      rec = this.rec!,
      s = this.globalState ?? engine.state;
    const d = engine.diagnostics();
    const baryDist = new Float64Array(s.n);
    for (let i = 0; i < s.n; i++) {
      baryDist[i] = Math.hypot(s.pos[3 * i]!, s.pos[3 * i + 1]!, s.pos[3 * i + 2]!);
    }
    return {
      type: 'frame',
      gen: this.gen,
      t: s.t,
      t0: this.prev.t,
      advanced,
      carry: engine.carry,
      pos: s.pos.slice(),
      vel: s.vel.slice(),
      pos0: this.prev.pos.slice(),
      vel0: this.prev.vel.slice(),
      samples: rec.drain(),
      stride: rec.stride,
      energyDrift: d.energyDrift,
      angMomDrift: d.angMomDrift,
      baryDist,
    };
  }
}
