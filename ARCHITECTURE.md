# Architecture

Layer diagram (imports flow downward only):

```
ui → render → sim → physics → data
              ↘ frames (reference-frame transforms, used by render/sim)
```

## Rules

1. Layers only import downward: `ui → render → sim → physics → data`.
2. Physics is pure: no DOM, no Three.js, no `Date.now()`, no `Math.random()` without a seed.
3. Internal units: AU, day, AU³/day². Convert only at the edges.
4. Adding a body means adding JSON. Adding a physical effect means adding a `ForceModel`.
5. Scale exaggeration and frame changes happen in render and frames, never in physics.

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

## Key references

- Park et al. 2021, AJ 161:105 — DE440/441 ephemeris (cite for all GM/ICs).
- Rein & Spiegel 2015, MNRAS 446:1424 — IAS15 truth integrator.
- Rein & Tamayo 2015, MNRAS 452:376 — WHFast; Rein, Tamayo & Brown 2019 — WHCKL/SABA.
- Lu, Hernandez & Rein 2024, MNRAS 533:3708 — TRACE (replaces MERCURIUS).
- Pham, Rein & Spiegel 2024, OJAp 7:E1 — IAS15 PRS23 timestep (current default).
- Holman et al. 2023, PSJ 4:69 — ASSIST ephemeris-quality benchmark vs JPL.
- Tamayo et al. 2020, MNRAS 491:2885 — REBOUNDx force architecture.
- Abbot et al. 2023, ApJ 944:190 — Mercury instability stats + minimal GR recipe.
- Charlot et al. 2020, A&A 644:A159 — ICRF3 frame definition.
- Kaib & Raymond 2025, Icarus — field stars + Galactic tide budget.
