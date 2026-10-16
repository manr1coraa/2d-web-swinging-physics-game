import { clamp, lerp, sstep, hash, noise1 } from "./util";

export type Obj =
  | { kind: "stal"; x: number; y: number; len: number; w: number }
  | { kind: "spire"; x: number; tip: number; base: number; w: number }
  | { kind: "plat"; x: number; y: number; w: number; h: number }
  | { kind: "saw"; x: number; y: number; r: number; bob: number; ph: number }
  | { kind: "coin"; x: number; y: number; got: boolean };

export interface Chunk {
  i: number;
  x0: number;
  x1: number;
  gapA: number; // ceiling gap (open sky) start
  gapB: number; // end; gapA > gapB means "no gap"
  isGap: boolean;
  objs: Obj[];
}

export class World {
  readonly cw = 480; // chunk width
  readonly spacing = 220; // ceiling control point spacing
  readonly lavaBase = 610;

  chunks = new Map<number, Chunk>();
  private pts: number[] = [150, 168]; // ceiling heights

  constructor() {
    while (this.pts.length < 16) this.growPt();
  }

  private growPt() {
    const i = this.pts.length;
    const prev = this.pts[i - 1];
    // the opening stretch is an almost flat runway — easy to read and swing
    const amp = i < 8 ? 44 : i < 16 ? 95 : 150;
    const y = clamp(prev + (hash(i * 3.71 + 11.3) - 0.5) * amp, 92, 258);
    this.pts.push(y);
  }

  /** ceiling surface height at world x */
  ceilY(x: number): number {
    if (x <= 0) return this.pts[0];
    const need = Math.ceil(x / this.spacing) + 4;
    while (this.pts.length < need) this.growPt();
    const f = x / this.spacing;
    const i = Math.floor(f);
    const t = sstep(f - i);
    return lerp(this.pts[i], this.pts[i + 1], t);
  }

  /** street surface height at world x */
  lavaY(x: number): number {
    // the avenue sits much deeper at the start, so the opening corridor is
    // wide and very hard to fall out of
    const open = clamp(1 - x / 9000, 0, 1);
    return this.lavaBase + 190 * open + noise1(x * 0.0016 + 40.7) * 84;
  }

  /** difficulty 0..1 by distance */
  diffAt(x: number): number {
    return clamp((x / this.cw - 10) / 60, 0, 1);
  }

  chunkAt(x: number): Chunk {
    return this.ensureChunk(Math.max(0, Math.floor(x / this.cw)));
  }

  ceilSolid(x: number): boolean {
    const c = this.chunkAt(x);
    return !(c.isGap && x >= c.gapA && x <= c.gapB);
  }

  /** generate chunks around x, prune far ones */
  ensure(aheadX: number) {
    const i0 = Math.max(0, Math.floor(aheadX / this.cw));
    for (let i = Math.max(0, i0 - 3); i <= i0 + 7; i++) this.ensureChunk(i);
    for (const k of Array.from(this.chunks.keys())) {
      if (k < i0 - 5 || k > i0 + 9) this.chunks.delete(k);
    }
  }

  private ensureChunk(i: number): Chunk {
    let c = this.chunks.get(i);
    if (!c) {
      c = this.gen(i);
      this.chunks.set(i, c);
    }
    return c;
  }

  private gen(i: number): Chunk {
    const r = (n: number) => hash(i * 13.777 + n * 7.313 + 0.17);
    const t = clamp((i - 10) / 60, 0, 1); // difficulty — ramps late and slowly
    const x0 = i * this.cw;
    const x1 = x0 + this.cw;
    const objs: Obj[] = [];
    const prev = this.chunks.get(i - 1);
    const prevGap = prev ? prev.isGap : false;

    // ---- ceiling gap (open sky) ----
    let isGap = false;
    let gapA = 1;
    let gapB = 0;
    if (i > 13 && !prevGap && r(0) < 0.14 + 0.12 * t) {
      isGap = true;
      const len = (300 + r(1) * 210) * (1 + 0.25 * t);
      gapA = x0 + 50 + r(2) * 70;
      gapB = Math.min(gapA + len, x1 - 40);
    }

    // ---- platforms (friendly, attachable) ----
    const plats: { x: number; y: number; w: number }[] = [];
    if (isGap) {
      const n = r(3) < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const px = lerp(gapA + 40, gapB - 40, n === 1 ? 0.5 : 0.22 + 0.56 * k);
        const py = clamp(300 + r(4 + k) * 170, 285, 470);
        plats.push({ x: px, y: py, w: 130 + r(9 + k) * 90 });
      }
    } else if (r(3) < 0.1 + 0.16 * t) {
      plats.push({
        x: x0 + 90 + r(4) * (this.cw - 180),
        y: clamp(280 + r(5) * 190, 265, 460),
        w: 120 + r(6) * 90,
      });
    }
    for (const p of plats)
      objs.push({ kind: "plat", x: p.x, y: p.y, w: p.w, h: 24 });

    // ---- spires (deadly pillars rising from lava) ----
    const spires: number[] = [];
    const spCount =
      i < 12
        ? 0
        : isGap
          ? r(5) < 0.3
            ? 1
            : 0
          : r(5) < 0.3 + 0.4 * t
            ? r(6) < 0.12 + 0.45 * t
              ? 2
              : 1
            : 0;
    for (let k = 0; k < spCount; k++) {
      const px = x0 + 80 + ((k + 0.6) / (spCount + 0.4)) * (this.cw - 160) + (r(7 + k) - 0.5) * 90;
      if (plats.some((p) => Math.abs(p.x - px) < p.w / 2 + 70)) continue;
      if (spires.some((sx) => Math.abs(sx - px) < 150)) continue;
      spires.push(px);
      const base = this.lavaY(px) + 34;
      const hgt = (170 + r(10 + k) * 170) * (0.75 + 0.5 * t);
      let tip = base - hgt;
      if (this.ceilSolidX(i, px)) tip = Math.max(tip, this.ceilY(px) + 145);
      tip = Math.min(tip, base - 120);
      objs.push({ kind: "spire", x: px, tip, base, w: 30 + r(12 + k) * 22 });
    }

    // ---- stalactites (deadly spikes from ceiling) ----
    if (!isGap && i > 7) {
      // a lone girder shows up early as a gentle warm-up, then it ramps
      const count =
        i < 12 ? (r(8) < 0.55 ? 1 : 0) : Math.floor(r(8) * (0.9 + 2.6 * t) + t * 1.3);
      for (let k = 0; k < count; k++) {
        const sx = x0 + 40 + r(20 + k * 3) * (this.cw - 80);
        if (spires.some((px) => Math.abs(px - sx) < 80)) continue;
        const len = 52 + r(21 + k * 3) * (85 + 85 * t);
        objs.push({
          kind: "stal",
          x: sx,
          y: this.ceilY(sx),
          len,
          w: 14 + len * 0.16,
        });
      }
    }

    // ---- saws (floating deadly discs) ----
    if (i > 16 && r(9) < 0.1 + 0.32 * t) {
      const sx = x0 + 90 + r(22) * (this.cw - 180);
      if (!spires.some((px) => Math.abs(px - sx) < 110)) {
        const cy = clamp(
          this.ceilY(sx) + 150 + r(23) * 200,
          this.ceilY(sx) + 130,
          this.lavaY(sx) - 140,
        );
        objs.push({
          kind: "saw",
          x: sx,
          y: cy,
          r: 24 + r(24) * 8,
          bob: 8 + r(25) * 30 * t,
          ph: r(26) * Math.PI * 2,
        });
      }
    }

    // ---- coins (guide the ideal line) ----
    const coinRoll = r(30);
    const plat0 = plats[0];
    if (plat0 && coinRoll < 0.75) {
      // arc above platform
      const n = 4;
      for (let k = 0; k < n; k++) {
        const fx = plat0.x - 66 + (k / (n - 1)) * 132;
        const fy = plat0.y - 84 - Math.sin((k / (n - 1)) * Math.PI) * 26;
        objs.push({ kind: "coin", x: fx, y: fy, got: false });
      }
    }

    return { i, x0, x1, gapA, gapB, isGap, objs };
  }

  private ceilSolidX(chunkI: number, x: number): boolean {
    const c = this.chunks.get(chunkI);
    if (!c) return true;
    return !(c.isGap && x >= c.gapA && x <= c.gapB);
  }

  /** iterate objects in chunks near x */
  eachNear(x: number, cb: (o: Obj, ci: number) => void) {
    const i = Math.max(0, Math.floor(x / this.cw));
    for (let k = Math.max(0, i - 1); k <= i + 1; k++) {
      const c = this.chunks.get(k);
      if (!c) continue;
      for (const o of c.objs) cb(o, k);
    }
  }

  /** is point inside a webbable solid (ceiling / platform / spire) */
  solidAt(x: number, y: number): boolean {
    if (this.ceilSolid(x) && y < this.ceilY(x)) return true;
    let hit = false;
    this.eachNear(x, (o) => {
      if (hit) return;
      if (o.kind === "plat") {
        if (
          Math.abs(x - o.x) < o.w / 2 + 2 &&
          Math.abs(y - o.y) < o.h / 2 + 2
        )
          hit = true;
      } else if (o.kind === "spire") {
        if (y > o.tip && y < o.base + 60) {
          const t = clamp((y - o.tip) / Math.max(1, o.base - o.tip), 0, 1);
          const hw = lerp(5, o.w / 2, t);
          if (Math.abs(x - o.x) < hw + 2) hit = true;
        }
      }
    });
    return hit;
  }

  /** march a ray until it hits a solid; returns anchor point or null */
  raycast(
    x: number,
    y: number,
    dx: number,
    dy: number,
    maxLen: number,
  ): { x: number; y: number } | null {
    const step = 5;
    for (let d = 26; d <= maxLen; d += step) {
      const px = x + dx * d;
      const py = y + dy * d;
      if (this.solidAt(px, py)) {
        return { x: x + dx * (d - 3), y: y + dy * (d - 3) };
      }
    }
    return null;
  }
}
