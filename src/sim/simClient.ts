import { cloneState } from '@/physics/system';
import type { SystemState } from '@/physics/types';
import { History } from './history';
import type { Frame, ToWorker } from './protocol';
import type { SystemModel } from './registry';

export interface ClientOptions {
  maxDt: number;
  maxSteps: number;
  historyCap: number;
  historyIntervalDays: number;
  integrator?: 'leapfrog' | 'yoshida4';
  relativity?: boolean;
  quadrupole?: boolean;
  fixedDt?: number;
}

export class SimClient {
  readonly state: SystemState; // mirror of the worker's latest state
  readonly history: History;
  readonly baryDist: Float64Array;
  energyDrift = 0;
  angMomDrift = 0;
  ready = false;

  private readonly worker: Worker;
  private readonly maxPending: number;
  private gen = 0;
  private outstanding = 0; // messages sent minus replies received
  private pending = 0; // requested days not yet sent
  private seeking = false;

  constructor(model: SystemModel, o: ClientOptions) {
    this.state = cloneState(model.state);
    this.baryDist = new Float64Array(this.state.n);
    this.history = new History(this.state.n, o.historyCap, o.historyIntervalDays);
    this.maxPending = o.maxSteps * (o.fixedDt ?? o.maxDt);

    this.worker = new Worker(new URL('../workers/physics.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<Frame>) => this.onFrame(e.data);
    this.worker.onerror = (e) => console.error('physics worker error', e);

    const s = model.state;
    this.send({
      type: 'init',
      t: s.t,
      gm: s.gm.slice(),
      pos: s.pos.slice(),
      vel: s.vel.slice(),
      maxDt: o.maxDt,
      maxSteps: o.maxSteps,
      historyIntervalDays: o.historyIntervalDays,
      integrator: o.integrator,
      relativity: o.relativity,
      quadrupole: o.quadrupole,
      fixedDt: o.fixedDt,
    });
  }

  get busy(): boolean {
    return this.seeking;
  }

  /** Ask for `days` more simulated time (negative = backward). Call every animation frame. */
  request(days: number): void {
    if (!this.ready || this.seeking) return;
    this.pending = Math.max(-this.maxPending, Math.min(this.maxPending, this.pending + days));
    if (this.outstanding > 0 || this.pending === 0) return;
    this.send({ type: 'advance', gen: this.gen, days: this.pending });
    this.pending = 0;
  }

  /** Time direction flipped: history is only valid one-way. */
  newDirection(): void {
    this.bump();
  }

  reset(): void {
    this.bump();
    this.send({ type: 'reset', gen: this.gen });
  }

  /** Jump to absolute simulation time (days from epoch). */
  seek(t: number): void {
    this.bump();
    this.seeking = true;
    this.send({ type: 'seek', gen: this.gen, t });
  }

  /** Dynamically configure physics models and integrators in the worker. */
  setPhysics(opts: {
    integrator?: 'leapfrog' | 'yoshida4';
    relativity?: boolean;
    quadrupole?: boolean;
    fixedDt?: number;
  }): void {
    this.send({ type: 'setPhysics', ...opts });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private bump(): void {
    this.gen++;
    this.outstanding = 0;
    this.pending = 0;
    this.history.clear();
  }

  private send(m: ToWorker): void {
    this.outstanding++;
    this.worker.postMessage(m);
  }

  private onFrame(f: Frame): void {
    if (f.gen !== this.gen) return; // reply from before a reverse/reset/seek: discard
    this.outstanding = 0;
    this.ready = true;
    this.seeking = false;
    this.state.t = f.t;
    this.state.pos.set(f.pos);
    this.state.vel.set(f.vel);
    this.baryDist.set(f.baryDist);
    this.energyDrift = f.energyDrift;
    this.angMomDrift = f.angMomDrift;
    for (let o = 0; o + f.stride <= f.samples.length; o += f.stride) {
      this.history.pushRaw(f.samples[o]!, f.samples, o + 1);
    }
  }
}
