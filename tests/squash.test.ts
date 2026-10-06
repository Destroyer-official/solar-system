import { describe, it, expect } from 'vitest';
import { squash } from '@/frames/transform';

describe('Along-Track Compression (squash)', () => {
  it('squash only changes the component along the axis', () => {
    const out = [0, 0, 0];
    squash([1, 0, 0], 0.1, 10, 3, 4, out);
    expect(out).toEqual([1, 3, 4]);
  });

  it('s = 1 is the identity', () => {
    const out = [0, 0, 0];
    squash([0, 0, 1], 1, 1, 2, 3, out);
    expect(out).toEqual([1, 2, 3]);
  });

  it('undefined axis leaves coordinates untouched', () => {
    const out = [0, 0, 0];
    squash(undefined, 0.05, 5, 6, 7, out);
    expect(out).toEqual([5, 6, 7]);
  });

  it('compresses arbitrary unit vector axis accurately', () => {
    const out = [0, 0, 0];
    const u = [0, 0.6, 0.8]; // unit vector (0.6^2 + 0.8^2 = 1)
    // point along u with length 10: (0, 6, 8)
    squash(u, 0.2, 0, 6, 8, out);
    // should compress length from 10 to 2 along u: (0, 1.2, 1.6)
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(1.2, 6);
    expect(out[2]).toBeCloseTo(1.6, 6);
  });
});
