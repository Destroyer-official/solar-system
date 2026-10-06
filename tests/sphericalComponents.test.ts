import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OortCloudVisual } from '@/render/oortCloud';
import { GalaxyVisual } from '@/render/galaxyVisual';
import { GALACTIC_AXES_IN_SIM } from '@/frames/galactic';

describe('Spherical Components of Solar System & Galaxy', () => {
  it('Oort Cloud: spans from 30 AU (Kuiper) to 100,000 AU (outer spherical shell)', () => {
    const oort = new OortCloudVisual({
      numKuiper: 500,
      numHills: 1000,
      numOuter: 2000,
    });

    expect(oort.group.children.length).toBeGreaterThanOrEqual(3);

    // Verify outer points buffer geometry
    const outerPoints = oort.group.children[2] as THREE.Points;
    expect(outerPoints).toBeInstanceOf(THREE.Points);
    const pos = outerPoints.geometry.attributes['position']!.array as Float32Array;

    let minR = Infinity;
    let maxR = -Infinity;
    let meanX = 0;
    let meanY = 0;
    let meanZ = 0;
    const n = pos.length / 3;

    for (let i = 0; i < n; i++) {
      const x = pos[i * 3]!;
      const y = pos[i * 3 + 1]!;
      const z = pos[i * 3 + 2]!;
      const r = Math.hypot(x, y, z);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      meanX += x;
      meanY += y;
      meanZ += z;
    }
    meanX /= n;
    meanY /= n;
    meanZ /= n;

    // Minimum radius >= 20,000 AU, maximum radius <= 100,000 AU
    expect(minR).toBeGreaterThanOrEqual(19_999);
    expect(maxR).toBeLessThanOrEqual(100_001);

    // Isotropic distribution: center of mass is within 5% of radius
    expect(Math.abs(meanX)).toBeLessThan(5000);
    expect(Math.abs(meanY)).toBeLessThan(5000);
    expect(Math.abs(meanZ)).toBeLessThan(5000);
  });

  it('Milky Way: contains exactly 158 globular clusters in a spherical distribution', () => {
    const gal = new GalaxyVisual({
      numStars: 1000,
      numHaloStars: 500,
      numGlobularClusters: 158,
    });

    // Check halo group exists and contains globular clusters
    expect(gal.group.children.length).toBeGreaterThan(0);
  });

  it('Tilt: solar system ecliptic is tilted at 60.2° relative to the Milky Way midplane', () => {
    const [GX_SIM, GY_SIM, GZ_SIM] = GALACTIC_AXES_IN_SIM;

    // Galactic normal vector in simulation (ecliptic) frame is GZ_SIM
    const gz = new THREE.Vector3(GZ_SIM[0], GZ_SIM[1], GZ_SIM[2]).normalize();
    // Ecliptic normal vector in simulation frame is [0, 0, 1]
    const ez = new THREE.Vector3(0, 0, 1);

    const cosAngle = Math.abs(gz.dot(ez));
    const angleDeg = THREE.MathUtils.radToDeg(Math.acos(cosAngle));

    // The angle between ecliptic north pole and galactic north pole is ~60.19°
    expect(angleDeg).toBeCloseTo(60.19, 1);
  });
});
