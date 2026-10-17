import { clamp, lerp, sstep, hash, noise1, dist } from "./util";

export type ThemeId =
  | "city"
  | "jungle"
  | "underwater"
  | "desert"
  | "ice"
  | "volcano"
  | "space"
  | "neon";

export const THEMES: ThemeId[] = [
  "city",
  "jungle",
  "underwater",
  "desert",
  "ice",
  "volcano",
  "space",
  "neon",
];

/** every world is five stretches of the same place */
export const LEVELS_PER_WORLD = 5;

export function worldOfLevel(i: number): number {
  return Math.floor(Math.max(0, i) / LEVELS_PER_WORLD);
}

/** the world's theme — and it lasts all five stretches */
export function themeForLevel(i: number): ThemeId {
  return THEMES[worldOfLevel(i) % THEMES.length];
}

export type Obj =
  | { kind: "stal"; x: number; y: number; len: number; w: number }
  | { kind: "spire"; x: number; tip: number; base: number; w: number }
  | { kind: "plat"; x: number; y: number; w: number; h: number; pod?: boolean }
  | { kind: "saw"; x: number; y: number; r: number; bob: number; ph: number }
  | { kind: "shield"; x: number; y: number; r: number; got: boolean }
  | { kind: "magnet"; x: number; y: number; r: number; got: boolean }
  | { kind: "coin"; x: number; y: number; got: boolean }
  | { kind: "wind"; x: number; y: number; w: number; h: number; vx: number; vy: number; strength: number }
  | { kind: "fire"; x: number; y: number; w: number; h: number }
  | { kind: "fish"; x: number; y: number; r: number; bob: number; ph: number; vx: number }
  | { kind: "drone"; x: number; y: number; r: number; bob: number; ph: number; vx: number };

export interface Chunk {
  i: number;
  x0: number;
  x1: number;
  gapA: number;
  gapB: number;
  isGap: boolean;
  objs: Obj[];
}

/** A quiet floating waymark every 250 m, generated without a finite level cap. */
export const ROUTE_START_X = 90;
export const GATE_SPACING = 250 * 50;
export const gateX = (k: number): number => ROUTE_START_X + (k + 1) * GATE_SPACING;

/** Keep the approaches to waymarks calm and free of gaps or hazards. */
function nearGate(i: number): boolean {
  const x0 = i * 480;
  const x1 = x0 + 480;
  const k = Math.max(0, Math.floor((x0 - 300) / GATE_SPACING));
  return gateX(k) < x1 + 300 || gateX(k + 1) < x1 + 300;
}

export class World {
  readonly cw = 480;
  readonly spacing = 220;
  readonly lavaBase = 610;

  level: number;
  theme: ThemeId;
  chunks = new Map<number, Chunk>();
  private pts: number[] = [150, 168];

  constructor(level = 0) {
    this.level = level;
    this.theme = themeForLevel(level);
    while (this.pts.length < 16) this.growPt();
  }

  /** how tall the corridor is in this theme, and how much the roof snakes */
  private shape(): { lo: number; hi: number; amp: number } {
    switch (this.theme) {
      case "city":
      case "neon":
        return { lo: 112, hi: 232, amp: 112 };
      case "underwater":
        return { lo: 104, hi: 220, amp: 96 };
      case "jungle":
        return { lo: 100, hi: 226, amp: 104 };
      default:
        return { lo: 104, hi: 228, amp: 106 };
    }
  }

  private growPt() {
    const i = this.pts.length;
    const prev = this.pts[i - 1];
    const sh = this.shape();
    const amp = i < 8 ? 40 : i < 16 ? sh.amp * 0.66 : sh.amp;
    const y = clamp(prev + (hash(i * 3.71 + 11.3) - 0.5) * amp, sh.lo, sh.hi);
    this.pts.push(y);
  }

  ceilY(x: number): number {
    if (x <= 0) return this.pts[0];
    const need = Math.ceil(x / this.spacing) + 4;
    while (this.pts.length < need) this.growPt();
    const f = x / this.spacing;
    const i = Math.floor(f);
    const t = sstep(f - i);
    return lerp(this.pts[i], this.pts[i + 1], t);
  }

  /** Broad, gentle swales instead of abrupt sinkholes. */
  pitDepthAt(x: number): number {
    return Math.max(0, (noise1(x * 0.00024 + 91.7) - 0.74) * 110);
  }

  /** A continuous low-poly hillside with several calm scales of variation. */
  lavaY(x: number): number {
    const broad = (noise1(x * 0.00022 + 12.4) - 0.5) * 150;
    const middle = (noise1(x * 0.00063 + 38.1) - 0.5) * 48;
    const softDip = this.pitDepthAt(x) * 0.24;
    return this.lavaBase + broad + middle + softDip;
  }

  diffAt(x: number): number {
    return clamp((this.level / 32 + x / (this.cw * 180)), 0, 1);
  }

  chunkAt(x: number): Chunk {
    return this.ensureChunk(Math.max(0, Math.floor(x / this.cw)));
  }

  ceilSolid(x: number): boolean {
    const c = this.chunkAt(x);
    return !(c.isGap && x >= c.gapA && x <= c.gapB);
  }

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
    const r = (n: number) => hash(i * 13.777 + n * 7.313 + 0.17 + this.level * 0.37);
    const t = clamp(this.level / 32 + (i - 6) / 180, 0, 1);
    const x0 = i * this.cw;
    const x1 = x0 + this.cw;
    const objs: Obj[] = [];
    const prev = this.chunks.get(i - 1);
    const prevGap = prev ? prev.isGap : false;

    const isGateChunk = nearGate(i);

    // ---- ceiling gap (open sky) ----
    let isGap = false;
    let gapA = 1;
    let gapB = 0;
    if (!isGateChunk && i > 9 && !prevGap && r(0) < 0.055 + 0.035 * t) {
      isGap = true;
      const len = (260 + r(1) * 180) * (1 + 0.2 * t);
      gapA = x0 + 50 + r(2) * 70;
      gapB = Math.min(gapA + len, x1 - 40);
    }

    // ---- platforms (more frequent to fix reachability) ----
    const plats: { x: number; y: number; w: number }[] = [];
    if (isGap) {
      const n = r(3) < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const px = lerp(gapA + 40, gapB - 40, n === 1 ? 0.5 : 0.22 + 0.56 * k);
        const py = clamp(290 + r(4 + k) * 160, 275, 460);
        plats.push({ x: px, y: py, w: 140 + r(9 + k) * 90 });
      }
    } else if (r(3) < 0.1 + 0.12 * t) {
      plats.push({
        x: x0 + 80 + r(4) * (this.cw - 160),
        y: clamp(280 + r(5) * 180, 265, 455),
        w: 130 + r(6) * 90,
      });
    }
    for (const p of plats) objs.push({ kind: "plat", x: p.x, y: p.y, w: p.w, h: 24 });

    // ---- spires ----
    const spires: number[] = [];
    const spCount =
      isGateChunk || i < 10 || isGap
        ? 0
        : r(5) < 0.04 + 0.035 * t
          ? 1
          : 0;
    for (let k = 0; k < spCount; k++) {
      const px = x0 + 80 + ((k + 0.6) / (spCount + 0.4)) * (this.cw - 160) + (r(7 + k) - 0.5) * 90;
      if (plats.some((p) => Math.abs(p.x - px) < p.w / 2 + 70)) continue;
      if (spires.some((sx) => Math.abs(sx - px) < 150)) continue;
      spires.push(px);
      const base = this.lavaY(px) + 34;
      const roof = this.ceilY(px);
      const room = base - roof;
      const hgt = Math.min(
        (150 + r(10 + k) * 150) * (0.75 + 0.45 * t),
        room - 340, // keep a flyable corridor over every tower
      );
      let tip = base - hgt;
      tip = Math.max(tip, roof + 300);
      tip = Math.min(tip, base - 120);
      objs.push({ kind: "spire", x: px, tip, base, w: 28 + r(12 + k) * 20 });
    }

    // ---- stalactites / vines / ice shards ----
    if (!isGap && i > 5 && !isGateChunk) {
      const count = i < 10 ? 0 : r(8) < 0.16 + 0.08 * t ? 1 : 0;
      for (let k = 0; k < count; k++) {
        const sx = x0 + 40 + r(20 + k * 3) * (this.cw - 80);
        if (spires.some((px) => Math.abs(px - sx) < 80)) continue;
        const len = 48 + r(21 + k * 3) * (80 + 80 * t);
        objs.push({ kind: "stal", x: sx, y: this.ceilY(sx), len, w: 13 + len * 0.15 });
      }
    }

    // Moving wildlife is a peaceful visual cue, never a lethal obstacle.
    // ---- fish (underwater) ----
    if (this.theme === "underwater") {
      if (!isGateChunk && i > 6 && r(60) < 0.1 + 0.06 * t) {
        const fx = x0 + 60 + r(61) * (this.cw - 120);
        const fy = clamp(this.ceilY(fx) + 180 + r(62) * 220, this.ceilY(fx) + 150, this.lavaY(fx) - 120);
        objs.push({ kind: "fish", x: fx, y: fy, r: 18 + r(63) * 6, bob: 6 + r(64) * 16, ph: r(65) * Math.PI * 2, vx: (r(66) > 0.5 ? 1 : -1) * (50 + r(67) * 70) });
      }
    }

    // ---- air current: at most one per chunk, never in two chunks in a row,
    // so two currents can never overlap or fight each other ----
    const prevHadWind =
      prev !== undefined && prev.objs.some((o) => o.kind === "wind");
    const wantWind =
      !isGateChunk && !prevHadWind && i > 3 && r(80) < 0.13 + 0.05 * t;
    if (wantWind) {
      const wx = x0 + this.cw * 0.5 + (r(82) - 0.5) * 110;
      // the whole band has to sit in open air: under the roof, above the street
      const roof = this.ceilY(wx) + (isGap ? 0 : 0);
      const floor = this.lavaY(wx);
      const maxH = Math.max(120, Math.min(230, (floor - roof) * 0.42));
      const hgt = 140 + r(85) * (maxH - 140 > 0 ? maxH - 140 : 10);
      const lo = roof + 70 + hgt / 2;
      const hi = floor - 150 - hgt / 2;
      if (hi > lo) {
        const wy = clamp(lo + r(83) * (hi - lo), lo, hi);
        const strength = 110 + r(87) * 110;
        const ang = -Math.PI * (0.14 + r(86) * 0.3); // always forward and up
        objs.push({
          kind: "wind",
          x: wx,
          y: wy,
          w: 190 + r(84) * 80,
          h: hgt,
          vx: Math.cos(ang) * strength,
          vy: Math.sin(ang) * strength,
          strength,
        });
      }
    }

    // ---- coins ----
    const coinRoll = r(30);
    const plat0 = plats[0];
    if (plat0 && coinRoll < 0.55) {
      // a short arc over the platform
      const n = 3;
      for (let k = 0; k < n; k++) {
        const fx = plat0.x - 40 + (k / (n - 1)) * 80;
        const fy = plat0.y - 80 - Math.sin((k / (n - 1)) * Math.PI) * 20;
        objs.push({ kind: "coin", x: fx, y: fy, got: false });
      }
    } else if (coinRoll < 0.74) {
      const cx = x0 + 130 + r(31) * (this.cw - 260);
      const lo = this.ceilY(cx) + 150;
      const hi = this.lavaY(cx) - 150;
      if (hi - lo > 60) {
        const cy = clamp(lo + r(32) * (hi - lo), lo + 20, hi - 10);
        const n = 3;
        for (let k = 0; k < n; k++) {
          const fx = cx + (k - 1) * 34;
          const fy = cy - Math.cos(((k - 1) / n) * Math.PI) * 26;
          if (spires.some((px) => Math.abs(px - fx) < 70)) continue;
          objs.push({ kind: "coin", x: fx, y: fy, got: false });
        }
      }
    }

    // ---- power-ups ----
    if (i === 7 || (i > 5 && r(44) < 0.16 + 0.05 * t))
      this.placePower(objs, spires, plats, i, "shield", 44, i === 7);
    if (i === 10 || (i > 8 && r(46) < 0.12 + 0.05 * t))
      this.placePower(objs, spires, plats, i, "magnet", 46, i === 10);

    // ---- reachability: anchor pods so a long stretch is never a dead end ----
    if (isGap || plats.length === 0) {
      const solidSpans: number[] = [];
      for (let x = x0; x <= x1; x += 24) {
        const inGap = isGap && x >= gapA && x <= gapB;
        if (!inGap) solidSpans.push(x);
      }
      for (const p of plats) solidSpans.push(p.x);
      solidSpans.sort((a, b) => a - b);
      // walk the gutter between usable anchors and drop a pod wherever it is wide
      const edges = [x0, ...solidSpans, x1];
      for (let e = 0; e < edges.length - 1; e++) {
        const a = edges[e];
        const b = edges[e + 1];
        if (b - a <= 400) continue;
        const n = Math.max(1, Math.round((b - a) / 270) - 1);
        for (let k = 0; k < n; k++) {
          const px = a + ((k + 1) * (b - a)) / (n + 1);
          const py = clamp(
            this.ceilY(px) + 165 + r(95 + k) * 130,
            this.ceilY(px) + 150,
            this.lavaY(px) - 210,
          );
          if (spires.some((sx2) => Math.abs(sx2 - px) < 90)) continue;
          objs.push({ kind: "plat", x: px, y: py, w: 96 + r(96 + k) * 46, h: 20, pod: true });
        }
      }
    }
    return { i, x0, x1, gapA, gapB, isGap, objs };
  }

  private placePower(
    objs: Obj[],
    spires: number[],
    plats: { x: number; y: number; w: number }[],
    i: number,
    kind: "shield" | "magnet",
    seed: number,
    force: boolean,
  ) {
    const x0 = i * this.cw;
    const rr = (n: number) => hash(i * 5.19 + seed * 7.77 + n * 3.13);
    const attempts = force ? 10 : 2;
    for (let a = 0; a < attempts; a++) {
      let px: number;
      let py: number;
      const p0 = plats[a % Math.max(1, plats.length)];
      if (p0 && rr(1 + a * 7) < 0.45) {
        px = p0.x + (rr(8 + a) - 0.5) * 60;
        py = p0.y - 95;
      } else if (force) {
        px = x0 + 60 + (a + 0.5) * ((this.cw - 120) / attempts);
        px += (rr(2 + a) - 0.5) * 30;
        const lo = this.ceilY(px) + 150;
        const hi = this.lavaY(px) - 150;
        if (hi - lo <= 60) continue;
        py = clamp(lo + rr(3 + a) * (hi - lo), lo, hi);
      } else {
        px = x0 + 90 + rr(2 + a) * (this.cw - 180);
        const lo = this.ceilY(px) + 150;
        const hi = this.lavaY(px) - 150;
        if (hi - lo <= 60) continue;
        py = clamp(lo + rr(3 + a) * (hi - lo), lo, hi);
      }
      if (spires.some((sx) => Math.abs(sx - px) < (force ? 100 : 120))) continue;
      if (
        !force &&
        objs.some(
          (o) =>
            (o.kind === "shield" || o.kind === "magnet") &&
            Math.abs(o.x - px) < 110 &&
            Math.abs(o.y - py) < 120,
        )
      )
        continue;
      if (
        force &&
        objs.some(
          (o) =>
            (o.kind === "shield" || o.kind === "magnet") &&
            Math.abs(o.x - px) < 60 &&
            Math.abs(o.y - py) < 70,
        )
      )
        continue;
      objs.push({ kind, x: px, y: py, r: 17, got: false });
      return;
    }
  }

  eachNear(x: number, cb: (o: Obj, ci: number) => void) {
    const i = Math.max(0, Math.floor(x / this.cw));
    for (let k = Math.max(0, i - 1); k <= i + 1; k++) {
      const c = this.chunks.get(k);
      if (!c) continue;
      for (const o of c.objs) cb(o, k);
    }
  }

  /** is there something lethal within r of this point? (used by the auto-aim) */
  hazardNear(x: number, y: number, r: number, time: number): boolean {
    let hit = false;
    this.eachNear(x, (o) => {
      if (hit) return;
      switch (o.kind) {
        case "spire": {
          if (y > o.tip - r && y < o.base + 40) {
            const t = clamp((y - o.tip) / Math.max(1, o.base - o.tip), 0, 1);
            const hw = lerp(5, o.w / 2, t);
            if (Math.abs(x - o.x) < hw + r) hit = true;
          }
          break;
        }
        case "stal": {
          for (let k = 0; k < 3; k++) {
            const f = (k + 1) / 3.4;
            const cy = o.y + o.len * f;
            const cr = o.w * (1 - f) * 0.8 + 3;
            if (dist(x, y, o.x, cy) < cr + r) hit = true;
          }
          break;
        }
        case "saw": {
          const sy = o.y + Math.sin(time * 1.3 + o.ph) * o.bob;
          if (dist(x, y, o.x, sy) < o.r + r) hit = true;
          break;
        }
        case "drone": {
          const dx2 = o.x + Math.sin(time * 0.7 + o.ph) * 78;
          const dy2 = o.y + Math.sin(time * 1.4 + o.ph) * o.bob;
          if (dist(x, y, dx2, dy2) < o.r + r) hit = true;
          break;
        }
        case "fire": {
          if (Math.abs(x - o.x) < o.w / 2 + r && y > o.y - o.h - r && y < o.y + r) hit = true;
          break;
        }
      }
    });
    return hit;
  }

  solidAt(x: number, y: number): boolean {
    if (this.ceilSolid(x) && y < this.ceilY(x)) return true;
    let hit = false;
    this.eachNear(x, (o) => {
      if (hit) return;
      if (o.kind === "plat") {
        if (Math.abs(x - o.x) < o.w / 2 + 2 && Math.abs(y - o.y) < o.h / 2 + 2) hit = true;
      } else if (o.kind === "spire") {
        if (y > o.tip && y < o.base + 60) {
          const t = clamp((y - o.tip) / Math.max(1, o.base - o.tip), 0, 1);
          const hw = lerp(5, o.w / 2, t);
          if (Math.abs(x - o.x) < hw + 2) hit = true;
        }
      } else if (o.kind === "fire") {
        if (Math.abs(x - o.x) < o.w / 2 + 2 && y < o.y + 4 && y > o.y - o.h - 6) hit = true;
      }
    });
    return hit;
  }

  raycast(x: number, y: number, dx: number, dy: number, maxLen: number): { x: number; y: number } | null {
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
