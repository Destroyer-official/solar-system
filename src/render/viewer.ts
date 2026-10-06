import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JD_J2000 } from '@/data/constants';
import type { ReferenceFrame } from '@/frames/types';
import { mapPoint } from '@/frames/transform';
import type { SystemState } from '@/physics/types';
import type { History } from '@/sim/history';
import type { SystemModel } from '@/sim/registry';
import { buildTracks } from '@/sim/track';
import { BodyVisual, type ScaleMode } from './bodyVisual';
import { createStarfield } from './starfield';
import { Trail } from './trail';

const MIN_PIXEL_RADIUS = 4;

export interface ViewState {
  frame: ReferenceFrame;
  focus: number; // body index, -1 = barycenter
  trails: boolean;
  trailDays: number;
  history: History;
  scaleMode?: ScaleMode;
  scaleExaggeration?: number;
  selected?: string | null;
}

export interface ViewerOptions {
  onSelect?(id: string | null): void;
}

export function createViewer(
  container: HTMLElement,
  model: SystemModel,
  trailCapacity: number,
  options?: ViewerOptions,
) {
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

  // 2. Lighting: sun pointlight + small ambient (0.02) for realistic dark night sides
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 0); // decay 0
  scene.add(sunLight);

  // 3. Body visuals
  const visuals: BodyVisual[] = model.ids.map((id, i) => {
    const vis = new BodyVisual({
      id,
      name: model.names[i]!,
      radiusKm: model.radiusKm[i]!,
      color: model.colors[i]!,
      physical: model.physicalMap[id],
    });
    scene.add(vis.group);
    return vis;
  });

  // 4. Raycasting on click for selection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = visuals.map((v) => v.mesh);
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const hitMesh = hits[0]!.object;
      const hitVis = visuals.find((v) => v.mesh === hitMesh);
      if (hitVis) {
        options?.onSelect?.(hitVis.id);
        return;
      }
    }
  });

  const trails = model.ids.map((_, i) => {
    const t = new Trail(trailCapacity + 1, model.colors[i]!);
    scene.add(t.line);
    return t;
  });
  const trailData = trails.map((t) => t.data);

  // Barycenter marker
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

    if (v.focus >= 0) {
      mapPoint(ax, o, s.pos[3 * v.focus]!, s.pos[3 * v.focus + 1]!, s.pos[3 * v.focus + 2]!, f);
    } else {
      mapPoint(ax, o, 0, 0, 0, f);
    }

    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * MIN_PIXEL_RADIUS) / height;
    const daysSinceJ2000 = model.epochJd - JD_J2000 + s.t;
    const scaleMode = v.scaleMode ?? 'pixels';
    const scaleExag = v.scaleExaggeration ?? 20;

    for (let i = 0; i < s.n; i++) {
      mapPoint(ax, o, s.pos[3 * i]!, s.pos[3 * i + 1]!, s.pos[3 * i + 2]!, p);
      const vis = visuals[i]!;

      vis.group.position.set(p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!);

      if (i === 0) {
        sunLight.position.copy(vis.group.position);
      }

      // Orientation computed analytically on main thread each frame from s.t
      vis.updateOrientation(daysSinceJ2000, ax ?? undefined);

      // Apparent visual radius calculation
      const dist = camera.position.distanceTo(vis.group.position);
      const visualRadius = vis.computeScale(scaleMode, dist, k, scaleExag);

      // Apply scale: radius along x and y, oblate radius along z
      vis.mesh.scale.set(visualRadius, visualRadius, visualRadius * (1 - vis.flattening));
      if (vis.ringMesh) {
        const ringScale = visualRadius / vis.radiusAu;
        vis.ringMesh.scale.setScalar(ringScale);
      }
    }

    mapPoint(ax, o, 0, 0, 0, p);
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
