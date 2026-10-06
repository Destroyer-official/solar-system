import type { ForceModel, Integrator, SystemState } from './types';
import { add } from './vec3';

/** Differential pull of external bodies on a local system. Positions are linear in time during a drift. */
export class TidalForce implements ForceModel {
  readonly name = 'external-tide';
  t0 = 0;
  m = 0;
  gm = new Float64Array(0);
  rel0 = new Float64Array(0);
  relV = new Float64Array(0);

  configure(m: number): void {
    if (this.m === m) return;
    this.m = m;
    this.gm = new Float64Array(m);
    this.rel0 = new Float64Array(3 * m);
    this.relV = new Float64Array(3 * m);
  }

  apply(s: SystemState, acc: Float64Array): void {
    const tau = s.t - this.t0;
    for (let j = 0; j < this.m; j++) {
      const Rx = this.rel0[3 * j]! + this.relV[3 * j]! * tau,
        Ry = this.rel0[3 * j + 1]! + this.relV[3 * j + 1]! * tau,
        Rz = this.rel0[3 * j + 2]! + this.relV[3 * j + 2]! * tau;
      const R2 = Rx * Rx + Ry * Ry + Rz * Rz,
        iR3 = 1 / (R2 * Math.sqrt(R2)),
        g = this.gm[j]!;
      for (let i = 0; i < s.n; i++) {
        const dx = Rx - s.pos[3 * i]!,
          dy = Ry - s.pos[3 * i + 1]!,
          dz = Rz - s.pos[3 * i + 2]!;
        const d2 = dx * dx + dy * dy + dz * dz,
          iD3 = 1 / (d2 * Math.sqrt(d2));
        add(acc, i, g * (dx * iD3 - Rx * iR3), g * (dy * iD3 - Ry * iR3), g * (dz * iD3 - Rz * iR3));
      }
    }
  }
}

export interface LocalSystem {
  host: number; // index of the system's barycenter in the level-0 state
  hostId: string;
  bodyIds: string[];
  state: SystemState; // planet (index 0) + moons, relative to the barycenter; t is ABSOLUTE sim time
  forces: ForceModel[]; // internal gravity, J2, tide
  tide: TidalForce;
  integrator: Integrator; // yoshida4(Leapfrog)
  dtMax: number;
}

/** Symmetric 2nd-order step: kick, drift (with sub-cycled local systems), kick. */
export class HierarchicalLeapfrog implements Integrator {
  readonly name = 'leapfrog-hierarchical';
  readonly systems: LocalSystem[];
  private acc = new Float64Array(0);
  private p0 = new Float64Array(0);

  constructor(systems: LocalSystem[]) {
    this.systems = systems;
  }

  private accel(s: SystemState, forces: ForceModel[]): void {
    this.acc.fill(0);
    for (const f of forces) f.apply(s, this.acc);
  }

  step(s: SystemState, forces: ForceModel[], dt: number): void {
    const m = 3 * s.n,
      h = 0.5 * dt;
    if (this.acc.length !== m) {
      this.acc = new Float64Array(m);
      this.p0 = new Float64Array(m);
    }
    this.accel(s, forces);
    for (let k = 0; k < m; k++) s.vel[k] = s.vel[k]! + h * this.acc[k]!;
    this.p0.set(s.pos); // velocities are constant during the drift
    for (let k = 0; k < m; k++) s.pos[k] = s.pos[k]! + dt * s.vel[k]!;
    for (const L of this.systems) this.advanceLocal(L, s, dt);
    s.t += dt;
    this.accel(s, forces);
    for (let k = 0; k < m; k++) s.vel[k] = s.vel[k]! + h * this.acc[k]!;
  }

  private advanceLocal(L: LocalSystem, s: SystemState, dt: number): void {
    const nm = s.nMassive ?? s.n,
      k = L.host,
      ls = L.state,
      tide = L.tide;
    tide.configure(nm - 1);
    let c = 0;
    for (let j = 0; j < nm; j++) {
      if (j === k) continue;
      tide.gm[c] = s.gm[j]!;
      for (let d = 0; d < 3; d++) {
        tide.rel0[3 * c + d] = this.p0[3 * j + d]! - this.p0[3 * k + d]!;
        tide.relV[3 * c + d] = s.vel[3 * j + d]! - s.vel[3 * k + d]!;
      }
      c++;
    }
    tide.t0 = ls.t;
    const nsub = Math.max(1, Math.ceil(Math.abs(dt) / L.dtMax)),
      hs = dt / nsub;
    for (let q = 0; q < nsub; q++) L.integrator.step(ls, L.forces, hs);
  }
}

/** Where each global body lives: a plain level-0 body, or a member of a local system. */
export interface Slot {
  k: number;
  sys: LocalSystem | null;
  i: number;
}

export function compose(level0: SystemState, slots: readonly Slot[], out: SystemState): void {
  out.t = level0.t;
  for (let g = 0; g < slots.length; g++) {
    const { k, sys, i } = slots[g]!;
    for (let d = 0; d < 3; d++) {
      out.pos[3 * g + d] = level0.pos[3 * k + d]! + (sys ? sys.state.pos[3 * i + d]! : 0);
      out.vel[3 * g + d] = level0.vel[3 * k + d]! + (sys ? sys.state.vel[3 * i + d]! : 0);
    }
  }
}
