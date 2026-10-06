import './style.css';
import { dateToJd, jdToDate, auDayToKms } from '@/data/constants';
import { buildFrames } from '@/frames/registry';
import { transformState } from '@/frames/transform';
import { createViewer } from '@/render/viewer';
import { relativeRows } from '@/sim/readout';
import { loadSystem } from '@/sim/registry';
import { SimClient } from '@/sim/simClient';
import { createStore, type AppState } from '@/sim/store';
import { createPanel } from '@/ui/panel';
import { PRESETS } from '@/ui/presets';

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
const store = createStore<AppState>({
  playing: true,
  reversed: false,
  speed: 100,
  preset: 'giants',
  trails: true,
  frame: 'body:sun',
  focus: 'sun',
  trailDays: 4383,
});
const viewer = createViewer(document.getElementById('app')!, model, HISTORY_CAP);

const focusIndex = (id: string) => (id === 'barycenter' ? -1 : model.ids.indexOf(id));

function viewPreset(id: string): void {
  const p = PRESETS[id]!;
  viewer.setView(p.dir, p.dist);
  store.set('trailDays', p.trailDays);
}
function applyPreset(id: string): void {
  const p = PRESETS[id]!;
  store.set('preset', id);
  store.set('frame', p.frame); // may trigger applyFrameDefaults: we override right after
  store.set('focus', p.focus);
  viewPreset(id);
}
function applyFrameDefaults(id: string): void {
  if (id.startsWith('galactic')) {
    store.set('focus', 'sun');
    store.set('trailDays', 730.5);
    viewer.setView([1, 0, 0.3], 120);
  } else {
    store.set('focus', id.startsWith('body:') ? id.slice(5) : 'barycenter');
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
  onPhysicsChange: (opts) => client.setPhysics(opts),
});

store.subscribe((s, changed) => {
  if (changed === 'preset') applyPreset(s.preset);
  if (changed === 'reversed') client.newDirection();
  if (changed === 'frame') applyFrameDefaults(s.frame); // history is NOT cleared on a frame change
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
  if (s.playing) client.request(s.speed * dtReal * (s.reversed ? -1 : 1));
  client.updateDisplay();

  viewer.render(client.display, {
    frame: frameById.get(s.frame)!,
    focus: focusIndex(s.focus),
    trails: s.trails,
    trailDays: s.trailDays,
    history: client.history,
  });

  if (frameNo++ % 6 === 0) {
    panel.update({
      dateUtc: jdToDate(model.epochJd + client.display.t).toISOString().slice(0, 19) + ' UTC',
      sunBaryAu: client.baryDist[sun]!,
      sunSpeedKms: sunSpeedKms(s.frame),
      energyDrift: client.energyDrift,
      angMomDrift: client.angMomDrift,
      rows: relativeRows(client.display, model.names, sun),
      busy: client.busy,
    });
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
