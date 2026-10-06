import { AU_KM } from '@/data/constants';
import type { BodyRow } from '@/sim/readout';
import type { AppStore, ScaleMode } from '@/sim/store';
import type { ComputedFacts } from '@/sim/facts';

export interface Option {
  id: string;
  label: string;
}

export interface PanelContext {
  sunRadiusKm: number;
  frames: Option[];
  focuses: Option[];
  presets: Option[];
  onReset(): void;
  onSeekDate(d: Date): void;
  onNow(): void;
  onPhysicsChange?(opts: {
    integrator?: 'leapfrog' | 'yoshida4';
    relativity?: boolean;
    quadrupole?: boolean;
  }): void;
}

export interface PanelData {
  dateUtc: string;
  sunBaryAu: number;
  sunSpeedKms: number;
  energyDrift: number;
  angMomDrift: number;
  rows: BodyRow[];
  busy: boolean;
  selectedFacts?: ComputedFacts | null;
}

const fill = (sel: HTMLSelectElement, opts: Option[]) =>
  (sel.innerHTML = opts.map((o) => `<option value="${o.id}">${o.label}</option>`).join(''));

export function createPanel(root: HTMLElement, store: AppStore, ctx: PanelContext) {
  root.innerHTML = `
    <div class="panel">
      <h1>Solar System</h1>
      <div class="row"><button id="play"></button><button id="rev"></button><button id="reset">Reset</button></div>
      <label>Speed <input id="speed" type="range" min="-1" max="4.5" step="0.01" value="2"> <span id="speedLabel"></span></label>
      <div class="row">
        <input id="date" type="date"><button id="go">Go</button><button id="now">Now</button>
      </div>
      <div class="row" id="presets"></div>
      <label>Frame <select id="frame"></select></label>
      <label>Camera follows <select id="focus"></select></label>
      <label>Scale mode
        <select id="scaleMode">
          <option value="pixels" selected>Minimum Pixel Radius</option>
          <option value="true">True Physical Scale</option>
          <option value="exaggerated">Exaggerated Scale</option>
        </select>
      </label>
      <label id="exagRow" style="display:none;">Exaggeration
        <input id="scaleExag" type="range" min="1" max="300" step="1" value="20">
        <span id="exagVal">20x</span>
      </label>
      <label>Integrator
        <select id="integrator">
          <option value="yoshida4" selected>Yoshida 4th Order</option>
          <option value="leapfrog">Leapfrog (2nd)</option>
        </select>
      </label>
      <div class="row">
        <label><input id="relativity" type="checkbox" checked> 1PN Relativity</label>
        <label><input id="quadrupole" type="checkbox" checked> Solar J2</label>
      </div>
      <label>Trail length
        <select id="trailDays">
          <option value="365.25">1 year</option><option value="730.5">2 years</option>
          <option value="4383">12 years</option><option value="7305">20 years</option>
          <option value="18262.5">50 years</option><option value="36525">100 years</option>
        </select>
      </label>
      <label><input id="trails" type="checkbox" checked> Trails</label>
      <div id="factsBox" class="facts-box" style="display:none;"></div>
      <pre id="readout"></pre>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const play = q<HTMLButtonElement>('#play'),
    rev = q<HTMLButtonElement>('#rev');
  const speed = q<HTMLInputElement>('#speed'),
    speedLabel = q<HTMLSpanElement>('#speedLabel');
  const frameSel = q<HTMLSelectElement>('#frame'),
    focusSel = q<HTMLSelectElement>('#focus');
  const scaleModeSel = q<HTMLSelectElement>('#scaleMode');
  const scaleExagIn = q<HTMLInputElement>('#scaleExag');
  const exagRow = q<HTMLElement>('#exagRow');
  const exagVal = q<HTMLElement>('#exagVal');
  const factsBox = q<HTMLDivElement>('#factsBox');
  const trailSel = q<HTMLSelectElement>('#trailDays'),
    dateIn = q<HTMLInputElement>('#date');
  const out = q<HTMLPreElement>('#readout');

  fill(frameSel, ctx.frames);
  fill(focusSel, ctx.focuses);
  q<HTMLDivElement>('#presets').innerHTML = ctx.presets
    .map((p) => `<button data-preset="${p.id}">${p.label}</button>`)
    .join('');
  dateIn.value = new Date().toISOString().slice(0, 10);

  const sync = () => {
    const s = store.get();
    play.textContent = s.playing ? 'Pause' : 'Play';
    rev.textContent = s.reversed ? 'Backward' : 'Forward';
    speedLabel.textContent =
      s.speed >= 365.25 ? `${(s.speed / 365.25).toFixed(1)} yr/s` : `${s.speed.toFixed(1)} d/s`;
    frameSel.value = s.frame;
    focusSel.value = s.focus;
    trailSel.value = String(s.trailDays);
    scaleModeSel.value = s.scaleMode;
    exagRow.style.display = s.scaleMode === 'exaggerated' ? 'block' : 'none';
    scaleExagIn.value = String(s.scaleExaggeration);
    exagVal.textContent = `${s.scaleExaggeration}x`;
  };

  play.onclick = () => store.set('playing', !store.get().playing);
  rev.onclick = () => store.set('reversed', !store.get().reversed);
  q('#reset').onclick = ctx.onReset;
  q('#now').onclick = ctx.onNow;
  q('#go').onclick = () => {
    if (dateIn.value) ctx.onSeekDate(new Date(`${dateIn.value}T00:00:00Z`));
  };
  speed.oninput = () => store.set('speed', 10 ** Number(speed.value));
  frameSel.onchange = () => store.set('frame', frameSel.value);
  focusSel.onchange = () => store.set('focus', focusSel.value);
  scaleModeSel.onchange = () => store.set('scaleMode', scaleModeSel.value as ScaleMode);
  scaleExagIn.oninput = () => {
    store.set('scaleExaggeration', Number(scaleExagIn.value));
    exagVal.textContent = `${scaleExagIn.value}x`;
  };
  trailSel.onchange = () => store.set('trailDays', Number(trailSel.value));
  q<HTMLInputElement>('#trails').onchange = (e) =>
    store.set('trails', (e.target as HTMLInputElement).checked);

  const intSel = q<HTMLSelectElement>('#integrator');
  const relIn = q<HTMLInputElement>('#relativity');
  const quadIn = q<HTMLInputElement>('#quadrupole');
  const emitPhysics = () => {
    ctx.onPhysicsChange?.({
      integrator: intSel.value as 'leapfrog' | 'yoshida4',
      relativity: relIn.checked,
      quadrupole: quadIn.checked,
    });
  };
  intSel.onchange = emitPhysics;
  relIn.onchange = emitPhysics;
  quadIn.onchange = emitPhysics;

  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
    b.onclick = () => store.set('preset', b.dataset.preset!);
  });
  store.subscribe(sync);
  sync();

  return {
    update(d: PanelData) {
      const au = d.sunBaryAu;
      out.textContent = [
        `Date (UTC)      ${d.dateUtc}`,
        `Sun-barycenter  ${au.toFixed(5)} AU = ${((au * AU_KM) / ctx.sunRadiusKm).toFixed(2)} R_sun`,
        `Sun speed here  ${d.sunSpeedKms.toFixed(3)} km/s`,
        `Energy drift    ${d.energyDrift.toExponential(2)}`,
        `Ang.mom. drift  ${d.angMomDrift.toExponential(2)}`,
        '',
        'Body        r_sun(AU)  v(km/s)',
        ...d.rows.map(
          (r) => `${r.name.padEnd(10)} ${r.rAu.toFixed(3).padStart(9)} ${r.vKms.toFixed(2).padStart(8)}`,
        ),
        d.busy ? '\nComputing jump...' : '',
      ].join('\n');

      if (d.selectedFacts) {
        const sf = d.selectedFacts;
        factsBox.style.display = 'block';
        factsBox.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;">
            <strong style="font-size:1.1em;color:#ffd700;">${sf.name}</strong>
            <button id="closeFacts" style="padding:1px 6px;font-size:0.8em;">✕</button>
          </div>
          <div style="font-size:0.85em;line-height:1.4;margin-top:6px;">
            <div><strong>Dist to Sun:</strong> ${sf.distSunAu.toFixed(3)} AU (${sf.lightMinutes.toFixed(1)} light-min)</div>
            <div><strong>Orbital Speed:</strong> ${sf.speedKms.toFixed(2)} km/s</div>
            <div><strong>Semi-major axis:</strong> ${sf.elements.a.toFixed(3)} AU</div>
            <div><strong>Eccentricity:</strong> ${sf.elements.e.toFixed(4)}</div>
            <div><strong>Period:</strong> ${(sf.elements.period / 365.25).toFixed(2)} yr (${sf.elements.period.toFixed(1)} d)</div>
            <div><strong>Axial Tilt:</strong> ${sf.axialTiltDeg.toFixed(2)}°</div>
            <div><strong>Sidereal Day:</strong> ${sf.siderealDayDays.toFixed(2)} d</div>
            <div><strong>Subsolar Point:</strong> ${sf.subsolarLatDeg.toFixed(1)}° lat, ${sf.subsolarLonDeg.toFixed(1)}° lon</div>
            <div style="margin-top:4px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:4px;">
              ${Object.entries(sf.facts)
                .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                .join('')}
            </div>
          </div>
        `;
        const closeBtn = q<HTMLButtonElement>('#closeFacts');
        if (closeBtn) closeBtn.onclick = () => store.set('selected', null);
      } else {
        factsBox.style.display = 'none';
      }
    },
  };
}
