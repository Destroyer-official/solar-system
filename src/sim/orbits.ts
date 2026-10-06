import type { Vec3 } from '@/physics/types';

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** parent-relative r, v; returns the point count (0 if not an ellipse) */
export function osculatingCurve(
  mu: number,
  r: Vec3,
  v: Vec3,
  n: number,
  out: Float64Array,
): number {
  const h = cross(r, v),
    rl = len(r),
    vxh = cross(v, h);
  const ev: Vec3 = [vxh[0] / mu - r[0] / rl, vxh[1] / mu - r[1] / rl, vxh[2] / mu - r[2] / rl];
  const e = len(ev);
  if (e >= 1) return 0;
  const p = dot(h, h) / mu,
    a = p / (1 - e * e),
    b = a * Math.sqrt(1 - e * e);
  const P: Vec3 = e > 1e-10 ? [ev[0] / e, ev[1] / e, ev[2] / e] : [r[0] / rl, r[1] / rl, r[2] / rl];
  const hl = len(h),
    W: Vec3 = [h[0] / hl, h[1] / hl, h[2] / hl],
    Q = cross(W, P);
  for (let k = 0; k <= n; k++) {
    const E = (2 * Math.PI * k) / n,
      x = a * (Math.cos(E) - e),
      y = b * Math.sin(E);
    for (let d = 0; d < 3; d++) out[3 * k + d] = x * P[d]! + y * Q[d]!;
  }
  return n + 1;
}
