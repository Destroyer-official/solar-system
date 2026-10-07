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

/** Circular speed of the LSR, km/s. IAU 1985 value. */
export const LSR_SPEED_KMS = 220;

export interface GalaxyModel {
  readonly id: string;
  readonly label: string;
  readonly lsrKms: number;
  readonly source: string;
}

export const GALAXY_MODELS: readonly GalaxyModel[] = [
  {
    id: 'iau1985',
    label: 'IAU 1985 (220 km/s)',
    lsrKms: 220,
    source: 'IAU 1985 standard recommendation',
  },
  {
    id: 'sofue2016',
    label: 'Sofue 2016 / VERA (238 km/s)',
    lsrKms: 238,
    source: 'Yoshiaki Sofue 2016 (Caltech/IPAC NED Level 5 Review, VERA trigonometric astrometry)',
  },
  {
    id: 'reid2019',
    label: 'Reid et al. 2019 (~236 km/s)',
    lsrKms: 236,
    source: 'Reid et al. 2019 (ApJ 885:131, trigonometric maser parallax)',
  },
  {
    id: 'gravity2021',
    label: 'GRAVITY 2021 (~240 km/s)',
    lsrKms: 240,
    source: 'GRAVITY Collaboration 2021 (A&A 647:A59, Sgr A* orbit & LSR fit)',
  },
] as const;

export const DEFAULT_GALAXY_MODEL: GalaxyModel = GALAXY_MODELS[0]!;

/**
 * Solar motion relative to the Cosmic Microwave Background (CMB) rest frame.
 * Values from Planck 2018 / 2020 results (Aghanim et al. 2020, A&A 641:A1).
 */
export const CMB_DIPOLE_SPEED_KMS = 369.82; // ± 0.11 km/s
export const CMB_DIPOLE_L_DEG = 264.021; // ± 0.011 deg galactic longitude
export const CMB_DIPOLE_B_DEG = 48.253; // ± 0.005 deg galactic latitude
export const CMB_DIPOLE_SOURCE = 'Planck Collaboration 2020 (A&A 641:A1, CMB dipole)';
