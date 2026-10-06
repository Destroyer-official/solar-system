import { describe, it, expect } from 'vitest';
import { ALL_BODIES, buildModel, PHYSICAL_MAP } from '@/sim/registry';
import { AU_KM } from '@/data/constants';
import { stateToElements } from '@/physics/kepler';
import type { Vec3 } from '@/physics/types';

describe('Pluto-Charon System (Phase 6.2)', () => {
  it('Pluto-Charon barycenter lies outside Pluto physical surface', () => {
    const sub = ALL_BODIES.filter((b) => ['pluto', 'charon'].includes(b.id));
    const model = buildModel(sub, PHYSICAL_MAP);
    const plutoSys = model.localSystems.find((s) => s.hostId === 'pluto')!;

    // Pluto local position = -c (distance of Pluto center from system barycenter)
    const pPos = plutoSys.initialState.pos;
    const distBaryAu = Math.hypot(pPos[0]!, pPos[1]!, pPos[2]!);
    const distBaryKm = distBaryAu * AU_KM;

    const plutoRadiusKm = 1188.3;
    console.log(`Pluto center to Pluto-Charon barycenter: ${distBaryKm.toFixed(1)} km (Pluto radius: ${plutoRadiusKm} km)`);

    // The barycenter lies outside Pluto: offset > 1188.3 km (typically ~2,000-2,100 km)
    expect(distBaryKm).toBeGreaterThan(plutoRadiusKm);
  });

  it('Charon orbital period is approximately 6.387 days', () => {
    const sub = ALL_BODIES.filter((b) => ['pluto', 'charon'].includes(b.id));
    const model = buildModel(sub, PHYSICAL_MAP);
    const plutoSys = model.localSystems.find((s) => s.hostId === 'pluto')!;
    const ls = plutoSys.initialState;

    const r: Vec3 = [ls.pos[3]! - ls.pos[0]!, ls.pos[4]! - ls.pos[1]!, ls.pos[5]! - ls.pos[2]!];
    const v: Vec3 = [ls.vel[3]! - ls.vel[0]!, ls.vel[4]! - ls.vel[1]!, ls.vel[5]! - ls.vel[2]!];
    const mu = ls.gm[0]! + ls.gm[1]!;
    const el = stateToElements(mu, r, v);

    console.log(`Charon osculating orbital period: ${el.period.toFixed(4)} days`);
    expect(Math.abs(el.period - 6.387) / 6.387).toBeLessThan(0.01); // within 1%
  });
});
