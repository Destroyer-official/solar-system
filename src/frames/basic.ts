import type { ReferenceFrame, Writable } from './types';

function weightedMean(gm: Float64Array, a: Float64Array, base: number, out: Writable): void {
  let m = 0,
    x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < gm.length; i++) {
    const g = gm[i]!;
    m += g;
    x += g * a[base + 3 * i]!;
    y += g * a[base + 3 * i + 1]!;
    z += g * a[base + 3 * i + 2]!;
  }
  out[0] = x / m;
  out[1] = y / m;
  out[2] = z / m;
}

export const barycentricFrame: ReferenceFrame = {
  id: 'barycentric',
  label: 'Barycentric (Sun wobbles)',
  axes: null,
  origin: (_t, gm, pos, base, out) => weightedMean(gm, pos, base, out),
  originVelocity: (_t, gm, vel, base, out) => weightedMean(gm, vel, base, out),
};

/** Non-rotating frame centered on one body (heliocentric when index = Sun). */
export function bodyCenteredFrame(index: number, bodyId: string, name: string): ReferenceFrame {
  const read = (a: Float64Array, base: number, out: Writable) => {
    out[0] = a[base + 3 * index]!;
    out[1] = a[base + 3 * index + 1]!;
    out[2] = a[base + 3 * index + 2]!;
  };
  return {
    id: `body:${bodyId}`,
    label: `${name}-centered`,
    axes: null,
    origin: (_t, _gm, pos, base, out) => read(pos, base, out),
    originVelocity: (_t, _gm, vel, base, out) => read(vel, base, out),
  };
}
