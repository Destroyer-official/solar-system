import './style.css';
import { auDayToKms } from '@/data/constants';
import { buildFrames } from '@/frames/registry';
import { transformState } from '@/frames/transform';
import { newtonianGravity } from '@/physics/forces/gravity';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { createViewer } from '@/render/viewer';
import { Engine } from '@/sim/engine';
import { History } from '@/sim/history';
import { loadSystem } from '@/sim/registry';
import { createStore, type AppState } from '@/sim/store';
import { createPanel } from '@/ui/panel';

const HISTORY_CAP = 4000;
const HISTORY_INTERVAL_DAYS = 5;

const model = loadSystem();
const frames = buildFrames(model.ids, model.names);
const frameById = new Map(frames.map((f) => [f.id, f]));

const history = new History(model.state.n, HISTORY_CAP, HISTORY_INTERVAL_DAYS);
const engine = new Engine(model.state, [newtonianGravity], new Leapfrog(), 1);
engine.onStep = (s) => history.sample(s);
history.sample(model.state);

const store = createStore<AppState>({
  playing: true,
  reversed: false,
  speed: 100,
  preset: 'system',
  trails: true,
  frame: 'barycentric',
  focus: 'barycenter',
  trailDays: 4383,
});
const viewer = createViewer(document.getElementById('app')!, model, HISTORY_CAP);

const sun = model.ids.indexOf('sun');
const focusOptions = [
  { id: 'barycenter', label: 'Barycenter' },
  ...model.ids.map((id, i) => ({ id, label: model.names[i]! })),
];
const focusIndex = (id: string) => (id === 'barycenter' ? -1 : model.ids.indexOf(id));

const restartHistory = () => {
  history.clear();
  history.sample(engine.state);
};

const panel = createPanel(
  document.getElementById('panel')!,
  store,
  sun,
  model.radiusKm[sun]!,
  () => {
    engine.reset();
    restartHistory();
  },
  frames.map((f) => ({ id: f.id, label: f.label })),
  focusOptions,
);

/** Sensible camera + trail settings per frame, so each frame is readable on first switch. */
function applyFrameDefaults(id: string): void {
  if (id.startsWith('galactic')) {
    store.set('focus', 'sun');
    store.set('trailDays', 730.5);
    viewer.setView([1, 0, 0.3], 120); // side view of the Sun's path; orbit with the mouse
  } else {
    store.set('focus', id.startsWith('body:') ? id.slice(5) : 'barycenter');
    store.set('trailDays', 4383);
    viewer.setView([0, -14, 8], 16.1);
  }
}

store.subscribe((s, changed) => {
  if (changed === 'preset') viewer.setPreset(s.preset);
  if (changed === 'reversed') restartHistory(); // time order flips; history is only valid one-way
  if (changed === 'frame') applyFrameDefaults(s.frame); // NOTE: history is NOT cleared on a frame change
});

const P = new Float64Array(3 * model.state.n),
  V = new Float64Array(3 * model.state.n);
function sunSpeedKms(frameId: string): number {
  transformState(frameById.get(frameId)!, engine.state, P, V);
  return auDayToKms(Math.hypot(V[3 * sun]!, V[3 * sun + 1]!, V[3 * sun + 2]!));
}

let last = performance.now();
let frameNo = 0;
function tick(now: number) {
  const dtReal = Math.min((now - last) / 1000, 0.1);
  last = now;
  const s = store.get();
  if (s.playing) engine.advance(s.speed * dtReal * (s.reversed ? -1 : 1));
  viewer.render(engine.state, {
    frame: frameById.get(s.frame)!,
    focus: focusIndex(s.focus),
    trails: s.trails,
    trailDays: s.trailDays,
    history,
  });
  if (frameNo++ % 6 === 0) panel.update(engine.diagnostics(), sunSpeedKms(s.frame));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
