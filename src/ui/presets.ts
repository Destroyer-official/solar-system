export interface Preset {
  label: string;
  frame: string; // ReferenceFrame id
  focus: string; // 'barycenter' or body id
  dir: readonly [number, number, number]; // camera direction (normalized later)
  dist: number; // AU from the focus
  trailDays: number;
}

export const PRESETS: Record<string, Preset> = {
  inner: {
    label: 'Inner planets',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0, -0.8, 0.6],
    dist: 3.5,
    trailDays: 365.25,
  },
  giants: {
    label: 'Giant planets',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0, -0.8, 0.6],
    dist: 35,
    trailDays: 4383,
  },
  outer: {
    label: 'Whole system',
    frame: 'body:sun',
    focus: 'sun',
    dir: [0, -0.8, 0.6],
    dist: 85,
    trailDays: 36525,
  },
  wobble: {
    label: 'Sun wobble',
    frame: 'barycentric',
    focus: 'barycenter',
    dir: [0, -0.9, 0.45],
    dist: 0.03,
    trailDays: 7305,
  },
  earth: {
    label: 'Visit Earth',
    frame: 'body:earth',
    focus: 'earth',
    dir: [0, -0.8, 0.5],
    dist: 0.0004, // ~60,000 km
    trailDays: 365.25,
  },
  mars: {
    label: 'Visit Mars',
    frame: 'body:mars',
    focus: 'mars',
    dir: [0, -0.8, 0.5],
    dist: 0.00025, // ~37,000 km
    trailDays: 686.98,
  },
  jupiter: {
    label: 'Visit Jupiter',
    frame: 'body:jupiter',
    focus: 'jupiter',
    dir: [0, -0.8, 0.5],
    dist: 0.0035, // ~520,000 km
    trailDays: 4332.59,
  },
  saturn: {
    label: 'Visit Saturn',
    frame: 'body:saturn',
    focus: 'saturn',
    dir: [0, -0.7, 0.6],
    dist: 0.0055, // ~820,000 km (spectacular angle of rings)
    trailDays: 10759.22,
  },
};
