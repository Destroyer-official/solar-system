import { describe, it, expect } from 'vitest';
import { loadSystem, ALL_BODIES, MOON_BODIES } from '@/sim/registry';
import { computeBodyFacts } from '@/sim/facts';

describe('Moons Physical Elements and Real-Time Telemetry', () => {
  const model = loadSystem(ALL_BODIES);

  it('all 22 moons have valid physical rotational elements and NASA facts', () => {
    for (const moon of MOON_BODIES) {
      const phys = model.physicalMap[moon.id];
      expect(phys, `Moon ${moon.id} should have physical JSON data`).toBeDefined();
      expect(phys?.rotation, `Moon ${moon.id} should have rotational elements`).toBeDefined();
      expect(phys?.rotation?.wRateDegPerDay).toBeTypeOf('number');
      expect(phys?.facts, `Moon ${moon.id} should have facts dictionary`).toBeDefined();
      expect(Object.keys(phys?.facts ?? {}).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('Earth Moon computeBodyFacts reports host-relative orbital parameters', () => {
    const facts = computeBodyFacts('moon', model.state, model);
    expect(facts).not.toBeNull();
    expect(facts?.isMoon).toBe(true);
    expect(facts?.parentName).toBe('Earth');
    expect(facts?.distParentKm).toBeGreaterThan(350_000);
    expect(facts?.distParentKm).toBeLessThan(410_000);
    expect(facts?.elements.period).toBeCloseTo(27.32, 0);
  });

  it('Jupiter Galilean moons computeBodyFacts report accurate periods in Laplace resonance', () => {
    const io = computeBodyFacts('io', model.state, model);
    const europa = computeBodyFacts('europa', model.state, model);
    const ganymede = computeBodyFacts('ganymede', model.state, model);
    const callisto = computeBodyFacts('callisto', model.state, model);

    expect(io?.parentName).toBe('Jupiter');
    expect(io?.elements.period).toBeCloseTo(1.77, 1);

    expect(europa?.parentName).toBe('Jupiter');
    expect(europa?.elements.period).toBeCloseTo(3.55, 1);

    expect(ganymede?.parentName).toBe('Jupiter');
    expect(ganymede?.elements.period).toBeCloseTo(7.15, 1);

    expect(callisto?.parentName).toBe('Jupiter');
    expect(callisto?.elements.period).toBeCloseTo(16.7, 0);
  });

  it('Saturn Titan and Enceladus computeBodyFacts report accurate host-relative orbits', () => {
    const titan = computeBodyFacts('titan', model.state, model);
    const enceladus = computeBodyFacts('enceladus', model.state, model);

    expect(titan?.parentName).toBe('Saturn');
    expect(titan?.elements.period).toBeCloseTo(15.95, 1);

    expect(enceladus?.parentName).toBe('Saturn');
    expect(enceladus?.elements.period).toBeCloseTo(1.37, 1);
  });

  it('Neptune Triton and Pluto Charon computeBodyFacts report accurate orbits', () => {
    const triton = computeBodyFacts('triton', model.state, model);
    const charon = computeBodyFacts('charon', model.state, model);

    expect(triton?.parentName).toBe('Neptune');
    expect(triton?.elements.period).toBeCloseTo(5.88, 1);

    expect(charon?.parentName).toBe('Pluto');
    expect(charon?.elements.period).toBeCloseTo(6.39, 1);
  });
});
