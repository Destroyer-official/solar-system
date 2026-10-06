import { describe, it, expect } from 'vitest';
import { ALL_BODIES } from '@/sim/registry';
import { newtonianGravity, particleGravity } from '@/physics/forces/gravity';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { yoshida6 } from '@/physics/integrators/yoshida';
import type { SystemState } from '@/physics/types';

describe('Massless Test Particles (Phase 6.1)', () => {
  it('a test particle initialized on Earth trajectory tracks Earth within 1e-9 AU after 5 years', () => {
    const sunBody = ALL_BODIES.find((b) => b.id === 'sun')!;
    const earthBody = ALL_BODIES.find((b) => b.id === 'earth')!;

    if (sunBody.initial.type !== 'vectors' || earthBody.initial.type !== 'vectors') {
      throw new Error('Expected vectors initial state');
    }

    // 2 massive bodies (Sun, Earth) + 1 massless particle
    const nMassive = 2;
    const n = 3;
    const gm = new Float64Array(n);
    const pos = new Float64Array(3 * n);
    const vel = new Float64Array(3 * n);

    // GM in internal units
    // NASA units km^3/s^2 -> AU^3/day^2
    const AU_KM = 149_597_870.7;
    const toInternal = (km3s2: number) => (km3s2 * (86400 ** 2)) / (AU_KM ** 3);

    gm[0] = toInternal(sunBody.gmKm3S2);
    gm[1] = toInternal(earthBody.gmKm3S2);
    gm[2] = 0; // Massless particle

    // Sun
    pos.set(sunBody.initial.position, 0);
    vel.set(sunBody.initial.velocity, 0);

    // Earth
    pos.set(earthBody.initial.position, 3);
    vel.set(earthBody.initial.velocity, 3);

    // Particle exactly mirrors Earth's position and velocity
    pos.set(earthBody.initial.position, 6);
    vel.set(earthBody.initial.velocity, 6);

    const s: SystemState = {
      t: 0,
      n,
      nMassive,
      gm,
      pos,
      vel,
    };

    const it = yoshida6(new Leapfrog());
    const forces = [newtonianGravity, particleGravity];
    const dt = 0.5;
    const totalDays = 5 * 365.25;
    const steps = Math.round(totalDays / dt);

    for (let i = 0; i < steps; i++) {
      it.step(s, forces, dt);
    }

    // Measure separation between Earth (index 1) and test particle (index 2)
    const dx = s.pos[6]! - s.pos[3]!;
    const dy = s.pos[7]! - s.pos[4]!;
    const dz = s.pos[8]! - s.pos[5]!;
    const diffAu = Math.hypot(dx, dy, dz);

    console.log(`Earth vs test particle separation after 5 years: ${diffAu.toExponential(3)} AU`);
    expect(diffAu).toBeLessThan(1e-9);
  });

  it('adding massless particles leaves massive body trajectories bit-identical', () => {
    const sunBody = ALL_BODIES.find((b) => b.id === 'sun')!;
    const earthBody = ALL_BODIES.find((b) => b.id === 'earth')!;

    if (sunBody.initial.type !== 'vectors' || earthBody.initial.type !== 'vectors') {
      throw new Error('Expected vectors initial state');
    }

    const AU_KM = 149_597_870.7;
    const toInternal = (km3s2: number) => (km3s2 * (86400 ** 2)) / (AU_KM ** 3);

    // Run A: Massive bodies only
    const sA: SystemState = {
      t: 0,
      n: 2,
      nMassive: 2,
      gm: new Float64Array([toInternal(sunBody.gmKm3S2), toInternal(earthBody.gmKm3S2)]),
      pos: new Float64Array([...sunBody.initial.position, ...earthBody.initial.position]),
      vel: new Float64Array([...sunBody.initial.velocity, ...earthBody.initial.velocity]),
    };

    // Run B: Same massive bodies + 2 test particles
    const sB: SystemState = {
      t: 0,
      n: 4,
      nMassive: 2,
      gm: new Float64Array([toInternal(sunBody.gmKm3S2), toInternal(earthBody.gmKm3S2), 0, 0]),
      pos: new Float64Array([
        ...sunBody.initial.position,
        ...earthBody.initial.position,
        1.5, 0.2, -0.1,
        2.5, -0.8, 0.3,
      ]),
      vel: new Float64Array([
        ...sunBody.initial.velocity,
        ...earthBody.initial.velocity,
        0.005, 0.012, 0.001,
        -0.008, 0.009, -0.002,
      ]),
    };

    const itA = yoshida6(new Leapfrog());
    const itB = yoshida6(new Leapfrog());
    const forcesA = [newtonianGravity];
    const forcesB = [newtonianGravity, particleGravity];

    const dt = 1.0;
    const steps = 365; // 1 year

    for (let i = 0; i < steps; i++) {
      itA.step(sA, forcesA, dt);
      itB.step(sB, forcesB, dt);
    }

    // Compare massive body positions (indices 0 and 1, length 6)
    for (let k = 0; k < 6; k++) {
      expect(sB.pos[k]).toBe(sA.pos[k]);
      expect(sB.vel[k]).toBe(sA.vel[k]);
    }
  });
});
