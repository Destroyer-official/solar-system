import type { Vec3 } from './types';

/** Relative position/velocity of a body at perihelion around its parent. gmTotal = GM_parent + GM_body. */
export function perihelionState(
  gmTotal: number,
  aAu: number,
  e: number,
  incRad: number,
): { pos: Vec3; vel: Vec3 } {
  const rp = aAu * (1 - e);
  const vp = Math.sqrt((gmTotal * (1 + e)) / rp); // vis-viva at perihelion
  return { pos: [rp, 0, 0], vel: [0, vp * Math.cos(incRad), vp * Math.sin(incRad)] };
}
