import * as THREE from 'three';
import { AU_KM } from '@/data/constants';
import type { RingDef } from '@/data/rotational';
import { createSaturnRingTexture } from './textures';

export function createPlanetaryRing(ring: RingDef, planetId: string): THREE.Mesh {
  const innerAu = ring.innerRadiusKm / AU_KM;
  const outerAu = ring.outerRadiusKm / AU_KM;

  const geom = new THREE.RingGeometry(innerAu, outerAu, 128);

  // Remap UVs radially: u = (r - inner) / (outer - inner), v = 0.5
  const pos = geom.attributes.position!;
  const uvs = geom.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y);
    const u = Math.min(1, Math.max(0, (r - innerAu) / (outerAu - innerAu)));
    uvs.setXY(i, u, 0.5);
  }
  uvs.needsUpdate = true;

  let mat: THREE.Material;
  if (planetId === 'saturn') {
    const tex = createSaturnRingTexture();
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: ring.opacity,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1,
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: ring.color,
      transparent: true,
      opacity: ring.opacity,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
  }

  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  return mesh;
}
