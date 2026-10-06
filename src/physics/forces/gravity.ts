import type { ForceModel, SystemState } from '../types';

/** Pairwise Newtonian gravity. ADDS into acc (the integrator zeroes it). */
export const newtonianGravity: ForceModel = {
  name: 'newtonian-gravity',
  apply(s: SystemState, acc: Float64Array): void {
    const { n, gm, pos } = s;
    for (let i = 0; i < n; i++) {
      const xi = pos[3 * i]!,
        yi = pos[3 * i + 1]!,
        zi = pos[3 * i + 2]!;
      const gi = gm[i]!;
      let ax = 0,
        ay = 0,
        az = 0;
      for (let j = i + 1; j < n; j++) {
        const dx = pos[3 * j]! - xi,
          dy = pos[3 * j + 1]! - yi,
          dz = pos[3 * j + 2]! - zi;
        const r2 = dx * dx + dy * dy + dz * dz;
        const inv3 = 1 / (r2 * Math.sqrt(r2));
        const fj = gm[j]! * inv3,
          fi = gi * inv3;
        ax += fj * dx;
        ay += fj * dy;
        az += fj * dz;
        acc[3 * j] = acc[3 * j]! - fi * dx;
        acc[3 * j + 1] = acc[3 * j + 1]! - fi * dy;
        acc[3 * j + 2] = acc[3 * j + 2]! - fi * dz;
      }
      acc[3 * i] = acc[3 * i]! + ax;
      acc[3 * i + 1] = acc[3 * i + 1]! + ay;
      acc[3 * i + 2] = acc[3 * i + 2]! + az;
    }
  },
};
