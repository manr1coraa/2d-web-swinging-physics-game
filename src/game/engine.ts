import { World, themeForLevel, gateX } from "./world";
import type { ThemeId } from "./world";
import { Player } from "./player";
import { Particles } from "./particles";
import { Sfx } from "./audio";
import { Renderer } from "./renderer";
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
    title: "Hold to swing",
    text: "Hold SPACE or press anywhere — the web picks a ledge by itself. Let go to fly.",
    tone: "info",
  },
  glide: {
    id: "glide",
    title: "Glide mode",
    text: "Hold GLIDE (or SHIFT) to spread web-wings. Fast glides climb, and updrafts above the street always carry you back up.",
    tone: "good",
  },
  street: {
    id: "street",
    title: "Mind the street",
    text: "Hitting the avenue ends the run. Keep your arc above the traffic.",
    tone: "danger",
  },
  pump: {
    id: "pump",
    title: "You pump the web",
    text: "While attached you actively work the line — the longer you hold, the more speed you build.",
    tone: "good",
  },
  stal: {
    id: "stal",
    title: "Construction girder",
    text: "Steel beams with hazard stripes hang from above. Swing under or around them.",
    tone: "danger",
  },
  spire: {
    id: "spire",
    title: "Skyscraper",
    text: "Towers rise from the street. Crashing into one is fatal — web over the roof.",
    tone: "danger",
  },
  saw: {
    id: "saw",
    title: "Patrol drone",
    text: "Those rotors hurt. Time your arc so you pass well clear of the red eye.",
    tone: "danger",
  },
  plat: {
    id: "plat",
    title: "Scaffold",
    text: "Safe to land on and to web onto. Great for resetting a bad line.",
    tone: "good",
  },
  coin: {
    id: "coin",
    title: "Coins",
    text: "Strung along the ideal arc. Chain them for a rising combo jingle.",
    tone: "good",
  },
  release: {
    id: "release",
    title: "Let go!",
    text: "A held line only rocks you back and forth. Release at the top of the swing to launch forward — that is how you actually travel.",
    tone: "info",
  },
  boost: {
    id: "boost",
    title: "Boost ring",
    text: "Fly through for a burst of speed. Great right before a long gap.",
    tone: "good",
  },
  shield: {
    id: "shield",
    title: "Shield bubble",
    text: "Absorbs one fatal hit and throws you back into the air. One save per pickup.",
    tone: "good",
  },
  wind: {
    id: "wind",
    title: "Air current",
    text: "Those swirling tunnels push you hard. Enter along the arrows to get flung forward — they are the fastest way across a gap.",
    tone: "good",
  },
  fire: {
    id: "fire",
    title: "Burning rooftop",
    text: "Roofs are on fire down here. Webbing through the flames is fatal — swing high or grab a pod instead.",
    tone: "danger",
  },
  fish: {
    id: "fish",
    title: "Reef fish",
    text: "Big fish drift through the trench. Touching one hurts — keep your line above them.",
    tone: "danger",
  },
  drone: {
    id: "drone",
    title: "Hunter drone",
    text: "Drones patrol sideways with a red scanner eye. Pass behind them, never through.",
    tone: "danger",
  },
  pod: {
    id: "pod",
    title: "Web pod",
    text: "Floating pods are always webbable. If the next roof looks too far, ride from pod to pod.",
    tone: "good",
  },
  portal: {
    id: "portal",
    title: "Level gate",
    text: "Reach the glowing gate at 250 m to drop into the next level. Only a dead-centre hit counts!",
    tone: "good",
  },
  magnet: {
    id: "magnet",
    title: "Magnet",
    text: "Pulls every nearby coin to you for nine seconds.",
    tone: "good",
  },
};

/** full-screen transformation callout */
export interface Announce {
  id: string;
  kind: "shield" | "magnet" | "boost" | "glide" | "perfect" | "save" | "level";
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

const G = 1600; // gravity px/s^2 — lighter, floatier arcs
const FWD = 140; // forward push — ramps up with distance
const FWD_ATT = 75; // gentle constant swing nudge
const MAXV = 1050;
const ROPE_MAX = 440; // must exceed the corridor height or low flight is a dead end
const PUMP = 560; // tangential self-pump — keeps the swing alive
const REEL = 70; // rope reel speed while pumping
const GLIDE_G = 0.28; // gravity multiplier while gliding
const GLIDE_VY = 215; // sink rate when gliding slowly
const GLIDE_CLIMB = -110; // fast glides actually gain altitude
const GLIDE_FWD = 150; // forward drift from the web-wings
const UPDRAFT_H = 330; // height above the street where thermals kick in
const UPDRAFT_VY = -280; // how hard the updraft lifts you clear
const GRACE = 4.5; // seconds of invulnerability at the start of a run
const METER = 50; // px per meter
export const LEVEL_METERS = 250;
export const MAX_LEVELS = 40;
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
  private startX = 90;

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
  flipT = 0;
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
  coins = 0;
  best = 0;
  newBest = false;
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
    this.distM = 0;
    if (!keepCoins) this.coins = 0;
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
    this.lastMilestone = 0;
    this.holdWeb = false;
    this.aim = null;
    this.snapFx = null;
    this.autoRetryT = 0;
    this.attachTime = -10;
    this.pumpFx = 0;
    this.windGain = 0;
    this.glideAnnounced = false;
    this.missedGate = false;
    this.segStartM = 0;
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
      this.showAnnounce({
        id: `level${this.level}-${Math.floor(this.time * 7)}`,
        kind: "boost",
        title: `LEVEL ${this.level + 1}`,
        sub: this.theme.toUpperCase(),
      });
    }
    this.emit();
  }

  private advanceLevel() {
    if (this.level + 1 >= MAX_LEVELS) {
      this.toMenu();
      return;
    }
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
    this.player.attached = false;
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
    const perfect = p.vx > 260 && ang > 14 && ang < 68 && sp > 540;
    this.snapFx = { px: p.x, py: p.y, ax: p.ax, ay: p.ay, t: 0.26 };
    p.detach();
    this.sfx.whoosh();
    this.flipT = 0.6;
    this.parts.burst(p.x, p.y, "rgba(235,250,255,1)", 6, 130, 2.4, 0.4, 300);
    if (perfect) {
      p.vx *= 1.045;
      p.vy *= 1.045;
      this.perfectCombo = Math.min(9, this.perfectCombo + 1);
      if (this.perfectCombo === 1 || this.perfectCombo % 3 === 0) {
        this.popup(
          p.x,
          p.y - 48,
          this.perfectCombo > 1 ? `PERFECT ×${this.perfectCombo}` : "PERFECT",
          "#7df0ff",
          18,
        );
      }
      this.parts.ring(p.x, p.y, "rgba(125,240,255,0.9)", 8, 0.45);
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
      const dip = ay + d + 70 + p.r + 12 - lowestSky;
      if (dip > 0) score += 500 + dip; // the deeper the dip, the worse
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
    p.vx *= 1.02;
    p.vy *= 1.02;
    this.attachTime = this.time;
    this.firstClick = true;
    this.parts.burst(cand.x, cand.y, "rgba(126,240,255,1)", 9, 150, 2.4, 0.35, 150);
    this.parts.ring(cand.x, cand.y, "rgba(126,240,255,0.9)", 3, 0.3);
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
    if (Math.random() < dt * 2.5) {
      const bx = this.cam.x - 40 + Math.random() * (this.vw + 80);
      this.parts.spawn({
        x: bx,
        y: this.world.lavaY(bx) - 4,
        vy: -50 - Math.random() * 70,
        vx: (Math.random() - 0.5) * 30,
        life: 1.5,
        size: 5 + Math.random() * 9,
        color: "rgba(214,206,255,0.5)",
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
      // the spider is being sucked into the gate — spiral him in
      const p2 = this.player;
      p2.x = lerp(p2.x, this.gateHole?.x ?? p2.x, 1 - Math.exp(-dt * 3.2));
      p2.y = lerp(p2.y, (this.gateHole?.y ?? p2.y) + 60, 1 - Math.exp(-dt * 3.2));
      p2.vx *= Math.pow(0.5, dt * 3);
      p2.vy *= Math.pow(0.5, dt * 3);
      p2.trail.push({ x: p2.x, y: p2.y });
      if (p2.trail.length > 22) p2.trail.shift();
      if (Math.random() < dt * 34) {
        const a = Math.random() * Math.PI * 2;
        const rr = 40 + Math.random() * 60;
        this.parts.spawn({
          x: (this.gateHole?.x ?? p2.x) + Math.cos(a) * rr,
          y: (this.gateHole?.y ?? p2.y) - 40 + Math.sin(a) * rr * 0.6,
          vx: -Math.cos(a) * 130,
          vy: -Math.sin(a) * 90 - 40,
          life: 0.6 + Math.random() * 0.5,
          size: 2 + Math.random() * 4,
          color: this.theme === "underwater" ? "rgba(140,240,255,0.85)" : "rgba(255,226,150,0.9)",
          grav: -60,
        });
      }
      this.parts.update(dt);
      this.trauma = Math.max(0, this.trauma - dt * 0.6);
      this.updateShake(dt);
      this.sfx.setWind(0);
      if (this.levelT > 2.5) {
        this.state = "playing"; // guard so advanceLevel can restart cleanly
        this.advanceLevel();
      } else {
        this.emit();
      }
      return;
    }

    if (this.state !== "playing") return;

    this.runT += dt;
    if (this.flipT > 0) this.flipT = Math.max(0, this.flipT - dt);
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

    // ---- the gate pulls: a near miss still gets sucked into the hole ----
    const gh = this.gateHole;
    if (gh && this.state === "playing") {
      const dx = p.x - gh.x;
      const dy = p.y - (gh.y - 18);
      const dd = Math.hypot(dx, dy);
      if (dd < 320 && dd > 1 && p.x < gh.x + 60) {
        const pull = Math.pow(1 - dd / 320, 2) * 1250;
        p.vx -= (dx / dd) * pull * dt;
        p.vy -= (dy / dd) * pull * dt;
      }
      // sailed clean past it — the next gate is 250 m further on
      if (p.x > gh.x + 240 && !this.missedGate) {
        this.missedGate = true;
        this.segStartM = this.distM;
        this.refreshGate();
        this.showAnnounce({
          id: "missed" + this.gateIndex,
          kind: "save",
          title: "GATE MISSED",
          sub: "next one is 250 m ahead",
        });
        this.popup(p.x, p.y - 70, "MISSED!", "#ff8ea1", 26);
        this.sfx.shieldBreak();
      }
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
        this.autoRetryT = 0.1;
        this.tryAutoAttach();
      }
    }
    // predict where the auto-web will grab next (aim indicator)
    this.aim = p.attached ? null : this.findBestAnchor();

    // how close to the street — drives the on-screen warning
    const alt = this.world.lavaY(p.x) - p.y;
    this.lowAlt = clamp(1 - alt / 300, 0, 1);

    // score + milestones
    const m = Math.max(0, Math.floor((p.x - this.startX) / METER));
    if (m !== this.distM) this.distM = m;
    const ms = Math.floor(this.distM / 100) * 100;
    if (ms > 0 && ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.popup(p.x, p.y - 90, `${ms} M`, "#e8b64a", 26);
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
      (this.glideHold || this.holdWeb) &&
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
      const c = wind.gain * wind.gain * 8; // 1/s
      const k = Math.min(1, c * h);
      p.vx += (wind.vx - p.vx) * k;
      p.vy += (wind.vy - p.vy) * k;
    }

    // pace quickens the further you go — gently
    const fwd = p.attached
      ? FWD_ATT + Math.min(40, this.distM * 0.2)
      : FWD + Math.min(90, this.distM * 0.5);
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

    // rope constraint — rigid pendulum
    if (p.attached) {
      const rx = p.x - p.ax;
      const ry = p.y - p.ay;
      const d = Math.hypot(rx, ry) || 0.0001;
      if (d > p.rope) {
        const nx = rx / d;
        const ny = ry / d;
        p.x = p.ax + nx * p.rope;
        p.y = p.ay + ny * p.rope;
        const vr = p.vx * nx + p.vy * ny;
        if (vr > 0) {
          p.vx -= vr * nx;
          p.vy -= vr * ny;
        }
      }
    }
    // ---- active swing pumping (independent of gravity) ----
    // The spider works the line himself: he drives the swing along its
    // tangent and reels in on the way up / pays out on the way down.
    if (p.attached) {
      const rx2 = p.x - p.ax;
      const ry2 = p.y - p.ay;
      const d2 = Math.hypot(rx2, ry2) || 0.0001;
      const tx = -ry2 / d2;
      const ty = rx2 / d2;
      const vt = p.vx * tx + p.vy * ty; // tangential speed (signed)
      const dir = vt >= 0 ? 1 : -1;
      const spd = p.speed();
      // strongest when slow — this is what stops you from stalling out
      const k = clamp(1 - spd / 1050, 0.1, 1);
      p.vx += tx * dir * PUMP * k * h;
      p.vy += ty * dir * PUMP * k * h;
      this.pumpFx = clamp(k * (this.holdWeb ? 1 : 0.6), 0, 1);

      // classic pendulum pumping: shorten going up, lengthen going down
      const rising = p.vy < 0;
      const minRope = Math.max(70, p.rope0 - 85);
      const maxRope = p.rope0 + (this.holdWeb ? 70 : 20);
      p.rope = clamp(p.rope + (rising ? -REEL : REEL * 0.8) * h, minRope, maxRope);
    } else {
      this.pumpFx = 0;
    }
    if (p.grounded && p.vx < 200) p.vx = Math.max(p.vx, p.vx + 900 * h);
    this.collide();
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

    // floor gate — the hole at 250 m swallows you into the next level
    const gate = this.gateHole;
    if (gate && Math.abs(p.x - gate.x) < gate.r && p.y + p.r > gate.y - 44) {
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
        case "boost": {
          if (!o.used && dist(p.x, p.y, o.x, o.y) < o.r + p.r * 0.75) {
            o.used = true;
            this.boostNow(o.x, o.y);
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
        case "fish": {
          const fy = o.y + Math.sin(this.time * 1.1 + o.ph) * o.bob;
          const fx = o.x + Math.sin(this.time * 0.55 + o.ph) * 60;
          if (dist(p.x, p.y, fx, fy) < o.r + p.r - 4) death = "fish";
          break;
        }
        case "drone": {
          const dx = o.x + Math.sin(this.time * 0.7 + o.ph) * 78;
          const dy = o.y + Math.sin(this.time * 1.4 + o.ph) * o.bob;
          if (dist(p.x, p.y, dx, dy) < o.r + p.r - 5) death = "drone";
          break;
        }
        case "portal": {
          if (dist(p.x, p.y, o.x, o.y + 6) < o.r + p.r + 14 && !o.used) {
            o.used = true;
            this.reachPortal(o.x, o.y);
          }
          break;
        }
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
            this.popup(p.x, p.y - 56, "SHIELD ON", "#2fe0b0", 22);
            this.parts.burst(o.x, o.y, "#2fe0b0", 12, 190, 2.6, 0.5, 240);
            this.parts.ring(o.x, o.y, "rgba(47,224,176,0.9)", 5, 0.4);
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
            this.popup(p.x, p.y - 56, "MAGNET!", "#ff8ea1", 22);
            this.parts.burst(o.x, o.y, "#ff6b81", 12, 190, 2.6, 0.5, 240);
            this.parts.ring(o.x, o.y, "rgba(255,107,129,0.9)", 5, 0.4);
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
    this.parts.burst(x, y, "#ffd23f", 10, 170, 2.6, 0.45, 320);
    this.parts.ring(x, y, "rgba(255,210,63,0.9)", 4, 0.35);
    this.emit();
  }

  private boostNow(x: number, y: number) {
    const p = this.player;
    const sp = Math.max(p.speed(), 360);
    const k = Math.min((sp + 320) / sp, 1.4);
    p.vx = p.vx * k + 80;
    p.vy = p.vy * k;
    const s2 = p.speed();
    if (s2 > MAXV * 1.12) {
      const c = (MAXV * 1.12) / s2;
      p.vx *= c;
      p.vy *= c;
    }
    this.trauma = Math.min(0.4, this.trauma + 0.16);
    this.popup(p.x, p.y - 50, "BOOST", "#e8b64a", 18);
    this.parts.burst(x, y, "#ff7d9c", 16, 320, 3, 0.5, 200);
    this.parts.ring(x, y, "rgba(255,125,156,0.95)", 10, 0.5);
    this.sfx.boost();
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
    this.popup(p.x, p.y - 64, "SAVED!", "#2fe0b0", 28);
    this.parts.burst(p.x, p.y, "#2fe0b0", 20, 340, 3, 0.6, 420);
    this.parts.ring(p.x, p.y, "rgba(47,224,176,0.95)", 10, 0.6);
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
        p.attached = false;
        p.vy = Math.min(p.vy, -420);
        p.y -= p.r * 1.5;
        p.vx = Math.max(p.vx * 0.75, 260);
      }
      this.parts.burst(p.x, p.y, "#7df0ff", 12, 240, 2.6, 0.5, 300);
      this.parts.ring(p.x, p.y, "rgba(125,240,255,0.9)", 6, 0.4);
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
    p.attached = false;
    this.parts.burst(p.x, p.y, "#ff4d5e", 22, 380, 3.6, 0.8, 640);
    this.parts.burst(p.x, p.y, "#ffd9de", 8, 220, 2.4, 0.6, 500);
    this.parts.burst(p.x, p.y, "#2b3a8f", 10, 260, 3, 0.7, 620);
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
      if (o.kind === "boost" && o.used) return;
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

  /** point the gate marker at the next floor gate ahead of the spider */
  private refreshGate() {
    const p = this.player;
    let k = 0;
    while (k < 400 && gateX(k) < p.x - 200) k++;
    this.gateIndex = k;
    const gx = gateX(k);
    this.gateHole = { x: gx, y: this.world.lavaY(gx), r: 78 };
  }

  /** dove clean through the floor gate — level cleared */
  private reachPortal(x: number, y: number) {
    if (this.state !== "playing") return;
    this.segStartM = this.distM;
    this.missedGate = false;
    this.state = "levelup";
    this.levelT = 0;
    this.player.attached = false;
    this.player.vx *= 0.2;
    this.player.vy = Math.max(this.player.vy, 120);
    this.trauma = Math.min(0.8, this.trauma + 0.5);
    this.sfx.portal();
    this.sfx.levelUp();
    this.parts.burst(x, y - 30, "#ffe79a", 26, 340, 3.4, 0.9, 380);
    this.parts.ring(x, y - 30, "rgba(255,231,154,0.95)", 14, 0.7);
    this.parts.ring(x, y - 30, "rgba(255,255,255,0.75)", 8, 0.5);
    this.popup(x, y - 150, "GATE!", "#ffe79a", 40);
    if (this.level + 1 > this.unlocked) {
      this.unlocked = Math.min(MAX_LEVELS - 1, this.level + 1);
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
      gateM: this.gateHole ? Math.round(this.gateHole.x / METER) : LEVEL_METERS,
      segStart: this.segStartM,
      missed: this.missedGate,
    });
  }
}
