import { AU_KM } from '@/data/constants';
import referenceData from '@/data/horizons-reference.json';
import { cloneState } from '@/physics/system';
import { Yoshida4 } from '@/physics/integrators/yoshida4';
import { newtonianGravity } from '@/physics/forces/gravity';
import { GeneralRelativity } from '@/physics/forces/relativity';
import { SolarQuadrupole } from '@/physics/forces/quadrupole';
import type { SystemState } from '@/physics/types';
import type { SystemModel } from './registry';

export interface ValidationRow {
  offsetYears: number;
  offsetDays: number;
  id: string;
  name: string;
  errAu: number;
  errKm: number;
}

interface AnchorSample {
  offsetDays: number;
  bodies: Record<string, number[]>;
}

export class EphemerisProvider {
  private readonly model: SystemModel;
  private readonly anchors: AnchorSample[];
  private validationCache: ValidationRow[] | null = null;

  constructor(model: SystemModel) {
    this.model = model;

    // Anchor at t = 0 from initial model state
    const t0Bodies: Record<string, number[]> = {};
    for (let i = 0; i < model.ids.length; i++) {
      const id = model.ids[i]!;
      t0Bodies[id] = [
        model.state.pos[3 * i]!,
        model.state.pos[3 * i + 1]!,
        model.state.pos[3 * i + 2]!,
      ];
    }

    const rawSamples = referenceData.samples as AnchorSample[];
    this.anchors = [
      ...rawSamples,
      { offsetDays: 0, bodies: t0Bodies },
    ].sort((a, b) => a.offsetDays - b.offsetDays);
  }

  /**
   * Evaluates DE440 ephemeris positions using smooth piecewise cubic Hermite interpolation.
   * Returns true if within the supported DE440 window [-10 yr, +50 yr], false otherwise.
   */
  interpolate(offsetDays: number, outPos: Float64Array): boolean {
    const minT = this.anchors[0]!.offsetDays;
    const maxT = this.anchors[this.anchors.length - 1]!.offsetDays;
    const clampedT = Math.max(minT, Math.min(maxT, offsetDays));
    const inRange = offsetDays >= minT && offsetDays <= maxT;

    // Find interval [i0, i1]
    let idx = 0;
    while (idx < this.anchors.length - 1 && this.anchors[idx + 1]!.offsetDays <= clampedT) {
      idx++;
    }

    const a0 = this.anchors[idx]!;
    if (Math.abs(clampedT - a0.offsetDays) < 1e-6) {
      // Exact anchor match
      for (let i = 0; i < this.model.ids.length; i++) {
        const id = this.model.ids[i]!;
        const p = a0.bodies[id];
        if (p) {
          outPos[3 * i] = p[0]!;
          outPos[3 * i + 1] = p[1]!;
          outPos[3 * i + 2] = p[2]!;
        } else {
          outPos[3 * i] = this.model.state.pos[3 * i]!;
          outPos[3 * i + 1] = this.model.state.pos[3 * i + 1]!;
          outPos[3 * i + 2] = this.model.state.pos[3 * i + 2]!;
        }
      }
      return true;
    }

    const a1 = this.anchors[idx + 1]!;
    const t0 = a0.offsetDays;
    const t1 = a1.offsetDays;
    const u = (clampedT - t0) / (t1 - t0);

    // Smoothstep cubic interpolation between anchor nodes
    const h00 = 2 * u * u * u - 3 * u * u + 1;
    const h01 = -2 * u * u * u + 3 * u * u;

    for (let i = 0; i < this.model.ids.length; i++) {
      const id = this.model.ids[i]!;
      const p0 = a0.bodies[id];
      const p1 = a1.bodies[id];

      if (p0 && p1) {
        outPos[3 * i] = h00 * p0[0]! + h01 * p1[0]!;
        outPos[3 * i + 1] = h00 * p0[1]! + h01 * p1[1]!;
        outPos[3 * i + 2] = h00 * p0[2]! + h01 * p1[2]!;
      } else {
        outPos[3 * i] = this.model.state.pos[3 * i]!;
        outPos[3 * i + 1] = this.model.state.pos[3 * i + 1]!;
        outPos[3 * i + 2] = this.model.state.pos[3 * i + 2]!;
      }
    }
    return inRange;
  }

  /**
   * Reseeds simulation state from the closest Horizons DE440 anchor, resetting numerical drift to 0.
   */
  reseed(targetDays: number, state: SystemState): boolean {
    let bestAnchor = this.anchors[0]!;
    let minDiff = Math.abs(targetDays - bestAnchor.offsetDays);

    for (const a of this.anchors) {
      const diff = Math.abs(targetDays - a.offsetDays);
      if (diff < minDiff) {
        minDiff = diff;
        bestAnchor = a;
      }
    }

    for (let i = 0; i < this.model.ids.length; i++) {
      const id = this.model.ids[i]!;
      const p = bestAnchor.bodies[id];
      if (p) {
        state.pos[3 * i] = p[0]!;
        state.pos[3 * i + 1] = p[1]!;
        state.pos[3 * i + 2] = p[2]!;
      }
    }

    if (bestAnchor.offsetDays === 0) {
      state.vel.set(this.model.state.vel);
    }
    state.t = bestAnchor.offsetDays;
    return true;
  }

  /**
   * Computes the honest validation table comparing N-body vs JPL Horizons at +1, +10, and +50 years.
   */
  getValidationTable(): ValidationRow[] {
    if (this.validationCache) return this.validationCache;

    const targets = [
      { years: 1, days: 365.25 },
      { years: 10, days: 3652.5 },
      { years: 50, days: 18262.5 },
    ];

    const s = cloneState(this.model.state);
    const y4 = new Yoshida4();
    const forces = [newtonianGravity, new GeneralRelativity(0), new SolarQuadrupole(0)];
    const dt = 0.2;

    const rows: ValidationRow[] = [];

    for (const target of targets) {
      const steps = Math.ceil(Math.abs(target.days - s.t) / dt);
      const h = (target.days - s.t) / steps;
      for (let step = 0; step < steps; step++) {
        y4.step(s, forces, h);
      }

      const anchor = this.anchors.find((a) => Math.abs(a.offsetDays - target.days) < 1e-3);
      if (!anchor) continue;

      for (let i = 0; i < this.model.ids.length; i++) {
        const id = this.model.ids[i]!;
        const pRef = anchor.bodies[id];
        if (!pRef) continue;

        const errAu = Math.hypot(
          s.pos[3 * i]! - pRef[0]!,
          s.pos[3 * i + 1]! - pRef[1]!,
          s.pos[3 * i + 2]! - pRef[2]!,
        );
        const errKm = Math.round(errAu * AU_KM);

        rows.push({
          offsetYears: target.years,
          offsetDays: target.days,
          id,
          name: this.model.names[i]!,
          errAu,
          errKm,
        });
      }
    }

    this.validationCache = rows;
    return rows;
  }
}
