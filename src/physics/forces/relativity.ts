import type { ForceModel, SystemState } from '../types';
import { C_LIGHT_AU_DAY } from '@/data/constants';

const C2 = C_LIGHT_AU_DAY * C_LIGHT_AU_DAY;

/**
 * First Post-Newtonian (1PN) General Relativity acceleration.
 * Dominant solar term applied to all bodies orbiting the central body (default: Sun index 0).
 * a_1PN = (GM_sun / (c^2 * r^3)) * [ (4*GM_sun/r - v^2) * r + 4 * (r . v) * v ]
 *
 * Reproduces the anomalous perihelion precession of Mercury (~42.98 arcsec/century)
 * in accordance with Einstein's General Relativity.
 */
export class GeneralRelativity implements ForceModel {
  readonly name = 'general-relativity-1pn';
  private readonly sunIndex: number;

  constructor(sunIndex = 0) {
    this.sunIndex = sunIndex;
  }

  apply(s: SystemState, acc: Float64Array): void {
    const si = this.sunIndex;
    if (si >= s.n) return;

    const sx = s.pos[3 * si]!,
      sy = s.pos[3 * si + 1]!,
      sz = s.pos[3 * si + 2]!;
    const svx = s.vel[3 * si]!,
      svy = s.vel[3 * si + 1]!,
      svz = s.vel[3 * si + 2]!;
    const gmSun = s.gm[si]!;

    for (let i = 0; i < s.n; i++) {
      if (i === si) continue;
      const dx = s.pos[3 * i]! - sx;
      const dy = s.pos[3 * i + 1]! - sy;
      const dz = s.pos[3 * i + 2]! - sz;
      const r2 = dx * dx + dy * dy + dz * dz;
      const r = Math.sqrt(r2);
      const r3 = r2 * r;

      const dvx = s.vel[3 * i]! - svx;
      const dvy = s.vel[3 * i + 1]! - svy;
      const dvz = s.vel[3 * i + 2]! - svz;
      const v2 = dvx * dvx + dvy * dvy + dvz * dvz;
      const rDotV = dx * dvx + dy * dvy + dz * dvz;

      const factor = gmSun / (C2 * r3);
      const posCoeff = (4 * gmSun) / r - v2;
      const velCoeff = 4 * rDotV;

      const ax = factor * (posCoeff * dx + velCoeff * dvx);
      const ay = factor * (posCoeff * dy + velCoeff * dvy);
      const az = factor * (posCoeff * dz + velCoeff * dvz);

      acc[3 * i] = acc[3 * i]! + ax;
      acc[3 * i + 1] = acc[3 * i + 1]! + ay;
      acc[3 * i + 2] = acc[3 * i + 2]! + az;

      // Equal and opposite reaction onto the Sun to conserve total system momentum
      const gRatio = s.gm[i]! / gmSun;
      acc[3 * si] = acc[3 * si]! - gRatio * ax;
      acc[3 * si + 1] = acc[3 * si + 1]! - gRatio * ay;
      acc[3 * si + 2] = acc[3 * si + 2]! - gRatio * az;
    }
  }
}
