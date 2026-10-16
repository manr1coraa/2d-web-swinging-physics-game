export const clamp = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const sstep = (t: number): number => t * t * (3 - 2 * t);

/** deterministic pseudo random 0..1 from a number */
export const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/** smooth 1D value noise */
export const noise1 = (x: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i), hash(i + 1), sstep(f));
};

export const dist = (x0: number, y0: number, x1: number, y1: number): number =>
  Math.hypot(x1 - x0, y1 - y0);

export const wrap = (v: number, n: number): number => ((v % n) + n) % n;
