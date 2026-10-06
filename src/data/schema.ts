type Triple = readonly [number, number, number];

export type InitialState =
  | { type: 'root' }
  | { type: 'elements'; parent: string; aAu: number; e: number; incDeg: number }
  /** Barycentric (SSB), J2000 ecliptic axes, AU and AU/day, at epochJd (TDB). */
  | { type: 'vectors'; epochJd: number; position: Triple; velocity: Triple };

export interface BodyJson {
  id: string;
  name: string;
  gmKm3S2: number; // NASA units, converted once in code
  radiusKm: number; // equatorial
  color: string;
  note?: string;
  source?: string;
  initial: InitialState;
}
