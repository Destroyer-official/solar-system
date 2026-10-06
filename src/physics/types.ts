/** Plain tuple, used for data files and tests. Hot loops use flat Float64Array instead. */
export type Vec3 = readonly [number, number, number];

/** Static + initial data for one body. Loaded from JSON. All in internal units. */
export interface BodyDef {
  id: string;
  name: string;
  parent?: string; // for display grouping only; physics ignores it
  gm: number; // AU^3/day^2
  radiusKm: number;
  position: Vec3; // AU, barycentric ICRF
  velocity: Vec3; // AU/day
}

/**
 * Structure-of-arrays state: fast, GPU/worker friendly, no per-step allocation.
 * Body i occupies indices [3i, 3i+2].
 */
export interface SystemState {
  t: number; // days since epoch
  n: number; // body count
  gm: Float64Array; // length n
  pos: Float64Array; // length 3n
  vel: Float64Array; // length 3n
  nMassive?: number; // massive body boundary for particles / tide
}

/** Plug-in force: gravity, relativity, J2... adds into acc. */
export interface ForceModel {
  readonly name: string;
  apply(state: SystemState, acc: Float64Array): void;
}

/** Swappable algorithm: verlet, yoshida4, ias15... */
export interface Integrator {
  readonly name: string;
  step(state: SystemState, forces: ForceModel[], dt: number): void;
}
