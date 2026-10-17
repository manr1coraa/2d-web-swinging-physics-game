import { clamp, hash, lerp, noise1, sstep } from "./util";

/* ------------------------------------------------------------------ *
 * WEBBY! — the city.
 *
 * The whole map is rooftops. There is no ceiling and no upper limit:
 * an endless procedural skyline grows to the right, every ledge, parapet
 * and rooftop structure is something the silk can grab, and the only way
 * a run ends is the street far below (or a hard crash into a rooftop
 * structure). Buildings are generated left to right, deterministically,
 * so the same district always plays the same way.
 * ------------------------------------------------------------------ */

/** Eight calm city districts. They cycle forever while the pace tightens. */
export type DistrictId =
  | "harbour"
  | "brickline"
  | "mosslight"
  | "glassmarket"
  | "amberrow"
  | "pinewharf"
  | "cloudbreak"
  | "seabreeze";

export const DISTRICTS: DistrictId[] = [
  "harbour",
  "brickline",
  "mosslight",
  "glassmarket",
  "amberrow",
  "pinewharf",
  "cloudbreak",
  "seabreeze",
];

export const districtForLevel = (i: number): DistrictId =>
  DISTRICTS[((Math.floor(i) % DISTRICTS.length) + DISTRICTS.length) % DISTRICTS.length];

/* ---------------- units, route and checkpoints ---------------- */

/** one metre of the journey, in world pixels */
export const METER = 50;
/** a district (level) is 250 m of rooftops */
export const LEVEL_METERS = 250;
export const ROUTE_START_X = 90;
export const GATE_SPACING = LEVEL_METERS * METER;
export const gateX = (k: number): number => ROUTE_START_X + (k + 1) * GATE_SPACING;

/** the avenue. Touching it ends the run. */
export const STREET_Y = 980;
/** rooftops never start lower than this, so there is always air to swing in */
export const LOWEST_ROOF = STREET_Y - 300;
/** and never higher than this — above it the sky is open and empty */
export const HIGHEST_ROOF = 130;

/* ---------------- rooftop objects ---------------- */

export type PropKind =
  | "chimney"
  | "watertower"
  | "antenna"
  | "ac"
  | "billboard"
  | "vent"
  | "skylight"
  | "garden"
  | "crane"
  | "scaffold"
  | "clothesline"
  | "drone"
  | "sign"
  | "token"
  | "shield"
  | "magnet";

/** Crashing into these at speed ends the run; a slow brush only stumbles. */
export const HARD_PROPS: readonly PropKind[] = [
  "chimney",
  "watertower",
  "antenna",
  "billboard",
  "crane",
  "scaffold",
  "sign",
];

/** Safe to land on, a small stumble from the side. */
export const SOFT_PROPS: readonly PropKind[] = ["ac", "vent", "skylight", "garden"];

export interface Prop {
  kind: PropKind;
  /** base x on the roof for structures; centre x for drones, tokens, lines */
  x: number;
  /** roof surface y for structures; centre y for drones and tokens */
  y: number;
  w: number;
  h: number;
  /** drone patrol / clothesline sway */
  ph?: number;
  bob?: number;
  range?: number;
  /** pickups */
  got?: boolean;
  tone?: number;
  seed?: number;
}

export interface Anchor {
  x: number;
  y: number;
  /** ledge = a roof corner, prop = rooftop clutter, wall = a facade grab */
  kind: "ledge" | "prop" | "wall";
  /** for ledges and walls: which way the walkable roof lies, so a runner can
   * mantle up over the edge instead of dangling there */
  dir?: 1 | -1;
}

export interface RoofSeg {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type RoofShape = "flat" | "slant" | "step" | "peaked" | "setback";

export interface Building {
  i: number;
  x0: number;
  x1: number;
  baseY: number;
  segs: RoofSeg[];
  shape: RoofShape;
  tone: number;
  style: number;
  winSeed: number;
  props: Prop[];
  anchors: Anchor[];
  /** true when a checkpoint sits here: the roof is kept flat and clear */
  quiet: boolean;
}

/* ---------------- geometry helpers shared with the renderer ---------------- */

export function segYAt(seg: RoofSeg, x: number): number {
  const t = (x - seg.x0) / Math.max(1, seg.x1 - seg.x0);
  return lerp(seg.y0, seg.y1, clamp(t, 0, 1));
}

/** axis-aligned box of a box-like prop, sitting on the roof at (x, y) */
export function propBox(p: Prop): { x0: number; y0: number; x1: number; y1: number } {
  if (p.kind === "clothesline") {
    return { x0: p.x - p.w / 2, y0: p.y - 6, x1: p.x + p.w / 2, y1: p.y + 6 };
  }
  if (p.kind === "token" || p.kind === "shield" || p.kind === "magnet") {
    const r = p.kind === "token" ? 13 : 17;
    return { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
  }
  if (p.kind === "drone") {
    const r = 15;
    return { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
  }
  if (p.kind === "watertower") {
    // the tank sits on legs: the collision box covers the whole silhouette
    return { x0: p.x - p.w / 2, y0: p.y - p.h, x1: p.x + p.w / 2, y1: p.y };
  }
  if (p.kind === "crane") {
    // mast plus the jib arm reaching forward
    return { x0: p.x - p.w / 2, y0: p.y - p.h, x1: p.x + p.w / 2 + 120, y1: p.y };
  }
  if (p.kind === "skylight") {
    return { x0: p.x - p.w / 2, y0: p.y - p.h, x1: p.x + p.w / 2, y1: p.y + 2 };
  }
  return { x0: p.x - p.w / 2, y0: p.y - p.h, x1: p.x + p.w / 2, y1: p.y };
}

export function dronePos(p: Prop, time: number): { x: number; y: number } {
  return {
    x: p.x + Math.sin(time * 0.55 + (p.ph ?? 0)) * (p.range ?? 90),
    y: p.y + Math.sin(time * 1.15 + (p.ph ?? 0) * 1.7) * (p.bob ?? 14),
  };
}

/* ---------------- the world ---------------- */

/** how wide the corridor of generated buildings is kept around the player */
const KEEP_BEHIND = 2600;
const KEEP_AHEAD = 3200;

export class World {
  readonly level: number;
  readonly district: DistrictId;
  streetY = STREET_Y;

  /** cached buildings, ascending by x. `base` is the index of list[0]. */
  private list: Building[] = [];
  private base = 0;
  private hint = 0;
  private anchorCache: { key: number; list: Anchor[] } | null = null;

  constructor(level = 0) {
    this.level = Math.max(0, Math.floor(level));
    this.district = districtForLevel(this.level);
    this.ensure(ROUTE_START_X + 1600);
  }

  /* -------- difficulty -------- */

  /** 0 = the quiet opening, 1 = the tightest rooftops the city offers */
  diff(i = 0): number {
    return clamp(this.level / 26 + i / 150, 0, 1);
  }

  /* -------- generation -------- */

  /**
   * Generate the city up to `aheadX`. `behindX` is what may be forgotten: a
   * checkpoint far down the route must never prune the district you are in.
   */
  ensure(aheadX: number, behindX = aheadX - KEEP_BEHIND) {
    let guard = 0;
    while (guard++ < 3000) {
      const last = this.list[this.list.length - 1];
      if (last && last.x1 > aheadX + KEEP_AHEAD) break;
      this.build(this.base + this.list.length);
    }
    // prune what is far behind so a long run stays light
    while (this.list.length > 6 && this.list[0].x1 < behindX) {
      this.list.shift();
      this.base += 1;
      this.hint = Math.max(0, this.hint - 1);
    }
    this.anchorCache = null;
  }

  private byIndex(i: number): Building | null {
    const k = i - this.base;
    return k >= 0 && k < this.list.length ? this.list[k] : null;
  }

  private ensureIndex(i: number): Building | null {
    if (i < 0) return null;
    let guard = 0;
    while (guard++ < 4000) {
      const b = this.byIndex(i);
      if (b) return b;
      this.build(this.base + this.list.length);
    }
    return this.byIndex(i);
  }

  /** is a checkpoint near this x? The approach is always kept clear. */
  private nearGate(x0: number, x1: number): boolean {
    for (let k = 0; k < 4; k++) {
      const gx = gateX(k);
      if (gx > x0 - 520 && gx < x1 + 520) return true;
    }
    return false;
  }

  private build(i: number): Building {
    const prev = i > 0 ? this.ensureIndex(i - 1) : null;
    const t = this.diff(i);
    const r = (n: number) => hash(i * 91.73 + n * 17.31 + this.level * 3.77 + 0.137);

    /* --- footprint --- */
    const alley =
      i === 0
        ? 0
        : clamp(lerp(96, 128, t) + r(2) * lerp(64, 150, t), 74, 290);
    const x0 = prev ? prev.x1 + alley : 0;
    const width =
      i === 0
        ? 620
        : clamp(lerp(210, 165, t) + r(1) * lerp(160, 235, t), 150, 430);
    const x1 = x0 + width;
    const quiet = this.nearGate(x0, x1);

    /* --- height --- */
    const prevRoof = prev ? prev.segs[0].y0 : 640;
    const wave = noise1(i * 0.19 + this.level * 2.31);
    const target =
      lerp(706, 300, clamp(wave * 0.78 + t * 0.42, 0, 1)) + (r(3) - 0.5) * 130;
    let roofY = clamp(target, HIGHEST_ROOF, LOWEST_ROOF);
    // a tower now and then — the only way up is the web
    if (!quiet && i > 5 && r(4) < 0.1 + 0.1 * t) roofY -= 150 + r(9) * 130;
    // keep every step from the previous roof reachable on one line
    roofY = clamp(roofY, prevRoof - 292, prevRoof + 250);
    if (i === 0) roofY = 520;
    else if (i < 3) roofY = clamp(roofY, 480, 585);
    else if (i < 8) roofY = clamp(roofY, 372, 620);
    roofY = clamp(roofY, HIGHEST_ROOF, LOWEST_ROOF);

    /* --- roof shape --- */
    const roll = r(5);
    let shape: RoofShape = "flat";
    if (quiet || i < 2) shape = "flat";
    else if (roll < 0.44) shape = "flat";
    else if (roll < 0.57) shape = "slant";
    else if (roll < 0.78) shape = "step";
    else if (roll < 0.89) shape = "peaked";
    else shape = "setback";

    const segs: RoofSeg[] = [];
    const clampY = (y: number) => clamp(y, HIGHEST_ROOF, LOWEST_ROOF);
    if (shape === "flat") {
      segs.push({ x0, x1, y0: roofY, y1: roofY });
    } else if (shape === "slant") {
      const dir = r(6) < 0.5 ? -1 : 1;
      const dy = 26 + r(7) * 44;
      segs.push({ x0, x1, y0: clampY(roofY - dir * dy * 0.5), y1: clampY(roofY + dir * dy * 0.5) });
    } else if (shape === "step") {
      const tiers = r(8) < 0.34 ? 3 : 2;
      const up = r(6) < 0.62 ? -1 : 1;
      let cx = x0;
      for (let k = 0; k < tiers; k++) {
        const w = (width / tiers) * (0.82 + r(20 + k) * 0.36);
        const nx = k === tiers - 1 ? x1 : Math.min(x1 - 40, cx + w);
        const y = clampY(roofY + up * (38 + r(21 + k) * 52) * k);
        segs.push({ x0: cx, x1: nx, y0: y, y1: y });
        cx = nx;
        if (cx >= x1 - 20) break;
      }
      if (cx < x1) segs.push({ x0: cx, x1, y0: segs[segs.length - 1].y1, y1: segs[segs.length - 1].y1 });
    } else if (shape === "peaked") {
      const xm = x0 + width * (0.4 + r(6) * 0.2);
      const rise = 16 + r(7) * 20;
      segs.push({ x0, x1: xm, y0: clampY(roofY + rise * 0.5), y1: clampY(roofY - rise) });
      segs.push({ x0: xm, x1, y0: clampY(roofY - rise), y1: clampY(roofY + rise * 0.5) });
    } else {
      // setback: a wide roof with a narrower block on top
      const inset = width * (0.2 + r(6) * 0.16);
      const xa = x0 + inset;
      const xb = x1 - inset * (0.7 + r(7) * 0.5);
      const top = clampY(roofY - (96 + r(8) * 90));
      segs.push({ x0, x1: xa, y0: roofY, y1: roofY });
      segs.push({ x0: xa, x1: Math.max(xa + 60, xb), y0: top, y1: top });
      segs.push({ x0: Math.max(xa + 60, xb), x1, y0: roofY, y1: roofY });
    }

    const b: Building = {
      i,
      x0,
      x1,
      baseY: STREET_Y + 40,
      segs,
      shape,
      tone: Math.floor(r(10) * 3),
      style: Math.floor(r(11) * 4),
      winSeed: r(12) * 1000,
      props: [],
      anchors: [],
      quiet,
    };

    this.placeProps(b, t, r, quiet);
    this.buildAnchors(b);
    this.list.push(b);
    return b;
  }

  /* -------- rooftop clutter -------- */

  private placeProps(
    b: Building,
    t: number,
    r: (n: number) => number,
    quiet: boolean,
  ) {
    const props = b.props;
    const early = b.i < 6;

    const add = (p: Prop) => {
      // never stack two structures on top of each other
      for (const q of props) {
        if (q.kind === "token" || q.kind === "shield" || q.kind === "magnet") continue;
        if (Math.abs(q.x - p.x) < (q.w + p.w) * 0.5 + 26) return false;
      }
      props.push(p);
      return true;
    };

    const kinds: PropKind[] = ["chimney", "ac", "vent", "antenna", "watertower", "skylight", "garden"];
    for (const seg of b.segs) {
      const len = seg.x1 - seg.x0;
      if (len < 96) continue;
      const budget = quiet || early ? 0 : Math.floor(len / 165) + (r(30) < 0.5 ? 0 : 1);
      for (let k = 0; k < Math.min(3, budget); k++) {
        if (r(31 + k) > 0.42 + 0.4 * t) continue;
        const px = lerp(seg.x0 + 44, seg.x1 - 44, (k + 0.35 + r(32 + k) * 0.5) / Math.max(1, budget));
        const py = segYAt(seg, px);
        const pick = kinds[Math.floor(r(33 + k * 3) * kinds.length)];
        const made = this.makeProp(pick, px, py, r, 40 + k * 7, t);
        if (made) add(made);
      }
      // a billboard or a crane on the biggest roofs, once per district or so
      if (!quiet && !early && len > 250 && r(50) < 0.1 + 0.12 * t) {
        const px = lerp(seg.x0 + 70, seg.x1 - 70, r(51));
        const py = segYAt(seg, px);
        const made = this.makeProp(r(52) < 0.35 ? "crane" : "billboard", px, py, r, 60, t);
        if (made) add(made);
      }
    }

    /* --- clothesline across the alley behind this building --- */
    const prev = this.byIndex(b.i - 1);
    if (prev && !quiet && !prev.quiet && b.i > 8 && r(70) < 0.2 + 0.14 * t) {
      const gap = b.x0 - prev.x1;
      if (gap > 86 && gap < 250) {
        const topPrev = prev.segs[prev.segs.length - 1].y1;
        const topHere = b.segs[0].y0;
        const y = Math.min(topPrev, topHere) - (26 + r(71) * 44);
        if (y < Math.max(topPrev, topHere) - 8) {
          props.push({
            kind: "clothesline",
            x: (prev.x1 + b.x0) / 2,
            y,
            w: gap,
            h: 0,
            ph: r(72) * 6.28,
            tone: Math.floor(r(73) * 3),
            seed: r(74) * 100,
          });
        }
      }
    }

    /* --- a patrol drone: an obstacle to read, never in the opening --- */
    if (!quiet && b.i > 12 && this.level > 1 && r(80) < 0.06 + 0.1 * t) {
      const seg = b.segs[0];
      const dx = lerp(seg.x0 + 40, seg.x1 - 40, r(81));
      props.push({
        kind: "drone",
        x: dx,
        y: segYAt(seg, dx) - (130 + r(82) * 120),
        w: 30,
        h: 18,
        ph: r(83) * 6.28,
        bob: 10 + r(84) * 14,
        range: 70 + r(85) * 80,
      });
    }

    /* --- tokens: little web-spools along the route --- */
    const tokenRoll = r(90);
    if (tokenRoll < 0.5) {
      const seg = b.segs[Math.floor(r(91) * b.segs.length)];
      const cx = lerp(seg.x0 + 40, seg.x1 - 40, r(92));
      for (let k = 0; k < 3; k++) {
        const fx = cx + (k - 1) * 36;
        if (fx < seg.x0 + 12 || fx > seg.x1 - 12) continue;
        props.push({
          kind: "token",
          x: fx,
          y: segYAt(seg, fx) - 78 - Math.sin((k / 2) * Math.PI) * 26,
          w: 22,
          h: 22,
          got: false,
          seed: r(93 + k) * 10,
        });
      }
    } else if (tokenRoll < 0.74 && prev) {
      // an arc over the alley
      const gap = b.x0 - prev.x1;
      const topPrev = prev.segs[prev.segs.length - 1].y1;
      const topHere = b.segs[0].y0;
      const y = Math.min(topPrev, topHere) - 96;
      for (let k = 0; k < 3; k++) {
        const fx = prev.x1 + (gap * (k + 1)) / 4;
        props.push({
          kind: "token",
          x: fx,
          y: y - Math.sin(((k + 1) / 4) * Math.PI) * 30,
          w: 22,
          h: 22,
          got: false,
          seed: r(95 + k) * 10,
        });
      }
    }

    /* --- the two charms, rarely --- */
    if (b.i > 6 && r(96) < 0.05 + 0.03 * t) {
      const seg = b.segs[0];
      const px = lerp(seg.x0 + 50, seg.x1 - 50, r(97));
      props.push({ kind: "shield", x: px, y: segYAt(seg, px) - 96, w: 30, h: 30, got: false });
    }
    if (b.i > 9 && r(98) < 0.04 + 0.03 * t) {
      const seg = b.segs[0];
      const px = lerp(seg.x0 + 50, seg.x1 - 50, r(99));
      props.push({ kind: "magnet", x: px, y: segYAt(seg, px) - 104, w: 30, h: 30, got: false });
    }
  }

  private makeProp(
    kind: PropKind,
    x: number,
    y: number,
    r: (n: number) => number,
    s: number,
    t: number,
  ): Prop | null {
    switch (kind) {
      case "chimney": {
        const h = 46 + r(s) * 46 + t * 26;
        return { kind, x, y, w: 30 + r(s + 1) * 22, h, tone: Math.floor(r(s + 2) * 3), seed: r(s + 3) * 10 };
      }
      case "ac": {
        const h = 20 + r(s) * 12;
        return { kind, x, y, w: 40 + r(s + 1) * 24, h, tone: Math.floor(r(s + 2) * 3) };
      }
      case "vent": {
        const h = 16 + r(s) * 16;
        return { kind, x, y, w: 14 + r(s + 1) * 10, h };
      }
      case "antenna": {
        const h = 78 + r(s) * 90 + t * 60;
        return { kind, x, y, w: 8, h, seed: r(s + 1) * 10 };
      }
      case "watertower": {
        const h = 74 + r(s) * 34;
        return { kind, x, y, w: 58 + r(s + 1) * 18, h, tone: Math.floor(r(s + 2) * 3) };
      }
      case "skylight": {
        const w = 40 + r(s) * 40;
        return { kind, x, y, w, h: 12 + r(s + 1) * 6 };
      }
      case "garden": {
        const w = 46 + r(s) * 44;
        return { kind, x, y, w, h: 16 + r(s + 1) * 14, seed: r(s + 2) * 10 };
      }
      case "billboard": {
        const h = 62 + r(s) * 34;
        return { kind, x, y, w: 112 + r(s + 1) * 46, h, tone: Math.floor(r(s + 2) * 3) };
      }
      case "crane": {
        const h = 170 + r(s) * 110;
        return { kind, x, y, w: 16, h, seed: r(s + 1) * 10 };
      }
      default:
        return null;
    }
  }

  /** every point the silk can grab on this building */
  private buildAnchors(b: Building) {
    const a: Anchor[] = [];
    const push = (x: number, y: number, kind: Anchor["kind"], dir?: 1 | -1) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (kind !== "wall" && y > LOWEST_ROOF + 40) return;
      if (y > STREET_Y - 130) return;
      a.push({ x, y, kind, dir });
    };
    for (const seg of b.segs) {
      push(seg.x0 - 2, seg.y0 - 9, "ledge", 1);
      push(seg.x1 + 2, seg.y1 - 9, "ledge", -1);
      if (seg.x1 - seg.x0 > 210) {
        const mx = (seg.x0 + seg.x1) / 2;
        push(mx, segYAt(seg, mx) - 9, "ledge");
      }
      if (b.shape === "peaked") push((seg.x0 + seg.x1) / 2, Math.min(seg.y0, seg.y1) - 10, "ledge");
    }
    for (const p of b.props) {
      switch (p.kind) {
        case "chimney":
          push(p.x - p.w / 2 + 3, p.y - p.h - 3, "prop");
          push(p.x + p.w / 2 - 3, p.y - p.h - 3, "prop");
          break;
        case "watertower":
          push(p.x, p.y - p.h - 6, "prop");
          push(p.x - p.w / 2, p.y - p.h * 0.62, "prop");
          push(p.x + p.w / 2, p.y - p.h * 0.62, "prop");
          break;
        case "antenna":
          push(p.x, p.y - p.h, "prop");
          push(p.x, p.y - p.h * 0.62, "prop");
          break;
        case "billboard":
          push(p.x - p.w / 2 + 4, p.y - p.h - 4, "prop");
          push(p.x + p.w / 2 - 4, p.y - p.h - 4, "prop");
          push(p.x, p.y - p.h - 6, "prop");
          break;
        case "crane":
          push(p.x, p.y - p.h, "prop");
          push(p.x + 108, p.y - p.h + 12, "prop");
          push(p.x - 34, p.y - p.h + 16, "prop");
          break;
        case "ac":
          push(p.x - p.w / 2 + 3, p.y - p.h - 2, "prop");
          push(p.x + p.w / 2 - 3, p.y - p.h - 2, "prop");
          break;
        case "vent":
          push(p.x, p.y - p.h - 2, "prop");
          break;
        case "garden":
          push(p.x - p.w / 2 + 4, p.y - p.h, "prop");
          push(p.x + p.w / 2 - 4, p.y - p.h, "prop");
          break;
        default:
          break;
      }
    }
    /* --- facade grabs: the walls are climbable, so an alley is never a dead end --- */
    const wallTop = b.segs[0].y0;
    for (const [wx, dir] of [
      [b.x0 - 3, 1],
      [b.x1 + 3, -1],
    ] as [number, 1 | -1][]) {
      for (let y = wallTop + 34; y < STREET_Y - 150; y += 92) {
        push(wx, y, "wall", dir);
      }
    }

    // a scaffold on the facade gives a low grab when you are already falling
    if (!b.quiet && b.i > 4 && hash(b.i * 7.7 + this.level) < 0.3) {
      const side = hash(b.i * 3.3) < 0.5 ? b.x0 + 16 : b.x1 - 16;
      const top = b.segs[0].y0 + 96 + hash(b.i * 5.1) * 90;
      if (top < LOWEST_ROOF) {
        b.props.push({ kind: "scaffold", x: side, y: Math.min(top, STREET_Y - 120), w: 34, h: 96 + hash(b.i * 2.9) * 90 });
        push(side - 15, b.props[b.props.length - 1].y - b.props[b.props.length - 1].h - 2, "prop");
        push(side + 15, b.props[b.props.length - 1].y - b.props[b.props.length - 1].h - 2, "prop");
      }
    }
    b.anchors = a;
  }

  /* -------- queries -------- */

  /** the building covering x, or null when x is over an alley */
  at(x: number): Building | null {
    const list = this.list;
    if (list.length === 0) return null;
    const h = this.byIndex(this.hint + this.base);
    if (h && x >= h.x0 && x <= h.x1) return h;
    let lo = 0;
    let hi = list.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = list[mid];
      if (x < b.x0) hi = mid - 1;
      else if (x > b.x1) lo = mid + 1;
      else {
        this.hint = mid;
        return b;
      }
    }
    return null;
  }

  segAt(x: number): RoofSeg | null {
    const b = this.at(x);
    if (!b) return null;
    for (const s of b.segs) if (x >= s.x0 && x <= s.x1) return s;
    return b.segs[b.segs.length - 1] ?? null;
  }

  hasRoof(x: number): boolean {
    return this.at(x) !== null;
  }

  /** roof surface height at x, or null over an alley */
  roofYAt(x: number): number | null {
    const seg = this.segAt(x);
    return seg ? segYAt(seg, x) : null;
  }

  /** roof height or the street, whichever is closer — used for warnings */
  floorYAt(x: number): number {
    return this.roofYAt(x) ?? this.streetY;
  }

  /**
   * The surface you would land on if you fell from (x, y): the roof when you
   * are above it, the avenue when you are in an alley or past a roof line.
   */
  floorBelow(x: number, y: number): number {
    const b = this.at(x);
    if (!b) return this.streetY;
    const seg = this.segAt(x);
    const top = seg ? segYAt(seg, x) : b.segs[0].y0;
    return y <= top ? top : this.streetY;
  }

  buildingsNear(x: number, range = 620): Building[] {
    const out: Building[] = [];
    const list = this.list;
    if (list.length === 0) return out;
    // binary search for the first building that could still be in range
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].x1 < x - range) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < list.length; i++) {
      const b = list[i];
      if (b.x0 > x + range) break;
      out.push(b);
    }
    return out;
  }

  eachNear(x: number, cb: (p: Prop, b: Building) => void, range = 700) {
    for (const b of this.buildingsNear(x, range)) for (const p of b.props) cb(p, b);
  }

  /** anchors the silk could grab, nearest first */
  anchorsNear(x: number, range = 560): Anchor[] {
    const key = Math.round(x / 24);
    if (this.anchorCache && this.anchorCache.key === key) return this.anchorCache.list;
    const list: Anchor[] = [];
    for (const b of this.buildingsNear(x, range + 340)) {
      for (const a of b.anchors) {
        if (Math.abs(a.x - x) > range) continue;
        list.push(a);
      }
    }
    list.sort((p, q) => Math.abs(p.x - x) - Math.abs(q.x - x));
    this.anchorCache = { key, list };
    return list;
  }

  /** the checkpoint arch for stretch k, standing over a real roof */
  gate(k: number): { x: number; y: number; r: number } {
    const gx = gateX(k);
    this.ensure(gx + 400, Number.NEGATIVE_INFINITY);
    const roof = this.roofYAt(gx) ?? 520;
    return { x: gx, y: roof - 172, r: 70 };
  }

  /** is a hard prop blocking this point? Used by the aim line and the bot. */
  propSolid(p: Prop, x: number, y: number, pad = 0): boolean {
    if (p.kind === "token" || p.kind === "shield" || p.kind === "magnet") return false;
    if (p.kind === "drone") return false;
    if (p.kind === "clothesline") return false;
    const box = propBox(p);
    return x > box.x0 - pad && x < box.x1 + pad && y > box.y0 - pad && y < box.y1 + pad;
  }

  solidAt(x: number, y: number): boolean {
    if (y > this.streetY) return true;
    const b = this.at(x);
    if (b) {
      const seg = this.segAt(x);
      const top = seg ? segYAt(seg, x) : b.segs[0].y0;
      if (y > top) return true;
    }
    let hit = false;
    for (const bb of this.buildingsNear(x, 260)) {
      for (const p of bb.props) {
        if (this.propSolid(p, x, y)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    return hit;
  }

  /**
   * Something lethal within r of this point: hard rooftop clutter and drones.
   * Facades are not lethal — they only cost speed — so they are reported by
   * `wallNear` instead.
   */
  hazardNear(x: number, y: number, r: number, time: number): boolean {
    for (const b of this.buildingsNear(x, r + 320)) {
      for (const p of b.props) {
        if (p.kind === "drone") {
          const d = dronePos(p, time);
          if (Math.hypot(d.x - x, d.y - y) < 18 + r) return true;
          continue;
        }
        if (!HARD_PROPS.includes(p.kind)) continue;
        const box = propBox(p);
        const cx = clamp(x, box.x0, box.x1);
        const cy = clamp(y, box.y0, box.y1);
        if (Math.hypot(cx - x, cy - y) < r) return true;
      }
    }
    return false;
  }

  /** is this point inside a building body (a facade you would slide down)? */
  wallNear(x: number, y: number, r = 0): boolean {
    if (y > this.streetY) return false;
    for (const b of this.buildingsNear(x, r + 120)) {
      if (x < b.x0 - r || x > b.x1 + r) continue;
      const seg = this.segAt(x);
      const top = seg ? segYAt(seg, x) : b.segs[0].y0;
      if (y > top + r) return true;
    }
    return false;
  }

  raycast(
    x: number,
    y: number,
    dx: number,
    dy: number,
    maxLen: number,
  ): { x: number; y: number } | null {
    const step = 6;
    for (let d = 22; d <= maxLen; d += step) {
      const px = x + dx * d;
      const py = y + dy * d;
      if (this.solidAt(px, py)) return { x: x + dx * (d - 4), y: y + dy * (d - 4) };
    }
    return null;
  }

  /** the highest roof within reach of x — used for the "climb" readout */
  highestNear(x: number, range = 900): number {
    let best = STREET_Y;
    for (const b of this.buildingsNear(x, range)) {
      for (const s of b.segs) best = Math.min(best, Math.min(s.y0, s.y1));
      for (const p of b.props) {
        if (HARD_PROPS.includes(p.kind)) best = Math.min(best, p.y - p.h);
      }
    }
    return best;
  }

  /** deterministic skyline for the parallax backdrop */
  static backdrop(seed: number, x: number, spacing: number): { h: number; w: number; lit: number } {
    const i = Math.floor(x / spacing);
    const r1 = hash(i * 3.77 + seed * 11.3);
    const r2 = hash(i * 8.13 + seed * 5.7);
    const r3 = hash(i * 1.31 + seed * 19.9);
    return {
      h: 90 + sstep(r1) * 300,
      w: spacing * (0.62 + r2 * 0.42),
      lit: r3,
    };
  }
}
