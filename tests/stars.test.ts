import { describe, it, expect } from 'vitest';
import { GALACTIC_AXES_IN_SIM } from '@/frames/galactic';
import { OBLIQUITY_J2000_RAD } from '@/data/galaxy';

describe('Real Star Background & Coordinates (Phase 6.3)', () => {
  it("Polaris direction in the ecliptic frame is near 66.56° from the ecliptic plane", () => {
    // Polaris ICRS: RA = 2h 31m 49s (37.954°), Dec = 89.264°
    const raDeg = 37.954;
    const decDeg = 89.264;
    const rad = Math.PI / 180;
    const a = raDeg * rad;
    const d = decDeg * rad;

    const yIcrs = Math.sin(a) * Math.cos(d);
    const zIcrs = Math.sin(d);

    // ICRS to ecliptic: rotate about X by -obliquity
    const ce = Math.cos(OBLIQUITY_J2000_RAD);
    const se = Math.sin(OBLIQUITY_J2000_RAD);
    const zEcl = -se * yIcrs + ce * zIcrs;

    const angleFromEclipticDeg = (Math.asin(zEcl) * 180) / Math.PI;
    console.log(`Polaris angle from ecliptic plane: ${angleFromEclipticDeg.toFixed(2)}°`);

    // Expected near 66.56° (North celestial pole is 66.56°, Polaris is offset by ~0.74° at Dec 89.26°)
    expect(Math.abs(angleFromEclipticDeg - 66.56)).toBeLessThan(0.6);
  });

  it('Galactic center direction GALACTIC_AXES_IN_SIM[0] matches Sagittarius A* position within 1 degree', () => {
    // Sagittarius A* ICRS: RA = 17h 45m 40.04s (266.4168°), Dec = -29.0078°
    const raDeg = 266.4168;
    const decDeg = -29.0078;
    const rad = Math.PI / 180;
    const a = raDeg * rad;
    const d = decDeg * rad;

    const xIcrs = Math.cos(a) * Math.cos(d);
    const yIcrs = Math.sin(a) * Math.cos(d);
    const zIcrs = Math.sin(d);

    // Ecliptic coordinates
    const ce = Math.cos(OBLIQUITY_J2000_RAD);
    const se = Math.sin(OBLIQUITY_J2000_RAD);
    const sgrAEcl = [
      xIcrs,
      ce * yIcrs + se * zIcrs,
      -se * yIcrs + ce * zIcrs,
    ];

    const gcSim = GALACTIC_AXES_IN_SIM[0];
    const dot = gcSim[0] * sgrAEcl[0]! + gcSim[1] * sgrAEcl[1]! + gcSim[2] * sgrAEcl[2]!;
    const angleDiffDeg = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;

    console.log(`Angle between GALACTIC_AXES_IN_SIM[0] and Sagittarius A*: ${angleDiffDeg.toFixed(3)}°`);
    expect(angleDiffDeg).toBeLessThan(1.0); // within 1 degree
  });
});
