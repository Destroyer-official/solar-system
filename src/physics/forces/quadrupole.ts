import type { ForceModel, SystemState } from '../types';
import { SUN_J2, SUN_RADIUS_KM, kmToAu } from '@/data/constants';

/**
 * Solar J2 quadrupole acceleration (Park et al. 2021 DE440).
 * Accounts for the oblateness of the rotating Sun.
 * a_J2 = (3/2) * J2 * (GM_sun * R_eq^2 / r^5) * [ (5*(r.s)^2/r^2 - 1)*r - 2*(r.s)*s ]
 * where s is the solar rotation pole unit vector.
 */
export class SolarQuadrupole implements ForceModel {
  readonly name = 'solar-quadrupole-j2';
  private readonly sunIndex: number;
  private readonly j2: number;
  private readonly rEqAu: number;
  private readonly pole: readonly [number, number, number];

  constructor(
    sunIndex = 0,
    j2 = SUN_J2,
    rEqKm = SUN_RADIUS_KM,
    pole: readonly [number, number, number] = [0.0065, 0.126, 0.992], // J2000 ecliptic solar pole
  ) {
    this.sunIndex = sunIndex;
    this.j2 = j2;
    this.rEqAu = kmToAu(rEqKm);
    const pNorm = Math.hypot(pole[0], pole[1], pole[2]);
    this.pole = [pole[0] / pNorm, pole[1] / pNorm, pole[2] / pNorm];
  }

  apply(s: SystemState, acc: Float64Array): void {
    const si = this.sunIndex;
    if (si >= s.n) return;

    const sx = s.pos[3 * si]!,
      sy = s.pos[3 * si + 1]!,
      sz = s.pos[3 * si + 2]!;
    const gmSun = s.gm[si]!;
    const rEq2 = this.rEqAu * this.rEqAu;
    const [px, py, pz] = this.pole;

    for (let i = 0; i < s.n; i++) {
      if (i === si) continue;
      const dx = s.pos[3 * i]! - sx;
      const dy = s.pos[3 * i + 1]! - sy;
      const dz = s.pos[3 * i + 2]! - sz;
      const r2 = dx * dx + dy * dy + dz * dz;
      const r = Math.sqrt(r2);
      const r5 = r2 * r2 * r;

      const rDotP = dx * px + dy * py + dz * pz;
      const term5 = 5 * (rDotP * rDotP) / r2;

      const k = (1.5 * this.j2 * gmSun * rEq2) / r5;

      const ax = k * ((term5 - 1) * dx - 2 * rDotP * px);
      const ay = k * ((term5 - 1) * dy - 2 * rDotP * py);
      const az = k * ((term5 - 1) * dz - 2 * rDotP * pz);

      acc[3 * i] = acc[3 * i]! + ax;
      acc[3 * i + 1] = acc[3 * i + 1]! + ay;
      acc[3 * i + 2] = acc[3 * i + 2]! + az;

      const gRatio = s.gm[i]! / gmSun;
      acc[3 * si] = acc[3 * si]! - gRatio * ax;
      acc[3 * si + 1] = acc[3 * si + 1]! - gRatio * ay;
      acc[3 * si + 2] = acc[3 * si + 2]! - gRatio * az;
    }
  }
}
