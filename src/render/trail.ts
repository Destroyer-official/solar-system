import * as THREE from 'three';

export class Trail {
  readonly line: THREE.Line;
  private readonly cap: number;
  private readonly interval: number;
  private readonly buf: Float64Array;
  private readonly attr: THREE.BufferAttribute;
  private head = 0;
  private count = 0;
  private lastT = NaN;

  constructor(capacity: number, color: string, intervalDays: number) {
    this.cap = capacity;
    this.interval = intervalDays;
    this.buf = new Float64Array(3 * capacity);
    this.attr = new THREE.BufferAttribute(new Float32Array(3 * (capacity + 1)), 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', this.attr);
    this.line = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    );
    this.line.frustumCulled = false;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.lastT = NaN;
  }

  sample(t: number, x: number, y: number, z: number): void {
    if (this.count > 0 && Math.abs(t - this.lastT) < this.interval) return;
    this.buf[3 * this.head] = x;
    this.buf[3 * this.head + 1] = y;
    this.buf[3 * this.head + 2] = z;
    this.head = (this.head + 1) % this.cap;
    this.count = Math.min(this.count + 1, this.cap);
    this.lastT = t;
  }

  /** origin = floating origin (float64). current = live body position, appended as last vertex. */
  update(o: readonly number[], c: readonly number[]): void {
    const out = this.attr.array as Float32Array;
    const start = (this.head - this.count + this.cap) % this.cap;
    let k = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = 3 * ((start + i) % this.cap);
      out[k++] = this.buf[idx]! - o[0]!;
      out[k++] = this.buf[idx + 1]! - o[1]!;
      out[k++] = this.buf[idx + 2]! - o[2]!;
    }
    out[k++] = c[0]! - o[0]!;
    out[k++] = c[1]! - o[1]!;
    out[k++] = c[2]! - o[2]!;
    this.line.geometry.setDrawRange(0, this.count + 1);
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}
