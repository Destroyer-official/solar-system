import type { SystemState } from '@/physics/types';

export class Recorder {
  readonly stride: number;
  private readonly buf: Float64Array;
  private readonly cap: number;
  private readonly interval: number;
  private used = 0;
  private lastT = NaN;

  constructor(bodies: number, intervalDays: number, capacity: number) {
    this.stride = 1 + 3 * bodies;
    this.cap = capacity;
    this.interval = intervalDays;
    this.buf = new Float64Array(capacity * this.stride);
  }

  reset(): void {
    this.used = 0;
    this.lastT = NaN;
  }

  sample(s: SystemState): void {
    if (this.used >= this.cap) return;
    if (!Number.isNaN(this.lastT) && Math.abs(s.t - this.lastT) < this.interval) return;
    const o = this.used * this.stride;
    this.buf[o] = s.t;
    this.buf.set(s.pos, o + 1);
    this.used++;
    this.lastT = s.t;
  }

  /** Returns a fresh copy (safe to transfer) and empties the buffer. lastT persists across drains. */
  drain(): Float64Array {
    const out = this.buf.slice(0, this.used * this.stride);
    this.used = 0;
    return out;
  }
}
