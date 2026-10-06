import { cloneState } from '@/physics/system';
import type { SystemState } from '@/physics/types';
import { History } from './history';
import type { Frame, ToWorker } from './protocol';
import type { SystemModel } from './registry';
import { DEFAULT_CONFIG, type PhysicsConfig } from './config';
import { hermite } from './hermite';

export interface ClientOptions {
  maxDt: number;
  maxSteps: number;
  historyCap: number;
  historyIntervalDays: number;
  config?: PhysicsConfig;
  integrator?: 'leapfrog' | 'yoshida4' | 'yoshida6';
  relativity?: boolean;
  quadrupole?: boolean;
  fixedDt?: number;
}

export class SimClient {
  readonly state: SystemState; // mirror of the worker's latest state
  readonly display: SystemState; // Hermite interpolated display state
  readonly history: History;
  readonly baryDist: Float64Array;
  energyDrift = 0;
  angMomDrift = 0;
  ready = false;

  config: PhysicsConfig;
  t0 = 0;
  p0: Float64Array;
  v0: Float64Array;
  t1 = 0;
  p1: Float64Array;
  v1: Float64Array;
  carry = 0;
  inFlightDays = 0;
  dir = 1;

  private readonly worker: Worker;
  private readonly maxPending: number;
  private gen = 0;
  private outstanding = 0; // messages sent minus replies received
  private pending = 0; // requested days not yet sent
  private seeking = false;

  constructor(model: SystemModel, o: ClientOptions) {
    this.state = cloneState(model.state);
    this.display = cloneState(model.state);
    this.baryDist = new Float64Array(this.state.n);
    this.history = new History(this.state.n, o.historyCap, o.historyIntervalDays);
    this.maxPending = o.maxSteps * (o.fixedDt ?? o.maxDt);

    this.config = o.config ?? {
      ...DEFAULT_CONFIG,
      integrator: o.integrator ?? DEFAULT_CONFIG.integrator,
      dt: o.fixedDt ?? DEFAULT_CONFIG.dt,
      gr: o.relativity ?? DEFAULT_CONFIG.gr,
      sunJ2: o.quadrupole ?? DEFAULT_CONFIG.sunJ2,
    };

    this.t0 = this.state.t;
    this.t1 = this.state.t;
    this.p0 = new Float64Array(this.state.pos);
    this.v0 = new Float64Array(this.state.vel);
    this.p1 = new Float64Array(this.state.pos);
    this.v1 = new Float64Array(this.state.vel);

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
      config: this.config,
      integrator: this.config.integrator,
      relativity: this.config.gr,
      quadrupole: this.config.sunJ2,
      fixedDt: o.fixedDt,
    });
  }

  get busy(): boolean {
    return this.seeking;
  }

  /** Update display buffer using cubic Hermite interpolation */
  updateDisplay(): void {
    const target = this.t1 + this.carry + this.inFlightDays + this.pending;
    const lag = this.dir * this.config.dt; // dir = +1 forward, -1 backward
    const lo = Math.min(this.t0, this.t1);
    const hi = Math.max(this.t0, this.t1);
    const td = lo === hi ? lo : Math.max(lo, Math.min(hi, target - lag)); // clamp: stalls if physics falls behind
    hermite(this.t0, this.p0, this.v0, this.t1, this.p1, this.v1, td, this.display.pos);
    this.display.t = td;
    this.display.vel.set(this.p1.length === this.display.vel.length ? this.v1 : this.state.vel);
  }

  /** Ask for `days` more simulated time (negative = backward). Call every animation frame. */
  request(days: number): void {
    if (!this.ready || this.seeking) return;
    this.dir = days >= 0 ? 1 : -1;
    this.pending = Math.max(-this.maxPending, Math.min(this.maxPending, this.pending + days));
    if (this.outstanding > 0 || this.pending === 0) return;
    this.inFlightDays = this.pending;
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
    config?: PhysicsConfig;
    integrator?: 'leapfrog' | 'yoshida4' | 'yoshida6';
    relativity?: boolean;
    quadrupole?: boolean;
    fixedDt?: number;
  }): void {
    if (opts.config) this.config = { ...opts.config };
    if (opts.integrator) this.config.integrator = opts.integrator;
    if (opts.relativity !== undefined) this.config.gr = opts.relativity;
    if (opts.quadrupole !== undefined) this.config.sunJ2 = opts.quadrupole;
    if (opts.fixedDt !== undefined) this.config.dt = opts.fixedDt;
    this.send({ type: 'setPhysics', ...opts });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private bump(): void {
    this.gen++;
    this.outstanding = 0;
    this.inFlightDays = 0;
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
    this.inFlightDays = 0;
    this.ready = true;
    this.seeking = false;

    this.state.t = f.t;
    this.state.pos.set(f.pos);
    this.state.vel.set(f.vel);

    this.t0 = f.t0;
    this.p0.set(f.pos0);
    this.v0.set(f.vel0);
    this.t1 = f.t;
    this.p1.set(f.pos);
    this.v1.set(f.vel);
    this.carry = f.carry;

    this.baryDist.set(f.baryDist);
    this.energyDrift = f.energyDrift;
    this.angMomDrift = f.angMomDrift;
    for (let o = 0; o + f.stride <= f.samples.length; o += f.stride) {
      this.history.pushRaw(f.samples[o]!, f.samples, o + 1);
    }
  }
}
