import { AU_KM } from '@/data/constants';
import type { BodyRow } from '@/sim/readout';
import type { AppStore, ScaleMode, GalaxyCamera } from '@/sim/store';
import type { ComputedFacts } from '@/sim/facts';
import type { GalaxyReadout } from '@/sim/galaxySim';
import type { GalaxyModel } from '@/data/galaxy';
import type { ValidationRow } from '@/sim/ephemeris';

export interface Option {
  id: string;
  label: string;
}

export interface PanelContext {
  sunRadiusKm: number;
  frames: Option[];
  focuses: Option[];
  presets: Option[];
  galaxyModels: readonly GalaxyModel[];
  validationTable: ValidationRow[];
  onReset(): void;
  onSeekDate(d: Date): void;
  onNow(): void;
  onReseedHorizons?(): void;
  onGalaxyReset?(): void;
  onGalaxyCamera?(cam: GalaxyCamera): void;
  onGalaxyModelChange?(modelId: string): void;
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
  galaxyReadout?: GalaxyReadout | null;
}

const fill = (sel: HTMLSelectElement, opts: Option[]) =>
  (sel.innerHTML = opts.map((o) => `<option value="${o.id}">${o.label}</option>`).join(''));

export function createPanel(root: HTMLElement, store: AppStore, ctx: PanelContext) {
  root.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h1>Celestial Dynamics</h1>
      </div>

      <div class="mode-tabs">
        <button id="modeSolar" class="tab-btn active">Planets View</button>
        <button id="modeGalaxy" class="tab-btn">Milky Way Galaxy</button>
      </div>

      <!-- Dynamics Mode Bar (Truth & Ephemeris vs Simulation) -->
      <div class="dynamics-bar">
        <div id="dynamicsStatus" class="status-badge">● Simulation: Yoshida-4 + 1PN + J2</div>
        <div class="row">
          <button id="toggleDynamics" style="font-size:11px;padding:3px 6px;">Switch to JPL DE440</button>
          <button id="reseedBtn" style="font-size:11px;padding:3px 6px;" title="Re-seed N-body from Horizons DE440 vectors to reset drift">Re-sync Horizons</button>
          <button id="valTableBtn" style="font-size:11px;padding:3px 6px;">Validation</button>
        </div>
      </div>

      <!-- Horizons Validation Table Box -->
      <div id="valTableBox" class="val-table-container" style="display: none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:#38bdf8;">Horizons DE440 vs N-Body Validation</strong>
          <button id="closeValTable" style="padding:1px 5px;font-size:10px;">✕</button>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">
          Yoshida-4 + 1PN General Relativity + Solar J2 vs JPL Horizons:
        </div>
        <table class="val-table">
          <thead>
            <tr><th>Body</th><th>Offset</th><th>Err (AU)</th><th>Err (km)</th></tr>
          </thead>
          <tbody>
            ${ctx.validationTable
              .map(
                (r) => `
              <tr>
                <td>${r.name}</td>
                <td>+${r.offsetYears} yr</td>
                <td>${r.errAu.toExponential(1)}</td>
                <td>${r.errKm.toLocaleString()} km</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Reality & Honesty Inspector Button & Box -->
      <div>
        <button id="toggleReality" style="width:100%;font-size:11px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center;">
          <span>Reality & Honesty Inspector</span>
          <span id="realityArrow">▾</span>
        </button>
      </div>

      <div id="realityInspector" class="reality-inspector" style="display: none;">
        <div class="reality-item">
          <span>Positions:</span>
          <span id="realPosTag" class="reality-tag tag-model">Model</span>
        </div>
        <div class="reality-item">
          <span>Speeds:</span>
          <span class="reality-tag tag-true">True (float64)</span>
        </div>
        <div class="reality-item">
          <span>Body Radii:</span>
          <span id="realSizeTag" class="reality-tag tag-scaled">Scaled (visual only)</span>
        </div>
        <div class="reality-item">
          <span>Galactic Travel:</span>
          <span id="realTravelTag" class="reality-tag tag-scaled">Scaled (1:20 view)</span>
        </div>
        <div class="reality-item">
          <span>Textures:</span>
          <span class="reality-tag tag-model">Model (IAU map)</span>
        </div>
        <div class="reality-item">
          <span>Stars:</span>
          <span class="reality-tag tag-true">True (Hipparcos)</span>
        </div>
        <div class="reality-item">
          <span>LSR Speed Model:</span>
          <span id="realLsrTag" style="color:#ffd700;font-size:10px;">IAU 1985 (220 km/s)</span>
        </div>
      </div>

      <!-- Solar System View Controls -->
      <div id="solarSection" style="display: grid; gap: 8px;">
        <div class="row">
          <button id="play"></button>
          <button id="rev"></button>
          <button id="reset">Reset</button>
        </div>
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
        <label>Galactic Speed Model
          <select id="solarGalaxyModel">
            ${ctx.galaxyModels
              .map(
                (m) => `<option value="${m.id}">${m.label} - ${m.source.split('(')[0]}</option>`,
              )
              .join('')}
          </select>
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
        <label><input id="showMilkyWay" type="checkbox"> Milky Way backdrop</label>
        <label>Along-track compression <input id="compress" type="range" min="-2" max="0" step="0.05" value="0"> <span id="cLabel">1:1</span></label>
        <div id="factsBox" class="facts-box" style="display:none;"></div>
        <pre id="readout"></pre>
      </div>

      <!-- Milky Way Galaxy View Controls -->
      <div id="galaxySection" style="display: none; grid-gap: 8px;">
        <div class="row">
          <button id="galPlay">Play</button>
          <button id="galRev">Forward</button>
          <button id="galReset">Reset</button>
        </div>
        <label>Galactic Time Speed
          <input id="galSpeed" type="range" min="0.1" max="15" step="0.1" value="2">
          <span id="galSpeedLabel">2.0 Myr/s</span>
        </label>
        <label>LSR Circular Speed Model
          <select id="galaxyModel">
            ${ctx.galaxyModels
              .map(
                (m) => `<option value="${m.id}">${m.label} - ${m.source.split('(')[0]}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label>Camera View
          <select id="galCamera">
            <option value="perspective" selected>3D Perspective</option>
            <option value="face-on">Face-on (Galactic North)</option>
            <option value="edge-on">Edge-on (Vertical Bobbing)</option>
            <option value="follow-sun">Follow Sun (Local System)</option>
            <option value="sgra">Sagittarius A* (Core Black Hole)</option>
          </select>
        </label>
        <label>Vertical Exaggeration
          <input id="galZExag" type="range" min="1" max="5" step="0.1" value="1">
          <span id="galZExagVal">1.0x (True Scale)</span>
        </label>

        <div class="galaxy-info">
          <div><strong>Sun's Galactic Orbit:</strong> ~245 Myr (Rosette)</div>
          <div><strong>Vertical Bobbing:</strong> ~93 Myr period (±111 pc)</div>
          <div><strong>Galactic Center:</strong> Sgr A* (8.2 kpc distance)</div>
          <div><strong>Ecliptic Tilt:</strong> 60.2° to Galactic Midplane</div>
          <div><strong>CMB Dipole Speed:</strong> 369.82 km/s (Planck 2020)</div>
        </div>

        <pre id="galaxyReadout"></pre>
      </div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  // Tabs
  const modeSolarBtn = q<HTMLButtonElement>('#modeSolar');
  const modeGalaxyBtn = q<HTMLButtonElement>('#modeGalaxy');
  const solarSection = q<HTMLDivElement>('#solarSection');
  const galaxySection = q<HTMLDivElement>('#galaxySection');

  // Dynamics mode & Reality inspector
  const dynamicsStatus = q<HTMLSpanElement>('#dynamicsStatus');
  const toggleDynamics = q<HTMLButtonElement>('#toggleDynamics');
  const reseedBtn = q<HTMLButtonElement>('#reseedBtn');
  const valTableBtn = q<HTMLButtonElement>('#valTableBtn');
  const valTableBox = q<HTMLDivElement>('#valTableBox');
  const closeValTable = q<HTMLButtonElement>('#closeValTable');
  const toggleReality = q<HTMLButtonElement>('#toggleReality');
  const realityArrow = q<HTMLSpanElement>('#realityArrow');
  const realityInspector = q<HTMLDivElement>('#realityInspector');
  const realPosTag = q<HTMLSpanElement>('#realPosTag');
  const realSizeTag = q<HTMLSpanElement>('#realSizeTag');
  const realTravelTag = q<HTMLSpanElement>('#realTravelTag');
  const realLsrTag = q<HTMLSpanElement>('#realLsrTag');

  // Solar elements
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
  const compressIn = q<HTMLInputElement>('#compress');
  const cLabel = q<HTMLSpanElement>('#cLabel');
  const factsBox = q<HTMLDivElement>('#factsBox');
  const showMilkyWayIn = q<HTMLInputElement>('#showMilkyWay');
 const trailSel = q<HTMLSelectElement>('#trailDays'),
    dateIn = q<HTMLInputElement>('#date');
  const out = q<HTMLPreElement>('#readout');
  const solarGalaxyModel = q<HTMLSelectElement>('#solarGalaxyModel');

  // Galaxy elements
  const galPlay = q<HTMLButtonElement>('#galPlay'),
    galRev = q<HTMLButtonElement>('#galRev'),
    galReset = q<HTMLButtonElement>('#galReset');
  const galSpeed = q<HTMLInputElement>('#galSpeed'),
    galSpeedLabel = q<HTMLSpanElement>('#galSpeedLabel');
  const galCamera = q<HTMLSelectElement>('#galCamera');
  const galZExag = q<HTMLInputElement>('#galZExag'),
    galZExagVal = q<HTMLSpanElement>('#galZExagVal');
  const galOut = q<HTMLPreElement>('#galaxyReadout');
  const galaxyModel = q<HTMLSelectElement>('#galaxyModel');

  fill(frameSel, ctx.frames);
  fill(focusSel, ctx.focuses);
  q<HTMLDivElement>('#presets').innerHTML = ctx.presets
    .map((p) => `<button data-preset="${p.id}">${p.label}</button>`)
    .join('');
  dateIn.value = new Date().toISOString().slice(0, 10);

  const sync = () => {
    const s = store.get();
    const isSolar = s.mode === 'solar';

    modeSolarBtn.classList.toggle('active', isSolar);
    modeGalaxyBtn.classList.toggle('active', !isSolar);
    solarSection.style.display = isSolar ? 'grid' : 'none';
    galaxySection.style.display = isSolar ? 'none' : 'grid';

    // Dynamics mode sync
    const isEphem = s.dynamicsMode === 'ephemeris';
    dynamicsStatus.className = `status-badge ${isEphem ? 'ephem' : ''}`;
    dynamicsStatus.textContent = isEphem
      ? '● NASA JPL DE440 Ephemeris (Exact to meters)'
      : '● Simulation: Yoshida-4 + 1PN + J2';
    toggleDynamics.textContent = isEphem
      ? 'Switch to Simulation Mode'
      : 'Switch to JPL DE440 Ephemeris';

    // Reality inspector sync
    realityInspector.style.display = s.showRealityInspector ? 'grid' : 'none';
    realityArrow.textContent = s.showRealityInspector ? '▴' : '▾';
    valTableBox.style.display = s.showValidationTable ? 'block' : 'none';

    realPosTag.className = `reality-tag ${isEphem ? 'tag-true' : 'tag-model'}`;
    realPosTag.textContent = isEphem ? 'True (DE440)' : 'Model (N-body)';

    realSizeTag.className = `reality-tag ${s.scaleMode === 'true' ? 'tag-true' : 'tag-scaled'}`;
    realSizeTag.textContent = s.scaleMode === 'true' ? 'True (IAU)' : 'Scaled (visual only)';

    realTravelTag.className = `reality-tag ${s.compress === 1 ? 'tag-true' : 'tag-scaled'}`;
    realTravelTag.textContent =
      s.compress === 1 ? 'True (49 AU/yr)' : `Scaled (1:${Math.round(1 / s.compress)})`;

    const activeModel = ctx.galaxyModels.find((m) => m.id === s.galaxyModelId);
    if (activeModel) {
      realLsrTag.textContent = activeModel.label;
      galaxyModel.value = s.galaxyModelId;
      solarGalaxyModel.value = s.galaxyModelId;
    }

    // Solar sync
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
    compressIn.value = String(Math.log10(s.compress));
    if (showMilkyWayIn) showMilkyWayIn.checked = !!s.showMilkyWay;
    const ratio = Math.round(1 / s.compress);
    cLabel.textContent = ratio === 1 ? '1:1' : `1:${ratio} (visual only)`;

    // Galaxy sync
    galPlay.textContent = s.playing ? 'Pause' : 'Play';
    galRev.textContent = s.reversed ? 'Backward' : 'Forward';
    galSpeed.value = String(s.galaxySpeed);
    galSpeedLabel.textContent = `${s.galaxySpeed.toFixed(1)} Myr/s`;
    galCamera.value = s.galaxyCamera;
    galZExag.value = String(s.galaxyZExag);
    galZExagVal.textContent =
      s.galaxyZExag === 1 ? '1.0x (True Scale)' : `${s.galaxyZExag.toFixed(1)}x`;
  };

  modeSolarBtn.onclick = () => store.set('mode', 'solar');
  modeGalaxyBtn.onclick = () => store.set('mode', 'galaxy');

  // Dynamics mode actions
  toggleDynamics.onclick = () =>
    store.set(
      'dynamicsMode',
      store.get().dynamicsMode === 'ephemeris' ? 'simulation' : 'ephemeris',
    );
  reseedBtn.onclick = () => ctx.onReseedHorizons?.();
  valTableBtn.onclick = () =>
    store.set('showValidationTable', !store.get().showValidationTable);
  closeValTable.onclick = () => store.set('showValidationTable', false);
  toggleReality.onclick = () =>
    store.set('showRealityInspector', !store.get().showRealityInspector);

  const handleGalaxyModel = (val: string) => {
    store.set('galaxyModelId', val);
    ctx.onGalaxyModelChange?.(val);
  };
  galaxyModel.onchange = () => handleGalaxyModel(galaxyModel.value);
  solarGalaxyModel.onchange = () => handleGalaxyModel(solarGalaxyModel.value);

  // Solar actions
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
  compressIn.oninput = () => {
    store.set('compress', 10 ** Number(compressIn.value));
  };
  trailSel.onchange = () => store.set('trailDays', Number(trailSel.value));
  q<HTMLInputElement>('#trails').onchange = (e) =>
    store.set('trails', (e.target as HTMLInputElement).checked);
  if (showMilkyWayIn) {
    showMilkyWayIn.onchange = (e) =>
      store.set('showMilkyWay', (e.target as HTMLInputElement).checked);
  }

  // Galaxy actions
  galPlay.onclick = () => store.set('playing', !store.get().playing);
  galRev.onclick = () => store.set('reversed', !store.get().reversed);
  galReset.onclick = () => ctx.onGalaxyReset?.();
  galSpeed.oninput = () => store.set('galaxySpeed', Number(galSpeed.value));
  galCamera.onchange = () => {
    const cam = galCamera.value as GalaxyCamera;
    store.set('galaxyCamera', cam);
    ctx.onGalaxyCamera?.(cam);
  };
  galZExag.oninput = () => store.set('galaxyZExag', Number(galZExag.value));

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
      if (store.get().mode === 'solar') {
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
      } else if (d.galaxyReadout) {
        const gr = d.galaxyReadout;
        galOut.textContent = [
          `Time T          ${gr.tMyr >= 0 ? '+' : ''}${gr.tMyr.toFixed(2)} Myr`,
          `Radius R        ${gr.rKpc.toFixed(3)} kpc`,
          `Height z        ${gr.zPc >= 0 ? '+' : ''}${gr.zPc.toFixed(1)} pc`,
          `Galactic speed  ${gr.speedKms.toFixed(2)} km/s`,
          `  v_radial      ${gr.vRadialKms.toFixed(2)} km/s`,
          `  v_azimuthal   ${gr.vAzimuthalKms.toFixed(2)} km/s`,
          `  v_z (vertical)${gr.vZKms.toFixed(2)} km/s`,
          `Azimuth phi     ${gr.phiDeg.toFixed(1)}°`,
          `Vertical phase  ${gr.vertPhase.toUpperCase()}`,
          `Next midplane   in ${gr.timeToNextMidplaneMyr.toFixed(1)} Myr`,
          `Energy drift    ${gr.energyDrift.toExponential(2)}`,
          `Ang.mom. drift  ${gr.angMomDrift.toExponential(2)}`,
        ].join('\n');
      }
    },
  };
}
