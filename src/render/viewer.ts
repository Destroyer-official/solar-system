import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AU_KM } from '@/data/constants';
import type { ReferenceFrame } from '@/frames/types';
import { mapPoint } from '@/frames/transform';
import type { SystemState } from '@/physics/types';
import type { History } from '@/sim/history';
import type { SystemModel } from '@/sim/registry';
import { buildTracks } from '@/sim/track';
import { Trail } from './trail';

export type CameraPreset = 'system' | 'barycenter';
const PRESET_POS: Record<CameraPreset, readonly [number, number, number]> = {
  system: [0, -14, 8],
  barycenter: [0, -0.025, 0.012],
};
const MIN_PIXEL_RADIUS = 4;

export interface ViewState {
  frame: ReferenceFrame;
  focus: number; // body index, -1 = barycenter
  trails: boolean;
  trailDays: number;
  history: History;
}

export function createViewer(container: HTMLElement, model: SystemModel, trailCapacity: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e5);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1e-4;
  controls.maxDistance = 2000;

  const sphere = new THREE.SphereGeometry(1, 32, 16);
  const meshes = model.ids.map((_, i) => {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: model.colors[i]! }));
    scene.add(m);
    return m;
  });
  const trails = model.ids.map((_, i) => {
    const t = new Trail(trailCapacity + 1, model.colors[i]!);
    scene.add(t.line);
    return t;
  });
  const trailData = trails.map((t) => t.data);

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
  const setPreset = (p: CameraPreset) => {
    const v = PRESET_POS[p];
    setView(v, Math.hypot(v[0], v[1], v[2]));
  };
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

  const o = [0, 0, 0],
    p = [0, 0, 0],
    f = [0, 0, 0];

  function render(s: SystemState, v: ViewState): void {
    const ax = v.frame.axes;
    v.frame.origin(s.t, s.gm, s.pos, 0, o);

    // Floating origin = the focus, in frame coordinates (float64). Everything sent to the GPU is relative to it.
    if (v.focus >= 0) {
      mapPoint(ax, o, s.pos[3 * v.focus]!, s.pos[3 * v.focus + 1]!, s.pos[3 * v.focus + 2]!, f);
    } else {
      mapPoint(ax, o, 0, 0, 0, f);
    }

    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * MIN_PIXEL_RADIUS) / height;
    for (let i = 0; i < s.n; i++) {
      mapPoint(ax, o, s.pos[3 * i]!, s.pos[3 * i + 1]!, s.pos[3 * i + 2]!, p);
      const mesh = meshes[i]!;
      mesh.position.set(p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!);
      const dist = camera.position.distanceTo(mesh.position);
      mesh.scale.setScalar(Math.max(model.radiusKm[i]! / AU_KM, dist * k));
    }

    mapPoint(ax, o, 0, 0, 0, p); // barycenter = simulation origin, seen through the frame
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

  return { render, setPreset, setView };
}
