import type { SystemState } from '@/physics/types';

/**
 * Ring buffer of inertial snapshots (all bodies, float64).
 * Time must be monotonic between clear() calls. Flip direction => clear().
 */
export class History {
  readonly bodies: number;
  readonly cap: number;
  readonly intervalDays: number;
  private readonly t: Float64Array;
  private readonly pos: Float64Array;
  private head = 0;
  private n_ = 0;
  private lastT = NaN;

  constructor(bodies: number, cap: number, intervalDays: number) {
    this.bodies = bodies;
    this.cap = cap;
    this.intervalDays = intervalDays;
    this.t = new Float64Array(cap);
    this.pos = new Float64Array(cap * 3 * bodies);
  }
  get count(): number {
    return this.n_;
  }
  get positions(): Float64Array {
    return this.pos;
  }

  clear(): void {
    this.head = 0;
    this.n_ = 0;
    this.lastT = NaN;
  }

  sample(s: SystemState): void {
    if (this.n_ > 0 && Math.abs(s.t - this.lastT) < this.intervalDays) return;
    this.pushRaw(s.t, s.pos, 0);
  }

  /** Append one snapshot without interval filtering (the worker already filtered). */
  pushRaw(t: number, src: Float64Array, offset: number): void {
    this.t[this.head] = t;
    this.pos.set(src.subarray(offset, offset + 3 * this.bodies), this.head * 3 * this.bodies);
    this.head = (this.head + 1) % this.cap;
    this.n_ = Math.min(this.n_ + 1, this.cap);
    this.lastT = t;
  }

  private slot(k: number): number {
    return (this.head - this.n_ + k + this.cap) % this.cap;
  }
  /** k = 0 is the oldest sample, count-1 the newest. */
  timeAt(k: number): number {
    return this.t[this.slot(k)]!;
  }
  baseAt(k: number): number {
    return this.slot(k) * 3 * this.bodies;
  }
}
