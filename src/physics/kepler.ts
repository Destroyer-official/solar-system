import type { Vec3 } from './types';

export interface Elements {
  a: number;
  e: number;
  inc: number;
  node: number;
  argPeri: number;
  meanAnom: number;
  period: number;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

export function stateToElements(mu: number, r: Vec3, v: Vec3): Elements {
  const rl = len(r),
    h = cross(r, v),
    hl = len(h),
    hh: Vec3 = [h[0] / hl, h[1] / hl, h[2] / hl];
  const vxh = cross(v, h);
  const ev: Vec3 = [vxh[0] / mu - r[0] / rl, vxh[1] / mu - r[1] / rl, vxh[2] / mu - r[2] / rl];
  const e = len(ev),
    a = 1 / (2 / rl - dot(v, v) / mu);
  const inc = Math.acos(hh[2]);
  const nl = Math.hypot(h[0], h[1]); // |k x h|
  const N: Vec3 = nl > 1e-12 * hl ? [-h[1] / nl, h[0] / nl, 0] : [1, 0, 0]; // ascending node direction
  const node = Math.atan2(N[1], N[0]);
  const P: Vec3 = e > 1e-12 ? [ev[0] / e, ev[1] / e, ev[2] / e] : [r[0] / rl, r[1] / rl, r[2] / rl];
  const argPeri = Math.atan2(dot(P, cross(hh, N)), dot(P, N));
  const Q = cross(hh, P);
  const nu = Math.atan2(dot(r, Q), dot(r, P));
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const meanAnom = E - e * Math.sin(E);
  return { a, e, inc, node, argPeri, meanAnom, period: 2 * Math.PI * Math.sqrt((a * a * a) / mu) };
}

export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 50; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return E;
}

export function elementsToState(
  mu: number,
  a: number,
  e: number,
  inc: number,
  node: number,
  w: number,
  M: number,
): { pos: Vec3; vel: Vec3 } {
  const E = solveKepler(M, e),
    cE = Math.cos(E),
    sE = Math.sin(E),
    q = Math.sqrt(1 - e * e);
  const cO = Math.cos(node),
    sO = Math.sin(node),
    cw = Math.cos(w),
    sw = Math.sin(w),
    ci = Math.cos(inc),
    si = Math.sin(inc);
  const P: Vec3 = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q: Vec3 = [-cO * sw - sO * cw * ci, -sO * cw + cO * sw * ci, cw * si];
  const r = a * (1 - e * cE),
    k = Math.sqrt(mu * a) / r;
  const pos: Vec3 = [
    a * (cE - e) * P[0]! + a * q * sE * Q[0]!,
    a * (cE - e) * P[1]! + a * q * sE * Q[1]!,
    a * (cE - e) * P[2]! + a * q * sE * Q[2]!,
  ];
  const vel: Vec3 = [
    k * (-sE * P[0]! + q * cE * Q[0]!),
    k * (-sE * P[1]! + q * cE * Q[1]!),
    k * (-sE * P[2]! + q * cE * Q[2]!),
  ];
  return { pos, vel };
}
