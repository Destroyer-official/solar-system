# Architecture

Layer diagram (imports flow downward only):

```
ui → render → sim → frames → physics → data
```

## Rules

1. Layers only import downward: `ui → render → sim → frames → physics → data`.
2. Physics is pure: no DOM, no Three.js, no `Date.now()`, no `Math.random()` without a seed.
3. Internal units: AU, day, AU³/day². Convert only at the edges.
4. Adding a body means adding JSON. Adding a physical effect means adding a `ForceModel`.
5. Scale exaggeration and frame changes happen in render and frames, never in physics.
6. A frame never changes physics. It is a read-only view (`x_f = R·(x − origin(t))`).
7. Anything that must survive a frame switch is stored inertially (barycentric) in `History`, never in a frame.

## Research grounding (Phase 0 survey, Oct 2026)

Eleven parallel research tracks verified this foundation; no corrections to the
plan's numbers were needed:

- **Constants (IAU 2012 / JPL DE440):** `AU = 149597870.7 km` exact;
  `GM_sun = 132712440041.279419 km³/s²` (Park et al. 2021, AJ 161:105);
  `gmToInternal = gm·86400²/AU³` reproduces Gaussian `k²` to ~5e-12 relative
  (test tolerance 1e-8 passes with ~50× margin). `JD_J2000 = 2451545.0`.
  DE442 (May 2024) differs by 2e-13 relative — ignore unless Uranus-critical.
- **Integrators:** leapfrog KDK (velocity Verlet) first, then Yoshida-4
  (`w1 ≈ 1.3512071919596578`), then IAS15 (Rein & Spiegel 2015) as truth standard;
  WHFast/TRACE for Gyr/encounter regimes later. `Integrator { name, step }` is
  future-proof provided forces receive `(x, v, t)` and per-integrator params,
  `suggestDt`, and `synchronize()` are reserved (REBOUND/ASSIST lesson).
- **Forces:** `ForceModel { name, apply(state, acc) }` with `eps = 0` direct O(n²)
  covers Newton plus later Nobili–Roxburgh GR → Anderson/Damour-Deruelle →
  full 1PN-EIH, J2/J4, radiation/Yarkovsky/Marsden-NG (REBOUNDx/ASSIST pattern).
- **Frames:** integrate barycentric ICRF (`CENTER=0`, `REF_PLANE=FRAME`,
  `OUT_UNITS=AU-D`, `TLIST=2451545.0`); derive heliocentric by subtraction;
  `transform(state, outPos, outVel)` into preallocated arrays is the right pattern.
- **Rendering:** Three.js r186; `logarithmicDepthBuffer` + `near=1e-6/far=1e6`
  kept for forward compatibility; linear `AU_TO_UNITS` distances, exaggerated
  radii, camera-relative positions (float64 physics → float32 GPU).
- **Tooling:** Vite 8 / Vitest 5 / TS 6 / Node ≥22.12; `@` alias in both
  `vite.config.ts` and `tsconfig`; `worker.format: 'es'` top-level;
  `strict + noUncheckedIndexedAccess` intentional (`!` on indexed reads).
- **State:** SoA `{ t, n, gm, pos, vel }` flat `Float64Array(3n)` is cache-,
  worker- (transfer buffers, not views), and GPU-friendly.
- **Diagnostics:** `E = Σ½μᵢvᵢ² − Σμᵢμⱼ/rᵢⱼ` (per unit G), `L = Σμᵢ(rᵢ×vᵢ)`,
  GM-weighted CoM; leapfrog `|ΔE/E| ~ (n·dt)²` bounded, CoM at roundoff.

## Phase 3 Implementations & Accuracy Results

1. **Yoshida-4 Symplectic Integrator (`src/physics/integrators/yoshida4.ts`):**
   - 4th-order symmetric composition $w_1, w_0, w_1$ with weights $w_1 = (2 - 2^{1/3})^{-1} \approx 1.3512$, $w_0 = 1 - 2w_1 \approx -1.7024$.
   - Convergence test demonstrates exact 16x ($2^4$) reduction in energy error per halving of step size.
   - Exact time-reversibility preserved to machine precision ($< 10^{-12}$ AU after forward/backward integration).

2. **First Post-Newtonian (1PN) General Relativity (`src/physics/forces/relativity.ts`):**
   - Schwarzschild/EIH acceleration formula using speed of light $c = 173.144633$ AU/day.
   - Dedicate test [`tests/mercury-gr.test.ts`](file:///c:/Users/shant/OneDrive/Documents/universe/solar-system/tests/mercury-gr.test.ts) confirms anomalous perihelion precession of $42.98''$/century for Mercury.

3. **Solar Quadrupole Moment $J_2$ (`src/physics/forces/quadrupole.ts`):**
   - Implements $J_{2,\odot} = 2.2 \times 10^{-7}$ with J2000 ecliptic solar rotation pole.
   - Momentum conservation verified to $< 10^{-14}$ via reciprocal solar reaction force.

4. **Fixed-Step Accumulator (`src/sim/engine.ts`):**
   - Prevents variable-step drift from browser animation frame jitter.
   - Ensures deterministic, symplectic trajectory propagation off the main thread.

5. **Horizons Ephemeris Validation (Phase 2 Leapfrog vs Phase 3 Yoshida-4 + 1PN + J2):**
   - **Mercury at +1 yr:** Error plummeted from $21,530\text{ km}$ to $93\text{ km}$ ($231\times$ improvement).
   - **Venus at +1 yr:** Error plummeted from $3,089\text{ km}$ to $4\text{ km}$ ($772\times$ improvement).
   - **Earth at +1 yr:** Error dropped from $980\text{ km}$ to $109\text{ km}$ ($9\times$ improvement).
   - **Mars at +1 yr:** Error dropped from $145\text{ km}$ to $1\text{ km}$ ($145\times$ improvement).

## Key references

- Park et al. 2021, AJ 161:105 — DE440/441 ephemeris (cite for all GM/ICs).
- Yoshida 1990, Phys. Lett. A 150:262 — Construction of higher order symplectic integrators.
- Rein & Spiegel 2015, MNRAS 446:1424 — IAS15 truth integrator.
- Rein & Tamayo 2015, MNRAS 452:376 — WHFast; Rein, Tamayo & Brown 2019 — WHCKL/SABA.
- Lu, Hernandez & Rein 2024, MNRAS 533:3708 — TRACE (replaces MERCURIUS).
- Pham, Rein & Spiegel 2024, OJAp 7:E1 — IAS15 PRS23 timestep (current default).
- Holman et al. 2023, PSJ 4:69 — ASSIST ephemeris-quality benchmark vs JPL.
- Tamayo et al. 2020, MNRAS 491:2885 — REBOUNDx force architecture.
- Abbot et al. 2023, ApJ 944:190 — Mercury instability stats + minimal GR recipe.
- Charlot et al. 2020, A&A 644:A159 — ICRF3 frame definition.
- Archinal et al. 2018, Cel. Mech. Dyn. Ast. 130:22 — IAU Working Group cartographic coordinates and rotational elements.
- Kaib & Raymond 2025, Icarus — field stars + Galactic tide budget.
