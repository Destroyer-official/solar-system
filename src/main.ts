import './style.css';
import { dateToJd, jdToDate, auDayToKms } from '@/data/constants';
import { loadSystem, ALL_BODIES } from '@/sim/registry';
import { SimClient } from '@/sim/simClient';
import { GalaxySim } from '@/sim/galaxySim';
import { EphemerisProvider } from '@/sim/ephemeris';
import { createStore, type AppState } from '@/sim/store';
import { buildFrames } from '@/frames/registry';
import { transformState } from '@/frames/transform';
import { createViewer } from '@/render/viewer';
import { createPanel } from '@/ui/panel';
import { PRESETS } from '@/ui/presets';
import { relativeRows } from '@/sim/readout';
import { computeBodyFacts } from '@/sim/facts';
import { GALAXY_MODELS } from '@/data/galaxy';

const HISTORY_CAP = 20_000;
const MAX_JUMP_DAYS = 73_050;

// Load all 32 celestial bodies: Sun, 8 planets, Pluto, and all 22 moons
const model = loadSystem(ALL_BODIES);
const ephemeris = new EphemerisProvider(model);
const validationTable = ephemeris.getValidationTable();

const sun = model.ids.indexOf('sun');

const getLsrKms = (id: string) => GALAXY_MODELS.find((m) => m.id === id)?.lsrKms ?? 220;

let frames = buildFrames(model.ids, model.names, getLsrKms('iau1985'));
let frameById = new Map(frames.map((f) => [f.id, f]));

// Filter presets against the loaded system
const validPresets: Record<string, (typeof PRESETS)[string]> = {};
for (const [id, p] of Object.entries(PRESETS)) {
  if (frameById.has(p.frame) && (p.focus === 'barycenter' || p.focus === 'sgra' || model.ids.includes(p.focus))) {
    validPresets[id] = p;
  }
}

const client = new SimClient(model, {
  maxDt: 0.5,
  maxSteps: 10_000,
  historyCap: HISTORY_CAP,
  historyIntervalDays: 2,
  integrator: 'yoshida4',
  relativity: true,
  quadrupole: true,
  fixedDt: 0.2,
});

const galaxySim = new GalaxySim();

const store = createStore<AppState>({
  mode: 'solar',
  showMilkyWay: true,
  showOortCloud: false,
  showGalacticHalo: true,
  showLabels: true,
  dynamicsMode: 'simulation',
  galaxyModelId: 'iau1985',
  showRealityInspector: false,
  showValidationTable: false,
  playing: true,
  reversed: false,
  speed: 15,
  galaxySpeed: 2.0,
  galaxyZExag: 1.0,
  galaxyCamera: 'perspective',
  preset: 'outer',
  trails: true,
  frame: 'body:sun',
  focus: 'sun',
  trailDays: 4383,
  scaleMode: 'pixels',
  scaleExaggeration: 20,
  selected: 'earth',
  compress: 1,
});

const viewer = createViewer(document.getElementById('app')!, model, HISTORY_CAP, {
  onSelect: (id) => store.set('selected', id),
});

// Precompute full 500 Myr galactic orbit path and supply to viewer
viewer.setGalaxyOrbitPath(galaxySim.generateOrbitPath(500, 0.5));

const focusIndex = (id: string) => (id === 'barycenter' || id === 'sgra' ? -1 : model.ids.indexOf(id));

function viewPreset(id: string): void {
  const p = validPresets[id] ?? PRESETS[id]!;
  const targetFrame = frameById.get(p.frame);
  if (id === 'milkyWay') {
    viewer.setGalaxyView('overview', targetFrame, galaxySim.getState(), store.get().galaxyZExag);
  } else if (id === 'sgra') {
    viewer.setGalaxyView('sgra', targetFrame, galaxySim.getState(), store.get().galaxyZExag);
  } else {
    viewer.setView(p.dir, p.dist);
  }
  store.set('trailDays', p.trailDays);
}

let isApplyingPreset = false;

function applyPreset(id: string): void {
  const p = validPresets[id] ?? PRESETS[id]!;
  isApplyingPreset = true;
  store.set('preset', id);
  store.set('frame', p.frame);
  store.set('focus', p.focus);
  if (id === 'oort') {
    store.set('showOortCloud', true);
  }
  if (p.focus !== 'barycenter' && p.focus !== 'sgra') {
    store.set('selected', p.focus);
  } else if (id === 'sunUnified' || id === 'wobble') {
    store.set('selected', 'sun');
  }
  if (id === 'sunUnified' || id === 'wobble') {
    store.set('scaleMode', 'true');
  } else if (store.get().scaleMode === 'true') {
    store.set('scaleMode', 'pixels');
  }
  if (id === 'cosmic') {
    store.set('compress', 0.05);
  } else {
    store.set('compress', 1);
  }
  viewPreset(id);
  isApplyingPreset = false;
}

function applyFrameDefaults(id: string): void {
  if (id.startsWith('galactic') || id.startsWith('cmb')) {
    store.set('focus', 'sun');
    store.set('trailDays', 730.5);
    store.set('compress', 0.05);
    viewer.setView([1, 0, 0.3], 120);
  } else {
    store.set('focus', id.startsWith('body:') ? id.slice(5) : 'barycenter');
    store.set('compress', 1);
    viewPreset(store.get().preset);
  }
}

const seekToJd = (jd: number) => {
  const days = Math.max(-MAX_JUMP_DAYS, Math.min(MAX_JUMP_DAYS, jd - model.epochJd));
  client.seek(days);
};

const panel = createPanel(document.getElementById('panel')!, store, {
  sunRadiusKm: model.radiusKm[sun]!,
  frames: frames.map((f) => ({ id: f.id, label: f.label })),
  focuses: [
    { id: 'barycenter', label: 'Solar System Barycenter' },
    ...model.ids.map((id, i) => ({ id, label: model.names[i]! })),
    { id: 'sgra', label: 'Sagittarius A* (Galactic Center)' },
  ],
  presets: Object.entries(validPresets).map(([id, p]) => ({
    id,
    label: p.label,
    category: p.category ?? 'solar',
  })),
  galaxyModels: GALAXY_MODELS,
  validationTable,
  onReset: () => client.reset(),
  onSeekDate: (d) => seekToJd(dateToJd(d)),
  onNow: () => seekToJd(dateToJd(new Date())),
  onReseedHorizons: () => {
    ephemeris.reseed(client.display.t, client.display);
  },
  onGalaxyReset: () => galaxySim.reset(),
  onGalaxyCamera: (cam) =>
    viewer.setGalaxyView(cam, frameById.get(store.get().frame), galaxySim.getState(), store.get().galaxyZExag),
  onGalaxyModelChange: (modelId) => {
    const lsr = getLsrKms(modelId);
    galaxySim.setLsrSpeed(lsr);
    viewer.setGalaxyOrbitPath(galaxySim.generateOrbitPath(500, 0.5));
    frames = buildFrames(model.ids, model.names, lsr);
    frameById = new Map(frames.map((f) => [f.id, f]));
  },
  onPhysicsChange: (opts) => client.setPhysics(opts),
});

store.subscribe((s, changed) => {
  if (changed === 'preset') applyPreset(s.preset);
  if (changed === 'reversed') client.newDirection();
  if (changed === 'frame' && !isApplyingPreset) applyFrameDefaults(s.frame);
  if (changed === 'focus') {
    const fIdx = focusIndex(s.focus);
    if (fIdx >= 0) {
      store.set('selected', s.focus);
    }
  }
  if (changed === 'dynamicsMode' && s.dynamicsMode === 'ephemeris') {
    ephemeris.interpolate(client.display.t, client.display.pos);
  }
});

applyPreset('outer');

const P = new Float64Array(3 * model.state.n),
  V = new Float64Array(3 * model.state.n);
function sunSpeedKms(frameId: string): number {
  transformState(frameById.get(frameId)!, client.display, P, V);
  return auDayToKms(Math.hypot(V[3 * sun]!, V[3 * sun + 1]!, V[3 * sun + 2]!));
}

let last = performance.now();
let frameNo = 0;
function tick(now: number) {
  const dtReal = Math.min((now - last) / 1000, 0.1);
  last = now;
  const s = store.get();

  // Step both galactic motion and planetary & moon dynamics simultaneously
  if (s.playing) {
    galaxySim.step(s.galaxySpeed * dtReal * (s.reversed ? -1 : 1));
  }

  if (s.dynamicsMode === 'ephemeris') {
    if (s.playing) {
      client.display.t += s.speed * dtReal * (s.reversed ? -1 : 1);
    }
    ephemeris.interpolate(client.display.t, client.display.pos);
  } else {
    if (s.playing) client.request(s.speed * dtReal * (s.reversed ? -1 : 1));
    client.updateDisplay();
  }

  const curPreset = validPresets[s.preset] ?? PRESETS[s.preset];
  viewer.render(client.display, {
    mode: s.mode,
    presetCategory: curPreset?.category ?? 'solar',
    showMilkyWay: s.showMilkyWay,
    showOortCloud: s.showOortCloud,
    showGalacticHalo: s.showGalacticHalo,
    showLabels: s.showLabels,
    galaxyState: galaxySim.getState(),
    galaxyCamera: s.galaxyCamera,
    galaxyZExag: s.galaxyZExag,
    frame: frameById.get(s.frame)!,
    focus: focusIndex(s.focus),
    trails: s.trails,
    trailDays: s.trailDays,
    history: client.history,
    scaleMode: s.scaleMode,
    scaleExaggeration: s.scaleExaggeration,
    selected: s.selected,
    compress: s.compress,
  });

  if (frameNo++ % 6 === 0) {
    const selectedFacts = s.selected ? computeBodyFacts(s.selected, client.display, model) : null;
    panel.update({
      dateUtc: jdToDate(model.epochJd + client.display.t).toISOString().slice(0, 19) + ' UTC',
      sunBaryAu: client.baryDist[sun]!,
      sunSpeedKms: sunSpeedKms(s.frame),
      energyDrift: s.dynamicsMode === 'ephemeris' ? 0 : client.energyDrift,
      angMomDrift: s.dynamicsMode === 'ephemeris' ? 0 : client.angMomDrift,
      rows: relativeRows(client.display, model.names, sun),
      busy: client.busy,
      selectedFacts,
      galaxyReadout: galaxySim.computeReadout(),
    });
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
