import { describe, it, expect } from 'vitest';
import { History } from '@/sim/history';
import type { SystemState } from '@/physics/types';

const mk = (): SystemState => ({
  t: 0,
  n: 2,
  gm: new Float64Array([1, 1]),
  pos: new Float64Array(6),
  vel: new Float64Array(6),
});

describe('History', () => {
  it('keeps only the newest cap samples, in time order', () => {
    const h = new History(2, 10, 1),
      s = mk();
    for (let i = 0; i < 25; i++) {
      s.t = i;
      s.pos[0] = i;
      h.sample(s);
    }
    expect(h.count).toBe(10);
    expect(h.timeAt(0)).toBe(15);
    expect(h.timeAt(9)).toBe(24);
    expect(h.positions[h.baseAt(9)]).toBe(24);
  });
  it('respects the sampling interval', () => {
    const h = new History(2, 100, 5),
      s = mk();
    for (let t = 0; t <= 20; t++) {
      s.t = t;
      h.sample(s);
    }
    expect(h.count).toBe(5); // t = 0, 5, 10, 15, 20
  });
  it('clear() empties it', () => {
    const h = new History(2, 10, 1),
      s = mk();
    h.sample(s);
    h.clear();
    expect(h.count).toBe(0);
  });
});
