export interface Preset {
  label: string;
  category?: 'galaxy' | 'solar' | 'moons';
  frame: string; // ReferenceFrame id
  focus: string; // 'barycenter' or body id
  dir: readonly [number, number, number]; // camera direction (normalized later)
  dist: number; // AU from the focus
  trailDays: number;
}

export const PRESETS: Record<string, Preset> = {
  // 1. Deep Space & Galaxy Views
  milkyWay: {
    label: '🌌 Milky Way (Overview)',
    category: 'galaxy',
    frame: 'galactic-aligned',
    focus: 'sun',
    dir: [0.2, -0.6, 0.75],
    dist: 3500,
    trailDays: 29220,
  },
  sgra: {
    label: '🕳️ Sgr A* (Galactic Core)',
    category: 'galaxy',
    frame: 'galactic-aligned',
    focus: 'sun',
    dir: [-0.95, -0.2, 0.25],
    dist: 800,
    trailDays: 29220,
  },
  cosmic: {
    label: '🌀 Galactic Corkscrew (230 km/s)',
    category: 'galaxy',
    frame: 'galactic-aligned',
    focus: 'sun',
    dir: [0.35, -0.75, 0.55],
    dist: 90,
    trailDays: 29220,
  },
  oort: {
    label: '🌐 Oort Cloud (100,000 AU)',
    category: 'galaxy',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0.25, -0.7, 0.65],
    dist: 120000,
    trailDays: 36525,
  },

  // 2. Solar System Scales
  outer: {
    label: '🪐 Whole Solar System',
    category: 'solar',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0, -0.8, 0.6],
    dist: 85,
    trailDays: 36525,
  },
  inner: {
    label: '☀️ Inner Planets',
    category: 'solar',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0, -0.8, 0.6],
    dist: 3.5,
    trailDays: 365.25,
  },
  wobble: {
    label: '⚖️ Sun Wobble (Barycenter)',
    category: 'solar',
    frame: 'barycentric',
    focus: 'barycenter',
    dir: [0, -0.9, 0.45],
    dist: 0.03,
    trailDays: 7305,
  },

  // 3. Planetary & Moon Systems
  earthMoon: {
    label: '🌍 Earth & Moon',
    category: 'moons',
    frame: 'body:earth',
    focus: 'earth',
    dir: [0, -0.8, 0.45],
    dist: 0.007,
    trailDays: 28,
  },
  marsMoons: {
    label: '🔴 Mars, Phobos & Deimos',
    category: 'moons',
    frame: 'body:mars',
    focus: 'mars',
    dir: [0, -0.8, 0.45],
    dist: 0.0004,
    trailDays: 3,
  },
  jupiterMoons: {
    label: '⚡ Jupiter & Galilean Moons',
    category: 'moons',
    frame: 'body:jupiter',
    focus: 'jupiter',
    dir: [0, -0.8, 0.45],
    dist: 0.035,
    trailDays: 18,
  },
  saturnMoons: {
    label: '🪐 Saturn, Rings & Moons',
    category: 'moons',
    frame: 'body:saturn',
    focus: 'saturn',
    dir: [0, -0.7, 0.55],
    dist: 0.045,
    trailDays: 80,
  },
  uranusMoons: {
    label: '❄️ Uranus & Moons',
    category: 'moons',
    frame: 'body:uranus',
    focus: 'uranus',
    dir: [0, -0.8, 0.5],
    dist: 0.02,
    trailDays: 30,
  },
  neptuneMoons: {
    label: '🌊 Neptune & Triton',
    category: 'moons',
    frame: 'body:neptune',
    focus: 'neptune',
    dir: [0, -0.8, 0.5],
    dist: 0.015,
    trailDays: 15,
  },
  plutoCharon: {
    label: '🩶 Pluto & Charon Binary',
    category: 'moons',
    frame: 'body:pluto',
    focus: 'pluto',
    dir: [0, -0.8, 0.5],
    dist: 0.0004,
    trailDays: 7,
  },

  // 4. Close-Up Planet Visits
  earth: {
    label: 'Visit Earth',
    category: 'moons',
    frame: 'body:earth',
    focus: 'earth',
    dir: [0, -0.8, 0.5],
    dist: 0.0004,
    trailDays: 365.25,
  },
  mars: {
    label: 'Visit Mars',
    category: 'moons',
    frame: 'body:mars',
    focus: 'mars',
    dir: [0, -0.8, 0.5],
    dist: 0.00025,
    trailDays: 686.98,
  },
  jupiter: {
    label: 'Visit Jupiter',
    category: 'moons',
    frame: 'body:jupiter',
    focus: 'jupiter',
    dir: [0, -0.8, 0.5],
    dist: 0.0035,
    trailDays: 4332.59,
  },
  saturn: {
    label: 'Visit Saturn',
    category: 'moons',
    frame: 'body:saturn',
    focus: 'saturn',
    dir: [0, -0.7, 0.6],
    dist: 0.0055,
    trailDays: 10759.22,
  },
};
