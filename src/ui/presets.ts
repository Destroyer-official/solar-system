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
};
