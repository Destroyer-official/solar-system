/** Cubic Hermite between (t0,p0,v0) and (t1,p1,v1). Works for t1 < t0 (backward time). */
export function hermite(
  t0: number,
  p0: Float64Array,
  v0: Float64Array,
  t1: number,
  p1: Float64Array,
  v1: Float64Array,
  t: number,
  out: Float64Array,
): void {
  const h = t1 - t0;
  if (h === 0) {
    out.set(p1);
    return;
  }
  const s = (t - t0) / h,
    s2 = s * s,
    s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1,
    h10 = s3 - 2 * s2 + s,
    h01 = -2 * s3 + 3 * s2,
    h11 = s3 - s2;
  for (let k = 0; k < out.length; k++) {
    out[k] = h00 * p0[k]! + h10 * h * v0[k]! + h01 * p1[k]! + h11 * h * v1[k]!;
  }
}
