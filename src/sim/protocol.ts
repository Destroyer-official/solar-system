export type ToWorker =
  | {
      type: 'init';
      t: number;
      gm: Float64Array;
      pos: Float64Array;
      vel: Float64Array;
      maxDt: number;
      maxSteps: number;
      historyIntervalDays: number;
      integrator?: 'leapfrog' | 'yoshida4';
      relativity?: boolean;
      quadrupole?: boolean;
      fixedDt?: number;
    }
  | {
      type: 'setPhysics';
      integrator?: 'leapfrog' | 'yoshida4';
      relativity?: boolean;
      quadrupole?: boolean;
      fixedDt?: number;
    }
  | { type: 'advance'; gen: number; days: number }
  | { type: 'seek'; gen: number; t: number } // jump to absolute sim time (days from epoch)
  | { type: 'reset'; gen: number };

export interface Frame {
  type: 'frame';
  gen: number;
  t: number;
  advanced: number;
  pos: Float64Array;
  vel: Float64Array;
  samples: Float64Array; // k records of [t, x0,y0,z0, x1,...], record length = stride
  stride: number;
  energyDrift: number;
  angMomDrift: number;
  baryDist: Float64Array; // each body's distance to the system center of mass, AU
}
