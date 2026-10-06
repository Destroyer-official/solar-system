import type { SystemState } from './types';
import { cross } from './vec3';

export function centerOfMass(s: SystemState) {
  let m = 0,
    x = 0,
    y = 0,
    z = 0,
    vx = 0,
    vy = 0,
    vz = 0;
  const nm = s.nMassive ?? s.n;
  for (let i = 0; i < nm; i++) {
    const g = s.gm[i]!;
    m += g;
    x += g * s.pos[3 * i]!;
    y += g * s.pos[3 * i + 1]!;
    z += g * s.pos[3 * i + 2]!;
    vx += g * s.vel[3 * i]!;
    vy += g * s.vel[3 * i + 1]!;
    vz += g * s.vel[3 * i + 2]!;
  }
  return { pos: [x / m, y / m, z / m] as const, vel: [vx / m, vy / m, vz / m] as const };
}

/** Energy per unit G (uses GM as mass). Newtonian only. Only massive bodies. */
export function totalEnergy(s: SystemState): number {
  let e = 0;
  const nm = s.nMassive ?? s.n;
  for (let i = 0; i < nm; i++) {
    const v2 = s.vel[3 * i]! ** 2 + s.vel[3 * i + 1]! ** 2 + s.vel[3 * i + 2]! ** 2;
    e += 0.5 * s.gm[i]! * v2;
    for (let j = i + 1; j < nm; j++) {
      const r = Math.hypot(
        s.pos[3 * i]! - s.pos[3 * j]!,
        s.pos[3 * i + 1]! - s.pos[3 * j + 1]!,
        s.pos[3 * i + 2]! - s.pos[3 * j + 2]!,
      );
      e -= (s.gm[i]! * s.gm[j]!) / r;
    }
  }
  return e;
}

export function angularMomentum(s: SystemState): [number, number, number] {
  const L: [number, number, number] = [0, 0, 0];
  const nm = s.nMassive ?? s.n;
  for (let i = 0; i < nm; i++) {
    const c = cross(
      s.pos[3 * i]!,
      s.pos[3 * i + 1]!,
      s.pos[3 * i + 2]!,
      s.vel[3 * i]!,
      s.vel[3 * i + 1]!,
      s.vel[3 * i + 2]!,
    );
    L[0] += s.gm[i]! * c[0];
    L[1] += s.gm[i]! * c[1];
    L[2] += s.gm[i]! * c[2];
  }
  return L;
}
