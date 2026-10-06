import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AU_KM } from '@/data/constants';
import type { SystemState } from '@/physics/types';
import type { SystemModel } from '@/sim/registry';
import { Trail } from './trail';

export type CameraPreset = 'system' | 'barycenter';

const PRESET_POS: Record<CameraPreset, readonly [number, number, number]> = {
  system: [0, -14, 8], // AU: sees Jupiter's whole orbit
  barycenter: [0, -0.025, 0.012], // AU: Sun's true-size disk fills the view
};
const MIN_PIXEL_RADIUS = 4;
const TRAIL_CAPACITY = 4000;
const TRAIL_INTERVAL_DAYS = 5;

export function createViewer(container: HTMLElement, model: SystemModel) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e4);
  camera.up.set(0, 0, 1); // physics is z-up (ICRF/ecliptic style)

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1e-4;
  controls.maxDistance = 200;

  const sphere = new THREE.SphereGeometry(1, 32, 16);
  const meshes = model.ids.map((_, i) => {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: model.colors[i]! }));
    scene.add(m);
    return m;
  });
  const trails = model.ids.map((_, i) => {
    const t = new Trail(TRAIL_CAPACITY, model.colors[i]!, TRAIL_INTERVAL_DAYS);
    scene.add(t.line);
    return t;
  });

  // Barycenter marker (fixed-size point)
  const baryGeom = new THREE.BufferGeometry();
  baryGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const bary = new THREE.Points(
    baryGeom,
    new THREE.PointsMaterial({ color: 0xffffff, size: 8, sizeAttenuation: false }),
  );
  bary.frustumCulled = false;
  scene.add(bary);

  const origin = [0, 0, 0]; // floating origin (float64). Phase 1: fixed at the barycenter.

  function setPreset(p: CameraPreset): void {
    camera.position.set(...PRESET_POS[p]);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  setPreset('system');

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

  function render(s: SystemState, showTrails: boolean): void {
    const k = ((2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * MIN_PIXEL_RADIUS) / height) as number;
    for (let i = 0; i < s.n; i++) {
      const x = s.pos[3 * i]!,
        y = s.pos[3 * i + 1]!,
        z = s.pos[3 * i + 2]!;
      const mesh = meshes[i]!;
      mesh.position.set(x - origin[0]!, y - origin[1]!, z - origin[2]!);
      // True radius, but never smaller than MIN_PIXEL_RADIUS on screen.
      const dist = camera.position.distanceTo(mesh.position);
      mesh.scale.setScalar(Math.max(model.radiusKm[i]! / AU_KM, dist * k));

      const tr = trails[i]!;
      tr.line.visible = showTrails;
      if (showTrails) {
        tr.sample(s.t, x, y, z);
        tr.update(origin, [x, y, z]);
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    render,
    setPreset,
    clearTrails: () => trails.forEach((t) => t.clear()),
  };
}
