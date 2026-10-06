import './style.css';
import { dateToJd, jdToDate, auDayToKms } from '@/data/constants';
import { buildFrames } from '@/frames/registry';
import { transformState } from '@/frames/transform';
import { createViewer } from '@/render/viewer';
import { relativeRows } from '@/sim/readout';
import { loadSystem } from '@/sim/registry';
import { SimClient } from '@/sim/simClient';
import { GalaxySim } from '@/sim/galaxySim';
import { createStore, type AppState } from '@/sim/store';
import { createPanel } from '@/ui/panel';
import { PRESETS } from '@/ui/presets';
import { computeBodyFacts } from '@/sim/facts';

const HISTORY_CAP = 20_000; // x 2 days = ~110 years
const MAX_JUMP_DAYS = 73_050; // +-200 years (leapfrog accuracy degrades beyond this)

const model = loadSystem();
const frames = buildFrames(model.ids, model.names);
const frameById = new Map(frames.map((f) => [f.id, f]));
const sun = model.ids.indexOf('sun');

// Validate presets against the loaded system so typos fail loudly instead of
// silently falling back to the barycenter.
for (const [id, p] of Object.entries(PRESETS)) {
  if (!frameById.has(p.frame)) throw new Error(`Preset "${id}": unknown frame "${p.frame}"`);
  if (p.focus !== 'barycenter' && !model.ids.includes(p.focus))
    throw new Error(`Preset "${id}": unknown focus "${p.focus}"`);
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
  playing: true,
  reversed: false,
  speed: 100,
  galaxySpeed: 2.0,
  galaxyZExag: 1.0,
  galaxyCamera: 'perspective',
  preset: 'giants',
  trails: true,
  frame: 'body:sun',
  focus: 'sun',
  trailDays: 4383,
  scaleMode: 'pixels',
  scaleExaggeration: 20,
  selected: null,
  compress: 1,
});

const viewer = createViewer(document.getElementById('app')!, model, HISTORY_CAP, {
  onSelect: (id) => store.set('selected', id),
});

// Precompute full 500 Myr galactic orbit path and supply to viewer
viewer.setGalaxyOrbitPath(galaxySim.generateOrbitPath(500, 0.5));

const focusIndex = (id: string) => (id === 'barycenter' ? -1 : model.ids.indexOf(id));

function viewPreset(id: string): void {
  const p = PRESETS[id]!;
  viewer.setView(p.dir, p.dist);
  store.set('trailDays', p.trailDays);
}
function applyPreset(id: string): void {
  const p = PRESETS[id]!;
  store.set('preset', id);
  store.set('frame', p.frame);
  store.set('focus', p.focus);
  viewPreset(id);
}
function applyFrameDefaults(id: string): void {
  if (id.startsWith('galactic')) {
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
    { id: 'barycenter', label: 'Barycenter' },
    ...model.ids.map((id, i) => ({ id, label: model.names[i]! })),
  ],
  presets: Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label })),
  onReset: () => client.reset(),
  onSeekDate: (d) => seekToJd(dateToJd(d)),
  onNow: () => seekToJd(dateToJd(new Date())),
  onGalaxyReset: () => galaxySim.reset(),
  onGalaxyCamera: (cam) =>
    viewer.setGalaxyView(cam, galaxySim.getState(), store.get().galaxyZExag),
  onPhysicsChange: (opts) => client.setPhysics(opts),
});

store.subscribe((s, changed) => {
  if (changed === 'mode') {
    if (s.mode === 'galaxy') {
      viewer.setGalaxyView(s.galaxyCamera, galaxySim.getState(), s.galaxyZExag);
    } else {
      applyPreset(s.preset);
    }
  }
  if (changed === 'galaxyCamera' && s.mode === 'galaxy') {
    viewer.setGalaxyView(s.galaxyCamera, galaxySim.getState(), s.galaxyZExag);
  }
  if (changed === 'preset' && s.mode === 'solar') applyPreset(s.preset);
  if (changed === 'reversed') client.newDirection();
  if (changed === 'frame' && s.mode === 'solar') applyFrameDefaults(s.frame);
});
applyPreset('giants');

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

  if (s.mode === 'galaxy') {
    if (s.playing) galaxySim.step(s.galaxySpeed * dtReal * (s.reversed ? -1 : 1));
  } else {
    if (s.playing) client.request(s.speed * dtReal * (s.reversed ? -1 : 1));
    client.updateDisplay();
  }

  viewer.render(client.display, {
    mode: s.mode,
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
    if (s.mode === 'galaxy') {
      panel.update({
        dateUtc: '',
        sunBaryAu: 0,
        sunSpeedKms: 0,
        energyDrift: 0,
        angMomDrift: 0,
        rows: [],
        busy: false,
        galaxyReadout: galaxySim.computeReadout(),
      });
    } else {
      const selectedFacts = s.selected ? computeBodyFacts(s.selected, client.display, model) : null;
      panel.update({
        dateUtc: jdToDate(model.epochJd + client.display.t).toISOString().slice(0, 19) + ' UTC',
        sunBaryAu: client.baryDist[sun]!,
        sunSpeedKms: sunSpeedKms(s.frame),
        energyDrift: client.energyDrift,
        angMomDrift: client.angMomDrift,
        rows: relativeRows(client.display, model.names, sun),
        busy: client.busy,
        selectedFacts,
        galaxyReadout: null,
      });
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
