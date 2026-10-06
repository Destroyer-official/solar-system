import type { ForceModel, Vec3 } from '../types';
import { add } from '../vec3';

/**
 * Acceleration of a body at offset r from the host:
 *   a = (3/2) J2 GM R^2 / r^5 * [ (5 (r.p)^2 / r^2 - 1) r - 2 (r.p) p ]     (p = unit spin pole)
 * The host gets the opposite acceleration scaled by mass ratio.
 */
export function oblateness(
  host: number,
  j2: number,
  radiusAu: number,
  pole: (t: number) => Vec3,
): ForceModel {
  const R2 = radiusAu * radiusAu;
  return {
    name: 'j2',
    apply(s, acc) {
      const [px, py, pz] = pole(s.t);
      const gh = s.gm[host]!;
      for (let i = 0; i < s.n; i++) {
        if (i === host) continue;
        const dx = s.pos[3 * i]! - s.pos[3 * host]!,
          dy = s.pos[3 * i + 1]! - s.pos[3 * host + 1]!,
          dz = s.pos[3 * i + 2]! - s.pos[3 * host + 2]!;
        const r2 = dx * dx + dy * dy + dz * dz;
        const rp = dx * px + dy * py + dz * pz;
        const k = (1.5 * j2 * gh * R2) / (r2 * r2 * Math.sqrt(r2));
        const q = (5 * rp * rp) / r2 - 1;
        const ax = k * (q * dx - 2 * rp * px),
          ay = k * (q * dy - 2 * rp * py),
          az = k * (q * dz - 2 * rp * pz);
        add(acc, i, ax, ay, az);
        const f = s.gm[i]! / gh;
        add(acc, host, -f * ax, -f * ay, -f * az);
      }
    },
  };
}
