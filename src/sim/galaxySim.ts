import {
  GalacticPotential,
  type GalacticOrbitState,
} from '@/physics/galacticPotential';

export interface GalaxyReadout {
  tMyr: number;
  rKpc: number;
  zPc: number;
  speedKms: number;
  vRadialKms: number;
  vAzimuthalKms: number;
  vZKms: number;
  phiDeg: number;
  energyDrift: number;
  angMomDrift: number;
  vertPhase: 'ascending' | 'descending';
  timeToNextMidplaneMyr: number;
}

export class GalaxySim {
  readonly pot: GalacticPotential;
  private state: GalacticOrbitState;
  private readonly e0: number;
  private readonly lz0: number;

  constructor(pot?: GalacticPotential) {
    this.pot = pot ?? new GalacticPotential();
    this.state = this.pot.getInitialSunState();
    this.e0 = this.pot.getEnergy(this.state);
    this.lz0 = this.pot.getLz(this.state);
  }

  getState(): Readonly<GalacticOrbitState> {
    return this.state;
  }

  getEnergy(): number {
    return this.pot.getEnergy(this.state);
  }

  getLz(): number {
    return this.pot.getLz(this.state);
  }

  reset(): void {
    this.state = this.pot.getInitialSunState();
  }

  step(dtMyr: number): void {
    if (dtMyr === 0) return;
    const sign = dtMyr > 0 ? 1 : -1;
    const absDt = Math.abs(dtMyr);
    const subDt = 0.05; // 50,000 yr sub-steps ensures < 1e-7 symplectic energy conservation
    const steps = Math.floor(absDt / subDt);
    const rem = absDt - steps * subDt;

    for (let i = 0; i < steps; i++) {
      this.pot.step(this.state, sign * subDt);
    }
    if (rem > 1e-6) {
      this.pot.step(this.state, sign * rem);
    }
  }

  /**
   * Generates a pre-computed 3D trajectory array [x0, y0, z0, x1, y1, z1, ...]
   * for Three.js rendering over a given duration.
   */
  generateOrbitPath(durationMyr = 250, stepMyr = 0.5): Float32Array {
    const s: GalacticOrbitState = this.pot.getInitialSunState();
    const count = Math.ceil(durationMyr / stepMyr) + 1;
    const out = new Float32Array(count * 3);

    out[0] = s.x;
    out[1] = s.y;
    out[2] = s.z;

    for (let i = 1; i < count; i++) {
      this.pot.step(s, stepMyr);
      const idx = i * 3;
      out[idx] = s.x;
      out[idx + 1] = s.y;
      out[idx + 2] = s.z;
    }
    return out;
  }

  computeReadout(): GalaxyReadout {
    const s = this.state;
    const rKpc = Math.hypot(s.x, s.y);
    const zPc = s.z * 1000;
    const speedKms = Math.hypot(s.vx, s.vy, s.vz);

    // Cylindrical velocities
    const vRadialKms = (s.x * s.vx + s.y * s.vy) / (rKpc || 1);
    const vAzimuthalKms = (s.x * s.vy - s.y * s.vx) / (rKpc || 1);
    const vZKms = s.vz;

    let phiDeg = (Math.atan2(s.y, s.x) * 180) / Math.PI;
    if (phiDeg < 0) phiDeg += 360;

    const e = this.pot.getEnergy(s);
    const energyDrift = Math.abs(e - this.e0) / Math.abs(this.e0);

    const lz = this.pot.getLz(s);
    const angMomDrift = Math.abs(lz - this.lz0) / (Math.abs(this.lz0) || 1);

    const vertPhase: 'ascending' | 'descending' = s.vz >= 0 ? 'ascending' : 'descending';

    // Calculate time to next midplane crossing
    let timeToNextMidplaneMyr = 0;
    const clone: GalacticOrbitState = { ...s };
    const lookaheadDt = 0.2;
    const prevZ = clone.z;
    for (let i = 0; i < 500; i++) {
      this.pot.step(clone, lookaheadDt);
      timeToNextMidplaneMyr += lookaheadDt;
      if ((prevZ > 0 && clone.z <= 0) || (prevZ < 0 && clone.z >= 0)) {
        break;
      }
    }

    return {
      tMyr: s.tMyr,
      rKpc,
      zPc,
      speedKms,
      vRadialKms,
      vAzimuthalKms,
      vZKms,
      phiDeg,
      energyDrift,
      angMomDrift,
      vertPhase,
      timeToNextMidplaneMyr,
    };
  }
}
