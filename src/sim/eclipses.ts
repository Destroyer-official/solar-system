import type { SystemState } from '@/physics/types';

export interface EclipseEvent {
  date: Date;
  tDays: number;
  minSeparationDeg: number;
  type: 'solar' | 'lunar';
}

export function geocentricSunMoonSeparationDeg(
  s: SystemState,
  sunIdx: number,
  earthIdx: number,
  moonIdx: number,
): number {
  const ex = s.pos[3 * earthIdx]!,
    ey = s.pos[3 * earthIdx + 1]!,
    ez = s.pos[3 * earthIdx + 2]!;

  const sx = s.pos[3 * sunIdx]! - ex,
    sy = s.pos[3 * sunIdx + 1]! - ey,
    sz = s.pos[3 * sunIdx + 2]! - ez;
  const mx = s.pos[3 * moonIdx]! - ex,
    my = s.pos[3 * moonIdx + 1]! - ey,
    mz = s.pos[3 * moonIdx + 2]! - ez;

  const sLen = Math.hypot(sx, sy, sz);
  const mLen = Math.hypot(mx, my, mz);

  const cosTheta = (sx * mx + sy * my + sz * mz) / (sLen * mLen);
  const clamped = Math.max(-1, Math.min(1, cosTheta));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Scan for minimum geocentric separation around target date.
 */
export function findMinSeparation(
  getStateAtTime: (t: number) => SystemState,
  centerTDays: number,
  windowHours = 12,
  stepMinutes = 1,
  sunIdx = 0,
  earthIdx = 1,
  moonIdx = 2,
): { tMin: number; minSepDeg: number } {
  const windowDays = windowHours / 24;
  const stepDays = stepMinutes / 1440;

  let bestT = centerTDays;
  let minSep = Infinity;

  const tStart = centerTDays - windowDays;
  const tEnd = centerTDays + windowDays;

  for (let t = tStart; t <= tEnd; t += stepDays) {
    const s = getStateAtTime(t);
    const sep = geocentricSunMoonSeparationDeg(s, sunIdx, earthIdx, moonIdx);
    if (sep < minSep) {
      minSep = sep;
      bestT = t;
    }
  }

  // Golden section refinement to 1 second precision
  let a = bestT - stepDays;
  let b = bestT + stepDays;
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);

  while ((b - a) * 1440 > 0.02) {
    // 0.02 min = ~1.2 s
    const sepC = geocentricSunMoonSeparationDeg(getStateAtTime(c), sunIdx, earthIdx, moonIdx);
    const sepD = geocentricSunMoonSeparationDeg(getStateAtTime(d), sunIdx, earthIdx, moonIdx);
    if (sepC < sepD) {
      b = d;
      d = c;
      c = b - phi * (b - a);
    } else {
      a = c;
      c = d;
      d = a + phi * (b - a);
    }
  }

  const tOpt = (a + b) / 2;
  const sepOpt = geocentricSunMoonSeparationDeg(getStateAtTime(tOpt), sunIdx, earthIdx, moonIdx);
  return { tMin: tOpt, minSepDeg: sepOpt };
}
