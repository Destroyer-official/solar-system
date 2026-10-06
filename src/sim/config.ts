export interface PhysicsConfig {
  integrator: 'leapfrog' | 'yoshida4' | 'yoshida6';
  dt: number; // fixed level-0 step, days
  maxSteps: number; // per message
  gr: boolean;
  sunJ2: boolean;
  planetJ2: boolean; // used from Phase 5
  stepsPerPeriod: number; // moon sub-stepping, Phase 5
}

export const DEFAULT_CONFIG: PhysicsConfig = {
  integrator: 'yoshida6',
  dt: 1,
  maxSteps: 4000,
  gr: true,
  sunJ2: true,
  planetJ2: true,
  stepsPerPeriod: 100,
};
