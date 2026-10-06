import * as THREE from 'three';

const STAR_COLORS = [
  0x9bb0ff, // O/B blue
  0xcad7ff, // A white
  0xf8f9ff, // F yellow-white
  0xfff4e8, // G yellow (solar)
  0xffd2a1, // K orange
  0xff8866, // M red dwarf
];

/**
 * Creates an astronomical celestial sphere starfield with realistic stellar spectral distributions.
 */
export function createStarfield(count = 8000, radius = 50000): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const col = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Uniform sphere distribution
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = radius * (0.9 + 0.2 * Math.random());

    positions[3 * i] = r * Math.sin(phi) * Math.cos(theta);
    positions[3 * i + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[3 * i + 2] = r * Math.cos(phi);

    // Random spectral class
    const hex = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]!;
    col.setHex(hex);
    // Dimmer / brighter magnitudes
    const intensity = Math.random() < 0.05 ? 1.0 : Math.random() * 0.7 + 0.3;
    colors[3 * i] = col.r * intensity;
    colors[3 * i + 1] = col.g * intensity;
    colors[3 * i + 2] = col.b * intensity;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });

  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  return points;
}
