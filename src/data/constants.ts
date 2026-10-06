/** Exact by IAU 2012 definition */
export const AU_KM = 149_597_870.7;
export const DAY_S = 86_400;

/** Sun GM from JPL DE440, km^3/s^2 */
export const GM_SUN_KM3_S2 = 132_712_440_041.279419;

/** Convert GM from km^3/s^2 to AU^3/day^2 (the engine's internal unit). */
export function gmToInternal(gmKm3S2: number): number {
  return (gmKm3S2 * DAY_S * DAY_S) / AU_KM ** 3;
}

export const kmToAu = (km: number) => km / AU_KM;
export const kmsToAuDay = (kms: number) => (kms * DAY_S) / AU_KM;
export const auDayToKms = (v: number) => (v * AU_KM) / DAY_S;

/** Julian date of J2000.0 epoch */
export const JD_J2000 = 2451545.0;

/** Julian date of 1970-01-01T00:00:00Z */
export const JD_UNIX_EPOCH = 2440587.5;

/** Treats JD as UTC. Real TDB-UTC is ~69 s in 2026, irrelevant for display. */
export const jdToDate = (jd: number): Date => new Date((jd - JD_UNIX_EPOCH) * DAY_S * 1000);
export const dateToJd = (d: Date): number => d.getTime() / (DAY_S * 1000) + JD_UNIX_EPOCH;
