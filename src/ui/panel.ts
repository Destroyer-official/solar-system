import type { AppStore } from '@/sim/store';
import type { Diagnostics } from '@/sim/engine';
import { AU_KM } from '@/data/constants';

export interface Option {
  id: string;
  label: string;
}

export function createPanel(
  root: HTMLElement,
  store: AppStore,
  sunIndex: number,
  sunRadiusKm: number,
  onReset: () => void,
  frames: Option[],
  focuses: Option[],
) {
  root.innerHTML = `
    <div class="panel">
      <h1>Sun &amp; Jupiter around the barycenter</h1>
      <div class="row">
        <button id="play"></button><button id="rev"></button><button id="reset">Reset</button>
      </div>
      <label>Speed <input id="speed" type="range" min="-1" max="4.5" step="0.01" value="2"> <span id="speedLabel"></span></label>
      <div class="row">
        <button data-preset="system">System view</button>
        <button data-preset="barycenter">Sun wobble view</button>
      </div>
      <label><input id="trails" type="checkbox" checked> Trails</label>
      <label>Frame <select id="frame"></select></label>
      <label>Camera follows <select id="focus"></select></label>
      <label>Trail length
        <select id="trailDays">
          <option value="365.25">1 year</option>
          <option value="730.5">2 years</option>
          <option value="4383">12 years</option>
          <option value="18262.5">50 years</option>
        </select>
      </label>
      <pre id="readout"></pre>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const play = q<HTMLButtonElement>('#play'),
    rev = q<HTMLButtonElement>('#rev');
  const speed = q<HTMLInputElement>('#speed'),
    speedLabel = q<HTMLSpanElement>('#speedLabel');

  const fill = (sel: HTMLSelectElement, opts: Option[]) =>
    (sel.innerHTML = opts.map((o) => `<option value="${o.id}">${o.label}</option>`).join(''));
  const frameSel = q<HTMLSelectElement>('#frame'),
    focusSel = q<HTMLSelectElement>('#focus');
  const trailSel = q<HTMLSelectElement>('#trailDays');
  fill(frameSel, frames);
  fill(focusSel, focuses);
  frameSel.onchange = () => store.set('frame', frameSel.value);
  focusSel.onchange = () => store.set('focus', focusSel.value);
  trailSel.onchange = () => store.set('trailDays', Number(trailSel.value));

  const sync = () => {
    const s = store.get();
    play.textContent = s.playing ? 'Pause' : 'Play';
    rev.textContent = s.reversed ? 'Direction: backward' : 'Direction: forward';
    speedLabel.textContent =
      s.speed >= 365.25 ? `${(s.speed / 365.25).toFixed(1)} yr/s` : `${s.speed.toFixed(1)} d/s`;
    frameSel.value = s.frame;
    focusSel.value = s.focus;
    trailSel.value = String(s.trailDays);
  };
  play.onclick = () => store.set('playing', !store.get().playing);
  rev.onclick = () => store.set('reversed', !store.get().reversed);
  q('#reset').onclick = onReset;
  speed.oninput = () => store.set('speed', 10 ** Number(speed.value));
  q<HTMLInputElement>('#trails').onchange = (e) =>
    store.set('trails', (e.target as HTMLInputElement).checked);
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
    b.onclick = () => store.set('preset', b.dataset.preset as 'system' | 'barycenter');
  });
  store.subscribe(sync);
  store.set('speed', 10 ** Number(speed.value));
  sync();

  const out = q<HTMLPreElement>('#readout');
  return {
    update(d: Diagnostics, sunSpeedKms: number) {
      const au = d.baryDistAu(sunIndex);
      out.textContent =
        `Time            ${(d.t / 365.25).toFixed(3)} yr\n` +
        `Sun-barycenter  ${au.toFixed(6)} AU\n` +
        `                ${(au * AU_KM).toFixed(0)} km = ${((au * AU_KM) / sunRadiusKm).toFixed(3)} R_sun\n` +
        `Sun speed here  ${sunSpeedKms.toFixed(3)} km/s\n` +
        `Energy drift    ${d.energyDrift.toExponential(2)}\n` +
        `Ang.mom. drift  ${d.angMomDrift.toExponential(2)}`;
    },
  };
}
