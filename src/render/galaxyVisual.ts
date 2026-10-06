import * as THREE from 'three';
import type { GalacticOrbitState } from '@/physics/galacticPotential';

export interface GalaxyVisualConfig {
  numStars?: number;
  diskRadiusKpc?: number;
  numHaloStars?: number;
  numGlobularClusters?: number;
}

export class GalaxyVisual {
  readonly group = new THREE.Group();
  private readonly starsPoints: THREE.Points;
  private readonly bulgePoints: THREE.Points;

  // Spherical non-flat components of the Milky Way
  private readonly haloGroup = new THREE.Group();
  private readonly haloPoints: THREE.Points;
  private readonly globularPoints: THREE.Points;
  private readonly dmBoundary: THREE.Group;

  private readonly orbitLine: THREE.Line;
  private readonly orbitGeom: THREE.BufferGeometry;
  private readonly sunMarker: THREE.Group;
  private readonly sgrAMarker: THREE.Group;
  private readonly gridGroup: THREE.Group;
  private readonly eclipticPlane: THREE.Mesh;
  private readonly velArrow: THREE.ArrowHelper;

  private zExaggeration = 1.0;
  private readonly starPositions: Float32Array;
  private readonly baseStarZ: Float32Array;
  private readonly bulgePositions: Float32Array;
  private readonly baseBulgeZ: Float32Array;
  private readonly haloPositions: Float32Array;
  private readonly baseHaloZ: Float32Array;
  private readonly globularPositions: Float32Array;
  private readonly baseGlobularZ: Float32Array;

  constructor(config: GalaxyVisualConfig = {}) {
    const numStars = config.numStars ?? 60_000;
    const diskRadius = config.diskRadiusKpc ?? 18;
    const numHaloStars = config.numHaloStars ?? 8_000;
    const numGlobular = config.numGlobularClusters ?? 158;

    const starTex = this.createStarTexture();

    // 1. Milky Way Spiral Arms Star Distribution (Flat Thin Disc, ~1:100 aspect ratio)
    const starGeom = new THREE.BufferGeometry();
    this.starPositions = new Float32Array(numStars * 3);
    this.baseStarZ = new Float32Array(numStars);
    const starColors = new Float32Array(numStars * 3);

    const arms = 4;
    const armOffset = (2 * Math.PI) / arms;
    const b = 0.22; // pitch angle parameter for r = a * exp(b * theta)

    for (let i = 0; i < numStars; i++) {
      const idx = i * 3;
      // Exponential radial distribution
      const u = Math.random();
      const r = 1.0 + Math.sqrt(u) * (diskRadius - 1.0);

      // Choose arm (or inter-arm)
      const armIdx = Math.floor(Math.random() * arms);
      const isArm = Math.random() < 0.75;
      let theta = Math.log(r / 1.0) / b + armIdx * armOffset;

      if (isArm) {
        // Arm dispersion
        const spread = 0.25 + 0.15 * (r / diskRadius);
        theta += (Math.random() - 0.5) * spread * 2;
      } else {
        // Inter-arm diffuse stars
        theta = Math.random() * 2 * Math.PI;
      }

      // Vertical exponential scale height (~0.3 kpc)
      const zScale = 0.3 * (1 + 0.5 * (r / diskRadius));
      const zSign = Math.random() < 0.5 ? 1 : -1;
      const z = zSign * -Math.log(1 - Math.random() * 0.99) * zScale * 0.5;

      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      this.starPositions[idx] = x;
      this.starPositions[idx + 1] = y;
      this.starPositions[idx + 2] = z;
      this.baseStarZ[i] = z;

      // Color based on location and type
      const color = new THREE.Color();
      if (isArm && Math.random() < 0.25) {
        color.setHSL(0.58 + Math.random() * 0.08, 0.85, 0.75 + Math.random() * 0.2);
      } else if (isArm && Math.random() < 0.08) {
        color.setHSL(0.92 + Math.random() * 0.06, 0.9, 0.7);
      } else {
        const warmth = Math.min(1, 2.5 / (r + 0.5));
        color.setHSL(0.12 - 0.05 * warmth, 0.4 + 0.5 * warmth, 0.65 + Math.random() * 0.3);
      }

      starColors[idx] = color.r;
      starColors[idx + 1] = color.g;
      starColors[idx + 2] = color.b;
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      map: starTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeom, starMat);
    this.group.add(this.starsPoints);

    // 2. Central Galactic Bulge (Thicker spheroidal core)
    const numBulge = 15_000;
    const bulgeGeom = new THREE.BufferGeometry();
    this.bulgePositions = new Float32Array(numBulge * 3);
    this.baseBulgeZ = new Float32Array(numBulge);
    const bulgeColors = new Float32Array(numBulge * 3);

    for (let i = 0; i < numBulge; i++) {
      const idx = i * 3;
      const r = Math.pow(Math.random(), 2.5) * 2.5;
      const phi = Math.random() * 2 * Math.PI;
      const costheta = 2 * Math.random() - 1;
      const sintheta = Math.sqrt(Math.max(0, 1 - costheta * costheta));

      const x = r * sintheta * Math.cos(phi);
      const y = r * sintheta * Math.sin(phi);
      const z = r * costheta * 0.6; // slightly flattened

      this.bulgePositions[idx] = x;
      this.bulgePositions[idx + 1] = y;
      this.bulgePositions[idx + 2] = z;
      this.baseBulgeZ[i] = z;

      const color = new THREE.Color();
      color.setHSL(0.1 + Math.random() * 0.05, 0.8, 0.75 + Math.random() * 0.25);
      bulgeColors[idx] = color.r;
      bulgeColors[idx + 1] = color.g;
      bulgeColors[idx + 2] = color.b;
    }

    bulgeGeom.setAttribute('position', new THREE.BufferAttribute(this.bulgePositions, 3));
    bulgeGeom.setAttribute('color', new THREE.BufferAttribute(bulgeColors, 3));

    const bulgeMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: starTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.bulgePoints = new THREE.Points(bulgeGeom, bulgeMat);
    this.group.add(this.bulgePoints);

    // 3. Spherical Stellar Halo (Population II ancient stars, r ~ 2 to 35 kpc)
    const haloGeom = new THREE.BufferGeometry();
    this.haloPositions = new Float32Array(numHaloStars * 3);
    this.baseHaloZ = new Float32Array(numHaloStars);
    const haloColors = new Float32Array(numHaloStars * 3);

    for (let i = 0; i < numHaloStars; i++) {
      const idx = i * 3;
      // Power law density n(r) ~ r^-3.5
      const u = Math.random();
      const r = 2.0 + Math.pow(u, 0.5) * 32.0; // 2 to 34 kpc
      const phi = Math.random() * 2 * Math.PI;
      const costheta = 2 * Math.random() - 1;
      const sintheta = Math.sqrt(Math.max(0, 1 - costheta * costheta));

      // Mild flattening in inner halo (c/a ~ 0.8)
      const q = 0.8;
      const x = r * sintheta * Math.cos(phi);
      const y = r * sintheta * Math.sin(phi);
      const z = r * costheta * q;

      this.haloPositions[idx] = x;
      this.haloPositions[idx + 1] = y;
      this.haloPositions[idx + 2] = z;
      this.baseHaloZ[i] = z;

      // Faint antique gold / pale blue-white
      const color = new THREE.Color();
      if (Math.random() < 0.6) {
        color.setHSL(0.12, 0.4, 0.55 + Math.random() * 0.2);
      } else {
        color.setHSL(0.55, 0.3, 0.7 + Math.random() * 0.2);
      }
      haloColors[idx] = color.r;
      haloColors[idx + 1] = color.g;
      haloColors[idx + 2] = color.b;
    }

    haloGeom.setAttribute('position', new THREE.BufferAttribute(this.haloPositions, 3));
    haloGeom.setAttribute('color', new THREE.BufferAttribute(haloColors, 3));

    const haloMat = new THREE.PointsMaterial({
      size: 0.10,
      vertexColors: true,
      map: starTex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.haloPoints = new THREE.Points(haloGeom, haloMat);
    this.haloGroup.add(this.haloPoints);

    // 4. Globular Clusters (158 known Harris catalog clusters, spherical distribution)
    const globGeom = new THREE.BufferGeometry();
    this.globularPositions = new Float32Array(numGlobular * 3);
    this.baseGlobularZ = new Float32Array(numGlobular);
    const globColors = new Float32Array(numGlobular * 3);

    for (let i = 0; i < numGlobular; i++) {
      const idx = i * 3;
      // Isotropic spherical distribution with core concentration
      const u = Math.random();
      const r = 1.0 + Math.pow(u, 0.6) * 33.0; // 1 to 34 kpc
      const phi = Math.random() * 2 * Math.PI;
      const costheta = 2 * Math.random() - 1;
      const sintheta = Math.sqrt(Math.max(0, 1 - costheta * costheta));

      const x = r * sintheta * Math.cos(phi);
      const y = r * sintheta * Math.sin(phi);
      const z = r * costheta;

      this.globularPositions[idx] = x;
      this.globularPositions[idx + 1] = y;
      this.globularPositions[idx + 2] = z;
      this.baseGlobularZ[i] = z;

      // Bright incandescent gold
      globColors[idx] = 1.0;
      globColors[idx + 1] = 0.88;
      globColors[idx + 2] = 0.55;
    }

    globGeom.setAttribute('position', new THREE.BufferAttribute(this.globularPositions, 3));
    globGeom.setAttribute('color', new THREE.BufferAttribute(globColors, 3));

    const globMat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      map: starTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.globularPoints = new THREE.Points(globGeom, globMat);
    this.haloGroup.add(this.globularPoints);

    // 5. Dark Matter Halo Virial Boundary Shells (25 kpc & 40 kpc spherical guides)
    this.dmBoundary = this.createDarkMatterGuides();
    this.haloGroup.add(this.dmBoundary);

    this.group.add(this.haloGroup);

    // 6. Central Black Hole: Sagittarius A*
    this.sgrAMarker = new THREE.Group();
    const bhCoreGeom = new THREE.SphereGeometry(0.08, 32, 16);
    const bhCoreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bhCore = new THREE.Mesh(bhCoreGeom, bhCoreMat);
    this.sgrAMarker.add(bhCore);

    // Accretion disk glow around Sgr A*
    const accGeom = new THREE.RingGeometry(0.09, 0.35, 64);
    const accMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const accRing = new THREE.Mesh(accGeom, accMat);
    accRing.rotation.x = Math.PI * 0.15;
    this.sgrAMarker.add(accRing);
    this.group.add(this.sgrAMarker);

    // 7. Sun's Orbit Path (Rosette + Bobbing Trajectory)
    this.orbitGeom = new THREE.BufferGeometry();
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    this.orbitLine = new THREE.Line(this.orbitGeom, orbitMat);
    this.group.add(this.orbitLine);

    // 8. Sun / Solar System Marker
    this.sunMarker = new THREE.Group();

    const sunGeom = new THREE.SphereGeometry(0.12, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.sunMarker.add(sunMesh);

    const glowGeom = new THREE.SphereGeometry(0.24, 32, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.sunMarker.add(new THREE.Mesh(glowGeom, glowMat));

    // Solar System Ecliptic Disc tilted at 60.2° to Galactic Midplane
    const eclipticGeom = new THREE.RingGeometry(0.18, 0.45, 48);
    const eclipticMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    this.eclipticPlane = new THREE.Mesh(eclipticGeom, eclipticMat);
    this.eclipticPlane.rotation.x = THREE.MathUtils.degToRad(60.2);
    this.sunMarker.add(this.eclipticPlane);

    this.velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      0.8,
      0x00ff88,
      0.2,
      0.1,
    );
    this.sunMarker.add(this.velArrow);

    this.group.add(this.sunMarker);

    // 9. Galactic Reference Guides
    this.gridGroup = this.createGalacticGuides();
    this.group.add(this.gridGroup);

    this.group.visible = false;
  }

  private createStarTexture(): THREE.Texture {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(230, 240, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(150, 190, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  private createDarkMatterGuides(): THREE.Group {
    const group = new THREE.Group();
    const radii = [25.0, 40.0]; // kpc
    const segs = 128;
    const mat = new THREE.LineBasicMaterial({
      color: 0x554477,
      transparent: true,
      opacity: 0.25,
    });

    for (const r of radii) {
      // Equator
      const eqPts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * 2 * Math.PI;
        eqPts.push(new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), mat));

      // Meridian XZ
      const m1Pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * 2 * Math.PI;
        m1Pts.push(new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th)));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(m1Pts), mat));

      // Meridian YZ
      const m2Pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * 2 * Math.PI;
        m2Pts.push(new THREE.Vector3(0, r * Math.cos(th), r * Math.sin(th)));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(m2Pts), mat));
    }

    return group;
  }

  private createGalacticGuides(): THREE.Group {
    const group = new THREE.Group();
    const ringRadii = [4.0, 8.2, 12.0, 16.0]; // kpc

    for (const r of ringRadii) {
      const segs = 128;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * 2 * Math.PI;
        pts.push(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), 0));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const isSolarCircle = Math.abs(r - 8.2) < 0.1;
      const mat = new THREE.LineBasicMaterial({
        color: isSolarCircle ? 0xffaa00 : 0x334466,
        transparent: true,
        opacity: isSolarCircle ? 0.45 : 0.2,
      });
      group.add(new THREE.Line(geom, mat));
    }

    // Galactic axis crosshair lines
    const axisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-18, 0, 0),
      new THREE.Vector3(18, 0, 0),
      new THREE.Vector3(0, -18, 0),
      new THREE.Vector3(0, 18, 0),
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: 0x223355,
      transparent: true,
      opacity: 0.2,
    });
    group.add(new THREE.LineSegments(axisGeom, axisMat));

    return group;
  }

  setVerticalExaggeration(factor: number): void {
    if (this.zExaggeration === factor) return;
    this.zExaggeration = factor;

    // Update stars
    const pos = this.starPositions;
    for (let i = 0; i < this.baseStarZ.length; i++) {
      pos[i * 3 + 2] = this.baseStarZ[i]! * factor;
    }
    this.starsPoints.geometry.attributes['position']!.needsUpdate = true;

    // Update bulge
    const bPos = this.bulgePositions;
    for (let i = 0; i < this.baseBulgeZ.length; i++) {
      bPos[i * 3 + 2] = this.baseBulgeZ[i]! * factor;
    }
    this.bulgePoints.geometry.attributes['position']!.needsUpdate = true;

    // Update stellar halo
    const hPos = this.haloPositions;
    for (let i = 0; i < this.baseHaloZ.length; i++) {
      hPos[i * 3 + 2] = this.baseHaloZ[i]! * factor;
    }
    this.haloPoints.geometry.attributes['position']!.needsUpdate = true;

    // Update globular clusters
    const gPos = this.globularPositions;
    for (let i = 0; i < this.baseGlobularZ.length; i++) {
      gPos[i * 3 + 2] = this.baseGlobularZ[i]! * factor;
    }
    this.globularPoints.geometry.attributes['position']!.needsUpdate = true;
  }

  setOrbitPath(pathPoints: Float32Array): void {
    const exaggerated = new Float32Array(pathPoints.length);
    for (let i = 0; i < pathPoints.length; i += 3) {
      exaggerated[i] = pathPoints[i]!;
      exaggerated[i + 1] = pathPoints[i + 1]!;
      exaggerated[i + 2] = pathPoints[i + 2]! * this.zExaggeration;
    }
    this.orbitGeom.setAttribute('position', new THREE.BufferAttribute(exaggerated, 3));
    this.orbitGeom.attributes['position']!.needsUpdate = true;
  }

  update(state: GalacticOrbitState): void {
    const sunZ = state.z * this.zExaggeration;
    this.sunMarker.position.set(state.x, state.y, sunZ);

    const vLen = Math.hypot(state.vx, state.vy, state.vz) || 1;
    const dir = new THREE.Vector3(state.vx / vLen, state.vy / vLen, (state.vz * this.zExaggeration) / vLen);
    this.velArrow.setDirection(dir.normalize());
  }

  getSunPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.sunMarker.position);
  }

  setUnifiedMode(cameraDistAu: number, showHalo = true): void {
    const isClose = cameraDistAu < 600;
    // When close to the Sun, hide the large icon marker so the real 3D Sun is clean
    this.sunMarker.visible = !isClose;
    // The 500 Myr galactic orbit path of the Sun and Sagittarius A* are always visible
    this.orbitLine.visible = true;
    this.sgrAMarker.visible = true;
    this.gridGroup.visible = !isClose;
    this.haloGroup.visible = showHalo;

    const starMat = this.starsPoints.material as THREE.PointsMaterial;
    const bulgeMat = this.bulgePoints.material as THREE.PointsMaterial;
    starMat.size = isClose ? 1.5 : 0.14;
    bulgeMat.size = isClose ? 2.2 : 0.20;
  }

  setSolarMode(isSolar: boolean): void {
    this.setUnifiedMode(isSolar ? 50 : 2000, true);
  }

  setHaloVisible(visible: boolean): void {
    this.haloGroup.visible = visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
