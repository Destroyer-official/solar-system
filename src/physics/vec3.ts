export type Arr = Float64Array;

export const get = (a: Arr, i: number): [number, number, number] => [
  a[3 * i]!,
  a[3 * i + 1]!,
  a[3 * i + 2]!,
];

export const set = (a: Arr, i: number, x: number, y: number, z: number): void => {
  a[3 * i] = x;
  a[3 * i + 1] = y;
  a[3 * i + 2] = z;
};

export const add = (a: Arr, i: number, x: number, y: number, z: number): void => {
  a[3 * i]! += x;
  a[3 * i + 1]! += y;
  a[3 * i + 2]! += z;
};

export const dot = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
  ax * bx + ay * by + az * bz;

export const cross = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

export const norm = (x: number, y: number, z: number) => Math.hypot(x, y, z);
