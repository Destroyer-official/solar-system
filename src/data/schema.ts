export type InitialState =
  | { type: 'root' }
  | { type: 'elements'; parent: string; aAu: number; e: number; incDeg: number };

export interface BodyJson {
  id: string;
  name: string;
  gmKm3S2: number; // NASA units, converted once in code
  radiusKm: number;
  color: string;
  initial: InitialState;
}
