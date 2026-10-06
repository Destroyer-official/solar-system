import { describe, it, expect } from 'vitest';
import { loadSystem } from '@/sim/registry';
import { bodyToEcliptic, poleOf } from '@/physics/orientation';
import type { Vec3 } from '@/physics/types';
import { JD_J2000 } from '@/data/constants';

const model = loadSystem();
const sun = model.ids.indexOf('sun');
const idx = (id: string) => model.ids.indexOf(id);

// Known published values (IAU WGCCRE / Archinal et al. 2018).
// Tilt = angle between the spin pole and the orbit normal (r x v about the Sun).
const TILT_DEG: Record<string, number> = {
  mercury: 0.03,
  venus: 177.36,
  earth: 23.44,
  mars: 25.19,
  jupiter: 3.13,
  saturn: 26.73,
  uranus: 97.77,
  neptune: 28.32,
};

// Sidereal rotation days
const SIDEREAL_DAY: Record<string, number> = {
  mercury: 58.6462,
  venus: -243.0226,
  earth: 0.99726968,
  mars: 1.02595676,
  jupiter: 0.41354,
  saturn: 0.44401,
  uranus: -0.71833,
  neptune: 0.66526, // IAU 2015 WGCCRE: 360 / 541.1397757 = 0.66526 d (15.966 h)
};

function orbitNormal(i: number, sunIdx: number): Vec3 {
  const rx = model.state.pos[3 * i]! - model.state.pos[3 * sunIdx]!;
  const ry = model.state.pos[3 * i + 1]! - model.state.pos[3 * sunIdx + 1]!;
  const rz = model.state.pos[3 * i + 2]! - model.state.pos[3 * sunIdx + 2]!;

  const vx = model.state.vel[3 * i]! - model.state.vel[3 * sunIdx]!;
  const vy = model.state.vel[3 * i + 1]! - model.state.vel[3 * sunIdx + 1]!;
  const vz = model.state.vel[3 * i + 2]! - model.state.vel[3 * sunIdx + 2]!;

  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const hl = Math.hypot(hx, hy, hz);
  return [hx / hl, hy / hl, hz / hl];
}

describe('Planet Rotational Elements and Orientation', () => {
  const dEpoch = model.epochJd - JD_J2000;

  it.each(Object.keys(TILT_DEG))('%s: axial tilt matches', (id) => {
    const rot = model.physicalMap[id]?.rotation;
    expect(rot).toBeDefined();
    const m = bodyToEcliptic(rot!, dEpoch);
    const pole = poleOf(m);
    const n = orbitNormal(idx(id), sun);

    // Right-hand rule spin axis: for retrograde rotators (wRate < 0),
    // the IAU cartographic north pole points in the northern celestial hemisphere,
    // so physical spin axis is -pole.
    const spinPole = rot!.wRateDegPerDay < 0 ? [-pole[0]!, -pole[1]!, -pole[2]!] : pole;
    const dot = spinPole[0]! * n[0]! + spinPole[1]! * n[1]! + spinPole[2]! * n[2]!;
    const angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

    // Tolerance accounts for osculating orbit plane vs mean J2000 orbit plane (up to ~1.5° for Mars)
    const tol = id === 'mars' ? 1.5 : id === 'neptune' ? 0.6 : 0.3;
    expect(Math.abs(angle - TILT_DEG[id]!)).toBeLessThan(tol);
  });

  it.each(Object.keys(SIDEREAL_DAY))('%s: rotation period matches', (id) => {
    const rot = model.physicalMap[id]?.rotation;
    expect(rot).toBeDefined();
    const period = 360 / rot!.wRateDegPerDay;
    const relDiff = Math.abs(period - SIDEREAL_DAY[id]!) / Math.abs(SIDEREAL_DAY[id]!);
    expect(relDiff).toBeLessThan(1e-4);
  });

  const planetIds = Object.keys(TILT_DEG);
  it.each(planetIds)(
    '%s: matrix is orthonormal and spinning by one sidereal day returns orientation',
    (id) => {
      const rot = model.physicalMap[id]!.rotation!;
      const m1 = bodyToEcliptic(rot, dEpoch);

      // Orthonormality check
      for (let r = 0; r < 3; r++) {
        const rowLen = Math.hypot(m1[3 * r]!, m1[3 * r + 1]!, m1[3 * r + 2]!);
        expect(rowLen).toBeCloseTo(1.0, 10);
      }
      for (let c = 0; c < 3; c++) {
        const colLen = Math.hypot(m1[c]!, m1[3 + c]!, m1[6 + c]!);
        expect(colLen).toBeCloseTo(1.0, 10);
      }

      // One full sidereal rotation
      const period = Math.abs(360 / rot.wRateDegPerDay);
      const m2 = bodyToEcliptic(rot, dEpoch + period);
      for (let k = 0; k < 9; k++) {
        expect(m2[k]!).toBeCloseTo(m1[k]!, 4);
      }
    },
  );

  it('Mercury is in 3:2 spin-orbit resonance: 1.5 rotations per orbit', () => {
    expect(87.969 / 58.6462).toBeCloseTo(1.5, 2);
  });

  it('Earth subsolar point at 2026-10-06 12:00 UTC matches ephemeris expectations', () => {
    // 0.5 days after the epoch 2026-10-06 00:00
    const tDays = 0.5;
    const daysSinceJ2000 = dEpoch + tDays;
    const rot = model.physicalMap['earth']!.rotation!;
    const M = bodyToEcliptic(rot, daysSinceJ2000);

    // Earth to Sun vector in simulation axes (J2000 ecliptic)
    const eIdx = idx('earth');
    const rx = model.state.pos[3 * sun]! - model.state.pos[3 * eIdx]!;
    const ry = model.state.pos[3 * sun + 1]! - model.state.pos[3 * eIdx + 1]!;
    const rz = model.state.pos[3 * sun + 2]! - model.state.pos[3 * eIdx + 2]!;
    const rl = Math.hypot(rx, ry, rz);
    const uSim = [rx / rl, ry / rl, rz / rl];

    // Transpose of M maps from simulation frame into body-fixed frame:
    // v_body = M^T * v_sim
    const bx = M[0]! * uSim[0]! + M[3]! * uSim[1]! + M[6]! * uSim[2]!;
    const by = M[1]! * uSim[0]! + M[4]! * uSim[1]! + M[7]! * uSim[2]!;
    const bz = M[2]! * uSim[0]! + M[5]! * uSim[1]! + M[8]! * uSim[2]!;

    const latDeg = (Math.asin(bz) * 180) / Math.PI;
    const lonDeg = (Math.atan2(by, bx) * 180) / Math.PI;

    console.log(`Earth subsolar point measured: lat=${latDeg.toFixed(2)}°, lon=${lonDeg.toFixed(2)}°`);

    // Expected latitude ≈ -5.2° (±0.3°)
    expect(latDeg).toBeGreaterThan(-5.5);
    expect(latDeg).toBeLessThan(-4.9);

    // Expected longitude ≈ -2.9° (±1.0°)
    expect(lonDeg).toBeGreaterThan(-3.9);
    expect(lonDeg).toBeLessThan(-1.9);
  });

  it('scale modes: true mode equals radiusKm / AU_KM exactly, pixels mode clamps to minimum', async () => {
    const { BodyVisual } = await import('@/render/bodyVisual');
    const vis = new BodyVisual({
      id: 'earth',
      name: 'Earth',
      radiusKm: 6378.137,
      color: '#4488ff',
      physical: model.physicalMap['earth'],
    });

    const expectedTrue = 6378.137 / 149597870.7;
    expect(vis.computeScale('true', 1.0, 0.001)).toBe(expectedTrue);

    // Far away, pixels mode clamps to cameraDist * pixelFactor
    const pixelScale = vis.computeScale('pixels', 100.0, 0.001);
    expect(pixelScale).toBe(0.1);
    expect(pixelScale).toBeGreaterThan(expectedTrue);

    // Up close, pixels mode never drops below real radius
    const closeScale = vis.computeScale('pixels', 0.0001, 0.001);
    expect(closeScale).toBe(expectedTrue);

    // Exaggerated mode multiplies real radius by factor
    expect(vis.computeScale('exaggerated', 1.0, 0.001, 50)).toBe(expectedTrue * 50);
  });
});
