import { kmsToAuDay } from '@/data/constants';
import {
  GALACTIC_AXES_IN_ICRS,
  LSR_SPEED_KMS,
  OBLIQUITY_J2000_RAD,
  SOLAR_PECULIAR_KMS,
  CMB_DIPOLE_SPEED_KMS,
  CMB_DIPOLE_L_DEG,
  CMB_DIPOLE_B_DEG,
} from '@/data/galaxy';
import type { Mat3, ReferenceFrame } from './types';

type V3 = readonly [number, number, number];

const ce = Math.cos(OBLIQUITY_J2000_RAD),
  se = Math.sin(OBLIQUITY_J2000_RAD);
/** ICRS (equatorial) -> J2000 ecliptic: rotation about x by -obliquity. */
const icrsToEcliptic = (v: V3): V3 => [v[0], ce * v[1]! + se * v[2]!, -se * v[1]! + ce * v[2]!];

const [GX, GY, GZ] = GALACTIC_AXES_IN_ICRS;
/** Galactic x (to center), y (rotation), z (north) as unit vectors in simulation (ecliptic) axes. */
export const GALACTIC_AXES_IN_SIM: readonly [V3, V3, V3] = [
  icrsToEcliptic(GX),
  icrsToEcliptic(GY),
  icrsToEcliptic(GZ),
];

/** Sun's velocity through the galaxy in galactic axes (U, V, W), km/s. Default LSR speed 220 km/s. */
export function sunGalacticVelocityKms(lsrKms: number = LSR_SPEED_KMS): V3 {
  const [u, v, w] = SOLAR_PECULIAR_KMS;
  return [u, v + lsrKms, w];
}

/** Same velocity in simulation axes, AU/day. */
export function sunVelocitySim(lsrKms: number = LSR_SPEED_KMS): V3 {
  const g = sunGalacticVelocityKms(lsrKms);
  const [ex, ey, ez] = GALACTIC_AXES_IN_SIM;
  const c = (k: 0 | 1 | 2) => kmsToAuDay(g[0]! * ex[k]! + g[1]! * ey[k]! + g[2]! * ez[k]!);
  return [c(0), c(1), c(2)];
}

const unit = (v: readonly number[]): [number, number, number] => {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};

/**
 * Creates a reference frame boosted by velocity vector vGalKms (given in galactic axes).
 * x_frame = x_sim + V * t (origin = -V * t).
 * alignAxes = true aligns coordinates to the galactic axes (x = Galactic Center, y = rotation, z = Galactic North).
 */
export function boostedFrame(
  id: string,
  label: string,
  vGalKms: V3,
  alignAxes: boolean,
): ReferenceFrame {
  const [ex, ey, ez] = GALACTIC_AXES_IN_SIM;
  const V: V3 = [
    kmsToAuDay(vGalKms[0]! * ex[0]! + vGalKms[1]! * ey[0]! + vGalKms[2]! * ez[0]!),
    kmsToAuDay(vGalKms[0]! * ex[1]! + vGalKms[1]! * ey[1]! + vGalKms[2]! * ez[1]!),
    kmsToAuDay(vGalKms[0]! * ex[2]! + vGalKms[1]! * ey[2]! + vGalKms[2]! * ez[2]!),
  ];
  const axes: Mat3 | null = alignAxes
    ? [ex[0]!, ex[1]!, ex[2]!, ey[0]!, ey[1]!, ey[2]!, ez[0]!, ez[1]!, ez[2]!]
    : null;
  const dirAligned = unit(vGalKms);
  const dirSim = unit(V);
  return {
    id,
    label,
    axes,
    travelDir: alignAxes ? dirAligned : dirSim,
    origin: (t, _gm, _pos, _base, out) => {
      out[0] = -V[0]! * t;
      out[1] = -V[1]! * t;
      out[2] = -V[2]! * t;
    },
    originVelocity: (_t, _gm, _vel, _base, out) => {
      out[0] = -V[0]!;
      out[1] = -V[1]!;
      out[2] = -V[2]!;
    },
  };
}

/**
 * Frame in which the solar system's barycenter moves at the Sun's galactic velocity.
 * Valid for thousands of years (straight-line approximation).
 */
export function galacticFrame(alignAxes: boolean, lsrKms: number = LSR_SPEED_KMS): ReferenceFrame {
  const g = sunGalacticVelocityKms(lsrKms);
  const id = alignAxes ? 'galactic-aligned' : 'galactic';
  const label = alignAxes
    ? `Galactic (axes aligned, ${lsrKms} km/s)`
    : `Galactic (ecliptic axes, ${lsrKms} km/s)`;
  return boostedFrame(id, label, g, alignAxes);
}

/**
 * Sun's velocity relative to the Cosmic Microwave Background (CMB) dipole in Galactic axes, km/s.
 * Planck 2018 / 2020 dipole: 369.82 km/s toward (l=264.021°, b=48.253°).
 */
export function sunCmbVelocityGalacticKms(): V3 {
  const D = Math.PI / 180;
  const l = CMB_DIPOLE_L_DEG * D;
  const b = CMB_DIPOLE_B_DEG * D;
  return [
    CMB_DIPOLE_SPEED_KMS * Math.cos(b) * Math.cos(l),
    CMB_DIPOLE_SPEED_KMS * Math.cos(b) * Math.sin(l),
    CMB_DIPOLE_SPEED_KMS * Math.sin(b),
  ];
}

/**
 * Cosmic Microwave Background (CMB) rest frame: the most "absolute" physical rest frame measurable.
 * The Sun moves at 369.82 km/s through the cosmic radiation background.
 */
export function cmbFrame(alignAxes: boolean = true): ReferenceFrame {
  const id = alignAxes ? 'cmb-aligned' : 'cmb';
  const label = alignAxes
    ? 'CMB rest frame (370 km/s, aligned)'
    : 'CMB rest frame (370 km/s, ecliptic)';
  return boostedFrame(id, label, sunCmbVelocityGalacticKms(), alignAxes);
}
