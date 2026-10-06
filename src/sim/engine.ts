import type { ForceModel, Integrator, SystemState } from '@/physics/types';
import { angularMomentum, centerOfMass, totalEnergy } from '@/physics/diagnostics';
import { cloneState } from '@/physics/system';

export interface Diagnostics {
  t: number; // days
  energyDrift: number; // (E - E0) / |E0|
  angMomDrift: number; // |L - L0| / |L0|
  baryDistAu: (i: number) => number;
}

export class Engine {
  readonly state: SystemState;
  maxDt: number; // largest allowed step, days
  maxSteps: number; // per advance() call, so a fast slider slows the sim instead of freezing the page
  fixedDt?: number; // fixed step size for exact symplectic energy conservation
  onStep?: (s: SystemState) => void;
  forces: ForceModel[];
  integrator: Integrator;
  private readonly initial: SystemState;
  private readonly e0: number;
  private readonly l0: number;
  private remainder = 0;

  constructor(
    state: SystemState,
    forces: ForceModel[],
    integrator: Integrator,
    maxDt = 1,
    maxSteps = 5000,
    fixedDt?: number,
  ) {
    this.state = state;
    this.forces = forces;
    this.integrator = integrator;
    this.maxDt = maxDt;
    this.maxSteps = maxSteps;
    this.fixedDt = fixedDt;
    this.initial = cloneState(state);
    this.e0 = totalEnergy(state);
    this.l0 = Math.hypot(...angularMomentum(state));
  }

  /** Advance by `days` (negative = backwards). Returns the days actually advanced. */
  advance(days: number): number {
    if (days === 0) return 0;
    const stepLimitDt = this.fixedDt ?? this.maxDt;
    const limit = this.maxSteps * stepLimitDt;
    const d = Math.max(-limit, Math.min(limit, days));

    if (this.fixedDt && this.fixedDt > 0) {
      this.remainder += d;
      const stepSign = Math.sign(this.remainder);
      const stepSize = stepSign * this.fixedDt;
      const numSteps = Math.min(
        this.maxSteps,
        Math.floor(Math.abs(this.remainder) / this.fixedDt),
      );
      for (let i = 0; i < numSteps; i++) {
        this.integrator.step(this.state, this.forces, stepSize);
        this.onStep?.(this.state);
      }
      this.remainder -= numSteps * stepSize;
      return numSteps * stepSize;
    }

    const steps = Math.max(1, Math.ceil(Math.abs(d) / this.maxDt));
    const dt = d / steps;
    for (let i = 0; i < steps; i++) {
      this.integrator.step(this.state, this.forces, dt);
      this.onStep?.(this.state);
    }
    return d;
  }

  reset(): void {
    this.state.t = this.initial.t;
    this.state.pos.set(this.initial.pos);
    this.state.vel.set(this.initial.vel);
    this.remainder = 0;
  }

  diagnostics(): Diagnostics {
    const s = this.state;
    const e = totalEnergy(s);
    const l = angularMomentum(s);
    const li = angularMomentum(this.initial);
    const dl = Math.hypot(l[0]! - li[0]!, l[1]! - li[1]!, l[2]! - li[2]!);
    const com = centerOfMass(s);
    return {
      t: s.t,
      energyDrift: (e - this.e0) / Math.abs(this.e0),
      angMomDrift: dl / this.l0,
      baryDistAu: (i) =>
        Math.hypot(
          s.pos[3 * i]! - com.pos[0]!,
          s.pos[3 * i + 1]! - com.pos[1]!,
          s.pos[3 * i + 2]! - com.pos[2]!,
        ),
    };
  }
}
