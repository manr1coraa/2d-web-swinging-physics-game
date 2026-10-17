import { World, themeForLevel, gateX, ROUTE_START_X } from "./world";
import type { ThemeId } from "./world";
import { Player, WEB_SEGMENTS } from "./player";
import { Particles } from "./particles";
import { Sfx } from "./audio";
import { Renderer } from "./renderer";
import { themeDef } from "./themes";
import { clamp, lerp, dist, noise1 } from "./util";

export type GameState =
  | "menu"
  | "playing"
  | "dying"
  | "dead"
  | "paused"
  | "levelup";

export interface Snap {
  state: GameState;
  level: number;
  unlocked: number;
  theme: ThemeId;
  dist: number;
  coins: number;
  tricks: number;
  best: number;
  newBest: boolean;
  muted: boolean;
  maxSpeed: number;
  cause: string;
  showHint: boolean;
  shield: boolean;
  magnetT: number;
  tip: Tip | null;
  graceT: number;
  gliding: boolean;
  announce: Announce | null;
  lowAlt: number; // 0..1 — how close to the street you are
  windGain: number; // 0..1 — how deep you are inside an air current
  gateM: number; // meters to the next floor gate
  segStart: number; // meters where this stretch began
  missed: boolean; // did you sail past a gate?
}

export interface Tip {
  id: string;
  title: string;
  text: string;
  tone: "info" | "danger" | "good";
}

/** contextual lessons, fired the first time you approach each thing */
export const TIPS: Record<string, Tip> = {
  swing: {
    id: "swing",
    title: "Catch a line",
    text: "Hold SPACE or touch the screen to catch a branch. Let go to keep the swing's momentum and drift onward.",
    tone: "info",
  },
  glide: {
    id: "glide",
    title: "Open the web-wings",
    text: "Hold GLIDE (or SHIFT) to soften your fall and shape a gentler arc.",
    tone: "good",
  },
  street: {
    id: "street",
    title: "Follow the hillside",
    text: "Stay above the cream ridge. There is no need to race; use the swing to find a comfortable rhythm.",
    tone: "info",
  },
  pump: {
    id: "pump",
    title: "Feel the spring",
    text: "The silk gives a little under load, then returns its spring. Let go while moving forward to carry that momentum onward.",
    tone: "good",
  },
  stal: {
    id: "stal",
    title: "A little hanging stone",
    text: "A few pointed branches or ice tips hang overhead. Keep a little space as you swing beneath them.",
    tone: "info",
  },
  spire: {
    id: "spire",
    title: "Mind the tall rocks",
    text: "Occasional stone spires rise from the hillside. A small change in timing can carry you over one.",
    tone: "info",
  },
  coin: {
    id: "coin",
    title: "Seed-leaves",
    text: "Gather the little seed-leaves along your route. They keep a simple record of what you found.",
    tone: "good",
  },
  release: {
    id: "release",
    title: "Let the swing go",
    text: "When your path points forward, release the line. Your own momentum carries you—no sudden launch is added.",
    tone: "info",
  },
  shield: {
    id: "shield",
    title: "A gentle safety net",
    text: "This soft charm cushions one bump, giving you another chance to find your balance.",
    tone: "good",
  },
  wind: {
    id: "wind",
    title: "A quiet breeze",
    text: "A passing current can nudge you upward or forward. Let it help shape your next arc.",
    tone: "good",
  },
  fish: {
    id: "fish",
    title: "Tidal visitors",
    text: "Little fish drift through the cove as scenery; they are friendly and safe to pass.",
    tone: "good",
  },
  pod: {
    id: "pod",
    title: "A resting branch",
    text: "These broad floating branches are safe to land on and make a comfortable place to catch another line.",
    tone: "good",
  },
  portal: {
    id: "portal",
    title: "Follow the waymark",
    text: "Pass through the wooden arch in the air every 250 m to reach the next stretch. If you miss it, another appears farther along.",
    tone: "good",
  },
  magnet: {
    id: "magnet",
    title: "A seed-catching charm",
    text: "Nearby seed-leaves drift toward you for a little while.",
    tone: "good",
  },
};

/** full-screen transformation callout */
export interface Announce {
  id: string;
  kind: "shield" | "magnet" | "glide" | "perfect" | "save" | "level";
  title: string;
  sub: string;
}

export interface Popup {
  x: number;
  y: number;
  str: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

const G = 1200; // gravity px/s²: soft, readable arcs
const FWD = 100; // gentle forward drift; distance is not a speed test
const FWD_ATT = 58;
const MAXV = 850;
const ROPE_MAX = 420;
const ROPE_K = 520; // spring stiffness (px/s² per px of extension)
const ROPE_DAMP = 11; // radial damping, only while the line is being pulled taut
const ROPE_MAX_TENSION = 6500;
const ROPE_MAX_STRETCH = 1.16;
const PUMP = 420; // active tangential pump while holding the line
const REEL = 58; // slow, phase-aware web reeling
const GLIDE_G = 0.34;
const GLIDE_VY = 150;
const GLIDE_CLIMB = -76;
const GLIDE_FWD = 92;
const UPDRAFT_H = 300;
const UPDRAFT_VY = -190;
const GRACE = 2.2;
const METER = 50;
export const LEVEL_METERS = 250;
export const MAX_LEVELS = Number.POSITIVE_INFINITY;
const ROUTE_TRANSITION = 1.45;
const WEB_SOLVER_PASSES = 6;
const UNLOCK_KEY = "webby_unlocked";
const MAGNET_TIME = 9;

const BEST_KEY = "pauchok_best";
const TAUGHT_KEY = "webby_taught";

export class Game {
  world = new World();
  player = new Player();
  parts = new Particles();
  sfx = new Sfx();
  renderer: Renderer;

  state: GameState = "menu";
  time = 0;
  runT = 0;
  private startX = ROUTE_START_X;

  vw = 0;
  vh = 0;
  dpr = 1;
  cam = { x: -200, y: 0, sx: 0, sy: 0 };
  trauma = 0;

  pointer = { id: -1 };
  firstClick = false;
  texts: Popup[] = [];

  // one-button web control
  holdWeb = false;
  aim: { x: number; y: number } | null = null;
  snapFx: { px: number; py: number; ax: number; ay: number; t: number } | null =
    null;
  attachTime = -10;
  pumpFx = 0;
  gliding = false;
  glideHold = false; // explicit glide input (button / key)
  graceT = 0;
  lowAlt = 0;
  windGain = 0; // 0..1 how deep the player is inside an air current
  private glideAnnounced = false;
  levelT = 0;
  gateHole: { x: number; y: number; r: number } | null = null;
  gateIndex = 0;
  missedGate = false;
  segStartM = 0;
  announce: Announce | null = null;
  private announceT = 0;
  private autoRetryT = 0;

  // tutorial
  tip: Tip | null = null;
  private tipT = 0;
  private taught = new Set<string>();
  private tipScanT = 0;

  distM = 0;
  private journeyMeters = 0;
  coins = 0;
  tricks = 0;
  best = 0;
  newBest = false;
  trickDir: -1 | 0 | 1 = 0;
  level = 0;
  unlocked = 0;
  theme: ThemeId = "city";
  maxSpeed = 0;
  cause = "";
  private coinChain = 0;
  private coinChainT = 0;
  private dyingT = 0;
  private deadAt = -10;

  // power-ups
  shieldActive = false;
  magnetT = 0;
  private invulnT = 0;
  private perfectCombo = 0;
  private lastMilestone = 0;

  private raf = 0;
  private last = 0;
  private cb: (s: Snap) => void;
  private lastKey = "";
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, cb: (s: Snap) => void) {
    this.cb = cb;
    this.renderer = new Renderer(canvas);
    try {
      this.best = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
      this.unlocked = parseInt(localStorage.getItem(UNLOCK_KEY) ?? "0", 10) || 0;
      const saved = localStorage.getItem(TAUGHT_KEY);
      if (saved) this.taught = new Set<string>(JSON.parse(saved) as string[]);
    } catch {
      this.best = 0;
    }
    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("visibilitychange", this.onVis);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.world.ensure(0);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.emit();
  }

  /* ---------------- public API ---------------- */

  start(levelIndex?: number) {
    if (levelIndex !== undefined) {
      this.level = Math.max(0, Math.min(MAX_LEVELS - 1, levelIndex));
      if (this.level > this.unlocked) this.unlocked = this.level;
      try {
        localStorage.setItem(UNLOCK_KEY, String(this.unlocked));
      } catch {
        /* ignore */
      }
    }
    this.startRun(false);
  }

  private startRun(keepCoins: boolean) {
    this.world = new World(this.level);
    this.theme = themeForLevel(this.level);
    this.world.ensure(0);
    this.parts.list = [];
    this.texts = [];
    this.player.reset(this.startX, this.world.ceilY(this.startX) + 225);
    this.runT = 0;
    if (!keepCoins) {
      this.journeyMeters = 0;
      this.coins = 0;
      this.tricks = 0;
    }
    this.distM = this.journeyMeters;
    this.newBest = false;
    this.maxSpeed = 0;
    this.cause = "";
    this.coinChain = 0;
    this.firstClick = false;
    this.trauma = 0;
    this.shieldActive = false;
    this.magnetT = 0;
    this.invulnT = 0;
    this.perfectCombo = 0;
    this.lastMilestone = Math.floor(this.journeyMeters / 100) * 100;
    this.holdWeb = false;
    this.trickDir = 0;
    this.aim = null;
    this.snapFx = null;
    this.autoRetryT = 0;
    this.attachTime = -10;
    this.pumpFx = 0;
    this.windGain = 0;
    this.glideAnnounced = false;
    this.missedGate = false;
    this.segStartM = this.journeyMeters;
    this.gliding = false;
    this.glideHold = false;
    this.announce = null;
    this.announceT = 0;
    this.graceT = GRACE;
    this.tip = null;
    this.tipT = 0;
    this.tipScanT = 0;
    this.refreshGate();
    this.levelT = 0;
    this.cam.x = this.player.x - this.vw * 0.4;
    this.cam.y = this.player.y - this.vh * 0.52;
    this.state = "playing";
    this.sfx.ensure();
    this.sfx.start();
    this.sfx.padStart();
    // onboarding: first swing is free — shows what to do
    const ax = this.player.x + 135;
    this.player.attach(ax, this.world.ceilY(ax) + 2);
    if (this.level > 0) {
      const newLandscape = themeForLevel(this.level) !== themeForLevel(this.level - 1);
      this.showAnnounce({
        id: `waymark${this.level}-${Math.floor(this.time * 7)}`,
        kind: "level",
        title: newLandscape ? "NEW LANDSCAPE" : "WAYMARK REACHED",
        sub: themeDef(themeForLevel(this.level)).name,
      });
    }
    this.emit();
  }

  private advanceLevel() {
    // A reached waymark starts another 250 m stretch. The route is unbounded;
    // worlds change every five waymarks and the eight biomes then cycle.
    this.journeyMeters = Math.max(this.journeyMeters, this.distM);
    this.level += 1;
    if (this.level > this.unlocked) {
      this.unlocked = this.level;
      try {
        localStorage.setItem(UNLOCK_KEY, String(this.unlocked));
      } catch {
        /* ignore */
      }
    }
    this.startRun(true);
  }

  toMenu() {
    if (this.state === "playing" || this.state === "dying" || this.state === "paused")
      this.state = "menu";
    this.player.detach();
    this.sfx.setWind(0);
    this.sfx.padStop();
    this.emit();
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.sfx.setWind(0);
    this.sfx.padDuck(true);
    this.emit();
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.sfx.ensure();
    this.sfx.padDuck(false);
    this.emit();
  }

  toggleMute() {
    this.sfx.setMuted(!this.sfx.muted);
    this.emit();
  }

  /** Hold a direction to tuck into a real, momentum-carrying somersault. */
  setTrick(direction: -1 | 0 | 1) {
    this.trickDir = direction;
  }

  /** explicit glide input — held from a button or a key */
  setGlide(on: boolean) {
    if (this.glideHold === on) return;
    this.glideHold = on;
    if (on && this.state === "playing") {
      if (this.player.attached) this.release(false);
      if (!this.glideAnnounced) {
        this.glideAnnounced = true;
        this.showAnnounce({
          id: "glide" + this.level,
          kind: "glide",
          title: "GLIDE MODE",
          sub: "web-wings deployed",
        });
      }
      this.sfx.magnetUp();
    }
    this.emit();
  }

  private showAnnounce(a: Announce) {
    this.announce = a;
    this.announceT = 1.5;
    this.emit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("visibilitychange", this.onVis);
    this.sfx.dispose();
  }

  /* ---------------- input ---------------- */

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    const c = this.renderer.canvas;
    c.width = Math.round(this.vw * this.dpr);
    c.height = Math.round(this.vh * this.dpr);
  };

  private onVis = () => {
    if (document.hidden && this.state === "playing") this.pause();
  };

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this.sfx.ensure();
    if (this.state === "menu") {
      this.start();
      return;
    }
    if (this.state === "dead") {
      if (this.time - this.deadAt > 0.45) this.start();
      return;
    }
    if (this.state !== "playing") return;
    this.pointer.id = e.pointerId;
    this.holdWeb = true;
    this.autoRetryT = 0;
    this.tryAutoAttach();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointer.id !== -1 && e.pointerId !== this.pointer.id) return;
    this.pointer.id = -1;
    this.holdWeb = false;
    this.release(false);
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyR") {
      e.preventDefault();
      this.start();
    } else if (e.code === "KeyM") {
      this.toggleMute();
    } else if (e.code === "KeyP") {
      e.preventDefault();
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    } else if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (this.state === "menu") this.start();
      else if (this.state === "dead" && this.time - this.deadAt > 0.45)
        this.start();
      else if (this.state === "paused") this.resume();
      else if (this.state === "playing" && !e.repeat) {
        // one-button web: hold to auto-swing
        this.holdWeb = true;
        this.autoRetryT = 0;
        this.tryAutoAttach();
      }
    } else if (
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "KeyG" ||
      e.code === "ArrowDown"
    ) {
      e.preventDefault();
      if (this.state === "playing" && !e.repeat) this.setGlide(true);
    } else if (e.code === "KeyA" || e.code === "ArrowLeft") {
      e.preventDefault();
      if (this.state === "playing") this.setTrick(-1);
    } else if (e.code === "KeyD" || e.code === "ArrowRight") {
      e.preventDefault();
      if (this.state === "playing") this.setTrick(1);
    } else if (e.code === "Escape") {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "Enter") {
      this.holdWeb = false;
      this.release(false);
    } else if (
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "KeyG" ||
      e.code === "ArrowDown"
    ) {
      this.setGlide(false);
    } else if (
      e.code === "KeyA" || e.code === "ArrowLeft" || e.code === "KeyD" || e.code === "ArrowRight"
    ) {
      this.setTrick(0);
    }
  };

  /* ---------------- web ---------------- */

  /** release the current web; rewards sweet-spot timing */
  private release(reAim: boolean) {
    const p = this.player;
    if (!p.attached || this.state !== "playing") return;
    // rope angle from straight-down (0 = hanging below anchor)
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    const sp = p.speed();
    const perfect = p.vx > 150 && ang > 12 && ang < 72 && sp > 250;
    this.snapFx = { px: p.x, py: p.y, ax: p.ax, ay: p.ay, t: 0.26 };
    p.detach();
    this.sfx.whoosh();
    this.parts.burst(p.x, p.y, "rgba(244,239,220,0.92)", 6, 130, 2.4, 0.4, 300);
    if (perfect) {
      // Timing is rewarded as flow feedback, not an unexplained velocity boost.
      this.perfectCombo = Math.min(9, this.perfectCombo + 1);
      if (this.perfectCombo === 1 || this.perfectCombo % 3 === 0) {
        this.popup(
          p.x,
          p.y - 48,
          this.perfectCombo > 1 ? `PERFECT ×${this.perfectCombo}` : "PERFECT",
          "#91a680",
          18,
        );
      }
      this.parts.ring(p.x, p.y, "rgba(145,166,128,0.72)", 8, 0.45);
      this.sfx.perfect(this.perfectCombo);
      if (this.perfectCombo === 4 || this.perfectCombo === 7)
        this.showAnnounce({
          id: "perfect" + this.perfectCombo,
          kind: "perfect",
          title: `PERFECT ×${this.perfectCombo}`,
          sub: "flawless release chain",
        });
    } else {
      this.perfectCombo = 0;
    }
    void reAim;
  }

  /**
   * Auto-aim: scan surfaces ahead and rate every candidate anchor —
   * good forward angle, mid rope length, line of sight, no lava dip.
   */
  private findBestAnchor(
    desperate = false,
  ): { x: number; y: number; d: number } | null {
    const p = this.player;
    const w = this.world;
    const cands: { x: number; y: number; d: number; score: number }[] = [];
    // when nothing good is ahead, accept anything overhead or slightly behind
    const minD = desperate ? 44 : 64;
    const minBack = desperate ? -220 : 2;
    const maxTheta = desperate ? 104 : 84;

    const consider = (ax: number, ay: number) => {
      const dx = ax - p.x;
      const dy = ay - p.y;
      const d = Math.hypot(dx, dy);
      if (d < minD || d > ROPE_MAX) return;
      if (dy > -24) return; // anchor must be clearly above
      if (dx < minBack) return;
      const theta = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = straight up
      if (theta > maxTheta) return;
      let score = 0;
      score += Math.abs(theta - 40) * 1.6; // ~40° ahead is the sweet spot
      score += Math.abs(d - 215) * 0.35; // mid-length ropes swing best
      // would the pendulum dip into lava anywhere along the sweep? (rope also spools +70)
      let lowestSky = w.lavaY(ax);
      for (let k = 0; k <= 6; k++) {
        const sx = p.x + ((ax + d) - p.x) * (k / 6);
        lowestSky = Math.min(lowestSky, w.lavaY(sx));
      }
      const dip = ay + d * ROPE_MAX_STRETCH + 48 + p.r + 10 - lowestSky;
      // Prefer a web whose full elastic swing still clears the hillside. The
      // desperate scan tolerates a small brush of the safety margin, never a
      // line that would predictably pull the player into the ground.
      if (dip > (desperate ? 36 : 12)) return;
      if (dip > 0) score += 260 + dip;
      // line of sight — the surface must actually block the ray there
      const hit = w.raycast(p.x, p.y, dx / d, dy / d, d + 12);
      if (!hit || dist(hit.x, hit.y, ax, ay) > 18) return;
      cands.push({ x: ax, y: ay, d, score });
    };

    // ceiling samples (desperate scans behind the spider too)
    const from = desperate ? -ROPE_MAX : 46;
    for (let ox = from; ox <= ROPE_MAX + 40; ox += 20) {
      const sx = p.x + ox;
      if (sx < 0) continue;
      if (w.ceilSolid(sx)) consider(sx, w.ceilY(sx) + 3);
    }
    // platforms: undersides + top corners
    w.eachNear(p.x + (desperate ? 0 : 170), (o) => {
      if (o.kind !== "plat") return;
      for (let k = -2; k <= 2; k++)
        consider(o.x + (k * o.w) / 5, o.y + o.h / 2 + 4);
      consider(o.x - o.w / 2 + 5, o.y - o.h / 2 - 2);
      consider(o.x + o.w / 2 - 5, o.y - o.h / 2 - 2);
    });

    if (cands.length === 0) return null;
    cands.sort((a, b) => a.score - b.score);

    // ---- second pass: walk the actual swing arc on the shortlisted anchors.
    // A coarse sample can slip straight over a 30px spire, so this one is fine.
    const shortlist = Math.min(cands.length, 6);
    let best: { x: number; y: number; d: number; score: number } | null = null;
    for (let i = 0; i < shortlist; i++) {
      const c = cands[i];
      const a0 = Math.atan2(p.x - c.x, p.y - c.y);
      const aEnd = Math.PI / 2 + Math.PI * 0.42; // through the bottom and out the far upswing
      let penalty = 0;
      const N = 16;
      for (let k = 1; k <= N; k++) {
        const a = a0 + ((aEnd - a0) * k) / N;
        const hx = c.x + Math.sin(a) * c.d;
        const hy = c.y + Math.cos(a) * c.d;
        if (w.hazardNear(hx, hy, 34, this.time)) penalty += 120;
      }
      c.score += penalty;
      if (!best || c.score < best.score) best = c;
      // early out: nothing further down the list can beat what we already have
      const next = cands[i + 1];
      if (best && next && best.score + 120 * 16 < next.score) break;
    }
    return best ? { x: best.x, y: best.y, d: best.d } : null;
  }

  /** attach to the auto-aim target, if any */
  private tryAutoAttach(): boolean {
    const p = this.player;
    if (p.attached || this.state !== "playing") return false;
    // normal scan, then a desperate one so you are never left with no option
    const cand = this.findBestAnchor() ?? this.findBestAnchor(true);
    if (!cand) return false;
    p.attach(cand.x, cand.y);
    this.attachTime = this.time;
    this.firstClick = true;
    this.parts.burst(cand.x, cand.y, "rgba(232,220,187,0.92)", 9, 150, 2.4, 0.35, 150);
    this.parts.ring(cand.x, cand.y, "rgba(202,191,157,0.72)", 3, 0.3);
    this.sfx.thwip();
    this.emit();
    return true;
  }

  private popup(x: number, y: number, str: string, color: string, size = 20) {
    if (this.texts.length > 5) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 0.7, max: 0.7 });
  }

  /* ---------------- core loop ---------------- */

  private frame = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt < 0) dt = 0;
    if (this.state === "paused") {
      this.renderer.render(this); // frozen frame under the pause overlay
      return;
    }
    this.time += dt;
    this.update(dt);
    this.renderer.render(this);
  };

  private update(dt: number) {
    if (this.snapFx) {
      this.snapFx.t -= dt;
      if (this.snapFx.t <= 0) this.snapFx = null;
    }
    // floating popup texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tp = this.texts[i];
      tp.life -= dt;
      tp.y -= 30 * dt;
      if (tp.life <= 0) this.texts.splice(i, 1);
    }
    // steam drifting up from the street vents
    if (Math.random() < dt * 5) {
      const bx = this.cam.x - 40 + Math.random() * (this.vw + 80);
      this.parts.spawn({
        x: bx,
        y: this.world.lavaY(bx) - 4,
        vy: -50 - Math.random() * 70,
        vx: (Math.random() - 0.5) * 30,
        life: 1.5,
        size: 5 + Math.random() * 9,
        color: "rgba(225,212,176,0.38)",
        grav: -40,
        drag: 0.03,
      });
    }
    this.parts.update(dt);

    if (this.state === "menu") {
      this.cam.x += dt * 46;
      this.world.ensure(this.cam.x + this.vw);
      this.cam.y = lerp(this.cam.y, 30, 1 - Math.exp(-dt * 2));
      this.updateShake(dt);
      return;
    }

    if (this.state === "dying") {
      this.dyingT += dt;
      this.updateShake(dt);
      if (this.dyingT > 0.8) {
        this.state = "dead";
        this.deadAt = this.time;
        try {
          localStorage.setItem(BEST_KEY, String(this.best));
        } catch {
          /* ignore */
        }
        if (this.newBest) this.sfx.best();
        this.emit();
      }
      this.sfx.setWind(0);
      return;
    }

    if (this.state === "levelup") {
      this.levelT += dt;
      // Reaching a waymark pauses the trail where the spider crossed it. The
      // marker never pulls the player in; a few drifting leaves mark the rest.
      const p2 = this.player;
      p2.trail.push({ x: p2.x, y: p2.y });
      if (p2.trail.length > 22) p2.trail.shift();
      if (Math.random() < dt * 18) {
        const a = Math.random() * Math.PI * 2;
        const rr = 18 + Math.random() * 38;
        this.parts.spawn({
          x: p2.x + Math.cos(a) * rr,
          y: p2.y + Math.sin(a) * rr,
          vx: Math.cos(a) * 22,
          vy: -18 - Math.random() * 24,
          life: 0.7 + Math.random() * 0.45,
          size: 2 + Math.random() * 3,
          color: "rgba(225,212,176,0.5)",
          grav: -14,
        });
      }
      this.parts.update(dt);
      this.trauma = Math.max(0, this.trauma - dt * 0.6);
      this.updateShake(dt);
      this.sfx.setWind(0);
      if (this.levelT > ROUTE_TRANSITION) {
        this.state = "playing"; // guard so advanceLevel can restart cleanly
        this.advanceLevel();
      } else {
        this.emit();
      }
      return;
    }

    if (this.state !== "playing") return;

    this.runT += dt;
    const sub = Math.max(1, Math.ceil(dt * 240));
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      this.step(h);
      if (this.state !== "playing") break;
    }
    if (this.state !== "playing") return;

    const p = this.player;
    const sp = p.speed();
    this.maxSpeed = Math.max(this.maxSpeed, sp);

    // trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 22) p.trail.shift();

    // power-up timers
    if (this.magnetT > 0) this.magnetT = Math.max(0, this.magnetT - dt);
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.graceT > 0) this.graceT = Math.max(0, this.graceT - dt);
    if (this.announceT > 0) {
      this.announceT -= dt;
      if (this.announceT <= 0) {
        this.announce = null;
        this.emit();
      }
    }

    // coin chain window
    if (this.coinChainT > 0) {
      this.coinChainT -= dt;
      if (this.coinChainT <= 0) this.coinChain = 0;
    }

    // camera
    const lk = clamp(p.vx * 0.22, -30, 260);
    const tx = p.x - this.vw * 0.4 + lk;
    const ty = p.y - this.vh * 0.52 + clamp(p.vy * 0.08, -70, 90);
    this.cam.x = lerp(this.cam.x, tx, 1 - Math.exp(-dt * 7));
    this.cam.y = lerp(
      this.cam.y,
      clamp(ty, -280, 440),
      1 - Math.exp(-dt * 4.2),
    );
    this.updateShake(dt);
    this.world.ensure(p.x + this.vw);

    // Waymarks are gentle goals, not magnets: the player has to steer through
    // the arch. Missing one simply sets the next marker 250 m farther on.
    const gh = this.gateHole;
    if (gh && this.state === "playing" && p.x > gh.x + 180 && !this.missedGate) {
      this.missedGate = true;
      this.segStartM = this.journeyMeters + Math.max(0, Math.floor((p.x - this.startX) / METER));
      this.refreshGate();
      this.popup(p.x, p.y - 54, "NEXT WAYMARK AHEAD", "#8d9d70", 16);
    }

    this.updateTips(dt);

    // held the same line for a long time? teach the release once.
    if (p.attached && this.time - this.attachTime > 2.6 && this.judgeHold()) {
      this.show("release");
    }

    // one-button web: keep grabbing while the key is held
    if (this.holdWeb && !p.attached) {
      this.autoRetryT -= dt;
      if (this.autoRetryT <= 0) {
        this.autoRetryT = 0.075;
        this.tryAutoAttach();
      }
    }
    // predict where the auto-web will grab next (aim indicator)
    this.aim = p.attached ? null : this.findBestAnchor();

    // how close to the street — drives the on-screen warning
    const alt = this.world.lavaY(p.x) - p.y;
    this.lowAlt = clamp(1 - alt / 300, 0, 1);

    // The journey keeps its total distance across each 250 m waymark.
    const m = this.journeyMeters + Math.max(0, Math.floor((p.x - this.startX) / METER));
    if (m !== this.distM) this.distM = m;
    const ms = Math.floor(this.distM / 100) * 100;
    if (ms > 0 && ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.popup(p.x, p.y - 70, `${ms} m`, "#b89158", 20);
      this.sfx.milestone();
    }

    this.sfx.setWind(sp / MAXV);
    this.sfx.padLevel(sp / MAXV);
    this.emit();
  }

  private step(h: number) {
    const p = this.player;
    // ---- glide: holding with no web out spreads the web-wings ----
    // The spider catches air instead of dropping like a stone, which gives
    // you time to find the next ledge (and makes the early game forgiving).
    const glide =
      !p.attached &&
      !p.grounded &&
      this.glideHold &&
      p.vy > -80 &&
      this.state === "playing";
    this.gliding = glide;
    const wind = this.sampleWind();
    p.vy += (glide ? G * GLIDE_G : G) * h * (1 - 0.25 * wind.gain);
    if (glide) {
      // speed turns into altitude: a fast glide climbs, a slow one sinks
      const liftF = clamp((Math.abs(p.vx) - 270) / 620, 0, 1);
      let targetVy = lerp(GLIDE_VY, GLIDE_CLIMB, liftF);
      // thermals off the avenue — gliding can skim the street but never sink in
      const alt = this.world.lavaY(p.x) - p.y;
      let rate = 8;
      if (alt < UPDRAFT_H) {
        const u = clamp(1 - alt / UPDRAFT_H, 0, 1);
        targetVy = lerp(targetVy, UPDRAFT_VY, u);
        // the lower you are, the more instantly the updraft grabs you
        rate = lerp(8, 42, u * u);
      }
      if (p.vy > targetVy) p.vy += (targetVy - p.vy) * Math.min(1, h * rate);
      p.vx += GLIDE_FWD * h;
    }
    // A current is honest drag: the air pulls the body toward its own
    // velocity. Strong enough in the core to carry you, gentle at the edges.
    if (wind.gain > 0.01) {
      const c = wind.gain * wind.gain * 12; // 1/s
      const k = Math.min(1, c * h);
      p.vx += (wind.vx - p.vx) * k;
      p.vy += (wind.vy - p.vy) * k;
    }

    // pace quickens the further you go — gently
    const fwd = p.attached ? FWD_ATT : FWD;
    p.vx += fwd * h * (p.grounded ? 2.2 : 1);
    // gentle air drag
    p.vx *= Math.pow(0.5, h * (p.attached ? 0.045 : 0.13));
    p.vy *= Math.pow(0.5, h * 0.05);
    const sp = p.speed();
    if (sp > MAXV) {
      const k = MAXV / sp;
      p.vx *= k;
      p.vy *= k;
    }
    // ---- air currents: strong flowing funnels you can ride ----
    // The flow drags the body toward its velocity and takes weight off the
    // wings, so a strong current can genuinely carry you across a gap.
    p.x += p.vx * h;
    p.y += p.vy * h;

    // A web is a one-way damped spring: it can sag, stretch, and return a little
    // energy, but it can never push the spider away from its anchor.
    if (p.attached) this.applyWebTension(h);

    // Intentional pumping is a small tangential force, with a gentle reel on
    // the upswing. The web—not an automatic speed multiplier—does the work.
    if (p.attached) {
      const rx = p.x - p.ax;
      const ry = p.y - p.ay;
      const d = Math.hypot(rx, ry) || 0.0001;
      const tx = -ry / d;
      const ty = rx / d;
      const vt = p.vx * tx + p.vy * ty;
      const dir = vt >= 0 ? 1 : -1;
      const speedFactor = clamp(1 - p.speed() / 820, 0.12, 1);
      const inputFactor = this.holdWeb ? 1 : 0.28;
      p.vx += tx * dir * PUMP * speedFactor * inputFactor * h;
      p.vy += ty * dir * PUMP * speedFactor * inputFactor * h;
      this.pumpFx = clamp(speedFactor * inputFactor, 0, 1);

      const rising = p.vy < 0;
      const minRope = Math.max(76, p.rope0 - 64);
      const maxRope = p.rope0 + (this.holdWeb ? 48 : 20);
      const reelFactor = this.holdWeb ? 1 : 0.35;
      p.rope = clamp(
        p.rope + (rising ? -REEL : REEL * 0.72) * h * reelFactor,
        minRope,
        maxRope,
      );
    } else {
      this.pumpFx = 0;
    }

    const postSwingSpeed = p.speed();
    if (postSwingSpeed > MAXV) {
      const scale = MAXV / postSwingSpeed;
      p.vx *= scale;
      p.vy *= scale;
    }
    if (p.grounded && p.vx < 180) p.vx = Math.max(p.vx, p.vx + 220 * h);
    this.collide();
    this.stepRotation(h);
    if (p.attached && this.state === "playing") this.updateWebChain(h);
  }

  private applyWebTension(h: number) {
    const p = this.player;
    const dx = p.x - p.ax;
    const dy = p.y - p.ay;
    const length = Math.hypot(dx, dy) || 0.0001;
    const nx = dx / length;
    const ny = dy / length;
    const stretch = length - p.rope;

    if (stretch > 0) {
      const radialSpeed = p.vx * nx + p.vy * ny;
      const tension = clamp(
        ROPE_K * stretch + ROPE_DAMP * Math.max(0, radialSpeed),
        0,
        ROPE_MAX_TENSION,
      );
      p.vx -= nx * tension * h;
      p.vy -= ny * tension * h;
    }

    // A soft line has a hard safety limit beyond its elastic travel. The
    // correction only removes outward motion; tangential momentum is kept.
    const maxLength = p.rope * ROPE_MAX_STRETCH;
    if (length > maxLength) {
      p.x = p.ax + nx * maxLength;
      p.y = p.ay + ny * maxLength;
      const outward = p.vx * nx + p.vy * ny;
      if (outward > 0) {
        p.vx -= nx * outward * 0.78;
        p.vy -= ny * outward * 0.78;
      }
    }
  }

  /** Verlet integration plus distance constraints for the visible silk strand. */
  private updateWebChain(h: number) {
    const p = this.player;
    const nodes = p.webNodes;
    if (nodes.length !== WEB_SEGMENTS + 1) return;
    const last = WEB_SEGMENTS;

    nodes[0].x = nodes[0].px = p.ax;
    nodes[0].y = nodes[0].py = p.ay;
    nodes[last].x = nodes[last].px = p.x;
    nodes[last].y = nodes[last].py = p.y;

    for (let i = 1; i < last; i++) {
      const node = nodes[i];
      const vx = (node.x - node.px) * 0.994;
      const vy = (node.y - node.py) * 0.994;
      node.px = node.x;
      node.py = node.y;
      node.x += vx;
      node.y += vy + G * 0.12 * h * h;
    }

    // If the player is temporarily stretching the spring, the strand follows
    // that stretch instead of snapping into a straight, impossible chord.
    const chord = Math.hypot(p.x - p.ax, p.y - p.ay);
    const segmentLength = Math.max(p.rope, chord) / last;
    for (let pass = 0; pass < WEB_SOLVER_PASSES; pass++) {
      nodes[0].x = p.ax;
      nodes[0].y = p.ay;
      nodes[last].x = p.x;
      nodes[last].y = p.y;
      for (let i = 0; i < last; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const correction = (d - segmentLength) / d;
        if (i === 0) {
          b.x -= dx * correction;
          b.y -= dy * correction;
        } else if (i === last - 1) {
          a.x += dx * correction;
          a.y += dy * correction;
        } else {
          const cx = dx * correction * 0.5;
          const cy = dy * correction * 0.5;
          a.x += cx;
          a.y += cy;
          b.x -= cx;
          b.y -= cy;
        }
      }
    }

    nodes[0].x = nodes[0].px = p.ax;
    nodes[0].y = nodes[0].py = p.ay;
    nodes[last].x = nodes[last].px = p.x;
    nodes[last].y = nodes[last].py = p.y;
  }

  private stepRotation(h: number) {
    const p = this.player;
    const target = Math.atan2(p.vy, p.vx || 0.0001);
    const error = Math.atan2(Math.sin(target - p.rotation), Math.cos(target - p.rotation));

    if (p.attached) {
      // While webbed, the body follows the swing tangent with a small inertial lag.
      p.angularVelocity += error * 18 * h;
      p.angularVelocity *= Math.exp(-7 * h);
      p.rotation += p.angularVelocity * h;
      p.lastFlipAngle = p.rotation;
      p.flips = 0;
      return;
    }

    if (this.trickDir !== 0 && !p.grounded) {
      p.angularVelocity += this.trickDir * 6.5 * h;
    } else if (Math.abs(p.angularVelocity) < 1.25 && !p.grounded) {
      // At low spin the body settles back into the direction of travel.
      p.angularVelocity += clamp(error * 2.8, -2.2, 2.2) * h;
    }

    p.angularVelocity *= Math.exp(-(this.trickDir !== 0 ? 0.2 : p.grounded ? 5 : 0.42) * h);
    p.angularVelocity = clamp(p.angularVelocity, -8, 8);
    p.rotation += p.angularVelocity * h;

    const turns = Math.trunc((p.rotation - p.lastFlipAngle) / (Math.PI * 2));
    if (turns !== 0) {
      const count = Math.abs(turns);
      p.lastFlipAngle += turns * Math.PI * 2;
      p.flips += count;
      this.tricks += count;
      this.popup(p.x, p.y - 48, count > 1 ? `×${count} SOMERSAULTS` : "SOMERSAULT", "#a7805e", 17);
      this.parts.ring(p.x, p.y, "rgba(190,148,106,0.52)", 5, 0.38);
      this.sfx.coin(Math.min(count, 4));
      this.emit();
    }
  }

  private collide() {
    const p = this.player;
    const w = this.world;
    if (this.state !== "playing") return;
    p.grounded = false;

    // soft ceiling bump (not deadly)
    if (w.ceilSolid(p.x)) {
      const cy = w.ceilY(p.x);
      if (p.y - p.r < cy) {
        p.y = cy + p.r + 0.5;
        if (p.vy < 0) p.vy *= -0.22;
      }
    }

    // Cross through the visible opening of the wooden arch; its broad frame is
    // forgiving, but simply passing beside it does not advance the journey.
    const gate = this.gateHole;
    const withinArch =
      gate !== null &&
      Math.abs(p.x - gate.x) < gate.r * 0.72 + p.r * 0.35 &&
      p.y > gate.y - gate.r * 0.78 - p.r * 0.2 &&
      p.y < gate.y + gate.r * 0.82 + p.r * 0.2;
    if (gate && withinArch) {
      this.reachPortal(gate.x, gate.y);
      return;
    }

    // lava — deadly (unless shielded)
    if (p.y + p.r > w.lavaY(p.x) - 2) {
      this.die("lava");
      return;
    }

    let death: string | null = null;
    w.eachNear(p.x, (o) => {
      if (death || this.state !== "playing") return;
      switch (o.kind) {
        case "plat": {
          const hw = o.w / 2;
          const hh = o.h / 2;
          const nx = clamp(p.x, o.x - hw, o.x + hw);
          const ny = clamp(p.y, o.y - hh, o.y + hh);
          const ddx = p.x - nx;
          const ddy = p.y - ny;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < p.r * p.r) {
            if (d2 > 0.0001) {
              const d = Math.sqrt(d2);
              const ux = ddx / d;
              const uy = ddy / d;
              p.x = nx + ux * (p.r + 0.5);
              p.y = ny + uy * (p.r + 0.5);
              const vr = p.vx * ux + p.vy * uy;
              if (vr < 0) {
                p.vx -= vr * ux * 1.25;
                p.vy -= vr * uy * 1.25;
              }
              if (uy < -0.55 && p.vy >= -1) {
                p.grounded = true;
                p.vy = 0;
              }
            } else {
              p.y = o.y - hh - p.r - 0.5;
              p.vy = 0;
              p.grounded = true;
            }
          }
          break;
        }
        case "stal": {
          // approximating the spike with 3 circles (forgiving)
          for (let k = 0; k < 3; k++) {
            const f = (k + 1) / 3.4;
            const cy = o.y + o.len * f;
            const cr = o.w * (1 - f) * 0.8 + 3;
            if (dist(p.x, p.y, o.x, cy) < cr + p.r - 4) {
              death = "spike";
              break;
            }
          }
          break;
        }
        case "saw": {
          const sy = o.y + Math.sin(this.time * 1.3 + o.ph) * o.bob;
          if (dist(p.x, p.y, o.x, sy) < o.r + p.r - 5) death = "saw";
          break;
        }
        case "spire": {
          if (p.y > o.tip && p.y < o.base) {
            const t = clamp((p.y - o.tip) / Math.max(1, o.base - o.tip), 0, 1);
            const hw = lerp(6, o.w / 2, t);
            if (Math.abs(p.x - o.x) < hw + p.r * 0.72) death = "spire";
          }
          break;
        }
        case "coin": {
          if (!o.got) {
            const d = dist(p.x, p.y, o.x, o.y);
            const pullR = this.magnetT > 0 ? 215 : 70;
            if (d < pullR) {
              // magnet power-up sucks coins hard, base is a gentle pull
              const f =
                this.magnetT > 0
                  ? 0.05
                  : (1 - Math.exp(-0.45 * (70 - d) * 0.016)) * 0.12;
              o.x = lerp(o.x, p.x, f);
              o.y = lerp(o.y, p.y, f);
            }
            if (d < p.r + 24) {
              o.got = true;
              this.onCoin(o.x, o.y);
            }
          }
          break;
        }
        case "fire": {
          const hw = o.w / 2;
          if (
            Math.abs(p.x - o.x) < hw * 0.94 + p.r * 0.4 &&
            p.y > o.y - p.r * 0.5 &&
            p.y < o.y + o.h + p.r * 0.5
          )
            death = "fire";
          break;
        }
        case "fish":
        case "drone":
          // Wildlife is scenery, not a collision hazard.
          break;
        case "shield": {
          if (!o.got && dist(p.x, p.y, o.x, o.y) < 34 + p.r) {
            o.got = true;
            this.shieldActive = true;
            this.showAnnounce({
              id: "shield" + Math.floor(this.time * 10),
              kind: "shield",
              title: "SHIELD UP",
              sub: "absorbs one fatal hit",
            });
            this.popup(p.x, p.y - 56, "SHIELD ON", "#89a47b", 22);
            this.parts.burst(o.x, o.y, "#89a47b", 12, 190, 2.6, 0.5, 240);
            this.parts.ring(o.x, o.y, "rgba(137,164,123,0.72)", 5, 0.4);
            this.sfx.shieldUp();
            this.emit();
          }
          break;
        }
        case "magnet": {
          if (!o.got && dist(p.x, p.y, o.x, o.y) < 34 + p.r) {
            o.got = true;
            this.magnetT = MAGNET_TIME;
            this.showAnnounce({
              id: "magnet" + Math.floor(this.time * 10),
              kind: "magnet",
              title: "MAGNET",
              sub: `${MAGNET_TIME}s of coin vacuum`,
            });
            this.popup(p.x, p.y - 56, "MAGNET!", "#b87e67", 22);
            this.parts.burst(o.x, o.y, "#bd8066", 12, 190, 2.6, 0.5, 240);
            this.parts.ring(o.x, o.y, "rgba(189,128,102,0.68)", 5, 0.4);
            this.sfx.magnetUp();
            this.emit();
          }
          break;
        }
      }
    });
    if (death) this.die(death);
  }

  private onCoin(x: number, y: number) {
    this.coins += 1;
    this.coinChain += 1;
    this.coinChainT = 1.4;
    this.sfx.coin(this.coinChain);
    this.parts.burst(x, y, "#d1ac69", 10, 170, 2.6, 0.45, 320);
    this.parts.ring(x, y, "rgba(209,172,105,0.72)", 4, 0.35);
    this.emit();
  }

  /** shield absorbs one lethal hit and bails you out */
  private breakShield(cause: string) {
    const p = this.player;
    this.shieldActive = false;
    this.invulnT = 1.15;
    if (cause === "lava") {
      p.vy = -880;
      p.vx += 160;
      // lift out of the lava plane so the bounce reads
      p.y = this.world.lavaY(p.x) - p.r * 1.6;
    } else {
      p.vy = Math.min(p.vy, -620);
      p.vx += 90;
    }
    this.trauma = Math.min(0.7, this.trauma + 0.45);
    this.showAnnounce({
      id: "save" + Math.floor(this.time * 10),
      kind: "save",
      title: "SAVED!",
      sub: "shield absorbed the hit",
    });
    this.popup(p.x, p.y - 64, "SAVED!", "#89a47b", 28);
    this.parts.burst(p.x, p.y, "#89a47b", 20, 340, 3, 0.6, 420);
    this.parts.ring(p.x, p.y, "rgba(137,164,123,0.76)", 10, 0.6);
    this.sfx.shieldBreak();
    this.emit();
  }

  private die(cause: string) {
    if (this.state !== "playing") return;
    // opening grace — nobody should die in the first seconds of a run
    if (this.graceT > 0 && this.runT < 25) {
      const p = this.player;
      if (cause === "lava") {
        p.y = this.world.lavaY(p.x) - p.r * 2.2;
        p.vy = -700;
        p.vx = Math.max(p.vx, 320);
      } else {
        // bounce off the hazard instead of dying (and don't get stuck in it)
        p.detach();
        p.vy = Math.min(p.vy, -300);
        p.y -= p.r * 1.5;
        p.vx = Math.max(p.vx * 0.75, 260);
      }
      this.parts.burst(p.x, p.y, "#91a680", 12, 240, 2.6, 0.5, 300);
      this.parts.ring(p.x, p.y, "rgba(145,166,128,0.72)", 6, 0.4);
      this.graceT = Math.max(this.graceT, 0.5); // brief i-frames after a bump
      this.sfx.shieldUp();
      return;
    }
    if (this.shieldActive && this.invulnT <= 0) {
      this.breakShield(cause);
      return;
    }
    this.state = "dying";
    this.dyingT = 0;
    this.cause = cause;
    this.trauma = 1;
    this.shieldActive = false;
    this.magnetT = 0;
    this.perfectCombo = 0;
    const p = this.player;
    p.detach();
    this.parts.burst(p.x, p.y, "#bf775f", 14, 180, 2.8, 0.7, 360);
    this.parts.burst(p.x, p.y, "#ffd9de", 8, 220, 2.4, 0.6, 500);
    this.parts.burst(p.x, p.y, "#7c8975", 10, 260, 3, 0.7, 620);
    this.parts.ring(p.x, p.y, "rgba(255,255,255,0.9)", 8, 0.6);
    this.sfx.death();
    this.sfx.padStop();
    if (this.distM > this.best) {
      this.best = this.distM;
      this.newBest = true;
    }
    this.sfx.setWind(0);
    this.emit();
  }

  /** contextual tutorial — teach each thing the first time it shows up */
  private updateTips(dt: number) {
    if (this.tip) {
      this.tipT -= dt;
      if (this.tipT <= 0) {
        this.tip = null;
        this.emit();
      }
      return;
    }
    this.tipScanT -= dt;
    if (this.tipScanT > 0) return;
    this.tipScanT = 0.2;

    const p = this.player;
    // core lessons first
    if (this.show("swing")) return;
    if (this.gliding && this.show("glide")) return;
    if (this.runT > 3.5 && this.show("street")) return;
    if (p.attached && this.runT > 6 && this.show("pump")) return;

    // the gate is the goal of every level — explain it on approach
    if (this.distM > 150 && this.show("portal")) return;

    // then whatever hazard or pickup is coming up next
    const lookahead = 760;
    let found: string | null = null;
    this.world.eachNear(p.x + 420, (o) => {
      if (found) return;
      const ox = o.x;
      if (ox < p.x + 120 || ox > p.x + lookahead) return;
      if (o.kind === "plat" && o.pod) {
        if (!this.taught.has("pod") && ox < p.x + 420) found = "pod";
        return;
      }
      if (o.kind === "coin" && o.got) return;
      if ((o.kind === "shield" || o.kind === "magnet") && o.got) return;
      if (!this.taught.has(o.kind) && TIPS[o.kind]) found = o.kind;
    });
    if (found) this.show(found);
  }

  private show(id: string): boolean {
    if (this.taught.has(id)) return false;
    const tip = TIPS[id];
    if (!tip) return false;
    this.taught.add(id);
    try {
      localStorage.setItem(
        TAUGHT_KEY,
        JSON.stringify(Array.from(this.taught)),
      );
    } catch {
      /* ignore */
    }
    this.tip = tip;
    this.tipT = tip.tone === "info" ? 5 : 4;
    this.sfx.tick();
    this.emit();
    return true;
  }

  /** true when the spider is just rocking on a line and would rather be let go */
  private judgeHold(): boolean {
    const p = this.player;
    if (!p.attached || !this.holdWeb) return false;
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    return Math.abs(ang) > 55 || p.speed() < 190;
  }

  /** replay the whole tutorial from scratch */
  resetTutorial() {
    this.taught.clear();
    try {
      localStorage.removeItem(TAUGHT_KEY);
    } catch {
      /* ignore */
    }
    this.emit();
  }

  /** strongest air current the spider is standing in right now */
  private sampleWind(): { gain: number; vx: number; vy: number; strength: number } {
    const p = this.player;
    const out = { gain: 0, vx: 0, vy: 0, strength: 0 };
    this.world.eachNear(p.x, (o) => {
      if (o.kind !== "wind") return;
      const fx = clamp(1 - Math.abs(p.x - o.x) / (o.w / 2), 0, 1);
      const fy = clamp(1 - Math.abs(p.y - o.y) / (o.h / 2), 0, 1);
      if (fx <= 0 || fy <= 0) return;
      const edge = Math.min(fx, fy);
      if (edge <= out.gain) return;
      out.gain = edge;
      out.vx = o.vx;
      out.vy = o.vy;
      out.strength = o.strength;
    });
    this.windGain = out.gain;
    return out;
  }

  /** Point the waymark at the next 250 m waypoint; there is no final gate. */
  private refreshGate() {
    const p = this.player;
    const spacing = LEVEL_METERS * METER;
    const k = Math.max(0, Math.ceil((p.x + 200 - this.startX) / spacing) - 1);
    this.gateIndex = k;
    const gx = gateX(k);
    this.gateHole = { x: gx, y: this.world.lavaY(gx) - 210, r: 62 };
  }

  /** pass through the floating waymark — stretch cleared */
  private reachPortal(x: number, y: number) {
    if (this.state !== "playing") return;
    const localGateMeters = this.gateHole
      ? Math.max(LEVEL_METERS, Math.round((this.gateHole.x - this.startX) / METER))
      : Math.max(0, Math.floor((this.player.x - this.startX) / METER));
    this.distM = this.journeyMeters + localGateMeters;
    this.segStartM = this.distM;
    this.missedGate = false;
    this.state = "levelup";
    this.levelT = 0;
    this.player.detach();
    this.player.vx = 0;
    this.player.vy = 0;
    this.trauma = Math.min(0.25, this.trauma + 0.08);
    this.sfx.portal();
    this.sfx.levelUp();
    this.parts.burst(x, y - 30, "#d1b16f", 26, 340, 3.4, 0.9, 380);
    this.parts.ring(x, y - 30, "rgba(226,203,150,0.82)", 14, 0.7);
    this.parts.ring(x, y - 30, "rgba(251,247,231,0.64)", 8, 0.5);
    this.popup(x, y - 150, "WAYMARK!", "#d1b16f", 40);
    if (this.level + 1 > this.unlocked) {
      this.unlocked = this.level + 1;
      try {
        localStorage.setItem(UNLOCK_KEY, String(this.unlocked));
      } catch {
        /* ignore */
      }
    }
    this.sfx.setWind(0);
    this.emit();
  }

  private updateShake(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.25);
    const amp = this.trauma * this.trauma * 20;
    this.cam.sx = (noise1(this.time * 29.7) - 0.5) * 2 * amp;
    this.cam.sy = (noise1(this.time * 34.3 + 7.7) - 0.5) * 2 * amp;
  }

  /* ---------------- snapshot for React HUD ---------------- */

  private emit() {
    const key = [
      this.state,
      this.distM,
      this.coins,
      this.tricks,
      this.best,
      this.newBest,
      this.sfx.muted,
      Math.round(this.maxSpeed),
      this.cause,
      this.state === "playing" && !this.firstClick,
      this.shieldActive,
      Math.ceil(this.magnetT),
      this.tip?.id ?? "",
      Math.ceil(this.graceT),
      this.gliding,
      this.announce?.id ?? "",
      Math.round(this.lowAlt * 5),
      this.level,
      this.unlocked,
      this.theme,
      Math.round(this.windGain * 4),
      Math.round(this.distM / 5),
      Math.round(this.segStartM / 5),
      this.missedGate,
    ].join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cb({
      state: this.state,
      dist: this.distM,
      coins: this.coins,
      tricks: this.tricks,
      best: this.best,
      newBest: this.newBest,
      muted: this.sfx.muted,
      maxSpeed: this.maxSpeed,
      cause: this.cause,
      showHint: this.state === "playing" && !this.firstClick,
      shield: this.shieldActive,
      magnetT: this.magnetT,
      tip: this.tip,
      graceT: this.graceT,
      gliding: this.gliding,
      announce: this.announce,
      lowAlt: this.lowAlt,
      level: this.level,
      unlocked: this.unlocked,
      theme: this.theme,
      windGain: this.windGain,
      gateM: this.journeyMeters + (this.gateHole ? Math.round((this.gateHole.x - this.startX) / METER) : LEVEL_METERS),
      segStart: this.segStartM,
      missed: this.missedGate,
    });
  }
}
