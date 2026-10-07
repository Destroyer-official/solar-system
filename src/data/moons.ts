export const MOON_DATA: Record<string, Array<{name: string; a_km: number; period_days: number; inc_deg: number}>> = {
  earth: [
    { name: 'Moon', a_km: 384400, period_days: 27.322, inc_deg: 5.145 },
  ],
  mars: [
    { name: 'Phobos', a_km: 9375, period_days: 0.3187, inc_deg: 1.1 },
    { name: 'Deimos', a_km: 23457, period_days: 1.2625, inc_deg: 1.8 },
  ],
  jupiter: [
    { name: 'Io', a_km: 421800, period_days: 1.762732, inc_deg: 0.0 },
    { name: 'Europa', a_km: 671100, period_days: 3.525463, inc_deg: 0.5 },
    { name: 'Ganymede', a_km: 1070400, period_days: 7.155588, inc_deg: 0.2 },
    { name: 'Callisto', a_km: 1882700, period_days: 16.690440, inc_deg: 0.3 },
  ],
  saturn: [
    { name: 'Mimas', a_km: 185540, period_days: 0.942422, inc_deg: 1.56 },
    { name: 'Enceladus', a_km: 238200, period_days: 1.370218, inc_deg: 0.03 },
    { name: 'Tethys', a_km: 294992, period_days: 1.887802, inc_deg: 1.10 },
    { name: 'Dione', a_km: 377654, period_days: 2.736916, inc_deg: 0.0 },
    { name: 'Rhea', a_km: 527367, period_days: 4.517503, inc_deg: 0.35 },
    { name: 'Titan', a_km: 1221870, period_days: 15.945, inc_deg: 0.0 },
    { name: 'Iapetus', a_km: 3560820, period_days: 79.322, inc_deg: 8.05 },
  ],
  uranus: [
    { name: 'Miranda', a_km: 129390, period_days: 1.413539, inc_deg: 4.237 },
    { name: 'Ariel', a_km: 190945, period_days: 2.520379, inc_deg: 0.024 },
    { name: 'Umbriel', a_km: 265998, period_days: 4.144176, inc_deg: 0.133 },
    { name: 'Titania', a_km: 436300, period_days: 8.705586, inc_deg: 0.147 },
    { name: 'Oberon', a_km: 583519, period_days: 13.461638, inc_deg: 0.066 },
  ],
  neptune: [
    { name: 'Triton', a_km: 354759, period_days: 5.876850, inc_deg: 156.3 },
    { name: 'Nereid', a_km: 5513410, period_days: 360.135, inc_deg: 7.468 },
  ],
};

export function moonPeriod(name: string, planet: string): number {
  const moons = MOON_DATA[planet] ?? [];
  const m = moons.find((x) => x.name === name);
  return m?.period_days ?? 0;
}

export function moonSemiMajorAxis(name: string, planet: string): number {
  const moons = MOON_DATA[planet] ?? [];
  const m = moons.find((x) => x.name === name);
  return m?.a_km ?? 0;
}

export function moonInclination(name: string, planet: string): number {
  const moons = MOON_DATA[planet] ?? [];
  const m = moons.find((x) => x.name === name);
  return m?.inc_deg ?? 0;
}