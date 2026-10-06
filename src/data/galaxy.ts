/** Mean obliquity of the ecliptic at J2000 (IAU 2006): 84381.406 arcsec. */
export const OBLIQUITY_J2000_RAD = ((84381.406 / 3600) * Math.PI) / 180;

/**
 * Galactic axes expressed in ICRS (Hipparcos catalogue, vol. 1, eq. 1.5.11).
 * Row 0 = toward Galactic Center (l=0,b=0), row 1 = direction of galactic rotation (l=90°),
 * row 2 = North Galactic Pole.
 */
export const GALACTIC_AXES_IN_ICRS = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
] as const;

/** Sun's peculiar motion relative to the local standard of rest (U toward GC, V rotation, W north), km/s. Schönrich+2010. */
export const SOLAR_PECULIAR_KMS = [11.1, 12.24, 7.25] as const;

/** Circular speed of the LSR, km/s. IAU 1985 value. Modern estimates range ~220-250 km/s. */
export const LSR_SPEED_KMS = 220;
