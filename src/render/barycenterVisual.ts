import * as THREE from 'three';

/**
 * High-precision astronomical visualization of the Solar System Barycenter (SSB).
 * Represents the "empty point" / center of mass around which the Sun and all planets wobble.
 */
export class BarycenterVisual {
  readonly group = new THREE.Group();
  private readonly reticleSprite: THREE.Sprite;
  private readonly labelSprite: THREE.Sprite;
  private readonly tetherLine: THREE.Line;
  private readonly tetherGeom: THREE.BufferGeometry;
  private readonly tetherPositions = new Float32Array(6);

  constructor() {
    this.group.name = 'SolarSystemBarycenter';

    // 1. Concentric astronomical target reticle sprite
    const reticleTex = this.createReticleTexture();
    const reticleMat = new THREE.SpriteMaterial({
      map: reticleTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.reticleSprite = new THREE.Sprite(reticleMat);
    this.group.add(this.reticleSprite);

    // 2. High-contrast floating pill billboard label
    const labelTex = this.createLabelTexture();
    const labelMat = new THREE.SpriteMaterial({
      map: labelTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.labelSprite = new THREE.Sprite(labelMat);
    this.group.add(this.labelSprite);

    // 3. Dynamic displacement tether line connecting Sun center to Barycenter
    this.tetherGeom = new THREE.BufferGeometry();
    this.tetherGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.tetherPositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const tetherMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.0005,
      gapSize: 0.0003,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    });
    this.tetherLine = new THREE.Line(this.tetherGeom, tetherMat);
    this.tetherLine.frustumCulled = false;
    this.group.add(this.tetherLine);
  }

  private createReticleTexture(): THREE.CanvasTexture {
    if (typeof document === 'undefined') {
      return new THREE.CanvasTexture({} as HTMLCanvasElement);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const cx = 64, cy = 64;

    // Glowing outer halo
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 60);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    glow.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    // Outer target ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Inner target ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Center focal dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Crosshairs
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Horizontal
    ctx.moveTo(12, cy); ctx.lineTo(32, cy);
    ctx.moveTo(96, cy); ctx.lineTo(116, cy);
    // Vertical
    ctx.moveTo(cx, 12); ctx.lineTo(cx, 32);
    ctx.moveTo(cx, 96); ctx.lineTo(cx, 116);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private createLabelTexture(): THREE.CanvasTexture {
    if (typeof document === 'undefined') {
      return new THREE.CanvasTexture({} as HTMLCanvasElement);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const pillW = 290, pillH = 34;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = (canvas.height - pillH) / 2;
    const r = pillH / 2;

    // Dark pill container
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, r);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fillStyle = 'rgba(12, 20, 36, 0.92)';
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Indicator dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(pillX + 16, canvas.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Text label
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Barycenter (SSB) [Empty Point]', pillX + 28, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Update barycenter position, screen-constant sizing, and tether line to Sun.
   */
  update(
    baryPos: THREE.Vector3,
    sunPos: THREE.Vector3,
    camera: THREE.Camera,
    viewportHeightPx: number,
    visible = true,
  ): void {
    if (!visible) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // Place barycenter group at its current position
    this.reticleSprite.position.copy(baryPos);

    // Compute pixel scale to maintain constant, crisp screen size
    const camDist = camera.position.distanceTo(baryPos);
    const fov = (camera as THREE.PerspectiveCamera).fov || 50;
    const frustumH = 2 * camDist * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const auPerPx = frustumH / Math.max(1, viewportHeightPx);

    // Reticle size: 36px on screen
    const reticleAu = 36 * auPerPx;
    this.reticleSprite.scale.set(reticleAu, reticleAu, 1);

    // Label size: 24px height, 120px width (ratio 5:1)
    const labelHAu = 24 * auPerPx;
    const labelWAu = labelHAu * 5;
    this.labelSprite.position.set(baryPos.x, baryPos.y, baryPos.z);
    this.labelSprite.scale.set(labelWAu, labelHAu, 1);
    this.labelSprite.center.set(0.5, 0.5 - (18 + 14) / 24); // Offset above the reticle

    // Update displacement tether between Sun center and Barycenter
    const posAttr = this.tetherGeom.attributes['position'] as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr[0] = sunPos.x;
    arr[1] = sunPos.y;
    arr[2] = sunPos.z;
    arr[3] = baryPos.x;
    arr[4] = baryPos.y;
    arr[5] = baryPos.z;
    posAttr.needsUpdate = true;
    (this.tetherLine as THREE.Line & { computeLineDistances?(): void }).computeLineDistances?.();
  }
}
