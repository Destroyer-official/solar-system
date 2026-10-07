import { AU_KM } from '@/data/constants';
import type { BodyRow } from '@/sim/readout';
import type { AppStore, ScaleMode } from '@/sim/store';
import type { ComputedFacts } from '@/sim/facts';
import type { GalaxyReadout } from '@/sim/galaxySim';
import type { GalaxyModel } from '@/data/galaxy';
import type { ValidationRow } from '@/sim/ephemeris';

export interface Option {
  id: string;
  label: string;
  category?: string;
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
  onGalaxyCamera?(cam: string): void;
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

export function createPanel(root: HTMLElement, store: AppStore, ctx: PanelContext) {
  root.innerHTML = `
    <div class="panel-inner">
      <div class="panel-header" style="flex-direction: column; align-items: flex-start; gap: 2px;">
        <h1 style="font-size: 14px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
          <span>🌌</span> Cosmic Universe Simulator
        </h1>
        <div style="font-size: 10px; color: #7dd3fc; opacity: 0.9;">
          Unified Solar System, Planetary Moons & Milky Way Galaxy
        </div>
      </div>

      <!-- Dynamics Mode Indicator & Reseed -->
      <div class="dynamics-bar" style="margin-top: 4px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 11px; opacity: 0.7;">Dynamics:</span>
          <span id="dynamicsStatus" class="status-badge badge-sim">Yoshida-4 N-Body</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button id="toggleDynamics" style="font-size: 10px; padding: 2px 6px;">Switch Mode</button>
          <button id="reseedBtn" style="font-size: 10px; padding: 2px 6px;" title="Reset N-body state to NASA Horizons truth vectors at current date">Re-seed</button>
          <button id="valTableBtn" style="font-size: 10px; padding: 2px 6px;" title="View comparison table vs JPL Horizons">Validation</button>
        </div>
      </div>

      <!-- Validation Table Box (Collapsible) -->
      <div id="valTableBox" class="val-table-box" style="display: none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#00ffcc; font-size:11px;">JPL DE440 Accuracy Table</strong>
          <button id="closeValTable" style="padding:1px 5px; font-size:10px;">✕</button>
        </div>
        <table class="val-table">
          <thead>
            <tr>
              <th>Body</th>
              <th>Offset</th>
              <th>Δ pos (AU)</th>
              <th>Δ pos (km)</th>
            </tr>
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
          <span>Planet Positions:</span>
          <span id="realPosTag" class="reality-tag tag-model">True Float64 N-Body</span>
        </div>
        <div class="reality-item">
          <span>Moons Dynamics:</span>
          <span class="reality-tag tag-true">Hierarchical Sub-cycled</span>
        </div>
        <div class="reality-item">
          <span>Body Radii:</span>
          <span id="realSizeTag" class="reality-tag tag-scaled">Minimum Pixel Clamped</span>
        </div>
        <div class="reality-item">
          <span>Planetary Disc:</span>
          <span class="reality-tag tag-true">True Flat (within 7°)</span>
        </div>
        <div class="reality-item">
          <span>Oort Cloud:</span>
          <span class="reality-tag tag-model">100,000 AU Sphere</span>
        </div>
        <div class="reality-item">
          <span>Galactic Disc:</span>
          <span class="reality-tag tag-true">Thin Disc (~1:100)</span>
        </div>
        <div class="reality-item">
          <span>Galactic Halo:</span>
          <span class="reality-tag tag-model">158 Globular Clusters</span>
        </div>
        <div class="reality-item">
          <span>Sun Self-Rotation:</span>
          <span class="reality-tag tag-true">IAU Pole 7.25° Tilt (25.38d)</span>
        </div>
        <div class="reality-item">
          <span>Sun Barycenter Wobble:</span>
          <span class="reality-tag tag-true">Empty Point N-Body (2.2 R☉)</span>
        </div>
        <div class="reality-item">
          <span>Sun Galactic Orbit:</span>
          <span id="realGalOrbitTag" class="reality-tag tag-true">Curved 3D (238 km/s, Sofue 2016)</span>
        </div>
        <div class="reality-item">
          <span>Galactic Potential:</span>
          <span id="realGalModelTag" class="reality-tag tag-model">Sofue 2016 (Bulge+Disk+NFW)</span>
        </div>
      </div>

      <!-- Simulation Playback & Time Controls -->
      <div style="display: grid; gap: 8px;">
        <div class="row">
          <button id="play" style="flex: 1; font-weight: 600;">Pause</button>
          <button id="rev" style="flex: 1;">Forward</button>
          <button id="reset">Reset</button>
        </div>

        <label>Simulation Speed 
          <input id="speed" type="range" min="-1" max="4.5" step="0.01" value="2"> 
          <span id="speedLabel" style="color: #38bdf8; font-weight: 600;">100.0 d/s</span>
        </label>

        <div class="row">
          <input id="date" type="date" style="flex: 1;">
          <button id="go">Go</button>
          <button id="now" title="Sync live to current real-world UTC time">Now (Live)</button>
        </div>

        <!-- Categorized Cosmic Presets (Instant Navigation) -->
        <div style="margin-top: 4px;">
          <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>Camera View Presets</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;" id="presetsContainer">
            <!-- Galaxy Presets -->
            <div style="font-size: 10px; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">🌌 Milky Way & Cosmic Scales</div>
            <div class="row" id="presets-galaxy"></div>

            <!-- Solar System Presets -->
            <div style="font-size: 10px; color: #fde047; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px;">🪐 Solar System Scales</div>
            <div class="row" id="presets-solar"></div>

            <!-- Moons Presets -->
            <div style="font-size: 10px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px;">🌙 Planetary Moon Systems</div>
            <div class="row" id="presets-moons"></div>

            <!-- Close-Up Visits -->
            <div style="font-size: 10px; color: #f472b6; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px;">🔭 Close-up Planet Visits</div>
            <div class="row" id="presets-visits"></div>

            <!-- Iconic Moon Visits -->
            <div style="font-size: 10px; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px;">🔬 Iconic Moon Visits</div>
            <div class="row" id="presets-moon-visits"></div>
          </div>
        </div>

        <!-- Selected Body Facts Card (Right Below Presets) -->
        <div id="factsBox" class="facts-box" style="display:none; margin-top: 6px;"></div>

        <!-- Camera Focus & Reference Frame -->
        <label>Camera follows (Focus Body)
          <select id="focus"></select>
        </label>

        <label>Reference Frame
          <select id="frame"></select>
        </label>

        <label>Scale mode
          <select id="scaleMode">
            <option value="pixels" selected>Minimum Pixel Radius (Visible Discs)</option>
            <option value="true">True 1:1 Physical Scale</option>
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
            <option value="yoshida4" selected>Yoshida 4th Order (Symplectic)</option>
            <option value="leapfrog">Leapfrog (2nd Order)</option>
          </select>
        </label>

        <div class="row">
          <label><input id="relativity" type="checkbox" checked> 1PN Relativity</label>
          <label><input id="quadrupole" type="checkbox" checked> Solar J2</label>
        </div>

        <label>Trail length
          <select id="trailDays">
            <option value="3">3 days (Fast Moons)</option>
            <option value="28">28 days (Lunar Month)</option>
            <option value="365.25">1 year (Earth)</option>
            <option value="4383">12 years (Jupiter)</option>
            <option value="10759">30 years (Saturn)</option>
            <option value="29220" selected>80 years (Outer System & Corkscrew)</option>
            <option value="36525">100 years</option>
          </select>
        </label>

        <div class="row">
          <label><input id="trails" type="checkbox" checked> Trails</label>
          <label><input id="showLabels" type="checkbox" checked> 🏷️ Labels</label>
          <label><input id="showMilkyWay" type="checkbox" checked> Milky Way</label>
          <label><input id="showOortCloud" type="checkbox"> Oort Cloud</label>
        </div>

        <label>Along-track compression (Galactic Corkscrew View)
          <input id="compress" type="range" min="-2" max="0" step="0.05" value="0"> 
          <span id="cLabel">1:1</span>
        </label>

        <!-- Telemetry Readout -->
        <pre id="readout"></pre>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;

  const dynamicsStatus = q<HTMLElement>('#dynamicsStatus');
  const toggleDynamics = q<HTMLButtonElement>('#toggleDynamics');
  const reseedBtn = q<HTMLButtonElement>('#reseedBtn');
  const valTableBtn = q<HTMLButtonElement>('#valTableBtn');
  const valTableBox = q<HTMLElement>('#valTableBox');
  const closeValTable = q<HTMLButtonElement>('#closeValTable');

  const toggleReality = q<HTMLButtonElement>('#toggleReality');
  const realityInspector = q<HTMLElement>('#realityInspector');
  const realityArrow = q<HTMLElement>('#realityArrow');
  const realPosTag = q<HTMLElement>('#realPosTag');
  const realGalOrbitTag = q<HTMLElement>('#realGalOrbitTag');
  const realGalModelTag = q<HTMLElement>('#realGalModelTag');

  const play = q<HTMLButtonElement>('#play'),
    rev = q<HTMLButtonElement>('#rev'),
    speed = q<HTMLInputElement>('#speed'),
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
  const showLabelsIn = q<HTMLInputElement>('#showLabels');
  const showMilkyWayIn = q<HTMLInputElement>('#showMilkyWay');
  const showOortCloudIn = q<HTMLInputElement>('#showOortCloud');
  const trailSel = q<HTMLSelectElement>('#trailDays'),
    dateIn = q<HTMLInputElement>('#date');
  const out = q<HTMLPreElement>('#readout');
  const solarGalaxyModel = q<HTMLSelectElement>('#solarGalaxyModel');

  fill(frameSel, ctx.frames);
  fill(focusSel, ctx.focuses);

  // Distribute presets into categories
  const galPresets = ctx.presets.filter((p) => p.category === 'galaxy');
  const solPresets = ctx.presets.filter((p) => p.category === 'solar');
  const moonPresets = ctx.presets.filter((p) => p.category === 'moons');
  const visitPresets = ctx.presets.filter((p) => p.category === 'visits');
  const moonVisitPresets = ctx.presets.filter((p) => p.category === 'moonVisits');

  const renderPresetButtons = (el: HTMLElement | null, list: Option[]) => {
    if (!el) return;
    el.innerHTML = list
      .map((p) => `<button data-preset="${p.id}" style="font-size: 11px; padding: 3px 7px;">${p.label}</button>`)
      .join('');
  };

  renderPresetButtons(q<HTMLElement>('#presets-galaxy'), galPresets);
  renderPresetButtons(q<HTMLElement>('#presets-solar'), solPresets);
  renderPresetButtons(q<HTMLElement>('#presets-moons'), moonPresets);
  renderPresetButtons(q<HTMLElement>('#presets-visits'), visitPresets);
  renderPresetButtons(q<HTMLElement>('#presets-moon-visits'), moonVisitPresets);

  dateIn.value = new Date().toISOString().slice(0, 10);

  const sync = () => {
    const s = store.get();

    // Dynamics badge & inspector
    if (s.dynamicsMode === 'ephemeris') {
      dynamicsStatus.textContent = 'DE440 Ephemeris';
      dynamicsStatus.className = 'status-badge badge-eph';
      realPosTag.textContent = 'True (DE440)';
      realPosTag.className = 'reality-tag tag-true';
    } else {
      dynamicsStatus.textContent = 'Yoshida-4 N-Body';
      dynamicsStatus.className = 'status-badge badge-sim';
      realPosTag.textContent = 'True Float64 N-Body';
      realPosTag.className = 'reality-tag tag-true';
    }

    valTableBox.style.display = s.showValidationTable ? 'block' : 'none';
    realityInspector.style.display = s.showRealityInspector ? 'grid' : 'none';
    realityArrow.textContent = s.showRealityInspector ? '▴' : '▾';

    play.textContent = s.playing ? 'Pause' : 'Play';
    rev.textContent = s.reversed ? 'Backward' : 'Forward';
    speed.value = String(Math.log10(s.speed));
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
    if (showLabelsIn) showLabelsIn.checked = s.showLabels !== false;
    if (showMilkyWayIn) showMilkyWayIn.checked = !!s.showMilkyWay;
    if (showOortCloudIn) showOortCloudIn.checked = !!s.showOortCloud;
    const ratio = Math.round(1 / s.compress);
    cLabel.textContent = ratio === 1 ? '1:1' : `1:${ratio} (visual only)`;

    solarGalaxyModel.value = s.galaxyModelId ?? 'iau1985';
    const activeGal = ctx.galaxyModels.find((m) => m.id === (s.galaxyModelId ?? 'iau1985'));
    if (realGalOrbitTag) {
      realGalOrbitTag.textContent = `Curved 3D (${activeGal?.lsrKms ?? 220} km/s)`;
    }
    if (realGalModelTag) {
      realGalModelTag.textContent =
        activeGal?.id === 'sofue2016'
          ? 'Sofue 2016 (4-Comp + NFW Halo)'
          : `${activeGal?.label.split('(')[0]?.trim() ?? 'IAU'} Standard`;
    }
  };

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
  solarGalaxyModel.onchange = () => handleGalaxyModel(solarGalaxyModel.value);

  // Playback & input actions
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
  if (showLabelsIn) {
    showLabelsIn.onchange = (e) =>
      store.set('showLabels', (e.target as HTMLInputElement).checked);
  }
  if (showMilkyWayIn) {
    showMilkyWayIn.onchange = (e) =>
      store.set('showMilkyWay', (e.target as HTMLInputElement).checked);
  }
  if (showOortCloudIn) {
    showOortCloudIn.onchange = (e) =>
      store.set('showOortCloud', (e.target as HTMLInputElement).checked);
  }

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

  q('#presetsContainer').onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'BUTTON' && t.dataset['preset']) {
      store.set('preset', t.dataset['preset']!);
    }
  };

  store.subscribe(sync);
  sync();

  return {
    update(d: PanelData): void {
      dateIn.value = d.dateUtc ? d.dateUtc.slice(0, 10) : '';

      const gr = d.galaxyReadout;
      const curGalModel = ctx.galaxyModels.find((m) => m.id === (store.get().galaxyModelId ?? 'iau1985'));
      const galHeader = gr
        ? [
            `Galactic Model:    ${curGalModel?.label ?? 'IAU 1985'} (${curGalModel?.source.split('(')[0]?.trim()})`,
            `Galactic Position: R=${gr.rKpc.toFixed(2)} kpc | z=${gr.zPc >= 0 ? '+' : ''}${gr.zPc.toFixed(0)} pc`,
            `Galactic Velocity: ${gr.speedKms.toFixed(1)} km/s (Azimuthal ${gr.vAzimuthalKms.toFixed(1)} km/s)`,
            `Sun Midplane:      in ${gr.timeToNextMidplaneMyr.toFixed(1)} Myr (${gr.vertPhase.toUpperCase()})`,
            '------------------------------------------------',
          ]
        : [];

      const lines: string[] = [
        `Date (UTC)     ${d.dateUtc}`,
        `Sun-SSB dist   ${(d.sunBaryAu * AU_KM).toLocaleString('en-US', { maximumFractionDigits: 0 })} km (${((d.sunBaryAu * AU_KM) / ctx.sunRadiusKm).toFixed(2)} R_sun)`,
        `Sun speed      ${d.sunSpeedKms.toFixed(3)} km/s`,
        `|ΔE/E|         ${d.energyDrift.toExponential(2)}`,
        `|ΔL/L|         ${d.angMomDrift.toExponential(2)}`,
        d.busy ? 'SIMULATION BUSY' : '',
        ...galHeader,
        '',
        'Body         Dist(AU)   Dist(km)      Speed(km/s)',
        '------------------------------------------------',
        ...d.rows.map(
          (r) =>
            `${r.name.padEnd(12)} ${r.rAu.toFixed(4).padStart(9)} ${(r.rAu * AU_KM).toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(13)} ${r.vKms.toFixed(2).padStart(11)}`,
        ),
      ];
      out.textContent = lines.filter(Boolean).join('\n');

      // Selection facts card
      if (d.selectedFacts) {
        const sf = d.selectedFacts;
        factsBox.style.display = 'block';
        factsBox.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:1.15em;color:#ffd700;">${sf.name}</strong>
            <button id="closeFacts" style="padding:1px 6px;font-size:0.8em;">✕</button>
          </div>
          <div style="font-size:0.85em;line-height:1.45;margin-top:6px;">
            ${
              sf.id === 'sun'
                ? `
                <div><strong>Dist to SSB (Empty Point):</strong> ${sf.distSunAu.toFixed(6)} AU (${(sf.distSunAu * AU_KM).toLocaleString('en-US', { maximumFractionDigits: 0 })} km)</div>
                <div><strong>Barycentric Wobble Speed:</strong> ${(sf.speedKms * 1000).toFixed(1)} m/s (${sf.speedKms.toFixed(3)} km/s)</div>
                <div><strong>Axial Obliquity:</strong> 7.25° to ecliptic (RA 286.13°, Dec 63.87°)</div>
                <div><strong>Carrington Sidereal Period:</strong> 25.38 days (14.1844°/day)</div>
                <div style="margin-top:6px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:6px;">
                  ${Object.entries(sf.facts)
                    .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                    .join('')}
                </div>
              `
                : sf.isMoon && sf.parentName && sf.distParentKm !== undefined
                ? `
                <div style="color:#67e8f9;font-weight:600;margin-bottom:3px;">🌙 Orbiting Host: ${sf.parentName}</div>
                <div><strong>Distance to ${sf.parentName}:</strong> ${sf.distParentKm.toLocaleString('en-US', { maximumFractionDigits: 0 })} km (${sf.distParentAu?.toFixed(6)} AU)</div>
                <div><strong>Orbital Speed around ${sf.parentName}:</strong> ${sf.speedRelParentKms?.toFixed(2)} km/s</div>
                <div><strong>Orbital Period:</strong> ${sf.elements.period < 1 ? `${(sf.elements.period * 24).toFixed(1)} hours` : `${sf.elements.period.toFixed(2)} days`}</div>
                <div><strong>Semi-Major Axis:</strong> ${(sf.elements.a * AU_KM).toLocaleString('en-US', { maximumFractionDigits: 0 })} km</div>
                <div><strong>Eccentricity:</strong> ${sf.elements.e.toFixed(4)}</div>
                <div><strong>Tidal Locking:</strong> Synchronous (${Math.abs(sf.siderealDayDays) < 1 ? `${(Math.abs(sf.siderealDayDays) * 24).toFixed(1)}h` : `${sf.siderealDayDays.toFixed(2)}d`})</div>
                <div><strong>Axial Obliquity:</strong> ${sf.axialTiltDeg.toFixed(2)}°</div>
                <div><strong>Dist to Sun:</strong> ${sf.distSunAu.toFixed(3)} AU (${sf.lightMinutes.toFixed(1)} light-min)</div>
                <div style="margin-top:4px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:4px;">
                  ${Object.entries(sf.facts)
                    .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                    .join('')}
                </div>
              `
                : `
                <div><strong>Dist to Sun:</strong> ${sf.distSunAu.toFixed(4)} AU (${(sf.distSunAu * AU_KM).toLocaleString('en-US', { maximumFractionDigits: 0 })} km)</div>
                <div><strong>Light Travel:</strong> ${sf.lightMinutes.toFixed(2)} light-min</div>
                <div><strong>Orbital Speed:</strong> ${sf.speedKms.toFixed(2)} km/s</div>
                <div><strong>Semi-major axis:</strong> ${sf.elements.a.toFixed(4)} AU</div>
                <div><strong>Eccentricity:</strong> ${sf.elements.e.toFixed(4)}</div>
                <div><strong>Orbital Period:</strong> ${sf.elements.period >= 365.25 ? `${(sf.elements.period / 365.25).toFixed(2)} yr` : `${sf.elements.period.toFixed(2)} days`}</div>
                <div><strong>Axial Tilt:</strong> ${sf.axialTiltDeg.toFixed(2)}°</div>
                <div><strong>Sidereal Day:</strong> ${Math.abs(sf.siderealDayDays) < 1 ? `${(Math.abs(sf.siderealDayDays) * 24).toFixed(1)} hours` : `${sf.siderealDayDays.toFixed(2)} days`}</div>
                <div><strong>Subsolar Point:</strong> ${sf.subsolarLatDeg.toFixed(1)}° lat, ${sf.subsolarLonDeg.toFixed(1)}° lon</div>
                <div style="margin-top:4px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:4px;">
                  ${Object.entries(sf.facts)
                    .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                    .join('')}
                </div>
              `
            }
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

function fill(sel: HTMLSelectElement, opts: Option[]) {
  sel.innerHTML = opts.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');
}
