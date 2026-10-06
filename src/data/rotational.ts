
export interface RingDef {
  innerRadiusKm: number;
  outerRadiusKm: number;
  color: string;
  opacity: number;
}

export interface RotationalElements {
  id: string;
  name: string;
  /** Sidereal rotation period in days. Negative for retrograde rotation (Venus, Uranus) */
  periodDays: number;
  /** Obliquity / axial tilt to ecliptic in degrees */
  tiltDeg: number;
  /** Unit vector of the north rotation pole in J2000 ecliptic coordinates */
  poleVector: readonly [number, number, number];
  /** Rings (if present) */
  rings?: RingDef;
}

/**
 * IAU Working Group on Cartographic Coordinates and Rotational Elements (Archinal et al. 2018).
 * Pole vectors expressed as unit vectors in J2000 ecliptic coordinates.
 */
export const ROTATIONAL_DATA: Record<string, RotationalElements> = {
  sun: {
    id: 'sun',
    name: 'Sun',
    periodDays: 25.05, // equatorial sidereal period
    tiltDeg: 7.25,
    poleVector: [0.0065, 0.126, 0.992],
  },
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    periodDays: 58.646,
    tiltDeg: 0.034,
    poleVector: [0.0, 0.0006, 1.0],
  },
  venus: {
    id: 'venus',
    name: 'Venus',
    periodDays: -243.02, // retrograde
    tiltDeg: 177.36,
    poleVector: [0.009, 0.046, -0.9989],
  },
  earth: {
    id: 'earth',
    name: 'Earth',
    periodDays: 0.99726968, // 23h 56m 4.1s sidereal day
    tiltDeg: 23.4393,
    poleVector: [0.0, 0.39778, 0.91748],
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    periodDays: 1.025957, // 24h 37m 22.7s
    tiltDeg: 25.19,
    poleVector: [0.0934, 0.4155, 0.9048],
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter',
    periodDays: 0.41354, // 9h 55m 30s (System II)
    tiltDeg: 3.13,
    poleVector: [0.0227, 0.05, 0.9985],
  },
  saturn: {
    id: 'saturn',
    name: 'Saturn',
    periodDays: 0.4396, // 10h 33m 38s
    tiltDeg: 26.73,
    poleVector: [-0.0718, 0.4441, 0.8931],
    rings: {
      innerRadiusKm: 74500, // C Ring inner edge
      outerRadiusKm: 140220, // A Ring outer edge
      color: '#d4c49c',
      opacity: 0.85,
    },
  },
  uranus: {
    id: 'uranus',
    name: 'Uranus',
    periodDays: -0.71833, // 17h 14m 24s (retrograde, rolling on its side)
    tiltDeg: 97.77,
    poleVector: [0.7738, -0.6186, -0.1353],
    rings: {
      innerRadiusKm: 38000,
      outerRadiusKm: 51149, // Epsilon ring
      color: '#98c5ce',
      opacity: 0.35,
    },
  },
  neptune: {
    id: 'neptune',
    name: 'Neptune',
    periodDays: 0.6713, // 16h 6m 36s
    tiltDeg: 28.32,
    poleVector: [-0.3475, 0.3396, 0.8741],
    rings: {
      innerRadiusKm: 41900,
      outerRadiusKm: 62933, // Adams ring
      color: '#658ed1',
      opacity: 0.25,
    },
  },
};
