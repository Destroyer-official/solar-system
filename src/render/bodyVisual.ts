import * as THREE from 'three';
import { AU_KM } from '@/data/constants';
import type { PhysicalJson } from '@/data/schema';
import { bodyToEcliptic } from '@/physics/orientation';
import { PLANET_TEXTURE_GETTERS } from './textures';
import { createPlanetaryRing } from './rings';

export type ScaleMode = 'true' | 'pixels' | 'exaggerated';

export interface BodyVisualOptions {
  id: string;
  name: string;
  radiusKm: number;
  color: string;
  physical?: PhysicalJson;
}

export class BodyVisual {
  readonly id: string;
  readonly name: string;
  readonly radiusKm: number;
  readonly radiusAu: number;
  readonly flattening: number;
  readonly physical?: PhysicalJson;

  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly ringMesh?: THREE.Mesh;

  constructor(opts: BodyVisualOptions) {
    this.id = opts.id;
    this.name = opts.name;
    this.radiusKm = opts.radiusKm;
    this.radiusAu = opts.radiusKm / AU_KM;
    this.physical = opts.physical;
    this.flattening = opts.physical?.flattening ?? 0;

    this.group = new THREE.Group();

    // Geometry: poles along +z, prime meridian along +x
    const geom = new THREE.SphereGeometry(1, 64, 32).rotateX(Math.PI / 2);

    let mat: THREE.Material;
    const texGetter = typeof document !== 'undefined' ? PLANET_TEXTURE_GETTERS[opts.id] : undefined;
    const tex = texGetter ? texGetter() : undefined;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }

    if (opts.id === 'sun') {
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xffffff,
      });

      // Atmospheric outer glow
      const glowGeom = new THREE.SphereGeometry(1.2, 32, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      this.group.add(glow);
    } else {
      mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: tex ? 0xffffff : opts.color,
        roughness: 0.7,
        metalness: 0.05,
      });
    }

    this.mesh = new THREE.Mesh(geom, mat);
    // Oblateness along the pole (+z)
    this.mesh.scale.z = 1 - this.flattening;
    this.group.add(this.mesh);

    // Planetary ring (Saturn, etc.)
    if (opts.physical?.ring) {
      const { innerKm, outerKm } = opts.physical.ring;
      const g = new THREE.RingGeometry(innerKm / opts.radiusKm, outerKm / opts.radiusKm, 192);
      const posAttr = g.attributes.position!;
      const uvAttr = g.attributes.uv!;
      const v = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr as THREE.BufferAttribute, i);
        uvAttr.setXY(
          i,
          (v.length() - innerKm / opts.radiusKm) / ((outerKm - innerKm) / opts.radiusKm),
          0.5,
        );
      }
      uvAttr.needsUpdate = true;
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xd4c49c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        roughness: 0.8,
      });
      this.ringMesh = new THREE.Mesh(g, ringMat);
      this.group.add(this.ringMesh);
    } else if (opts.id === 'saturn' || opts.id === 'uranus' || opts.id === 'neptune') {
      // Fallback to existing procedural ring
      const ringDef = {
        saturn: { innerRadiusKm: 74500, outerRadiusKm: 140220, color: '#d4c49c', opacity: 0.85 },
        uranus: { innerRadiusKm: 38000, outerRadiusKm: 51149, color: '#98c5ce', opacity: 0.35 },
        neptune: { innerRadiusKm: 41900, outerRadiusKm: 62933, color: '#658ed1', opacity: 0.25 },
      }[opts.id];
      if (ringDef) {
        this.ringMesh = createPlanetaryRing(ringDef, opts.id);
        this.group.add(this.ringMesh);
      }
    }
  }

  /**
   * Update orientation and apparent visual scale.
   * Orientation is computed on the main thread per frame from display.t.
   */
  updateOrientation(
    daysSinceJ2000: number,
    frameAxes?: readonly [number, number, number, number, number, number, number, number, number],
  ): void {
    const rot = this.physical?.rotation;
    if (!rot) return;

    let m = bodyToEcliptic(rot, daysSinceJ2000);

    // If active reference frame has an orientation matrix, compose: axes * M
    if (frameAxes) {
      const res = new Array(9).fill(0) as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) sum += frameAxes[3 * i + k]! * m[3 * k + j]!;
          res[3 * i + j] = sum;
        }
      }
      m = res;
    }

    const mat4 = new THREE.Matrix4().set(
      m[0]!,
      m[1]!,
      m[2]!,
      0,
      m[3]!,
      m[4]!,
      m[5]!,
      0,
      m[6]!,
      m[7]!,
      m[8]!,
      0,
      0,
      0,
      0,
      1,
    );
    this.group.quaternion.setFromRotationMatrix(mat4);
  }

  computeScale(
    scaleMode: ScaleMode,
    cameraDistAu: number,
    pixelFactor: number,
    exaggerationFactor = 20,
  ): number {
    if (scaleMode === 'true') {
      return this.radiusAu;
    }
    if (scaleMode === 'exaggerated') {
      return this.radiusAu * Math.max(1, exaggerationFactor);
    }
    // 'pixels' mode: clamp to min pixel radius
    const minRadiusAu = cameraDistAu * pixelFactor;
    return Math.max(this.radiusAu, minRadiusAu);
  }
}
