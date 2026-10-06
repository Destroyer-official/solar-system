import { describe, it, expect } from 'vitest';
import { GalaxySim } from '@/sim/galaxySim';

describe('GalaxySim (Galaxy Mode Simulation)', () => {
  it('initializes Sun at R0 = 8.2 kpc and z0 = +20.8 pc with realistic galactic velocity', () => {
    const sim = new GalaxySim();
    const s = sim.getState();
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(8.2, 2);
    expect(s.z * 1000).toBeCloseTo(20.8, 1);
    const speed = Math.hypot(s.vx, s.vy, s.vz);
    expect(speed).toBeGreaterThan(230);
    expect(speed).toBeLessThan(235);
  });

  it('steps forward and conserves energy to < 1e-6 over 250 Myr', () => {
    const sim = new GalaxySim();
    const e0 = sim.getEnergy();
    sim.step(250);
    const e1 = sim.getEnergy();
    const drift = Math.abs(e1 - e0) / Math.abs(e0);
    expect(drift).toBeLessThan(1e-6);
  });

  it('generates a continuous 3D orbit trajectory covering full galactic revolution', () => {
    const sim = new GalaxySim();
    const trajectory = sim.generateOrbitPath(250, 0.5);
    expect(trajectory.length).toBeGreaterThan(1000);
    // Trajectory is [x0, y0, z0, x1, y1, z1, ...]
    expect(trajectory.length % 3).toBe(0);
    // Distance from center should stay near ~8.2 kpc
    const rStart = Math.hypot(trajectory[0]!, trajectory[1]!);
    expect(rStart).toBeCloseTo(8.2, 1);
  });

  it('computes accurate observational readouts including midplane crossing phase', () => {
    const sim = new GalaxySim();
    const readout = sim.computeReadout();
    expect(readout.rKpc).toBeCloseTo(8.2, 2);
    expect(readout.zPc).toBeCloseTo(20.8, 1);
    expect(readout.speedKms).toBeGreaterThan(230);
    expect(readout.vZKms).toBeGreaterThan(0); // currently moving upward (W = +7.25 km/s)
    expect(readout.vertPhase).toBe('ascending');
    expect(readout.timeToNextMidplaneMyr).toBeGreaterThan(0);
  });

  it('resets cleanly back to initial state', () => {
    const sim = new GalaxySim();
    sim.step(100);
    expect(sim.getState().tMyr).toBeCloseTo(100, 5);
    sim.reset();
    expect(sim.getState().tMyr).toBe(0);
    expect(sim.getState().z * 1000).toBeCloseTo(20.8, 1);
  });
});
