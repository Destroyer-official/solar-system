import type { ReferenceFrame } from '@/frames/types';
import { mapPoint } from '@/frames/transform';
import type { SystemState } from '@/physics/types';
import type { History } from './history';

/**
 * Rebuild every body's trail in `frame`, relative to the focus's CURRENT position (floating origin).
 * float64 math, float32 only at the end. focus = body index, or -1 for the barycenter.
 * outs[i] must hold at least 3*(history.cap+1) floats. Returns the vertex count (same for every body).
 */
export function buildTracks(
  h: History,
  live: SystemState,
  frame: ReferenceFrame,
  focus: number,
  windowDays: number,
  outs: Float32Array[],
): number {
  const ax = frame.axes,
    n = live.n;
  const o = [0, 0, 0],
    p = [0, 0, 0],
    f = [0, 0, 0];

  frame.origin(live.t, live.gm, live.pos, 0, o);
  if (focus >= 0)
    mapPoint(ax, o, live.pos[3 * focus]!, live.pos[3 * focus + 1]!, live.pos[3 * focus + 2]!, f);
  else mapPoint(ax, o, 0, 0, 0, f); // the simulation is barycentric, so the barycenter is the sim origin

  let start = h.count;
  for (let k = h.count - 1; k >= 0; k--) {
    if (Math.abs(live.t - h.timeAt(k)) > windowDays) break;
    start = k;
  }

  let v = 0;
  const emit = (t: number, pos: Float64Array, base: number) => {
    frame.origin(t, live.gm, pos, base, o); // where the frame's origin was AT THAT TIME
    for (let i = 0; i < n; i++) {
      mapPoint(ax, o, pos[base + 3 * i]!, pos[base + 3 * i + 1]!, pos[base + 3 * i + 2]!, p);
      const out = outs[i]!;
      out[3 * v] = p[0]! - f[0]!;
      out[3 * v + 1] = p[1]! - f[1]!;
      out[3 * v + 2] = p[2]! - f[2]!;
    }
    v++;
  };
  for (let k = start; k < h.count; k++) emit(h.timeAt(k), h.positions, h.baseAt(k));
  emit(live.t, live.pos, 0);
  return v;
}
