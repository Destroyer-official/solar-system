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
  isMoon?: boolean;
  parentId?: string;
}

function createTextSprite(text: string, color: string, isMoon: boolean): THREE.Sprite {
  if (typeof document === 'undefined') {
    return new THREE.Sprite(new THREE.SpriteMaterial());
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite(new THREE.SpriteMaterial());

  const fontSize = isMoon ? 19 : 23;
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  const padX = isMoon ? 12 : 14;
  const pillHeight = isMoon ? 28 : 32;
  const pillWidth = Math.min(240, Math.max(50, textWidth + padX * 2 + 14));
  const pillX = (canvas.width - pillWidth) / 2;
  const pillY = (canvas.height - pillHeight) / 2;
  const radius = pillHeight / 2;

  // Background rounded rectangle
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
  } else {
    ctx.rect(pillX, pillY, pillWidth, pillHeight);
  }
  ctx.fillStyle = isMoon ? 'rgba(15, 23, 42, 0.85)' : 'rgba(8, 12, 24, 0.9)';
  ctx.fill();

  // Subtle accent border
  ctx.strokeStyle = color;
  ctx.lineWidth = isMoon ? 1.5 : 2;
  ctx.stroke();

  // Tiny color indicator circle before text
  const dotR = isMoon ? 3 : 3.5;
  const dotX = pillX + padX;
  const dotY = canvas.height / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, dotX + dotR + 6, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  return new THREE.Sprite(mat);
}

export class BodyVisual {
  readonly id: string;
  readonly name: string;
  readonly radiusKm: number;
  readonly radiusAu: number;
  readonly flattening: number;
  readonly physical?: PhysicalJson;
  readonly isMoon: boolean;
  readonly parentId?: string;

  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly ringMesh?: THREE.Mesh;
  readonly labelSprite: THREE.Sprite;

  constructor(opts: BodyVisualOptions) {
    this.id = opts.id;
    this.name = opts.name;
    this.radiusKm = opts.radiusKm;
    this.radiusAu = opts.radiusKm / AU_KM;
    this.physical = opts.physical;
    this.flattening = opts.physical?.flattening ?? 0;
    this.isMoon = !!opts.isMoon;
    this.parentId = opts.parentId;

    this.group = new THREE.Group();

    // Geometry: poles along +z, prime meridian along +x (Sun 128x64 to avoid faceting when zoomed)
    const segW = opts.id === 'sun' ? 128 : 64;
    const segH = opts.id === 'sun' ? 64 : 32;
    const geom = new THREE.SphereGeometry(1, segW, segH).rotateX(Math.PI / 2);

    let mat: THREE.Material;
    const texGetter = typeof document !== 'undefined' ? PLANET_TEXTURE_GETTERS[opts.id] : undefined;
    const tex = texGetter ? texGetter() : undefined;
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }

    if (opts.id === 'sun') {
      const sunOpts: THREE.MeshBasicMaterialParameters = {
        color: 0xffffff,
      };
      if (tex) sunOpts.map = tex;
      mat = new THREE.MeshBasicMaterial(sunOpts);
    } else {
      const stdOpts: THREE.MeshStandardMaterialParameters = {
        color: tex ? 0xffffff : opts.color,
        roughness: 0.7,
        metalness: 0.05,
      };
      if (tex) stdOpts.map = tex;
      mat = new THREE.MeshStandardMaterial(stdOpts);
    }

    this.mesh = new THREE.Mesh(geom, mat);
    // Oblateness along the pole (+z)
    this.mesh.scale.z = 1 - this.flattening;
    this.group.add(this.mesh);

    // Atmospheric coronal outer glow - scales strictly with the Sun's mesh disc
    if (opts.id === 'sun') {
      const glowGeom = new THREE.SphereGeometry(1.2, 32, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      this.mesh.add(glow);
    }

    // Floating text label sprite
    this.labelSprite = createTextSprite(this.name, opts.color, this.isMoon);
    this.group.add(this.labelSprite);

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
        this.ringMesh = createPlanetaryRing(ringDef, opts.id, opts.radiusKm);
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

  /**
   * Update the 3D floating billboard label.
   * Keeps the label at a fixed, crisp screen pixel height and offsets it above the sphere disc.
   */
  updateLabel(
    cameraDistAu: number,
    visible: boolean,
    visualRadiusAu: number,
    fovDeg: number,
    viewportHeightPx: number,
  ): void {
    if (!this.labelSprite) return;
    if (!visible) {
      this.labelSprite.visible = false;
      return;
    }

    this.labelSprite.visible = true;

    // Height of frustum in AU at this camera distance
    const frustumHeightAu = 2 * cameraDistAu * Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
    const auPerPixel = frustumHeightAu / Math.max(1, viewportHeightPx);

    // Target label height in screen pixels
    const targetHeightPx = this.isMoon ? 18 : 22;
    const spriteHeightAu = targetHeightPx * auPerPixel;
    // Canvas is 256x64 (aspect ratio 4:1)
    const spriteWidthAu = spriteHeightAu * 4;

    this.labelSprite.scale.set(spriteWidthAu, spriteHeightAu, 1);

    // Planet/moon apparent screen radius in pixels
    const radiusPx = visualRadiusAu / auPerPixel;

    // Offset in screen pixels: radiusPx + margin (8px) + half sprite height
    const offsetPx = radiusPx + 8 + targetHeightPx / 2;
    // Center Y anchor: normalized relative to sprite height:
    // When center.y is negative, sprite shifts UP in camera view space
    this.labelSprite.center.set(0.5, 0.5 - offsetPx / targetHeightPx);
  }
}

