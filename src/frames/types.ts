import type { SystemState } from '@/physics/types';

export interface ReferenceFrame {
  readonly id: string;
  /** Write frame-relative positions/velocities into out (same length as state). */
  transform(state: SystemState, outPos: Float64Array, outVel: Float64Array): void;
}
