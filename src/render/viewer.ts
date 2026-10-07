import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JD_J2000 } from '@/data/constants';
import type { ReferenceFrame } from '@/frames/types';
import { mapPoint, squash } from '@/frames/transform';
import { GALACTIC_AXES_IN_SIM } from '@/frames/galactic';
import type { SystemState } from '@/physics/types';
import type { History } from '@/sim/history';
import type { SystemModel } from '@/sim/registry';
import { buildTracks } from '@/sim/track';
import { BodyVisual, type ScaleMode } from './bodyVisual';
import { createStarfield } from './starfield';
import { Trail } from './trail';
import { GalaxyVisual } from './galaxyVisual';
import { OortCloudVisual } from './oortCloud';
import { BarycenterVisual } from './barycenterVisual';
import type { GalacticOrbitState } from '@/physics/galacticPotential';

const MIN_PIXEL_RADIUS = 4;

export interface ViewState {
  mode?: 'solar' | 'galaxy';
  presetCategory?: 'galaxy' | 'solar' | 'moons' | 'visits' | 'moonVisits';
  showMilkyWay?: boolean;
  showOortCloud?: boolean;
  showGalacticHalo?: boolean;
  showLabels?: boolean;
  galaxyState?: GalacticOrbitState;
  galaxyCamera?: string;
  galaxyZExag?: number;
  frame: ReferenceFrame;
  focus: number; // body index, -1 = barycenter
  trails: boolean;
  trailDays: number;
  history: History;
  compress?: number;
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
  const getWidth = () => container.clientWidth || window.innerWidth || 800;
  const getHeight = () => container.clientHeight || window.innerHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(getWidth(), getHeight());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Near 1e-6 AU to Far 5e6 AU for seamless zooming from planetary radii out to 100,000 AU Oort cloud
  const camera = new THREE.PerspectiveCamera(50, getWidth() / getHeight(), 1e-6, 5e6);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1e-6;
  controls.maxDistance = 500_000;

  function onResize() {
    const w = getWidth();
    const h = getHeight();
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  }
  window.addEventListener('resize', onResize);

  // 1. Photorealistic celestial sphere starfield & Milky Way band
  scene.add(createStarfield(45000));

  // 2. Lighting: sun pointlight + small ambient (0.02) for realistic dark night sides
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 0); // decay 0
  scene.add(sunLight);

  // 3. Body visuals
  const visualById = new Map<string, BodyVisual>();
  const visuals: BodyVisual[] = model.ids.map((id, i) => {
    const bodyDef = model.bodies?.find((b) => b.id === id);
    const parentId = (bodyDef as { parent?: string } | undefined)?.parent;
    const vis = new BodyVisual({
      id,
      name: model.names[i]!,
      radiusKm: model.radiusKm[i]!,
      color: model.colors[i]!,
      physical: model.physicalMap[id],
      isMoon: !!parentId,
      parentId,
    });
    scene.add(vis.group);
    visualById.set(id, vis);
    return vis;
  });

  // 4. Raycasting on click for selection (supports mesh or floating label)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const clickables = visuals.flatMap((v) => [v.mesh, v.labelSprite]);
    const hits = raycaster.intersectObjects(clickables, false);

    if (hits.length > 0) {
      const hitObj = hits[0]!.object;
      const hitVis = visuals.find((v) => v.mesh === hitObj || v.labelSprite === hitObj);
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

  // Solar System Barycenter (SSB) - the "empty point" around which the Sun wobbles
  const baryVisual = new BarycenterVisual();
  scene.add(baryVisual.group);

  // Galaxy visual
  const galaxyVisual = new GalaxyVisual();
  scene.add(galaxyVisual.group);

  // Oort cloud visual
  const oortVisual = new OortCloudVisual();
  scene.add(oortVisual.group);

  function setView(dir: readonly [number, number, number], distanceAu: number, target?: THREE.Vector3): void {
    if (target) {
      controls.target.copy(target);
      camera.position.set(
        target.x + dir[0] * distanceAu,
        target.y + dir[1] * distanceAu,
        target.z + dir[2] * distanceAu,
      );
    } else {
      camera.position.set(dir[0], dir[1], dir[2]).setLength(distanceAu);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  }
  setView([0, -0.8, 0.6], 35);

  function setGalaxyOrbitPath(path: Float32Array): void {
    galaxyVisual.setOrbitPath(path);
  }

  function setGalaxyView(viewType: string, _state?: GalacticOrbitState, _zExag = 1): void {
    const sgrPos = galaxyVisual.group.position;
    if (viewType === 'face-on') {
      camera.position.set(sgrPos.x, sgrPos.y + 0.01, sgrPos.z + 2800);
      controls.target.copy(sgrPos);
    } else if (viewType === 'edge-on') {
      camera.position.set(sgrPos.x, sgrPos.y - 2600, sgrPos.z);
      controls.target.copy(sgrPos);
    } else if (viewType === 'follow-sun') {
      const sunPos = visuals[0] ? visuals[0].group.position : new THREE.Vector3();
      controls.target.copy(sunPos);
      camera.position.set(sunPos.x + 20, sunPos.y - 45, sunPos.z + 25);
    } else if (viewType === 'sgra') {
      controls.target.copy(sgrPos);
      camera.position.set(sgrPos.x, sgrPos.y - 350, sgrPos.z + 120);
    } else {
      // perspective overview
      camera.position.set(sgrPos.x - 1400, sgrPos.y - 1800, sgrPos.z + 1500);
      controls.target.copy(sgrPos);
    }
    controls.update();
  }

  const p: [number, number, number] = [0, 0, 0];
  const o: [number, number, number] = [0, 0, 0];
  const f: [number, number, number] = [0, 0, 0];
  const w: [number, number, number] = [0, 0, 0];

  function render(s: SystemState, v: ViewState): void {
    // Unified cosmological scene: all celestial bodies, moons, and Milky Way active
    for (const vis of visuals) vis.group.visible = true;
    sunLight.visible = true;

    const ax = v.frame.axes;
    v.frame.origin(s.t, s.gm, s.pos, 0, o);

    if (v.focus >= 0) {
      mapPoint(ax, o, s.pos[3 * v.focus]!, s.pos[3 * v.focus + 1]!, s.pos[3 * v.focus + 2]!, f);
    } else {
      mapPoint(ax, o, 0, 0, 0, f);
    }

    const height = renderer.domElement.clientHeight || renderer.domElement.height || 600;
    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * MIN_PIXEL_RADIUS) / height;
    const kMoon = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2) / height;
    const daysSinceJ2000 = model.epochJd - JD_J2000 + s.t;
    const scaleMode = v.scaleMode ?? 'pixels';
    const scaleExag = v.scaleExaggeration ?? 20;

    for (let i = 0; i < s.n; i++) {
      mapPoint(ax, o, s.pos[3 * i]!, s.pos[3 * i + 1]!, s.pos[3 * i + 2]!, p);
      const vis = visuals[i]!;

      squash(v.frame.travelDir, v.compress ?? 1, p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!, w);
      vis.group.position.set(w[0]!, w[1]!, w[2]!);

      if (i === 0) {
        sunLight.position.copy(vis.group.position);
      }

      // Orientation computed analytically on main thread each frame from s.t
      vis.updateOrientation(daysSinceJ2000, ax ?? undefined);

      // Apparent visual radius calculation
      const dist = camera.position.distanceTo(vis.group.position);
      const visualRadius = vis.computeScale(scaleMode, dist, vis.isMoon ? kMoon : k, scaleExag);

      // Apply scale: radius along x and y, oblate radius along z
      vis.mesh.scale.set(visualRadius, visualRadius, visualRadius * (1 - vis.flattening));
      if (vis.ringMesh) {
        vis.ringMesh.scale.set(visualRadius, visualRadius, visualRadius);
      }

      // Update 3D billboard label
      let labelVisible = v.showLabels !== false;
      const camDistToSun = visuals[0] ? camera.position.distanceTo(visuals[0].group.position) : camera.position.length();
      if (v.presetCategory === 'galaxy' || camDistToSun > 400) {
        // At galactic scale, only show the Sun / Solar System label; hide individual planets and moons
        if (i !== 0) {
          labelVisible = false;
        }
      } else if (vis.isMoon && vis.parentId && labelVisible) {
        const parentVis = visualById.get(vis.parentId);
        if (parentVis) {
          const camDistToParent = camera.position.distanceTo(parentVis.group.position);
          // Only show moon labels if camera is within 0.35 AU of the parent planetary system
          if (camDistToParent > 0.35) {
            labelVisible = false;
          } else {
            const sepAu = vis.group.position.distanceTo(parentVis.group.position);
            const frustumH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
            const auPerPx = frustumH / Math.max(1, height);
            const sepPx = sepAu / auPerPx;
            // Hide moon label if it's less than 16px from parent on screen (avoids text overlap)
            if (sepPx < 16) {
              labelVisible = false;
            }
          }
        }
      }
      vis.updateLabel(dist, labelVisible, visualRadius, camera.fov, height);
    }

    // Oort cloud visual in solar mode
    if (v.showOortCloud) {
      oortVisual.setVisible(true);
      // Center Oort cloud at the Sun's current rendered position
      oortVisual.group.position.copy(visuals[0]!.group.position);
    } else {
      oortVisual.setVisible(false);
    }

    // Milky Way Galaxy in unified cosmos: active and visible across cosmological scales
    const camDist = camera.position.length();

    if (v.showMilkyWay !== false) {
      galaxyVisual.setVisible(true);
      galaxyVisual.setUnifiedMode(camDist, v.showGalacticHalo !== false);
      if (v.galaxyZExag !== undefined) {
        galaxyVisual.setVerticalExaggeration(v.galaxyZExag);
      }

      const S_GAL = 60.0;
      const [GX_SIM, GY_SIM, GZ_SIM] = GALACTIC_AXES_IN_SIM;

      const mRotEcl = new THREE.Matrix4().set(
        GX_SIM[0]!, GY_SIM[0]!, GZ_SIM[0]!, 0,
        GX_SIM[1]!, GY_SIM[1]!, GZ_SIM[1]!, 0,
        GX_SIM[2]!, GY_SIM[2]!, GZ_SIM[2]!, 0,
        0,          0,          0,          1,
      );

      let mRotScene = mRotEcl;
      if (v.frame.axes) {
        const frameAxes = v.frame.axes;
        const mFrame = new THREE.Matrix4().set(
          frameAxes[0]!, frameAxes[1]!, frameAxes[2]!, 0,
          frameAxes[3]!, frameAxes[4]!, frameAxes[5]!, 0,
          frameAxes[6]!, frameAxes[7]!, frameAxes[8]!, 0,
          0,             0,             0,             1,
        );
        mRotScene = mFrame.clone().multiply(mRotEcl);
      }

      const sunGalX = v.galaxyState?.x ?? -8.2;
      const sunGalY = v.galaxyState?.y ?? 0;
      const sunGalZ = v.galaxyState?.z ?? 0.0208;

      const sunGal = new THREE.Vector3(sunGalX, sunGalY, sunGalZ).multiplyScalar(S_GAL);
      sunGal.applyMatrix4(mRotScene);

      // visuals[0] is the Sun
      const sunScenePos = visuals[0]!.group.position;
      const galPos = sunScenePos.clone().sub(sunGal);

      galaxyVisual.group.position.copy(galPos);
      galaxyVisual.group.rotation.setFromRotationMatrix(mRotScene);
      galaxyVisual.group.scale.set(S_GAL, S_GAL, S_GAL);

      if (v.galaxyState) {
        galaxyVisual.update(v.galaxyState);
      }
    } else {
      galaxyVisual.setVisible(false);
    }

    mapPoint(ax, o, 0, 0, 0, p);
    squash(v.frame.travelDir, v.compress ?? 1, p[0]! - f[0]!, p[1]! - f[1]!, p[2]! - f[2]!, w);
    const baryPos = new THREE.Vector3(w[0]!, w[1]!, w[2]!);
    const sunPos = visuals[0]!.group.position;
    // Show the "empty point" Solar System Barycenter when labels are enabled, or in barycentric frame / wobble view
    const showBary = v.showLabels !== false || v.focus === -1 || v.frame.id === 'barycentric';
    baryVisual.update(baryPos, sunPos, camera, height, showBary);

    const focusId = v.focus >= 0 ? model.ids[v.focus] : undefined;
    const focusParent = focusId
      ? (model.bodies?.find((b) => b.id === focusId) as { parent?: string } | undefined)?.parent ?? focusId
      : undefined;

    for (let i = 0; i < trails.length; i++) {
      const t = trails[i]!;
      const id = model.ids[i]!;
      if (!v.trails) {
        t.line.visible = false;
        continue;
      }

      if (focusId && focusId !== 'sun') {
        // Focused on a planetary or moon system: only show trails in this system
        const myParent = (model.bodies?.find((b) => b.id === id) as { parent?: string } | undefined)?.parent;
        const inSystem = id === focusParent || myParent === focusParent;
        t.line.visible = inSystem;
      } else {
        // Focused on Sun or Barycenter: show planets and dwarf planets (omit moons to avoid trail clutter)
        const myParent = (model.bodies?.find((b) => b.id === id) as { parent?: string } | undefined)?.parent;
        t.line.visible = !myParent;
      }
    }

    if (v.trails) {
      const count = buildTracks(
        v.history,
        s,
        v.frame,
        v.focus,
        v.trailDays,
        trailData,
        v.compress ?? 1,
      );
      for (const t of trails) t.commit(count);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  return { render, setView, setGalaxyView, setGalaxyOrbitPath };
}
