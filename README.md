# 🌌 Solar System & Milky Way Astrodynamics Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black.svg?logo=three.js)](https://threejs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-33%20passed%20%2F%20165%20tests-success.svg?logo=vitest)](https://vitest.dev/)
[![JPL DE440](https://img.shields.io/badge/Ephemeris-NASA%20JPL%20DE440-red.svg)](https://ssd.jpl.nasa.gov/)

A high-fidelity astrodynamics simulation and interactive 3D visualizer modeling the Solar System from the Moon out to the Oort Cloud ($100,000\text{ AU}$) and its motion through the Milky Way galaxy ($35\text{ kpc}$), built upon a strict separation between **Physical Truth** and **Visual Truth**.

---

## 🎯 Physical Truth vs. Visual Truth: The Truth Ladder

At true physical scale, the Sun moves $\sim 49\text{ AU}$ per year along its galactic path, while Earth's orbital wave around it is only $1\text{ AU}$ high. This engine strictly decouples the float64 physics core from the renderer:

| Level | Physical Domain | Source of Truth | Implementation Details |
|---|---|---|---|
| **1** | Real Planet & Sun Positions | **NASA JPL Horizons / DE440** | `src/sim/ephemeris.ts` (Hermite cubic interpolation from sampled state vectors) |
| **2** | Sun Wobble about Barycenter | **Symplectic N-body** | `src/physics/integrators/yoshida4.ts` (Center of mass drift $< 10^{-14}\text{ AU}$) |
| **3** | Relativity, Oblateness & Asteroids | **1PN General Relativity & Solar $J_2$** | `src/physics/forces/relativity.ts`, `quadrupole.ts` (Mercury perihelion precession: $+42.98''/\text{century}$) |
| **4** | Spheres, Axial Tilt, Spin & Rings | **IAU WGCCRE 2015 Cartographic Models** | `src/physics/orientation.ts` (Earth subsolar point, oblate spheroid geometries) |
| **5** | Moons with Hierarchical Dynamics | **Hierarchical Multi-Rate N-body** | `src/physics/hierarchical.ts` (16 moon periods within $0.12\%$; Jupiter Galilean Laplace resonance) |
| **6** | Motion through the Galaxy | **Named Solar Velocity Models** | `src/data/galaxy.ts`, `src/frames/galactic.ts` (`iau1985`, `reid2019`, `gravity2021`) |
| **7** | Curved Galactic Orbit (Deep Time) | **Miyamoto-Nagai + Logarithmic Halo** | `src/physics/galacticPotential.ts` (Sun $T_\phi \approx 245\text{ Myr}$, $T_z \approx 93\text{ Myr}$; $< 0.01\text{ AU}$ straight departure in 100 yr) |
| **8** | Universal Cosmic Rest Frame | **Planck 2020 CMB Dipole** | `src/frames/galactic.ts` (`cmbFrame`, $369.82\text{ km/s}$ towards $l=264.021^\circ, b=48.253^\circ$) |

---

## ✨ Key Features

### 1. Dual Dynamics Engine & Reseed
- **Ephemeris Mode:** Real positions evaluated directly from JPL DE440 ephemeris vectors across $[-10\text{ yr}, +50\text{ yr}]$ with zero dynamical drift.
- **Simulation Mode:** Pure symplectic 4th-order Yoshida integrator running off the main thread in a Web Worker with 1PN General Relativity, solar $J_2$, and hierarchical moon systems.
- **Re-seed from Horizons:** One-click re-synchronization resetting accumulated integration drift to zero.
- **Live Horizons Accuracy Table:** Transparent live error readouts comparing N-body integration vs. JPL DE440 at $+1\text{ yr}$, $+10\text{ yr}$, and $+50\text{ yr}$.

### 2. Discs vs. Spheres: Non-Flat Architecture
- **Planetary Disc:** The 8 planets orbit in a thin disc ($\sim 1:60$ aspect ratio) tilted at **$60.2^\circ$** to the galactic midplane.
- **Spherical Oort Cloud ($2,000 - 100,000\text{ AU}$):** Full 3D isotropic cloud of icy cometary planetesimals surrounding the inner Hills Cloud and flat Kuiper Belt ($30 - 65\text{ AU}$).
- **Milky Way Thin Disc:** $100,000\text{ ly}$ wide, $\sim 1,000\text{ ly}$ thick ($\sim 1:100$ aspect ratio) with 4 logarithmic spiral arms and central spheroidal bulge.
- **Galactic Spherical Halo:** 8,000 Population II stars and **158 Globular Clusters** (matching the Harris 1996/2010 catalog count) orbiting spherically out to $35\text{ kpc}$, encased by a $200\text{ kpc}$ Dark Matter Halo virial boundary.

### 3. CMB Rest Frame & Named Galactic Speed Models
- **CMB Rest Frame:** Calibrated to the Planck Collaboration 2020 dipole ($v_\odot = 369.816\text{ km/s}$).
- **Named Models:**
  - `iau1985`: IAU 1985 circular speed standard ($v_0 = 220.0\text{ km/s}$, $v_\odot \approx 232.55\text{ km/s}$)
  - `reid2019`: Reid et al. 2019 maser parallax fit ($v_0 = 236.0\text{ km/s}$, $v_\odot \approx 248.59\text{ km/s}$)
  - `gravity2021`: GRAVITY Collaboration 2021 Sgr A* orbit fit ($v_0 = 240.0\text{ km/s}$, $v_\odot \approx 252.57\text{ km/s}$)

### 4. Reality & Honesty Inspector
A glassmorphic HUD labeling every visual and mathematical component:
- **Positions:** `True (JPL DE440 / Yoshida-4 1PN)`
- **Speeds:** `True (float64 AU/day & km/s)`
- **Body Radii:** `Scaled (Visual Only)`
- **Planetary Disc:** `True (Flat ~1:60)`
- **Oort Cloud:** `Model (2k–100k AU sphere)`
- **Galactic Travel:** `Scaled (Visual Only 1:20 view)` or `True (1:1)`
- **Thin Disc:** `True (Flat ~1:100)`
- **Galactic Halo:** `Model (158 clusters + halo)`
- **Dark Matter:** `Model (200kpc envelope)`
- **Stars:** `True (Hipparcos catalog)`

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+

### Installation & Run
```bash
git clone https://github.com/Destroyer-official/solar-system.git
cd solar-system
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Tests & Validation
```bash
# Run all 33 test suites (165 tests)
npm test

# Run TypeScript type check
npm run typecheck
```

---

## 🏛️ Architecture

```
ui → render → sim → frames → physics → data
```

1. **Downstream-only imports:** `physics` never imports `render` or `ui`.
2. **Pure float64 internal units:** Astronomical Units (AU), days (d), Gaussian gravitational constants.
3. **Symplectic Integration:** Symplectic 4th-order composition with deterministic fixed-step accumulator.
4. **Logarithmic Depth Buffer:** Near plane at $10^{-6}\text{ AU}$ ($150\text{ m}$) to Far plane at $5 \times 10^6\text{ AU}$ ($79\text{ light-years}$) without z-fighting.

---

## 📚 Key References
- Park et al. 2021, *The JPL Planetary and Lunar Ephemerides DE440 and DE441*, AJ 161:105.
- Yoshida 1990, *Construction of higher order symplectic integrators*, Phys. Lett. A 150:262.
- Planck Collaboration 2020, *Planck 2018 results. I. Overview and the cosmological legacy of Planck*, A&A 641:A1.
- Reid et al. 2019, *Trigonometric Parallaxes of High-mass Star-forming Regions*, ApJ 885:131.
- GRAVITY Collaboration 2021, *Improved measurement of the Galactic Center distance and circular speed*, A&A 647:A59.
- Harris, W.E. 1996 (2010 edition), *A Catalog of Parameters for Globular Clusters in the Milky Way*, AJ 112:1487.
- Archinal et al. 2018, *Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015*, Cel. Mech. Dyn. Ast. 130:22.
