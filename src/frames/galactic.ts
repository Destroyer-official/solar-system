import { kmsToAuDay } from '@/data/constants';
import { GALACTIC_AXES_IN_ICRS, LSR_SPEED_KMS, OBLIQUITY_J2000_RAD, SOLAR_PECULIAR_KMS } from '@/data/galaxy';
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

/** Sun's velocity through the galaxy in galactic axes (U, V, W), km/s. */
export function sunGalacticVelocityKms(): V3 {
  const [u, v, w] = SOLAR_PECULIAR_KMS;
  return [u, v + LSR_SPEED_KMS, w];
}

/** Same velocity in simulation axes, AU/day. */
export function sunVelocitySim(): V3 {
  const g = sunGalacticVelocityKms();
  const [ex, ey, ez] = GALACTIC_AXES_IN_SIM;
  const c = (k: 0 | 1 | 2) => kmsToAuDay(g[0]! * ex[k]! + g[1]! * ey[k]! + g[2]! * ez[k]!);
  return [c(0), c(1), c(2)];
}

/**
 * Frame in which the solar system's barycenter moves at the Sun's galactic velocity.
 * x_gal = x_sim + V t   (origin = -V t).  Straight-line motion: valid for thousands of years
 * (galactic orbital curvature is ~0.6 AU sagitta per kyr — negligible here, false precision to model).
 * alignAxes = true also rotates axes so +x = galactic center, +y = direction of rotation, +z = galactic north.
 */
export function galacticFrame(alignAxes: boolean): ReferenceFrame {
  const V = sunVelocitySim();
  const [ex, ey, ez] = GALACTIC_AXES_IN_SIM;
  const axes: Mat3 | null = alignAxes
    ? [ex[0]!, ex[1]!, ex[2]!, ey[0]!, ey[1]!, ey[2]!, ez[0]!, ez[1]!, ez[2]!]
    : null;
  return {
    id: alignAxes ? 'galactic-aligned' : 'galactic',
    label: alignAxes ? 'Galactic (axes aligned to galaxy)' : 'Galactic (ecliptic axes)',
    axes,
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
