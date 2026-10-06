import { describe, it, expect } from 'vitest';
import { perihelionState } from '@/physics/orbit';
import { createState } from '@/physics/system';
import { newtonianGravity } from '@/physics/forces/gravity';
import { GeneralRelativity } from '@/physics/forces/relativity';
import { Yoshida4 } from '@/physics/integrators/yoshida4';
import { GM_SUN_KM3_S2, gmToInternal } from '@/data/constants';
import type { BodyDef } from '@/physics/types';

describe('Mercury Relativistic Perihelion Precession (1PN)', () => {
  const gmSun = gmToInternal(GM_SUN_KM3_S2);
  const aAu = 0.38709893;
  const e = 0.20563069;
  const periodDays = 2 * Math.PI * Math.sqrt(aAu ** 3 / gmSun); // ~87.969 days

  // Initial perihelion state
  const orbit = perihelionState(gmSun, aAu, e, 0);
  const bodies: BodyDef[] = [
    { id: 'sun', name: 'Sun', gm: gmSun, radiusKm: 695700, position: [0, 0, 0], velocity: [0, 0, 0] },
    { id: 'mercury', name: 'Mercury', gm: gmToInternal(22031.86), radiusKm: 2439.7, position: orbit.pos, velocity: orbit.vel },
  ];

  function getPerihelionAngle(pos: Float64Array, vel: Float64Array): number {
    const rx = pos[3]! - pos[0]!, ry = pos[4]! - pos[1]!;
    const vx = vel[3]! - vel[0]!, vy = vel[4]! - vel[1]!;
    const hz = rx * vy - ry * vx;
    const r = Math.hypot(rx, ry);
    // Laplace-Runge-Lenz vector e = (v x h)/GM - r/|r|
    const ex = (vy * hz) / gmSun - rx / r;
    const ey = (-vx * hz) / gmSun - ry / r;
    return Math.atan2(ey, ex);
  }

  it('Newtonian gravity alone produces 0 perihelion precession', () => {
    const s = createState(bodies);
    const y4 = new Yoshida4();
    const phi0 = getPerihelionAngle(s.pos, s.vel);
    // Integrate for 20 orbits
    const dt = 0.1;
    const steps = Math.round((20 * periodDays) / dt);
    for (let i = 0; i < steps; i++) y4.step(s, [newtonianGravity], dt);
    const phiEnd = getPerihelionAngle(s.pos, s.vel);
    expect(Math.abs(phiEnd - phi0)).toBeLessThan(1e-5);
  });

  it('1PN General Relativity reproduces anomalous precession of ~43 arcsec/century', () => {
    const s = createState(bodies);
    const y4 = new Yoshida4();
    const gr = new GeneralRelativity(0);
    const phi0 = getPerihelionAngle(s.pos, s.vel);

    // Integrate 40 Mercury orbits (~9.6 years)
    const numOrbits = 40;
    const totalDays = numOrbits * periodDays;
    const dt = 0.05; // fine step for orbital precession
    const steps = Math.round(totalDays / dt);
    for (let i = 0; i < steps; i++) {
      y4.step(s, [newtonianGravity, gr], dt);
    }

    const phiEnd = getPerihelionAngle(s.pos, s.vel);
    let deltaRad = phiEnd - phi0;
    while (deltaRad < 0) deltaRad += 2 * Math.PI;

    // Convert radians to arcseconds per century (36525 days)
    const radToArcsec = (180 * 3600) / Math.PI;
    const arcsecPerCentury = (deltaRad * radToArcsec * 36525) / totalDays;

    // Theoretical General Relativity prediction:
    // dOmega = 6 * pi * GM / (c^2 * a * (1 - e^2)) per orbit
    // For Mercury: ~42.98 arcsec / century
    expect(arcsecPerCentury).toBeGreaterThan(41.5);
    expect(arcsecPerCentury).toBeLessThan(44.5);
  });
});
