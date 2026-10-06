import { AU_KM, auDayToKms } from '@/data/constants';
import { bodyToEcliptic, poleOf } from '@/physics/orientation';
import { stateToElements, type Elements } from '@/physics/kepler';
import type { SystemState, Vec3 } from '@/physics/types';
import type { SystemModel } from './registry';

export interface ComputedFacts {
  id: string;
  name: string;
  distSunAu: number;
  lightMinutes: number;
  speedKms: number;
  elements: Elements;
  axialTiltDeg: number;
  siderealDayDays: number;
  subsolarLatDeg: number;
  subsolarLonDeg: number;
  facts: Record<string, string>;
}

export function computeBodyFacts(
  id: string,
  state: SystemState,
  model: SystemModel,
): ComputedFacts | null {
  const i = model.ids.indexOf(id);
  const sun = model.ids.indexOf('sun');
  if (i < 0 || sun < 0) return null;

  const physical = model.physicalMap[id];
  const rot = physical?.rotation;
  const daysSinceJ2000 = model.epochJd - 2451545.0 + state.t;

  // Body relative to Sun
  const rx = state.pos[3 * i]! - state.pos[3 * sun]!;
  const ry = state.pos[3 * i + 1]! - state.pos[3 * sun + 1]!;
  const rz = state.pos[3 * i + 2]! - state.pos[3 * sun + 2]!;

  const vx = state.vel[3 * i]! - state.vel[3 * sun]!;
  const vy = state.vel[3 * i + 1]! - state.vel[3 * sun + 1]!;
  const vz = state.vel[3 * i + 2]! - state.vel[3 * sun + 2]!;

  const distSunAu = Math.hypot(rx, ry, rz);
  const lightMinutes = distSunAu * (AU_KM / 299792.458 / 60);
  const speedKms = auDayToKms(Math.hypot(vx, vy, vz));

  // Osculating orbital elements
  const mu = state.gm[sun]! + state.gm[i]!;
  const rVec: Vec3 = [rx, ry, rz];
  const vVec: Vec3 = [vx, vy, vz];
  const elements = stateToElements(mu, rVec, vVec);

  let axialTiltDeg = 0;
  let siderealDayDays = 0;
  let subsolarLatDeg = 0;
  let subsolarLonDeg = 0;

  if (rot) {
    const M = bodyToEcliptic(rot, daysSinceJ2000);
    const pole = poleOf(M);

    // Orbit normal
    const hx = ry * vz - rz * vy;
    const hy = rz * vx - rx * vz;
    const hz = rx * vy - ry * vx;
    const hl = Math.hypot(hx, hy, hz);
    const n = [hx / hl, hy / hl, hz / hl];

    const spinPole = rot.wRateDegPerDay < 0 ? [-pole[0]!, -pole[1]!, -pole[2]!] : pole;
    const dot = spinPole[0]! * n[0]! + spinPole[1]! * n[1]! + spinPole[2]! * n[2]!;
    axialTiltDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

    siderealDayDays = 360 / rot.wRateDegPerDay;

    // Subsolar point
    // Vector from body to Sun is -rVec
    const toSunX = -rx / distSunAu;
    const toSunY = -ry / distSunAu;
    const toSunZ = -rz / distSunAu;

    // Rotate into body-fixed frame using transpose(M)
    const bx = M[0]! * toSunX + M[3]! * toSunY + M[6]! * toSunZ;
    const by = M[1]! * toSunX + M[4]! * toSunY + M[7]! * toSunZ;
    const bz = M[2]! * toSunX + M[5]! * toSunY + M[8]! * toSunZ;

    subsolarLatDeg = (Math.asin(Math.max(-1, Math.min(1, bz))) * 180) / Math.PI;
    subsolarLonDeg = (Math.atan2(by, bx) * 180) / Math.PI;
  }

  return {
    id,
    name: model.names[i]!,
    distSunAu,
    lightMinutes,
    speedKms,
    elements,
    axialTiltDeg,
    siderealDayDays,
    subsolarLatDeg,
    subsolarLonDeg,
    facts: physical?.facts ?? {},
  };
}
