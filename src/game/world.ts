import { clamp, lerp, sstep, hash, noise1 } from "./util";
import { SEGMENTS, Piece, PIECE_W, type Role, type Segment } from "./segments";

export type Obj =
  | { kind: "stal"; x: number; y: number; len: number; w: number }
  | { kind: "spire"; x: number; tip: number; base: number; w: number }
  | { kind: "plat"; x: number; y: number; w: number; h: number; burn?: boolean }
  | { kind: "wind"; x: number; w: number; yTop: number; yBot: number }
  | { kind: "saw"; x: number; y: number; r: number; bob: number; ph: number }
  | { kind: "shield"; x: number; y: number; r: number; got: boolean }
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
  /** generated pieces (two chunks each), built in order */
  private pieces: { seg: Segment; piece: Piece }[] = [];

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

  /**
   * Pieces are chosen by a rhythm, not by dice per object:
   * calm → build → build → peak → rest → build, with the tier cap rising
   * with distance. The first pieces are hazard-free (safe start).
   */
  private pieceAt(k: number): { seg: Segment; piece: Piece } {
    while (this.pieces.length <= k) {
      const idx = this.pieces.length;
      const seg = this.pickSegment(idx);
      const x0 = idx * PIECE_W;
      const piece = new Piece(
        x0,
        (x) => this.ceilY(x),
        (x) => this.lavaY(x),
        seg.gap,
        (n) => hash(idx * 17.31 + n * 5.07 + 3.3),
      );
      seg.build(piece);
      this.pieces.push({ seg, piece });
    }
    return this.pieces[k];
  }

  private pickSegment(k: number): Segment {
    const cycle: Role[] = ["calm", "build", "build", "peak", "rest", "build"];
    // the opening two pieces are always calm and safe
    const role: Role = k < 2 ? "calm" : cycle[k % cycle.length];
    const cap = k < 4 ? 1 : k < 10 ? 2 : k < 18 ? 3 : 4;
    const prev = k > 0 ? this.pieces[k - 1]?.seg.id : "";
    const pool = (r: Role) =>
      SEGMENTS.filter((s) => s.role === r && s.tier <= cap && s.id !== prev);
    let cands = pool(role);
    if (cands.length === 0) cands = pool("build");
    if (cands.length === 0) cands = SEGMENTS.filter((s) => s.tier === 0);
    const r = hash(k * 9.173 + 0.61);
    return cands[Math.floor(r * cands.length) % cands.length];
  }

  private gen(i: number): Chunk {
    const x0 = i * this.cw;
    const x1 = x0 + this.cw;
    const { piece } = this.pieceAt(Math.floor(i / 2));
    const objs: Obj[] = piece.items.filter((o) => o.x >= x0 && o.x < x1);
    let isGap = false;
    let gapA = 1;
    let gapB = 0;
    if (piece.gapW) {
      const [ga, gb] = piece.gapW;
      const a = Math.max(ga, x0);
      const b = Math.min(gb, x1);
      if (a < b) {
        isGap = true;
        gapA = a;
        gapB = b;
      }
    }
    return { i, x0, x1, gapA, gapB, isGap, objs };
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
