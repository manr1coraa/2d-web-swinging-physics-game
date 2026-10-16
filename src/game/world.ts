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

export function themeForLevel(i: number): ThemeId {
  return THEMES[i % THEMES.length];
}

export type Obj =
  | { kind: "stal"; x: number; y: number; len: number; w: number }
  | { kind: "spire"; x: number; tip: number; base: number; w: number }
  | { kind: "plat"; x: number; y: number; w: number; h: number; pod?: boolean }
  | { kind: "saw"; x: number; y: number; r: number; bob: number; ph: number }
  | { kind: "boost"; x: number; y: number; r: number; used: boolean }
  | { kind: "shield"; x: number; y: number; r: number; got: boolean }
  | { kind: "magnet"; x: number; y: number; r: number; got: boolean }
  | { kind: "coin"; x: number; y: number; got: boolean }
  | { kind: "wind"; x: number; y: number; w: number; h: number; vx: number; vy: number; strength: number }
  | { kind: "fire"; x: number; y: number; w: number; h: number }
  | { kind: "fish"; x: number; y: number; r: number; bob: number; ph: number; vx: number }
  | { kind: "drone"; x: number; y: number; r: number; bob: number; ph: number; vx: number }
  | { kind: "portal"; x: number; y: number; r: number; used: boolean }
  | { kind: "dip"; x: number; y: number; w: number; depth: number };

export interface Chunk {
  i: number;
  x0: number;
  x1: number;
  gapA: number;
  gapB: number;
  isGap: boolean;
  objs: Obj[];
}

/** every level ends at a floor gate; they repeat every 250 m so a miss is not fatal */
export const GATE_SPACING = 250 * 50; // 250 m in px
export const GATE_COUNT = 40;
export const gateX = (k: number): number => (k + 1) * GATE_SPACING;

/** which gate (if any) sits inside this chunk, and is this chunk part of the run-up? */
function gateInChunk(i: number): number | null {
  const x0 = i * 480;
  const x1 = x0 + 480;
  for (let k = 0; k < GATE_COUNT; k++) {
    const gx = gateX(k);
    if (gx >= x0 && gx < x1) return gx;
  }
  return null;
}

function nearGate(i: number): boolean {
  const x0 = i * 480;
  const x1 = x0 + 480;
  for (let k = 0; k < GATE_COUNT; k++) {
    const gx = gateX(k);
    if (gx > x0 - 300 && gx < x1 + 300) return true;
  }
  return false;
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

  private growPt() {
    const i = this.pts.length;
    const prev = this.pts[i - 1];
    const amp = i < 8 ? 44 : i < 16 ? 95 : 150;
    const y = clamp(prev + (hash(i * 3.71 + 11.3) - 0.5) * amp, 92, 258);
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

  /** how deep the sinkhole is at this x (0 outside a pit) */
  pitDepthAt(x: number): number {
    const dip = Math.sin(x * 0.0009) * 0.5 + 0.5;
    return dip > 0.74 ? (dip - 0.74) * 420 : 0;
  }

  lavaY(x: number): number {
    const open = clamp(1 - x / 9000, 0, 1);
    return (
      this.lavaBase +
      190 * open +
      noise1(x * 0.0016 + 40.7) * 84 +
      this.pitDepthAt(x)
    );
  }

  diffAt(x: number): number {
    return clamp((x / this.cw - 6) / 50, 0, 1);
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
    const t = clamp((i - 6) / 40, 0, 1);
    const x0 = i * this.cw;
    const x1 = x0 + this.cw;
    const objs: Obj[] = [];
    const prev = this.chunks.get(i - 1);
    const prevGap = prev ? prev.isGap : false;

    const isGateChunk = nearGate(i);
    const gateHere = gateInChunk(i);

    // ---- ceiling gap (open sky) ----
    let isGap = false;
    let gapA = 1;
    let gapB = 0;
    if (!isGateChunk && i > 9 && !prevGap && r(0) < 0.12 + 0.1 * t) {
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
    } else if (r(3) < 0.18 + 0.18 * t) {
      plats.push({
        x: x0 + 80 + r(4) * (this.cw - 160),
        y: clamp(270 + r(5) * 180, 260, 450),
        w: 130 + r(6) * 90,
      });
    }
    // extra safety platform in every chunk at mid difficulty to avoid dead gaps
    if (!isGap && r(33) < 0.35) {
      plats.push({
        x: x0 + this.cw / 2 + (r(34) - 0.5) * 60,
        y: clamp(320 + r(35) * 120, 300, 440),
        w: 110 + r(36) * 70,
      });
    }
    for (const p of plats) objs.push({ kind: "plat", x: p.x, y: p.y, w: p.w, h: 24 });

    // ---- spires ----
    const spires: number[] = [];
    const spCount =
      isGateChunk
        ? 0
        : i < 8
        ? 0
        : isGap
          ? r(5) < 0.25
            ? 1
            : 0
          : r(5) < 0.22 + 0.3 * t
            ? r(6) < 0.1 + 0.4 * t
              ? 2
              : 1
            : 0;
    for (let k = 0; k < spCount; k++) {
      const px = x0 + 80 + ((k + 0.6) / (spCount + 0.4)) * (this.cw - 160) + (r(7 + k) - 0.5) * 90;
      if (plats.some((p) => Math.abs(p.x - px) < p.w / 2 + 70)) continue;
      if (spires.some((sx) => Math.abs(sx - px) < 150)) continue;
      spires.push(px);
      const base = this.lavaY(px) + 34;
      const hgt = (160 + r(10 + k) * 160) * (0.75 + 0.45 * t);
      let tip = base - hgt;
      // always leave a flyable corridor between the ceiling and the tip
      tip = Math.max(tip, this.ceilY(px) + 178);
      tip = Math.min(tip, base - 120);
      objs.push({ kind: "spire", x: px, tip, base, w: 28 + r(12 + k) * 20 });
    }

    // ---- stalactites / vines / ice shards ----
    if (!isGap && i > 5 && !isGateChunk) {
      const count =
        i < 10 ? (r(8) < 0.4 ? 1 : 0) : Math.floor(r(8) * (0.7 + 1.9 * t) + t * 1.1);
      for (let k = 0; k < count; k++) {
        const sx = x0 + 40 + r(20 + k * 3) * (this.cw - 80);
        if (spires.some((px) => Math.abs(px - sx) < 80)) continue;
        const len = 48 + r(21 + k * 3) * (80 + 80 * t);
        objs.push({ kind: "stal", x: sx, y: this.ceilY(sx), len, w: 13 + len * 0.15 });
      }
    }

    // ---- saws / drones ----
    if (!isGateChunk && i > 12 && r(9) < 0.1 + 0.22 * t) {
      const sx = x0 + 90 + r(22) * (this.cw - 180);
      if (!spires.some((px) => Math.abs(px - sx) < 110)) {
        const cy = clamp(this.ceilY(sx) + 150 + r(23) * 190, this.ceilY(sx) + 130, this.lavaY(sx) - 140);
        objs.push({ kind: "saw", x: sx, y: cy, r: 22 + r(24) * 8, bob: 8 + r(25) * 28 * t, ph: r(26) * Math.PI * 2 });
      }
    }

    // ---- drones (moving) in later levels ----
    if (this.theme === "city" || this.theme === "neon" || this.theme === "space") {
      if (!isGateChunk && i > 18 && r(50) < 0.14 + 0.16 * t) {
        const dx = x0 + 90 + r(51) * (this.cw - 180);
        const dy = clamp(this.ceilY(dx) + 160 + r(52) * 180, this.ceilY(dx) + 140, this.lavaY(dx) - 160);
        objs.push({ kind: "drone", x: dx, y: dy, r: 20 + r(53) * 6, bob: 12 + r(54) * 20, ph: r(55) * Math.PI * 2, vx: (r(56) > 0.5 ? 1 : -1) * (40 + r(57) * 60) });
      }
    }

    // ---- fish (underwater) ----
    if (this.theme === "underwater") {
      if (!isGateChunk && i > 6 && r(60) < 0.35 + 0.25 * t) {
        const fx = x0 + 60 + r(61) * (this.cw - 120);
        const fy = clamp(this.ceilY(fx) + 180 + r(62) * 220, this.ceilY(fx) + 150, this.lavaY(fx) - 120);
        objs.push({ kind: "fish", x: fx, y: fy, r: 18 + r(63) * 6, bob: 6 + r(64) * 16, ph: r(65) * Math.PI * 2, vx: (r(66) > 0.5 ? 1 : -1) * (50 + r(67) * 70) });
      }
    }

    // ---- fire on roofs ----
    if (this.theme === "volcano" || this.theme === "city" || this.theme === "neon") {
      if (!isGateChunk && i > 10 && r(70) < 0.2 + 0.2 * t) {
        const fx = x0 + 60 + r(71) * (this.cw - 180);
        objs.push({ kind: "fire", x: fx, y: this.ceilY(fx) + 2, w: 60 + r(72) * 80, h: 26 + r(73) * 20 });
      }
    }

    // ---- the gate intake: a funnel that sucks you down into the hole ----
    if (isGateChunk) {
      for (let k = 0; k < GATE_COUNT; k++) {
        const gx = gateX(k);
        if (gx < x0 - 700 || gx > x1 + 200) continue;
        // a lift before the hole so you always arrive with time to line up
        const lx = gx - 560;
        objs.push({
          kind: "wind",
          x: lx,
          y: clamp(this.ceilY(lx) + 300, this.ceilY(lx) + 180, this.lavaY(lx) - 220),
          w: 260,
          h: 320,
          vx: 230,
          vy: -140,
          strength: 520,
        });
        // and a down-draft funnel that aims you into the mouth — it stops at
        // the hole, so sailing over the top never dumps you on the sidewalk
        const floorY = this.lavaY(gx);
        const roofY = this.ceilY(gx);
        const midY = clamp((roofY + floorY) / 2 + 70, roofY + 130, floorY - 150);
        objs.push({
          kind: "wind",
          x: gx - 130,
          y: midY,
          w: 260,
          h: Math.max(320, (floorY - roofY) * 0.8),
          vx: 120,
          vy: 330,
          strength: 740,
        });
      }
    }

    // ---- air currents (wind zones) ----
    const windCount = this.theme === "underwater" ? 2 : r(80) < 0.7 + 0.2 * t ? (r(81) < 0.45 ? 2 : 1) : 0;
    for (let k = 0; k < windCount; k++) {
      const wx = x0 + 40 + r(82 + k * 4) * (this.cw - 120);
      const wy = clamp(200 + r(83 + k * 4) * 300, 190, 500);
      const ww = 190 + r(84 + k * 4) * 150;
      const wh = 150 + r(85 + k * 4) * 150;
      // mostly forward-and-up flows (the fun ones) with the odd downdraft
      const ang = (r(86 + k * 4) < 0.75 ? -0.75 : 0.9) * Math.PI * (0.15 + r(88 + k * 4) * 0.5);
      const strength = 420 + r(87 + k * 4) * 420;
      objs.push({
        kind: "wind",
        x: wx,
        y: wy,
        w: ww,
        h: wh,
        vx: Math.cos(ang) * strength,
        vy: Math.sin(ang) * strength * 0.6 - 60,
        strength,
      });
    }

    // ---- coins ----
    const coinRoll = r(30);
    const plat0 = plats[0];
    if (plat0 && coinRoll < 0.75) {
      const n = 4;
      for (let k = 0; k < n; k++) {
        const fx = plat0.x - 66 + (k / (n - 1)) * 132;
        const fy = plat0.y - 84 - Math.sin((k / (n - 1)) * Math.PI) * 26;
        objs.push({ kind: "coin", x: fx, y: fy, got: false });
      }
    } else if (coinRoll < 0.92) {
      const cx = x0 + 110 + r(31) * (this.cw - 220);
      const lo = this.ceilY(cx) + 150;
      const hi = this.lavaY(cx) - 150;
      if (hi - lo > 60) {
        const cy = clamp(lo + r(32) * (hi - lo), lo + 20, hi - 10);
        const n = 3 + Math.floor(r(33) * 2);
        for (let k = 0; k < n; k++) {
          const fx = cx + (k - (n - 1) / 2) * 36;
          const fy = cy - Math.cos(((k - (n - 1) / 2) / n) * Math.PI) * 34;
          if (spires.some((px) => Math.abs(px - fx) < 70)) continue;
          objs.push({ kind: "coin", x: fx, y: fy, got: false });
        }
      }
    }

    // ---- boost rings ----
    const wantBoost = i === 4 || (i > 2 && r(40) < 0.25 + 0.14 * t);
    if (wantBoost) {
      const attempts = i === 5 ? 6 : 2;
      for (let a = 0; a < attempts; a++) {
        const bx = x0 + 90 + hash(i * 7.31 + a * 3.97 + 40.2) * (this.cw - 180);
        if (spires.some((px) => Math.abs(px - bx) < 130)) continue;
        const lo = this.ceilY(bx) + 150;
        const hi = this.lavaY(bx) - 150;
        if (hi - lo <= 60) continue;
        objs.push({ kind: "boost", x: bx, y: clamp(lo + r(42) * (hi - lo), lo, hi), r: 24, used: false });
        break;
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
        if (b - a <= 300) continue;
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
    // ---- a boost ring right before every open sky gap ----
    if (isGap && gapA - 190 > x0 - 40) {
      const bx = gapA - 150;
      objs.push({
        kind: "boost",
        x: bx,
        y: clamp(this.ceilY(bx) + 130, this.ceilY(bx) + 110, this.lavaY(bx) - 160),
        r: 24,
        used: false,
      });
    }

    // ---- the floor gate (one per 250 m stretch) ----
    if (gateHere !== null) {
      objs.push({ kind: "portal", x: gateHere, y: this.lavaY(gateHere), r: 78, used: false });
    }

    // ---- sinkhole marker, only where the street really caves in ----
    let pitX = -1;
    let pitD = 0;
    for (let s = 0; s <= this.cw; s += 24) {
      const pd = this.pitDepthAt(x0 + s);
      if (pd > pitD) {
        pitD = pd;
        pitX = x0 + s;
      }
    }
    if (pitX >= 0 && pitD > 26) {
      objs.push({ kind: "dip", x: pitX, y: this.lavaY(pitX), w: 110 + pitD * 1.8, depth: pitD });
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
            (o.kind === "boost" || o.kind === "shield" || o.kind === "magnet") &&
            Math.abs(o.x - px) < 110 &&
            Math.abs(o.y - py) < 120,
        )
      )
        continue;
      if (
        force &&
        objs.some(
          (o) =>
            (o.kind === "boost" || o.kind === "shield" || o.kind === "magnet") &&
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
        case "fish": {
          const fx = o.x + Math.sin(time * 0.55 + o.ph) * 60;
          const fy = o.y + Math.sin(time * 1.1 + o.ph) * o.bob;
          if (dist(x, y, fx, fy) < o.r + r) hit = true;
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
