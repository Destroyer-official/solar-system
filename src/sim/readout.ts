import { AU_KM, DAY_S } from '@/data/constants';
import type { SystemState } from '@/physics/types';

export interface BodyRow {
  name: string;
  rAu: number;
  vKms: number;
}

/** Distance and speed of every other body relative to body `ref` (normally the Sun), nearest first. */
export function relativeRows(s: SystemState, names: readonly string[], ref: number): BodyRow[] {
  const rows: BodyRow[] = [];
  for (let i = 0; i < s.n; i++) {
    if (i === ref) continue;
    const r = Math.hypot(
      s.pos[3 * i]! - s.pos[3 * ref]!,
      s.pos[3 * i + 1]! - s.pos[3 * ref + 1]!,
      s.pos[3 * i + 2]! - s.pos[3 * ref + 2]!,
    );
    const v = Math.hypot(
      s.vel[3 * i]! - s.vel[3 * ref]!,
      s.vel[3 * i + 1]! - s.vel[3 * ref + 1]!,
      s.vel[3 * i + 2]! - s.vel[3 * ref + 2]!,
    );
    rows.push({ name: names[i]!, rAu: r, vKms: (v * AU_KM) / DAY_S });
  }
  return rows.sort((a, b) => a.rAu - b.rAu);
}
