/**
 * Hand-designed level pieces.
 *
 * A piece is 960 px wide (two 480 px chunks). Each piece is one puzzle with a
 * readable shape: a gap in the ceiling, a corridor, a rhythm of anchors.
 * The assembler (world.ts) picks pieces by role and tier, so the level has
 * ramps, peaks and breathers instead of random noise.
 *
 * Coordinates inside build() are local (0..PIECE_W). Use the Piece helpers.
 */
import type { Obj } from "./world";
import { lerp, clamp } from "./util";

export const PIECE_W = 960;

/** what the piece is for in the rhythm: calm / build / peak / rest */
export type Role = "calm" | "build" | "peak" | "rest";

export interface Segment {
  id: string;
  /** 0 = safe, 4 = hardest. Assembler uses tier caps by distance. */
  tier: 0 | 1 | 2 | 3 | 4;
  role: Role;
  /** open sky in the ceiling, local x range */
  gap?: [number, number];
  build(p: Piece): void;
}

/** Helper passed to build(). Converts local x to world x. */
export class Piece {
  items: Obj[] = [];
  /** world-space gap range, or null */
  readonly gapW: [number, number] | null;

  constructor(
    readonly x0: number,
    private readonly ceil: (x: number) => number,
    private readonly lava: (x: number) => number,
    gap: [number, number] | undefined,
    readonly rnd: (n: number) => number,
  ) {
    this.gapW = gap ? [x0 + gap[0], x0 + gap[1]] : null;
  }

  private wx(x: number) {
    return this.x0 + x;
  }

  inGap(x: number): boolean {
    const w = this.wx(x);
    return !!this.gapW && w >= this.gapW[0] && w <= this.gapW[1];
  }

  /** a platform: web anchor on its underside and top corners */
  plat(x: number, y: number, w: number) {
    this.items.push({ kind: "plat", x: this.wx(x), y, w, h: 24 });
  }

  /** stalactite hanging from the ceiling */
  stal(x: number, len: number, w = 14 + len * 0.16) {
    const X = this.wx(x);
    this.items.push({ kind: "stal", x: X, y: this.ceil(X), len, w });
  }

  /** tower from the street; tip is kept below the ceiling when there is one */
  spire(x: number, h: number) {
    const X = this.wx(x);
    const base = this.lava(X) + 34;
    let tip = base - h;
    if (!this.inGap(x)) tip = Math.max(tip, this.ceil(X) + 145);
    tip = Math.min(tip, base - 120);
    this.items.push({ kind: "spire", x: X, tip, base, w: 40 });
  }

  /** patrol drone; f = 0 near the ceiling, 1 near the street */
  saw(x: number, f: number, r = 25) {
    const X = this.wx(x);
    const lo = this.ceil(X) + 130;
    const hi = this.lava(X) - 140;
    const y = clamp(lerp(lo, hi, f), lo, hi);
    this.items.push({
      kind: "saw",
      x: X,
      y,
      r,
      bob: 10 + this.rnd(1) * 14,
      ph: this.rnd(2) * Math.PI * 2,
    });
  }

  /** a row of coins at a fixed height: marks the ideal line */
  coinRow(x: number, y: number, n: number, step: number) {
    for (let k = 0; k < n; k++) {
      this.items.push({
        kind: "coin",
        x: this.wx(x + (k - (n - 1) / 2) * step),
        y,
        got: false,
      });
    }
  }

  /** coins in an arc over a platform: the ideal arc through its top */
  coinArc(x: number, y: number, w: number) {
    const n = 5;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      this.items.push({
        kind: "coin",
        x: this.wx(x - w / 2 + t * w),
        y: y - Math.sin(t * Math.PI) * 60,
        got: false,
      });
    }
  }

  /** the only bonus: a shield orb, placed as a reward on a hard line */
  shield(x: number, y: number) {
    this.items.push({ kind: "shield", x: this.wx(x), y, r: 17, got: false });
  }
}

export const SEGMENTS: Segment[] = [
  // ---------- calm: first pieces are hazard-free ----------
  {
    id: "runway",
    tier: 0,
    role: "calm",
    build(p) {
      p.coinRow(480, p.rnd(3) * 40 + 230, 5, 46);
    },
  },
  {
    id: "first-gap",
    tier: 0,
    role: "calm",
    gap: [200, 760],
    build(p) {
      p.plat(480, 390, 180);
      p.coinArc(480, 390 - 26, 180);
    },
  },
  // ---------- rest: a wide landing and an empty sky ----------
  {
    id: "lull",
    tier: 0,
    role: "rest",
    build(p) {
      p.plat(480, 300, 320);
      p.coinArc(480, 300 - 26, 320);
    },
  },
  {
    id: "breather",
    tier: 0,
    role: "rest",
    build(p) {
      p.coinRow(300, 260, 3, 60);
      p.coinRow(660, 330, 3, 60);
    },
  },
  // ---------- build: one idea each, tier 1 ----------
  {
    id: "gap-plat",
    tier: 1,
    role: "build",
    gap: [180, 780],
    build(p) {
      p.plat(480, 360, 190);
      p.coinArc(480, 360 - 26, 190);
    },
  },
  {
    id: "stal-pair",
    tier: 1,
    role: "build",
    build(p) {
      p.stal(330, 110);
      p.stal(640, 90);
      p.coinRow(490, 220, 3, 50);
    },
  },
  {
    id: "spire-single",
    tier: 1,
    role: "build",
    build(p) {
      p.spire(520, 260);
      p.coinRow(300, 230, 3, 50);
    },
  },
  {
    id: "hop-two",
    tier: 1,
    role: "build",
    gap: [120, 840],
    build(p) {
      p.plat(320, 330, 150);
      p.plat(660, 430, 150);
    },
  },
  // ---------- build: tier 2 ----------
  {
    id: "girder-line",
    tier: 2,
    role: "build",
    build(p) {
      p.stal(250, 150);
      p.stal(510, 130);
      p.stal(770, 160);
    },
  },
  {
    id: "long-gap",
    tier: 2,
    role: "build",
    gap: [100, 900],
    build(p) {
      p.plat(500, 340, 150);
      p.coinArc(500, 340 - 26, 150);
    },
  },
  {
    id: "drone-under",
    tier: 2,
    role: "build",
    build(p) {
      p.saw(480, 0.42, 26);
      p.coinRow(240, 300, 3, 50);
    },
  },
  {
    id: "spire-pair",
    tier: 2,
    role: "build",
    build(p) {
      p.spire(300, 220);
      p.spire(660, 300);
    },
  },
  {
    id: "rhythm-plats",
    tier: 2,
    role: "build",
    gap: [60, 900],
    build(p) {
      p.plat(240, 340, 120);
      p.plat(480, 420, 120);
      p.plat(720, 340, 120);
    },
  },
  // ---------- build: tier 3 ----------
  {
    id: "drone-stal",
    tier: 3,
    role: "build",
    build(p) {
      p.saw(360, 0.6, 24);
      p.stal(640, 130);
    },
  },
  {
    id: "stal-corridor",
    tier: 3,
    role: "build",
    build(p) {
      p.stal(200, 160);
      p.stal(440, 190);
      p.stal(680, 150);
    },
  },
  // ---------- peak: the hard lines ----------
  {
    id: "tight-gap",
    tier: 3,
    role: "peak",
    gap: [260, 720],
    build(p) {
      p.plat(490, 300, 110);
      p.coinArc(490, 300 - 26, 110);
    },
  },
  {
    id: "gauntlet-3",
    tier: 3,
    role: "peak",
    build(p) {
      p.spire(260, 200);
      p.stal(520, 150);
      p.spire(780, 260);
    },
  },
  {
    id: "saw-gap",
    tier: 3,
    role: "peak",
    gap: [150, 800],
    build(p) {
      p.saw(480, 0.5, 26);
      p.plat(300, 390, 130);
    },
  },
  {
    id: "drone-patrol",
    tier: 4,
    role: "peak",
    build(p) {
      p.saw(240, 0.35, 28);
      p.saw(640, 0.65, 28);
    },
  },
  {
    id: "narrow-peak",
    tier: 4,
    role: "peak",
    gap: [80, 880],
    build(p) {
      p.plat(260, 400, 110);
      p.plat(560, 320, 110);
      p.shield(760, 290);
    },
  },
  {
    id: "gauntlet-4",
    tier: 4,
    role: "peak",
    build(p) {
      p.spire(200, 240);
      p.stal(470, 140);
      p.saw(700, 0.5, 26);
    },
  },
];
