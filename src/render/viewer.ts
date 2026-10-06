import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AU_KM } from '@/data/constants';
import { ROTATIONAL_DATA } from '@/data/rotational';
import type { ReferenceFrame } from '@/frames/types';
import { mapPoint } from '@/frames/transform';
import type { SystemState } from '@/physics/types';
import type { History } from '@/sim/history';
import type { SystemModel } from '@/sim/registry';
import { buildTracks } from '@/sim/track';
import { createPlanetaryRing } from './rings';
import { createStarfield } from './starfield';
import { PLANET_TEXTURE_GETTERS } from './textures';
import { Trail } from './trail';

const MIN_PIXEL_RADIUS = 4;

export interface ViewState {
  frame: ReferenceFrame;
  focus: number; // body index, -1 = barycenter
  trails: boolean;
  trailDays: number;
  history: History;
}

interface BodyVisual {
  container: THREE.Group;
  tiltGroup: THREE.Group;
  mesh: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  periodDays: number;
  radiusAu: number;
}

export function createViewer(container: HTMLElement, model: SystemModel, trailCapacity: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e5);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1e-6;
  controls.maxDistance = 2000;

  // 1. Starfield background
  scene.add(createStarfield(9000, 30000));

  // 2. Lighting
  const ambientLight = new THREE.AmbientLight(0x223344, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffffff, 2.5, 0, 0);
  scene.add(sunLight);

  // 3. Body geometry, materials, textures, axial tilts, and rings
  const sphereGeom = new THREE.SphereGeometry(1, 48, 32);

  const visuals: BodyVisual[] = model.ids.map((id, i) => {
    const rot = ROTATIONAL_DATA[id] ?? {
      id,
      name: model.names[i]!,
      periodDays: 1,
      tiltDeg: 0,
      poleVector: [0, 0, 1],
    };

    const container = new THREE.Group();
    const tiltGroup = new THREE.Group();
    container.add(tiltGroup);

    // Orient tiltGroup to point along the true IAU rotation pole vector
    const poleVec = new THREE.Vector3(...rot.poleVector).normalize();
    tiltGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), poleVec);

    let mat: THREE.Material;
    const texGetter = PLANET_TEXTURE_GETTERS[id];
    const tex = texGetter ? texGetter() : undefined;

    if (id === 'sun') {
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xffffff,
      });

      // Sun volumetric atmospheric glow
      const glowGeom = new THREE.SphereGeometry(1.25, 32, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      container.add(glow);
    } else {
      mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: tex ? 0xffffff : model.colors[i]!,
        roughness: 0.7,
        metalness: 0.08,
      });
    }

    const mesh = new THREE.Mesh(sphereGeom, mat);
    tiltGroup.add(mesh);

    let ringMesh: THREE.Mesh | undefined;
    if (rot.rings) {
      ringMesh = createPlanetaryRing(rot.rings, id);
      tiltGroup.add(ringMesh);
    }

    scene.add(container);

    return {
      container,
      tiltGroup,
      mesh,
      ringMesh,
      periodDays: rot.periodDays,
      radiusAu: model.radiusKm[i]! / AU_KM,
    };
  });

  const trails = model.ids.map((_, i) => {
    const t = new Trail(trailCapacity + 1, model.colors[i]!);
    scene.add(t.line);
    return t;
  });
  const trailData = trails.map((t) => t.data);

  // Barycenter marker (fixed-size point)
  const baryAttr = new THREE.BufferAttribute(new Float32Array(3), 3);
  baryAttr.setUsage(THREE.DynamicDrawUsage);
  const baryGeom = new THREE.BufferGeometry();
  baryGeom.setAttribute('position', baryAttr);
  const bary = new THREE.Points(
    baryGeom,
    new THREE.PointsMaterial({ color: 0xffffff, size: 8, sizeAttenuation: false }),
  );
  bary.frustumCulled = false;
  scene.add(bary);

  /** Camera position is relative to the focus (the scene origin is always the focus). */
  function setView(dir: readonly [number, number, number], distanceAu: number): void {
    camera.position.set(dir[0], dir[1], dir[2]).setLength(distanceAu);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  setView([0, -0.8, 0.6], 35);

  let height = 1;
  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight;
    height = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const o = [0, 0, 0],
    p = [0, 0, 0],
    f = [0, 0, 0];

  function render(s: SystemState, v: ViewState): void {
    const ax = v.frame.axes;
    v.frame.origin(s.t, s.gm, s.pos, 0, o);

    // Floating origin = the focus in frame coordinates (float64)
    if (v.focus >= 0) {
      mapPoint(ax, o, s.pos[3 * v.focus]!, s.pos[3 * v.focus + 1]!, s.pos[3 * v.focus + 2]!, f);
    } else {
      mapPoint(ax, o, 0, 0, 0, f);
    }

    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * MIN_PIXEL_RADIUS) / height;

    for (let i = 0; i < s.n; i++) {
      mapPoint(ax, o, s.pos[3 * i]!, s.pos[3 * i + 1]!, s.pos[3 * i + 2]!, p);
      const vis = visuals[i]!;

      // Position relative to floating origin
      vis.container.position.set(p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!);

      // If this body is the Sun, place the point light right at its position
      if (i === 0) {
        sunLight.position.copy(vis.container.position);
      }

      // Apparent visual radius calculation
      const dist = camera.position.distanceTo(vis.container.position);
      const visualRadius = Math.max(vis.radiusAu, dist * k);
      const scaleMultiplier = visualRadius / vis.radiusAu;

      // Scale the planet sphere & rings
      vis.mesh.scale.setScalar(visualRadius);
      if (vis.ringMesh) {
        vis.ringMesh.scale.setScalar(scaleMultiplier);
      }

      // Planetary sidereal rotation about its local tilted pole axis
      if (vis.periodDays !== 0) {
        const spinAngle = (2 * Math.PI * s.t) / vis.periodDays;
        vis.mesh.rotation.z = spinAngle;
      }
    }

    mapPoint(ax, o, 0, 0, 0, p); // barycenter marker
    baryAttr.setXYZ(0, p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!);
    baryAttr.needsUpdate = true;

    for (const t of trails) t.line.visible = v.trails;
    if (v.trails) {
      const count = buildTracks(v.history, s, v.frame, v.focus, v.trailDays, trailData);
      for (const t of trails) t.commit(count);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  return { render, setView };
}
