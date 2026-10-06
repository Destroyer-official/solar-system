import { describe, it, expect } from 'vitest';
import { GalacticPotential, MYR_TO_TIME } from '@/physics/galacticPotential';

describe("Sun's Curved Galactic Orbit (Phase 6.4)", () => {
  it('circular orbit period in z=0 plane matches 2pi*R0/vc ≈ 229 Myr', () => {
    const pot = new GalacticPotential(220, 8.2);
    expect(pot).toBeDefined();
    const R0 = 8.2;
    const vc = 220;
    // Period in Myr = (2 * pi * R0 / vc) * (1 / MYR_TO_TIME)
    const theoreticalPeriodMyr = (2 * Math.PI * R0) / (vc * MYR_TO_TIME);
    console.log(`Theoretical circular period: ${theoreticalPeriodMyr.toFixed(2)} Myr`);
    expect(theoreticalPeriodMyr).toBeGreaterThan(220);
    expect(theoreticalPeriodMyr).toBeLessThan(235);
  });

  it('conserves energy and Lz to high precision over 500 Myr', () => {
    const pot = new GalacticPotential();
    const s = pot.getInitialSunState();
    const e0 = pot.getEnergy(s);
    const lz0 = pot.getLz(s);

    const dtMyr = 0.05;
    const steps = Math.round(500 / dtMyr);

    let maxEDev = 0;
    let maxLzDev = 0;

    for (let i = 0; i < steps; i++) {
      pot.step(s, dtMyr);
      const e = pot.getEnergy(s);
      const lz = pot.getLz(s);

      const de = Math.abs(e - e0) / Math.abs(e0);
      const dlz = Math.abs(lz - lz0) / Math.abs(lz0);
      if (de > maxEDev) maxEDev = de;
      if (dlz > maxLzDev) maxLzDev = dlz;
    }

    console.log(`500 Myr orbit: max Energy drift = ${maxEDev.toExponential(2)}, max Lz drift = ${maxLzDev.toExponential(2)}`);
    expect(maxEDev).toBeLessThan(1e-5);
    expect(maxLzDev).toBeLessThan(1e-12); // Lz is exact in axisymmetric potential
  });

  it('measures azimuthal period (200-250 Myr) and vertical oscillation (60-90 Myr)', () => {
    const pot = new GalacticPotential();
    const s = pot.getInitialSunState();

    const dtMyr = 0.05;
    const totalMyr = 500;
    const steps = Math.round(totalMyr / dtMyr);

    let prevPhi = Math.atan2(s.y, s.x);
    let cumPhi = 0;

    let prevZ = s.z;
    const zCrossings: number[] = [];
    let maxZ = 0;

    for (let i = 0; i < steps; i++) {
      pot.step(s, dtMyr);
      const phi = Math.atan2(s.y, s.x);
      let dPhi = phi - prevPhi;
      while (dPhi > Math.PI) dPhi -= 2 * Math.PI;
      while (dPhi < -Math.PI) dPhi += 2 * Math.PI;
      cumPhi += dPhi;
      prevPhi = phi;

      if ((prevZ > 0 && s.z <= 0) || (prevZ < 0 && s.z >= 0)) {
        zCrossings.push(s.tMyr);
      }
      prevZ = s.z;
      if (Math.abs(s.z) > maxZ) maxZ = Math.abs(s.z);
    }

    // Azimuthal period from cumulative angle
    const totalRevolutions = Math.abs(cumPhi) / (2 * Math.PI);
    const azimuthalPeriod = totalMyr / totalRevolutions;
    console.log(`Sun azimuthal period: ${azimuthalPeriod.toFixed(1)} Myr`);
    expect(azimuthalPeriod).toBeGreaterThan(200);
    expect(azimuthalPeriod).toBeLessThan(250);

    // Vertical crossings (half-periods)
    const halfPeriods: number[] = [];
    for (let i = 1; i < zCrossings.length; i++) {
      halfPeriods.push(zCrossings[i]! - zCrossings[i - 1]!);
    }
    const meanHalfPeriod = halfPeriods.reduce((a, b) => a + b, 0) / halfPeriods.length;
    const verticalPeriod = 2 * meanHalfPeriod;
    const amplitudePc = maxZ * 1000; // kpc -> pc

    console.log(`Sun vertical oscillation period: ${verticalPeriod.toFixed(1)} Myr (half-period: ${meanHalfPeriod.toFixed(1)} Myr), amplitude: ${amplitudePc.toFixed(1)} pc`);
    expect(verticalPeriod).toBeGreaterThan(60);
    expect(verticalPeriod).toBeLessThan(95);
    expect(amplitudePc).toBeGreaterThan(60);
    expect(amplitudePc).toBeLessThan(140);
  });
});
