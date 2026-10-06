import { newtonianGravity } from '@/physics/forces/gravity';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import type { SystemState } from '@/physics/types';
import { Engine } from './engine';
import type { Frame, ToWorker } from './protocol';
import { Recorder } from './recorder';

export class SimCore {
  private engine: Engine | null = null;
  private rec: Recorder | null = null;
  private gen = 0;
  private recording = true;

  handle(msg: ToWorker): Frame | null {
    if (msg.type === 'init') {
      const n = msg.gm.length;
      const state: SystemState = { t: msg.t, n, gm: msg.gm, pos: msg.pos, vel: msg.vel };
      const engine = new Engine(state, [newtonianGravity], new Leapfrog(), msg.maxDt, msg.maxSteps);
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
