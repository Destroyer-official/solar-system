import './style.css';
import { loadSystem } from '@/sim/registry';
import { Engine } from '@/sim/engine';
import { createStore, type AppState } from '@/sim/store';
import { newtonianGravity } from '@/physics/forces/gravity';
import { Leapfrog } from '@/physics/integrators/leapfrog';
import { createViewer } from '@/render/viewer';
import { createPanel } from '@/ui/panel';

const model = loadSystem();
const engine = new Engine(model.state, [newtonianGravity], new Leapfrog(), 1);
const store = createStore<AppState>({
  playing: true,
  reversed: false,
  speed: 100,
  preset: 'system',
  trails: true,
});
const viewer = createViewer(document.getElementById('app')!, model);

const sun = model.ids.indexOf('sun');
const panel = createPanel(document.getElementById('panel')!, store, sun, model.radiusKm[sun]!, () => {
  engine.reset();
  viewer.clearTrails();
});

store.subscribe((s, changed) => {
  if (changed === 'preset') viewer.setPreset(s.preset);
  if (changed === 'reversed') viewer.clearTrails(); // trail order is meaningless after a direction flip
});

let last = performance.now();
let frameNo = 0;
function frame(now: number) {
  const dtReal = Math.min((now - last) / 1000, 0.1);
  last = now;
  const s = store.get();
  if (s.playing) engine.advance(s.speed * dtReal * (s.reversed ? -1 : 1));
  viewer.render(engine.state, s.trails);
  if (frameNo++ % 6 === 0) panel.update(engine.diagnostics());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
