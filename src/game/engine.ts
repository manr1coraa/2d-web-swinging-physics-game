import {
  World,
  ROUTE_START_X,
  LEVEL_METERS,
  METER,
  districtForLevel,
  propBox,
  dronePos,
  segYAt,
  HARD_PROPS,
  SOFT_PROPS,
} from "./world";
import type { Building, DistrictId, Prop, RoofSeg } from "./world";
import { Player, WEB_SEGMENTS } from "./player";
import { Particles } from "./particles";
import { Sfx } from "./audio";
import { Renderer } from "./renderer";
import { themeDef } from "./themes";
import { clamp, lerp, dist, noise1 } from "./util";
import { loadSave, writeSave, clearSave, type SaveData } from "./save";

export { LEVEL_METERS, METER };

export type GameState =
  | "menu"
  | "playing"
  | "dying"
  | "dead"
  | "paused"
  | "levelup";

export interface Snap {
  state: GameState;
  /** district index — the level the player is running */
  level: number;
  unlocked: number;
  theme: DistrictId;
  district: string;
  dist: number;
  tokens: number;
  tricks: number;
  combo: number;
  best: number;
  newBest: boolean;
  muted: boolean;
  maxSpeed: number;
  /** height above the street, in metres */
  alt: number;
  maxAlt: number;
  cause: string;
  showHint: boolean;
  shield: boolean;
  magnetT: number;
  tip: Tip | null;
  graceT: number;
  gliding: boolean;
  announce: Announce | null;
  /** 0..1 — how close to the street you are */
  lowAlt: number;
  /** cumulative metres of the next checkpoint */
  gateM: number;
  /** cumulative metres where this district began */
  segStart: number;
  missed: boolean;
  /** the auto-web is holding a line right now */
  webbed: boolean;
  grounded: boolean;
  /** where the next line would grab */
  aiming: boolean;
  save: SaveData;
}

export interface Tip {
  id: string;
  title: string;
  text: string;
  tone: "info" | "danger" | "good";
}

/** contextual lessons, fired the first time each thing shows up */
export const TIPS: Record<string, Tip> = {
  swing: {
    id: "swing",
    title: "The web fires itself",
    text: "Your silk auto-attaches to the nearest rooftop. Hold SPACE or the screen to work the line; let go at the top of the swing to fly.",
    tone: "info",
  },
  release: {
    id: "release",
    title: "Let go forward",
    text: "Release while the swing is carrying you forward and up. A clean release counts as PERFECT and gives you a longer, freer arc.",
    tone: "good",
  },
  run: {
    id: "run",
    title: "Roofs are parkour",
    text: "On a roof, A / D (or ← →) runs. W / ↑ jumps off the ledge — the web catches you in the air.",
    tone: "info",
  },
  glide: {
    id: "glide",
    title: "Glide to drop on purpose",
    text: "Hold GLIDE (SHIFT) to soften a fall. Gliding also keeps the web holstered, so you can drop into a lower street of roofs.",
    tone: "good",
  },
  street: {
    id: "street",
    title: "Never touch the avenue",
    text: "There is no upper limit — climb as high as you like. But the street below ends the run, so keep the chain of roofs going.",
    tone: "danger",
  },
  chimney: {
    id: "chimney",
    title: "Rooftop clutter",
    text: "Chimneys, tanks and masts are solid. A fast hit ends the run; a slow brush only knocks you off balance.",
    tone: "danger",
  },
  antenna: {
    id: "antenna",
    title: "Masts make great anchors",
    text: "Thin masts hurt to hit, but their tips are the highest grab points in the district — perfect for climbing.",
    tone: "info",
  },
  drone: {
    id: "drone",
    title: "Delivery drones",
    text: "Drones patrol above some roofs. Read their path and swing under or over them.",
    tone: "danger",
  },
  clothesline: {
    id: "clothesline",
    title: "Laundry lines",
    text: "You will smash straight through a clothesline. It only costs a little speed — and looks great.",
    tone: "good",
  },
  crane: {
    id: "crane",
    title: "Cranes",
    text: "A crane jib is the tallest anchor around. Grab it to gain serious height.",
    tone: "good",
  },
  token: {
    id: "token",
    title: "Web-spools",
    text: "Collect spools along the route. They are counted for the district and kept in your lifetime totals.",
    tone: "good",
  },
  shield: {
    id: "shield",
    title: "A spare strand",
    text: "This charm cushions one fatal hit and throws you back into the air.",
    tone: "good",
  },
  magnet: {
    id: "magnet",
    title: "Spool lure",
    text: "Nearby web-spools drift toward you for a few seconds.",
    tone: "good",
  },
  gate: {
    id: "gate",
    title: "District checkpoint",
    text: "Swing through the scaffold arch every 250 m to clear the district and open the next one. Progress is saved.",
    tone: "good",
  },
  alt: {
    id: "alt",
    title: "No ceiling",
    text: "The higher you climb, the more open the route — and the longer the fall. Chains of tall roofs are worth the risk.",
    tone: "good",
  },
  trick: {
    id: "trick",
    title: "Tricks",
    text: "In the air, hold A / ← or D / → to spin. A full somersault is a real 2π turn with its own angular momentum.",
    tone: "good",
  },
};

/** full-screen transformation callout */
export interface Announce {
  id: string;
  kind: "shield" | "magnet" | "glide" | "perfect" | "save" | "level" | "district";
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

/* ---------------- tuning ---------------- */

const G = 1200; // gravity px/s²: readable arcs, real weight
const FWD = 96; // gentle airborne drift so a chain never stalls outright
const FWD_ATT = 54;
const MAXV = 900;
const ROPE_MAX = 470; // the silk can reach this far
const ROPE_K = 520; // spring stiffness (px/s² per px of extension)
const ROPE_DAMP = 11; // radial damping, only while the line is being pulled taut
const ROPE_MAX_TENSION = 6500;
const ROPE_MAX_STRETCH = 1.16;
const PUMP = 400; // active tangential pump while holding the line
const REEL_IN = 190; // holding pulls you up the line — this is the climb
const REEL_AUTO = 46; // an unheld line still reels a little
const ROPE_MIN = 58;
const GLIDE_G = 0.5;
const GLIDE_VY = 235;
const GLIDE_CLIMB = -34;
const GLIDE_FWD = 74;
const GLIDE_DRAG = 0.3;
const UPDRAFT_H = 210;
const UPDRAFT_VY = -70;
const GRACE = 2.2;
const ROUTE_TRANSITION = 1.5;
const WEB_SOLVER_PASSES = 6;
const MAGNET_TIME = 9;
export const MAX_LEVELS = Number.POSITIVE_INFINITY;

/* parkour feel */
const RUN_ACCEL = 1500;
const RUN_MAX = 470;
const RUN_BACK_MAX = 250;
const JUMP_V = 640;
const COYOTE = 0.1;
const CRASH_SPEED = 430; // a hit faster than this ends the run
const WEB_COOLDOWN = 0.24; // pause before the auto-web fires again
const PERFECT_FLIGHT = 0.46; // a clean release buys a longer free arc
const ANCHOR_FORGET = 0.7;

export class Game {
  world: World;
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
  cam = { x: -200, y: 0, sx: 0, sy: 0, zoom: 1 };
  trauma = 0;

  pointer = { id: -1 };
  firstClick = false;
  texts: Popup[] = [];

  /* --- web control --- */
  /** the player is holding the line (pump + reel) */
  holdWeb = false;
  aim: { x: number; y: number; d: number } | null = null;
  /** what the current line is stuck to, so the runner can mantle over a ledge */
  private attachKind: "ledge" | "prop" | "wall" | null = null;
  private attachDir: 1 | -1 | 0 = 0;
  private stallT = 0;
  snapFx: { px: number; py: number; ax: number; ay: number; t: number } | null = null;
  attachTime = -10;
  pumpFx = 0;
  private webCooldown = 0;
  private forget: { x: number; y: number; t: number } | null = null;
  private webCount = 0;

  gliding = false;
  glideHold = false;
  graceT = 0;
  lowAlt = 0;
  private glideAnnounced = false;
  levelT = 0;
  gateHole: { x: number; y: number; r: number } | null = null;
  gateIndex = 0;
  missedGate = false;
  segStartM = 0;
  announce: Announce | null = null;
  private announceT = 0;

  /* --- tutorial --- */
  tip: Tip | null = null;
  private tipT = 0;
  private taught = new Set<string>();
  private tipScanT = 0;

  /* --- score --- */
  distM = 0;
  private journeyMeters = 0;
  tokens = 0;
  tricks = 0;
  combo = 0;
  best = 0;
  newBest = false;
  altM = 0;
  maxAlt = 0;
  trickDir: -1 | 0 | 1 = 0;
  private jumpQueued = false;
  level = 0;
  unlocked = 0;
  theme: DistrictId = "harbour";
  maxSpeed = 0;
  cause = "";
  private tokenChain = 0;
  private tokenChainT = 0;
  private dyingT = 0;
  private deadAt = -10;
  private perfectCombo = 0;
  private lastMilestone = 0;
  private airTricks = 0;

  /* --- power-ups --- */
  shieldActive = false;
  magnetT = 0;
  private invulnT = 0;

  /* --- persistence --- */
  save: SaveData = loadSave();

  private raf = 0;
  private last = 0;
  private cb: (s: Snap) => void;
  private lastKey = "";
  private disposed = false;
  private saveDirty = 0;

  constructor(canvas: HTMLCanvasElement, cb: (s: Snap) => void) {
    this.cb = cb;
    this.renderer = new Renderer(canvas);
    this.save = loadSave();
    this.best = this.save.best;
    this.unlocked = this.save.unlocked;
    this.taught = new Set(this.save.taught);
    this.sfx.setMuted(this.save.muted, true);
    this.world = new World(0);
    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("visibilitychange", this.onVis);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.setupMenu();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.emit();
  }

  /* ---------------- public API ---------------- */

  /** start (or restart) a district run */
  start(levelIndex?: number) {
    if (levelIndex !== undefined) {
      this.level = Math.max(0, Math.min(MAX_LEVELS - 1, Math.floor(levelIndex)));
    }
    if (this.level > this.unlocked) {
      this.unlocked = this.level;
      this.save.unlocked = this.unlocked;
      this.save.checkpoint = this.unlocked;
      this.persist();
    }
    this.startRun(false);
  }

  /** resume from the saved checkpoint district */
  continueRun() {
    this.start(Math.max(0, this.save.checkpoint));
  }

  /** retry the district you just lost */
  retry() {
    this.start(this.level);
  }

  toMenu() {
    if (this.state === "playing" || this.state === "dying" || this.state === "paused") {
      this.state = "menu";
      this.setupMenu();
    }
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
    this.persist();
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
    this.save.muted = this.sfx.muted;
    this.persist();
    this.emit();
  }

  /** Hold a direction: on a roof it runs, in the air it spins. */
  setTrick(direction: -1 | 0 | 1) {
    this.trickDir = direction;
  }

  /** explicit glide input — held from a button or a key. Holsters the web. */
  setGlide(on: boolean) {
    if (this.glideHold === on) return;
    this.glideHold = on;
    if (on && this.state === "playing") {
      if (this.player.attached) this.release();
      if (!this.glideAnnounced) {
        this.glideAnnounced = true;
        this.showAnnounce({
          id: "glide" + this.level,
          kind: "glide",
          title: "GLIDE",
          sub: "web holstered · soft fall",
        });
      }
      this.sfx.magnetUp();
    }
    this.emit();
  }

  /** hold / release the web line (pointer, SPACE, or the WEB button) */
  setWeb(on: boolean) {
    if (on) {
      if (this.holdWeb) return;
      this.holdWeb = true;
      this.webCooldown = 0;
      this.tryAutoAttach();
    } else {
      if (!this.holdWeb) return;
      this.holdWeb = false;
      this.release();
    }
  }

  jump() {
    if (this.state !== "playing") return;
    this.jumpQueued = true;
  }

  /** the facade the body is sliding on, if any: -1 wall on the left, 1 right */
  wallDir: -1 | 0 | 1 = 0;

  /** replay the whole tutorial from scratch */
  resetTutorial() {
    this.taught.clear();
    this.save.taught = [];
    this.persist();
    this.emit();
  }

  /** wipe local progress (districts, totals, best run) */
  eraseSave() {
    clearSave();
    this.save = loadSave();
    this.best = 0;
    this.unlocked = 0;
    this.taught.clear();
    this.emit();
  }

  private persist() {
    this.save.best = Math.max(this.save.best, this.best);
    this.save.unlocked = Math.max(this.save.unlocked, this.unlocked);
    this.save.muted = this.sfx.muted;
    this.save.taught = Array.from(this.taught);
    writeSave(this.save);
    this.saveDirty = 0;
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

  /* ---------------- run setup ---------------- */

  private startRun(keepTotals: boolean) {
    this.world = new World(this.level);
    this.theme = districtForLevel(this.level);
    this.parts.list = [];
    this.texts = [];
    this.startX = ROUTE_START_X;
    const startRoof = this.world.roofYAt(this.startX) ?? 620;
    this.player.reset(this.startX, startRoof - this.player.r - 1);
    this.player.grounded = true;
    this.player.groundY = startRoof;
    this.player.vx = 300;
    this.runT = 0;
    if (!keepTotals) {
      this.journeyMeters = this.level * LEVEL_METERS;
      this.tokens = 0;
      this.tricks = 0;
      this.combo = 0;
      this.maxAlt = 0;
      this.save.runs += 1;
    }
    this.distM = this.journeyMeters;
    this.newBest = false;
    this.maxSpeed = 0;
    this.cause = "";
    this.tokenChain = 0;
    this.firstClick = false;
    this.trauma = 0;
    this.shieldActive = false;
    this.magnetT = 0;
    this.invulnT = 0;
    this.perfectCombo = 0;
    this.airTricks = 0;
    this.lastMilestone = Math.floor(this.journeyMeters / 100) * 100;
    this.holdWeb = false;
    this.trickDir = 0;
    this.jumpQueued = false;
    this.aim = null;
    this.snapFx = null;
    this.webCooldown = 0.35;
    this.forget = null;
    this.webCount = 0;
    this.attachTime = -10;
    this.pumpFx = 0;
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
    this.cam.x = this.player.x - this.vw * 0.38;
    this.cam.y = this.player.y - this.vh * 0.55;
    this.cam.zoom = 1;
    this.state = "playing";
    this.sfx.ensure();
    this.sfx.start();
    this.sfx.padStart();
    if (this.level > 0) {
      const newDistrict = districtForLevel(this.level) !== districtForLevel(this.level - 1);
      this.showAnnounce({
        id: `district${this.level}`,
        kind: newDistrict ? "district" : "level",
        title: newDistrict ? "NEW DISTRICT" : "CHECKPOINT CLEARED",
        sub: themeDef(this.theme).name,
      });
    }
    this.persist();
    this.emit();
  }

  /** the attract-mode swing behind the menu */
  private setupMenu() {
    this.world = new World(this.unlocked > 0 ? this.unlocked % 8 : 0);
    this.theme = this.world.district;
    this.player.reset(ROUTE_START_X + 240, (this.world.roofYAt(ROUTE_START_X + 240) ?? 560) - 190);
    this.player.vx = 340;
    this.state = "menu";
    this.cam.x = this.player.x - this.vw * 0.4;
    this.cam.y = this.player.y - this.vh * 0.55;
    this.holdWeb = true;
    this.glideHold = false;
    this.webCooldown = 0;
  }

  private advanceLevel() {
    // A cleared checkpoint opens the next district. The route has no cap; the
    // eight districts simply cycle while the pace keeps tightening.
    this.journeyMeters = Math.max(this.journeyMeters, this.distM);
    this.level += 1;
    if (this.level > this.unlocked) this.unlocked = this.level;
    this.save.unlocked = Math.max(this.save.unlocked, this.unlocked);
    this.save.checkpoint = this.save.unlocked;
    this.persist();
    this.startRun(true);
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
      this.continueRun();
      return;
    }
    if (this.state === "dead") {
      if (this.time - this.deadAt > 0.45) this.retry();
      return;
    }
    if (this.state !== "playing") return;
    this.pointer.id = e.pointerId;
    this.setWeb(true);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointer.id !== -1 && e.pointerId !== this.pointer.id) return;
    this.pointer.id = -1;
    this.setWeb(false);
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyR") {
      e.preventDefault();
      if (this.state === "playing" || this.state === "paused" || this.state === "dead") this.retry();
      else this.start();
    } else if (e.code === "KeyM") {
      this.toggleMute();
    } else if (e.code === "KeyP") {
      e.preventDefault();
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    } else if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (this.state === "menu") this.continueRun();
      else if (this.state === "dead" && this.time - this.deadAt > 0.45) this.retry();
      else if (this.state === "paused") this.resume();
      else if (this.state === "playing" && !e.repeat) this.setWeb(true);
    } else if (
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "KeyG" ||
      e.code === "ArrowDown" ||
      e.code === "KeyS"
    ) {
      e.preventDefault();
      if (this.state === "playing" && !e.repeat) this.setGlide(true);
    } else if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "KeyK") {
      e.preventDefault();
      if (this.state === "playing" && !e.repeat) this.jump();
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
      this.setWeb(false);
    } else if (
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "KeyG" ||
      e.code === "ArrowDown" ||
      e.code === "KeyS"
    ) {
      this.setGlide(false);
    } else if (
      e.code === "KeyA" ||
      e.code === "ArrowLeft" ||
      e.code === "KeyD" ||
      e.code === "ArrowRight"
    ) {
      this.setTrick(0);
    }
  };

  /* ---------------- web ---------------- */

  /** release the current line; a clean, forward release is rewarded as flow */
  private release() {
    const p = this.player;
    if (!p.attached || this.state !== "playing") return;
    // rope angle from straight-down (0 = hanging below the anchor)
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    const sp = p.speed();
    const perfect = p.vx > 150 && ang > 12 && ang < 74 && sp > 260;
    this.snapFx = { px: p.x, py: p.y, ax: p.ax, ay: p.ay, t: 0.26 };
    this.forget = { x: p.ax, y: p.ay, t: ANCHOR_FORGET };
    this.attachKind = null;
    this.attachDir = 0;
    this.stallT = 0;
    p.detach();
    this.sfx.whoosh();
    this.parts.burst(p.x, p.y, "rgba(246,242,226,0.92)", 6, 130, 2.4, 0.4, 300);
    this.webCooldown = perfect ? PERFECT_FLIGHT : WEB_COOLDOWN;
    if (perfect) {
      // Timing is rewarded as flow, not as an unexplained velocity boost:
      // the free arc is simply longer before the auto-web grabs again.
      this.perfectCombo = Math.min(9, this.perfectCombo + 1);
      this.combo = Math.min(99, this.combo + 1);
      if (this.perfectCombo === 1 || this.perfectCombo % 3 === 0) {
        this.popup(
          p.x,
          p.y - 48,
          this.perfectCombo > 1 ? `PERFECT ×${this.perfectCombo}` : "PERFECT",
          "#c08a5e",
          18,
        );
      }
      this.parts.ring(p.x, p.y, "rgba(198,150,102,0.6)", 8, 0.45);
      this.sfx.perfect(this.perfectCombo);
      if (this.perfectCombo === 4 || this.perfectCombo === 7)
        this.showAnnounce({
          id: "perfect" + this.perfectCombo,
          kind: "perfect",
          title: `PERFECT ×${this.perfectCombo}`,
          sub: "clean release chain",
        });
    } else {
      this.perfectCombo = 0;
    }
  }

  /**
   * Auto-attack aim: rate every rooftop anchor in reach and pick the one the
   * silk would naturally grab — nearest, ahead of the body, in clear air, with
   * a swing arc that does not end in a wall or the avenue.
   */
  findBestAnchor(
    desperate = false,
  ): { x: number; y: number; d: number; kind: "ledge" | "prop" | "wall"; dir: 1 | -1 | 0 } | null {
    const p = this.player;
    const w = this.world;
    const minD = desperate ? 34 : 58;
    const maxBack = desperate ? 300 : 74;

    type Cand = {
      x: number;
      y: number;
      d: number;
      score: number;
      wall: boolean;
      kind: "ledge" | "prop" | "wall";
      dir: 1 | -1 | 0;
    };
    const cands: Cand[] = [];
    for (const a of w.anchorsNear(p.x, ROPE_MAX + 60)) {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < minD || d > ROPE_MAX) continue;
      if (dy > -20) continue; // the silk only grabs above the body
      if (dx < -maxBack) continue;
      const theta = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = straight up
      if (Math.abs(theta) > (desperate ? 112 : 96)) continue;
      if (this.forget && Math.abs(this.forget.x - a.x) < 8 && Math.abs(this.forget.y - a.y) < 8) continue;

      // nearest first, then a mild preference for anchors ahead and for a
      // rope that leaves room to swing without meeting the avenue
      const wall = a.kind === "wall";
      let score = d * (wall ? 1.12 : 1.0);
      score += Math.abs(theta) * (wall ? 0.7 : 1.5);
      // a fall is always saved forward: anchors behind you cost dearly
      if (p.vx >= 0) score += clamp(-dx / 200, 0, 1) * 190;
      else score += clamp(dx / 200, 0, 1) * 190;
      const midX = (p.x + a.x) / 2;
      const floorAhead = wall
        ? w.streetY
        : Math.min(w.floorBelow(midX, a.y + d), w.floorBelow(p.x, p.y));
      const dip = a.y + d * ROPE_MAX_STRETCH + p.r + 16 - floorAhead;
      if (!wall && dip > (desperate ? 40 : 14)) continue;
      if (dip > 0) score += 220 + dip * 1.4;
      cands.push({ x: a.x, y: a.y, d, score, wall, kind: a.kind, dir: a.dir ?? 0 });
    }
    if (cands.length === 0) return null;
    cands.sort((a, b) => a.score - b.score);

    // second pass on the shortlist: line of sight plus a walk of the real arc
    const shortlist = Math.min(cands.length, 7);
    let best: Cand | null = null;
    for (let i = 0; i < shortlist; i++) {
      const c = cands[i];
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      // the silk may wrap a corner: a hit close to the anchor still counts
      const hit = w.raycast(p.x, p.y, dx / c.d, dy / c.d, c.d - 8);
      if (hit && dist(hit.x, hit.y, c.x, c.y) > 42) continue;

      const a0 = Math.atan2(p.x - c.x, p.y - c.y);
      const dir = p.vx >= 0 ? 1 : -1;
      const aEnd = a0 + dir * Math.PI * 0.55;
      let penalty = 0;
      const N = 10;
      for (let k = 1; k <= N; k++) {
        const a = a0 + ((aEnd - a0) * k) / N;
        const hx = c.x + Math.sin(a) * c.d;
        const hy = c.y + Math.cos(a) * c.d;
        // a wall grab is a climb, not a pendulum: its own facade is expected
        if (c.wall && Math.abs(hx - c.x) < 30) continue;
        if (w.hazardNear(hx, hy, 26, this.time)) penalty += 260;
        else if (w.wallNear(hx, hy, 20)) penalty += 92;
      }
      const score = c.score + penalty;
      if (!best || score < best.score) best = { ...c, score };
    }
    return best
      ? { x: best.x, y: best.y, d: best.d, kind: best.kind, dir: best.dir }
      : null;
  }

  /** attach to the auto-aim target, if any */
  tryAutoAttach(): boolean {
    const p = this.player;
    if (p.attached || (this.state !== "playing" && this.state !== "menu")) return false;
    if (this.glideHold) return false;
    const cand = this.findBestAnchor() ?? this.findBestAnchor(true);
    if (!cand) return false;
    p.attach(cand.x, cand.y);
    this.attachKind = cand.kind;
    this.attachDir = cand.dir;
    this.stallT = 0;
    this.attachTime = this.time;
    this.webCount += 1;
    this.firstClick = true;
    this.parts.burst(cand.x, cand.y, "rgba(240,236,220,0.9)", 8, 140, 2.2, 0.32, 140);
    this.parts.ring(cand.x, cand.y, "rgba(214,206,180,0.6)", 3, 0.28);
    this.sfx.thwip();
    return true;
  }

  private popup(x: number, y: number, str: string, color: string, size = 20) {
    if (this.texts.length > 6) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 0.75, max: 0.75 });
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
    if (this.forget) {
      this.forget.t -= dt;
      if (this.forget.t <= 0) this.forget = null;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tp = this.texts[i];
      tp.life -= dt;
      tp.y -= 30 * dt;
      if (tp.life <= 0) this.texts.splice(i, 1);
    }
    this.parts.update(dt);
    if (this.saveDirty > 0) {
      this.saveDirty -= dt;
      if (this.saveDirty <= 0) this.persist();
    }

    if (this.state === "menu") {
      this.updateMenu(dt);
      return;
    }

    if (this.state === "dying") {
      this.dyingT += dt;
      this.updateShake(dt);
      if (this.dyingT > 0.85) {
        this.state = "dead";
        this.deadAt = this.time;
        this.persist();
        if (this.newBest) this.sfx.best();
        this.emit();
      }
      this.sfx.setWind(0);
      return;
    }

    if (this.state === "levelup") {
      this.levelT += dt;
      // A cleared checkpoint freezes the trail where the runner crossed it.
      const p2 = this.player;
      p2.trail.push({ x: p2.x, y: p2.y });
      if (p2.trail.length > 22) p2.trail.shift();
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2;
        const rr = 18 + Math.random() * 42;
        this.parts.spawn({
          x: p2.x + Math.cos(a) * rr,
          y: p2.y + Math.sin(a) * rr,
          vx: Math.cos(a) * 24,
          vy: -20 - Math.random() * 26,
          life: 0.7 + Math.random() * 0.45,
          size: 2 + Math.random() * 3,
          color: "rgba(232,214,170,0.55)",
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

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 22) p.trail.shift();

    if (this.magnetT > 0) this.magnetT = Math.max(0, this.magnetT - dt);
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.graceT > 0) this.graceT = Math.max(0, this.graceT - dt);
    if (this.tokenChainT > 0) {
      this.tokenChainT -= dt;
      if (this.tokenChainT <= 0) this.tokenChain = 0;
    }
    if (this.announceT > 0) {
      this.announceT -= dt;
      if (this.announceT <= 0) {
        this.announce = null;
        this.emit();
      }
    }

    /* --- camera: free in both directions, no ceiling clamp --- */
    const lk = clamp(p.vx * 0.24, -60, 300);
    const tx = p.x - this.vw * 0.4 + lk;
    const ty = p.y - this.vh * (p.vy < -120 ? 0.62 : 0.54) + clamp(p.vy * 0.09, -110, 120);
    this.cam.x = lerp(this.cam.x, tx, 1 - Math.exp(-dt * 7));
    this.cam.y = lerp(this.cam.y, ty, 1 - Math.exp(-dt * 4.4));
    const wantZoom = clamp(1.02 - (sp / MAXV) * 0.16, 0.84, 1.02);
    this.cam.zoom = lerp(this.cam.zoom, wantZoom, 1 - Math.exp(-dt * 2.4));
    this.updateShake(dt);
    this.world.ensure(p.x + this.vw);

    /* --- the auto-web keeps hunting for the next roof --- */
    if (this.webCooldown > 0) this.webCooldown = Math.max(0, this.webCooldown - dt);
    // survival instinct: when the avenue is coming up the silk stops waiting
    const inTrouble = p.vy > 240 || this.world.streetY - p.y < 300;
    if (!p.attached && !p.grounded && inTrouble) {
      this.webCooldown = Math.min(this.webCooldown, 0.05);
    }
    if (!p.attached && !p.grounded && this.webCooldown <= 0 && !this.glideHold) {
      this.tryAutoAttach();
    }
    this.aim = p.attached ? null : this.findBestAnchor();

    /* --- checkpoints: real openings, never magnets --- */
    const gh = this.gateHole;
    if (gh && p.x > gh.x + 200 && !this.missedGate) {
      this.missedGate = true;
      this.segStartM = this.journeyMeters + Math.max(0, Math.floor((p.x - this.startX) / METER));
      this.refreshGate();
      this.popup(p.x, p.y - 54, "NEXT CHECKPOINT AHEAD", "#9a8a5f", 16);
      this.combo = 0;
    }

    /* --- altitude: the run has no ceiling, only a floor --- */
    const alt = (this.world.streetY - p.y) / METER;
    this.altM = Math.max(0, Math.round(alt));
    this.maxAlt = Math.max(this.maxAlt, this.altM);
    this.lowAlt = clamp(1 - (this.world.streetY - p.y) / 320, 0, 1);

    this.updateTips(dt);
    if (p.attached && this.time - this.attachTime > 2.6 && this.judgeHold()) this.show("release");

    /* --- distance --- */
    const m = this.journeyMeters + Math.max(0, Math.floor((p.x - this.startX) / METER));
    if (m !== this.distM) this.distM = m;
    const ms = Math.floor(this.distM / 100) * 100;
    if (ms > 0 && ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.popup(p.x, p.y - 74, `${ms} m`, "#c09a5c", 20);
      this.sfx.milestone();
    }
    if (this.distM > this.best) {
      this.best = this.distM;
      this.saveDirty = Math.max(this.saveDirty, 1.5);
    }

    this.sfx.setWind(sp / MAXV);
    this.sfx.padLevel(sp / MAXV);
    this.emit();
  }

  /** attract mode: the little runner swings through the district behind the menu */
  private updateMenu(dt: number) {
    const p = this.player;
    const sub = Math.max(1, Math.ceil(dt * 180));
    const h = dt / sub;
    this.holdWeb = true;
    for (let s = 0; s < sub; s++) {
      p.prevX = p.x;
      p.prevY = p.y;
      p.vy += G * h;
      p.vx += FWD * h;
      p.vx *= Math.pow(0.5, h * 0.13);
      p.vy *= Math.pow(0.5, h * 0.05);
      const sp = p.speed();
      if (sp > MAXV * 0.8) {
        const k = (MAXV * 0.8) / sp;
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (p.attached) this.applyWebTension(h);
      if (p.attached) this.pumpSwing(h);
      this.stepRotation(h);
      if (p.attached) this.updateWebChain(h);
    }
    // never die in the menu: a drop below the avenue is simply restarted
    const street = this.world.streetY;
    if (p.y > street - 120 || p.grounded) {
      p.detach();
      const rx = p.x + 120;
      const roof = this.world.roofYAt(rx) ?? this.world.highestNear(rx);
      p.x = rx;
      p.y = roof - 210;
      p.vx = 340;
      p.vy = -60;
      p.grounded = false;
    }
    // avoid the roofs: the demo swing stays in the air
    const surf = this.world.roofYAt(p.x);
    if (surf !== null && p.y + p.r > surf - 4) {
      p.y = surf - p.r - 4;
      if (p.vy > 0) p.vy *= -0.4;
    }
    if (this.webCooldown > 0) this.webCooldown -= dt;
    if (!p.attached && this.webCooldown <= 0) {
      if (!this.tryAutoAttach()) this.webCooldown = 0.1;
      // let go on the upswing so the demo keeps flowing
    } else if (p.attached) {
      const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
      if ((p.vy < 0 && ang > 24 && p.vx > 200) || ang > 92) {
        p.detach();
        this.webCooldown = 0.16;
      }
    }
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 22) p.trail.shift();
    this.cam.x = lerp(this.cam.x, p.x - this.vw * 0.42, 1 - Math.exp(-dt * 3.4));
    this.cam.y = lerp(this.cam.y, p.y - this.vh * 0.56, 1 - Math.exp(-dt * 2.6));
    this.cam.zoom = lerp(this.cam.zoom, 1, 1 - Math.exp(-dt * 2));
    this.world.ensure(p.x + this.vw);
    this.updateShake(dt);
    this.emit();
  }

  /* ---------------- physics ---------------- */

  private step(h: number) {
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    p.landT += h;
    p.airT += h;
    p.stumbleT = Math.max(0, p.stumbleT - h);

    /* --- glide: holding it holsters the web and catches air --- */
    const glide =
      !p.attached && !p.grounded && this.glideHold && p.vy > -80 && this.state === "playing";
    this.gliding = glide;
    p.vy += (glide ? G * GLIDE_G : G) * h;
    if (glide) {
      const liftF = clamp((Math.abs(p.vx) - 300) / 620, 0, 1);
      const targetVy = lerp(GLIDE_VY, GLIDE_CLIMB, liftF);
      // thermals in the canyons help only while you are still moving: a stalled
      // body sinks, so gliding can never become a way to hover over the avenue
      const alt = this.world.streetY - p.y;
      let rate = 7;
      let tv = targetVy;
      if (alt < UPDRAFT_H) {
        const u = clamp(1 - alt / UPDRAFT_H, 0, 1) * clamp(Math.abs(p.vx) / 320, 0, 1);
        tv = lerp(targetVy, UPDRAFT_VY, u);
        rate = lerp(7, 30, u * u);
      }
      if (p.vy > tv) p.vy += (tv - p.vy) * Math.min(1, h * rate);
      p.vx += GLIDE_FWD * h * (p.vx < 40 ? 2.4 : 1);
    }

    /* --- ground: parkour on the roof --- */
    if (p.grounded) {
      const dir = this.trickDir;
      if (dir !== 0) {
        p.vx += dir * RUN_ACCEL * h;
        p.facing = dir > 0 ? 1 : -1;
      } else {
        p.vx *= Math.pow(0.015, h);
      }
      p.vx = clamp(p.vx, -RUN_BACK_MAX, RUN_MAX);
      p.runPhase += Math.abs(p.vx) * h * 0.045;
      // pitched roofs are slippery: the slope pulls you down it
      const seg = this.world.segAt(p.x);
      if (seg && seg.x1 > seg.x0) {
        const slope = (seg.y1 - seg.y0) / (seg.x1 - seg.x0);
        p.vx += slope * G * 0.42 * h;
      }
      if (this.jumpQueued) {
        this.jumpQueued = false;
        p.grounded = false;
        p.airT = 0;
        p.vy = -JUMP_V;
        p.vx += 60 * p.facing;
        p.tuck = 0.4;
        this.sfx.jump();
        this.parts.burst(p.x, p.y + p.r, "rgba(228,222,200,0.7)", 7, 96, 2.1, 0.3, 300);
      }
    } else {
      if (this.jumpQueued && p.airT < COYOTE) {
        this.jumpQueued = false;
        p.vy = -JUMP_V;
        p.tuck = 0.4;
        this.sfx.jump();
      } else if (this.jumpQueued && this.wallDir !== 0) {
        // wall kick: push off the facade and get back into the air
        this.jumpQueued = false;
        p.vy = -JUMP_V * 0.82;
        p.vx = -this.wallDir * 300;
        p.facing = p.vx > 0 ? 1 : -1;
        p.tuck = 0.5;
        this.wallDir = 0;
        this.sfx.jump();
        this.parts.burst(p.x, p.y, "rgba(226,220,200,0.7)", 7, 120, 2.1, 0.3, 300);
      } else if (this.jumpQueued) {
        this.jumpQueued = false;
      }
      const fwd = p.attached ? FWD_ATT : FWD;
      p.vx += fwd * h;
    }

    /* --- drag and the speed ceiling --- */
    p.vx *= Math.pow(0.5, h * (p.attached ? 0.045 : glide ? GLIDE_DRAG : 0.12));
    p.vy *= Math.pow(0.5, h * 0.05);
    const sp = p.speed();
    if (sp > MAXV) {
      const k = MAXV / sp;
      p.vx *= k;
      p.vy *= k;
    }

    p.x += p.vx * h;
    p.y += p.vy * h;
    if (p.x < 8) {
      p.x = 8;
      p.vx = Math.max(p.vx, 0);
    }

    /* --- the silk: a one-way damped spring --- */
    if (p.attached) {
      this.applyWebTension(h);
      this.pumpSwing(h);
    } else {
      this.pumpFx = 0;
    }

    const post = p.speed();
    if (post > MAXV) {
      const scale = MAXV / post;
      p.vx *= scale;
      p.vy *= scale;
    }
    p.tuck = Math.max(0, p.tuck - h * 2.2);
    this.collide();
    this.stepRotation(h);
    if (p.attached && this.state === "playing") this.updateWebChain(h);
  }

  /** intentional pumping along the swing tangent, plus a phase-aware reel */
  private pumpSwing(h: number) {
    const p = this.player;
    const rx = p.x - p.ax;
    const ry = p.y - p.ay;
    const d = Math.hypot(rx, ry) || 0.0001;
    const tx = -ry / d;
    const ty = rx / d;
    const vt = p.vx * tx + p.vy * ty;
    const dir = vt >= 0 ? 1 : -1;
    const speedFactor = clamp(1 - p.speed() / 860, 0.12, 1);
    const inputFactor = this.holdWeb ? 1 : 0.5;
    p.vx += tx * dir * PUMP * speedFactor * inputFactor * h;
    p.vy += ty * dir * PUMP * speedFactor * inputFactor * h;
    this.pumpFx = clamp(speedFactor * inputFactor, 0, 1);

    // the silk only ever reels in: holding the line is how you climb the city
    const reel = this.holdWeb ? REEL_IN : REEL_AUTO;
    p.rope = Math.max(ROPE_MIN, p.rope - reel * h);

    // reeled all the way up to a ledge? Mantle over it instead of dangling.
    if (
      this.attachKind !== "prop" &&
      this.attachDir !== 0 &&
      p.rope <= ROPE_MIN + 18 &&
      p.y + p.r <= p.ay + 76
    ) {
      const landX = p.ax + this.attachDir * 22;
      const ledgeY = p.ay + 9;
      const roof = this.world.roofYAt(landX);
      if (roof !== null && Math.abs(roof - ledgeY) < 26) {
        p.detach();
        this.attachKind = null;
        this.attachDir = 0;
        this.webCooldown = 0.16;
        p.x = landX;
        p.y = roof - p.r;
        p.vy = 0;
        p.vx = Math.abs(p.vx) < 90 ? this.attachDirOr(p.vx) : p.vx;
        p.grounded = true;
        p.groundY = roof;
        p.landT = 0;
        p.airT = 9;
        p.tuck = 0;
        this.sfx.land(240);
        this.parts.burst(p.x, roof - 2, "rgba(228,222,200,0.7)", 8, 110, 2.1, 0.3, 320);
        return;
      }
    }

    // a line that has nowhere left to pull is let go, so the aim can move on
    if (p.rope <= ROPE_MIN + 4 && p.speed() < 165) {
      this.stallT += h;
      if (this.stallT > 0.34) {
        this.stallT = 0;
        this.attachKind = null;
        this.attachDir = 0;
        this.forget = { x: p.ax, y: p.ay, t: 0.5 };
        p.detach();
        this.webCooldown = 0.05;
        this.sfx.whoosh();
      }
    } else {
      this.stallT = 0;
    }
  }

  /** a mantle keeps whatever pace you had, and never pushes you backwards */
  private attachDirOr(vx: number): number {
    const dir = this.attachDir || 1;
    return Math.max(vx, 90 * dir);
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

    if (p.grounded) {
      // upright on the roof, with a small lean into the run
      p.angularVelocity += (0 - p.rotation) * 22 * h;
      p.angularVelocity *= Math.exp(-11 * h);
      p.rotation += p.angularVelocity * h;
      p.lastFlipAngle = p.rotation;
      p.flips = 0;
      this.airTricks = 0;
      return;
    }

    if (p.attached) {
      // While webbed, the body follows the swing tangent with a small inertial lag.
      p.angularVelocity += error * 18 * h;
      p.angularVelocity *= Math.exp(-7 * h);
      p.rotation += p.angularVelocity * h;
      p.lastFlipAngle = p.rotation;
      p.flips = 0;
      return;
    }

    if (this.trickDir !== 0) {
      p.angularVelocity += this.trickDir * 7.4 * h;
      p.tuck = Math.min(1, p.tuck + h * 4);
    } else if (Math.abs(p.angularVelocity) < 1.25) {
      // At low spin the body settles back into the direction of travel.
      p.angularVelocity += clamp(error * 2.8, -2.2, 2.2) * h;
      p.tuck = Math.max(0, p.tuck - h * 2.4);
    }

    p.angularVelocity *= Math.exp(-(this.trickDir !== 0 ? 0.2 : 0.42) * h);
    p.angularVelocity = clamp(p.angularVelocity, -9, 9);
    p.rotation += p.angularVelocity * h;

    const turns = Math.trunc((p.rotation - p.lastFlipAngle) / (Math.PI * 2));
    if (turns !== 0) {
      const count = Math.abs(turns);
      p.lastFlipAngle += turns * Math.PI * 2;
      p.flips += count;
      this.airTricks += count;
      this.tricks += count;
      this.combo = Math.min(99, this.combo + count);
      const label =
        this.airTricks >= 3 ? `${this.airTricks}× FLIP CHAIN` : count > 1 ? `×${count} SOMERSAULTS` : "SOMERSAULT";
      this.popup(p.x, p.y - 52, label, "#b5825a", 17);
      this.parts.ring(p.x, p.y, "rgba(196,150,108,0.5)", 5, 0.38);
      this.sfx.coin(Math.min(count, 4));
      this.emit();
    }
  }

  /* ---------------- collision ---------------- */

  private collide() {
    const p = this.player;
    const w = this.world;
    if (this.state !== "playing") return;
    const wasGrounded = p.grounded;
    p.grounded = false;

    /* --- the avenue is the only floor that kills --- */
    if (p.y + p.r > w.streetY) {
      this.die("street");
      return;
    }

    /* --- roofs, risers and facades --- */
    this.wallDir = 0;
    const b = w.at(p.x);
    if (b) {
      const seg = w.segAt(p.x);
      if (seg) {
        const surf = segYAt(seg, p.x);
        // a resting body sits exactly on the surface, so the test is inclusive
        if (p.y + p.r >= surf - 0.5) {
          const pen = p.y + p.r - surf;
          const rising = p.vy < -40;
          const fromAbove = p.prevY + p.r <= surf + 20;
          if (!rising && (fromAbove || pen < 30)) this.land(surf, p.vy, wasGrounded);
          else if (pen >= 12 || !fromAbove) this.pushOutOfBuilding(b, seg);
          // otherwise: rising through a hair of penetration — let it go
        }
      }
    } else {
      // in an alley: the facades on either side are walls
      for (const nb of w.buildingsNear(p.x, 90)) {
        if (p.x >= nb.x0 && p.x <= nb.x1) continue;
        const top = nb.segs[0].y0;
        const overlapLeft = p.x + p.r > nb.x0 && p.x < nb.x0;
        const overlapRight = p.x - p.r < nb.x1 && p.x > nb.x1;
        if (!overlapLeft && !overlapRight) continue;
        if (p.y + p.r < top) continue; // still flying over the roof line
        const into = overlapLeft ? p.vx : -p.vx;
        if (overlapLeft) {
          p.x = nb.x0 - p.r - 0.4;
          this.wallDir = 1;
        } else {
          p.x = nb.x1 + p.r + 0.4;
          this.wallDir = -1;
        }
        if (into > 0) {
          this.wallImpact(into);
          p.vx = clamp(-p.vx * 0.14, -70, 70);
        }
        // a facade is slideable, not sticky
        if (p.vy > 0) p.vy = Math.min(p.vy, 240);
        break;
      }
    }

    /* --- rooftop structures, pickups and drones --- */
    let death: string | null = null;
    w.eachNear(
      p.x,
      (o) => {
        if (death || this.state !== "playing") return;
        const hit = this.propCollide(o, wasGrounded);
        if (hit) death = hit;
      },
      130,
    );
    if (death) {
      this.die(death);
      return;
    }

    /* --- the checkpoint arch: pass through its real opening --- */
    const gate = this.gateHole;
    const withinArch =
      gate !== null &&
      Math.abs(p.x - gate.x) < gate.r * 0.72 + p.r * 0.35 &&
      p.y > gate.y - gate.r * 0.78 - p.r * 0.2 &&
      p.y < gate.y + gate.r * 0.82 + p.r * 0.2;
    if (gate && withinArch) {
      this.reachGate(gate.x, gate.y);
    }
  }

  private land(surf: number, vy: number, wasGrounded: boolean) {
    const p = this.player;
    const impact = Math.max(0, vy);
    p.y = surf - p.r;
    p.vy = 0;
    p.grounded = true;
    p.groundY = surf;
    p.airT = 9;
    if (!wasGrounded) {
      p.landT = 0;
      p.angularVelocity *= 0.16;
      p.rotation = 0;
      p.lastFlipAngle = 0;
      p.flips = 0;
      p.tuck = 0;
      if (impact > 220) {
        this.trauma = Math.min(0.5, this.trauma + impact / 2600);
        this.parts.burst(p.x, surf - 2, "rgba(226,218,196,0.66)", 8, 120, 2.2, 0.32, 340);
        this.sfx.land(impact);
      } else {
        this.sfx.step();
      }
      if (this.airTricks > 0) {
        this.popup(p.x, p.y - 62, `LANDED · ${this.airTricks} ${this.airTricks === 1 ? "FLIP" : "FLIPS"}`, "#8f9a72", 15);
        this.airTricks = 0;
      }
      // a hard landing keeps momentum; a soft one costs a little speed
      p.vx *= impact > 520 ? 0.94 : 0.88;
    }
  }

  private pushOutOfBuilding(b: Building, seg: RoofSeg) {
    const p = this.player;
    const leftX = seg.x0 > b.x0 + 1 ? seg.x0 : b.x0;
    const rightX = seg.x1 < b.x1 - 1 ? seg.x1 : b.x1;
    const toLeft = p.x - (leftX - p.r - 0.5);
    const toRight = rightX + p.r + 0.5 - p.x;
    const into = Math.abs(p.vx);
    if (toLeft <= toRight) {
      p.x = leftX - p.r - 0.5;
      if (p.vx > 0) p.vx = -p.vx * 0.12;
      this.wallDir = 1;
    } else {
      p.x = rightX + p.r + 0.5;
      if (p.vx < 0) p.vx = -p.vx * 0.12;
      this.wallDir = -1;
    }
    if (p.vy > 0) p.vy = Math.min(p.vy, 240); // slide down the facade
    this.wallImpact(into);
  }

  /** a facade hit: never lethal, but it costs speed and balance */
  private wallImpact(speed: number) {
    const p = this.player;
    if (speed < 120) return;
    p.stumbleT = 0.34;
    this.combo = 0;
    this.perfectCombo = 0;
    this.trauma = Math.min(0.6, this.trauma + speed / 2200);
    this.parts.burst(p.x, p.y, "rgba(214,206,186,0.7)", 8, 150, 2.2, 0.34, 300);
    this.sfx.land(speed * 1.2);
  }

  /** returns the cause string when the run should end, otherwise null */
  private propCollide(o: Prop, wasGrounded: boolean): string | null {
    const p = this.player;
    const w = this.world;
    switch (o.kind) {
      case "token": {
        if (o.got) return null;
        const d = dist(p.x, p.y, o.x, o.y);
        const pullR = this.magnetT > 0 ? 230 : 76;
        if (d < pullR) {
          const f = this.magnetT > 0 ? 0.06 : (1 - Math.exp(-0.45 * (76 - d) * 0.016)) * 0.12;
          o.x = lerp(o.x, p.x, f);
          o.y = lerp(o.y, p.y, f);
        }
        if (d < p.r + 22) {
          o.got = true;
          this.onToken(o.x, o.y);
        }
        return null;
      }
      case "shield": {
        if (!o.got && dist(p.x, p.y, o.x, o.y) < 32 + p.r) {
          o.got = true;
          this.shieldActive = true;
          this.showAnnounce({
            id: "shield" + Math.floor(this.time * 10),
            kind: "shield",
            title: "SPARE STRAND",
            sub: "absorbs one fatal hit",
          });
          this.popup(p.x, p.y - 56, "SHIELD ON", "#8a9a72", 20);
          this.parts.burst(o.x, o.y, "#8a9a72", 12, 190, 2.6, 0.5, 240);
          this.sfx.shieldUp();
          this.emit();
        }
        return null;
      }
      case "magnet": {
        if (!o.got && dist(p.x, p.y, o.x, o.y) < 32 + p.r) {
          o.got = true;
          this.magnetT = MAGNET_TIME;
          this.showAnnounce({
            id: "magnet" + Math.floor(this.time * 10),
            kind: "magnet",
            title: "SPOOL LURE",
            sub: `${MAGNET_TIME}s of spool vacuum`,
          });
          this.parts.burst(o.x, o.y, "#bd8066", 12, 190, 2.6, 0.5, 240);
          this.sfx.magnetUp();
          this.emit();
        }
        return null;
      }
      case "drone": {
        const d = dronePos(o, this.time);
        if (dist(p.x, p.y, d.x, d.y) < 17 + p.r * 0.8) {
          this.parts.burst(d.x, d.y, "rgba(190,180,160,0.8)", 14, 220, 2.6, 0.5, 380);
          return "drone";
        }
        return null;
      }
      case "clothesline": {
        const box = propBox(o);
        if (
          p.x > box.x0 &&
          p.x < box.x1 &&
          Math.abs(p.y - o.y) < 16 + p.r &&
          p.speed() > 90
        ) {
          // smash straight through: a little drag, a lot of laundry
          p.vx *= 0.94;
          p.vy *= 0.96;
          this.parts.burst(p.x, o.y, "rgba(238,232,214,0.85)", 12, 150, 2.4, 0.6, 260);
          this.sfx.whoosh();
          o.y = w.streetY + 900; // the line is gone for this run
          this.combo = Math.min(99, this.combo + 1);
          this.popup(p.x, p.y - 46, "LAUNDRY!", "#a8896a", 14);
        }
        return null;
      }
      default: {
        const box = propBox(o);
        const hard = HARD_PROPS.includes(o.kind);
        const soft = SOFT_PROPS.includes(o.kind);
        // standing on top of rooftop clutter is part of the parkour
        const onTop =
          o.kind !== "antenna" &&
          p.x > box.x0 - 6 &&
          p.x < box.x1 + 6 &&
          p.y + p.r >= box.y0 - 0.6 &&
          p.y + p.r <= box.y0 + 28 &&
          p.vy >= -40 &&
          p.prevY + p.r <= box.y0 + 18;
        if (onTop) {
          this.land(box.y0, p.vy, p.grounded || wasGrounded);
          if (hard && Math.abs(p.vx) > 240) p.vx *= 0.9;
          return null;
        }
        const nx = clamp(p.x, box.x0, box.x1);
        const ny = clamp(p.y, box.y0, box.y1);
        const dx = p.x - nx;
        const dy = p.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= p.r * p.r) return null;
        const d = Math.sqrt(Math.max(d2, 0.0001));
        const ux = d > 0.0001 ? dx / d : 0;
        const uy = d > 0.0001 ? dy / d : -1;
        p.x = nx + ux * (p.r + 0.6);
        p.y = ny + uy * (p.r + 0.6);
        const vr = p.vx * ux + p.vy * uy;
        const impact = Math.max(0, -vr);
        if (vr < 0) {
          p.vx -= vr * ux * (soft ? 1.1 : 1.35);
          p.vy -= vr * uy * (soft ? 1.1 : 1.35);
        }
        if (hard && impact > CRASH_SPEED && this.invulnT <= 0) {
          this.parts.burst(p.x, p.y, "rgba(196,120,96,0.85)", 16, 240, 2.8, 0.6, 420);
          return `crash:${o.kind}`;
        }
        if (impact > 60) {
          p.stumbleT = 0.3;
          this.combo = 0;
          this.trauma = Math.min(0.55, this.trauma + impact / 2400);
          this.parts.burst(p.x, p.y, "rgba(214,206,186,0.7)", 7, 140, 2.1, 0.3, 320);
          this.sfx.land(impact);
        }
        return null;
      }
    }
  }

  private onToken(x: number, y: number) {
    this.tokens += 1;
    this.tokenChain += 1;
    this.tokenChainT = 1.4;
    this.save.tokens += 1;
    this.saveDirty = 2;
    this.sfx.coin(this.tokenChain);
    this.parts.burst(x, y, "#d3ab6a", 10, 170, 2.6, 0.45, 320);
    this.parts.ring(x, y, "rgba(211,171,106,0.66)", 4, 0.35);
    this.emit();
  }

  /** shield absorbs one lethal hit and throws you back into the air */
  private breakShield(cause: string) {
    const p = this.player;
    this.shieldActive = false;
    this.invulnT = 1.2;
    if (cause === "street") {
      p.vy = -880;
      p.vx += 170;
      p.y = this.world.streetY - p.r * 2.4;
    } else {
      p.vy = Math.min(p.vy, -640);
      p.vx += 90;
    }
    p.detach();
    this.webCooldown = 0.35;
    this.trauma = Math.min(0.7, this.trauma + 0.45);
    this.showAnnounce({
      id: "save" + Math.floor(this.time * 10),
      kind: "save",
      title: "SAVED!",
      sub: "the spare strand held",
    });
    this.popup(p.x, p.y - 64, "SAVED!", "#8a9a72", 26);
    this.parts.burst(p.x, p.y, "#8a9a72", 20, 340, 3, 0.6, 420);
    this.sfx.shieldBreak();
    this.emit();
  }

  private die(cause: string) {
    if (this.state !== "playing") return;
    const p = this.player;
    // opening grace — nobody should lose a run in the first seconds
    if (this.graceT > 0 && this.runT < 25) {
      if (cause === "street") {
        p.y = this.world.streetY - p.r * 2.6;
        p.vy = -720;
        p.vx = Math.max(p.vx, 320);
      } else {
        p.detach();
        p.vy = Math.min(p.vy, -320);
        p.y -= p.r * 1.6;
        p.vx = Math.max(p.vx * 0.72, 260);
      }
      this.parts.burst(p.x, p.y, "#93a37c", 12, 240, 2.6, 0.5, 300);
      this.graceT = Math.max(this.graceT, 0.6);
      this.invulnT = Math.max(this.invulnT, 0.6);
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
    this.combo = 0;
    p.detach();
    this.parts.burst(p.x, p.y, "#bf775f", 14, 190, 2.8, 0.7, 360);
    this.parts.burst(p.x, p.y, "rgba(246,240,226,0.9)", 9, 230, 2.4, 0.6, 500);
    this.parts.burst(p.x, p.y, "#7c8975", 10, 260, 3, 0.7, 620);
    this.parts.ring(p.x, p.y, "rgba(255,252,244,0.85)", 8, 0.6);
    this.sfx.death();
    this.sfx.padStop();
    if (this.distM > this.best) {
      this.best = this.distM;
      this.newBest = true;
    }
    this.save.meters += Math.max(0, this.distM - this.journeyMeters);
    this.save.tricks += this.tricks;
    this.save.alt = Math.max(this.save.alt, this.maxAlt);
    this.sfx.setWind(0);
    this.persist();
    this.emit();
  }

  /* ---------------- tutorial ---------------- */

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
    if (this.show("swing")) return;
    if (this.runT > 4 && this.show("run")) return;
    if (this.gliding && this.show("glide")) return;
    if (this.runT > 6 && this.show("street")) return;
    if (p.attached && this.runT > 8 && this.show("release")) return;
    if (this.maxAlt > 22 && this.show("alt")) return;
    if (Math.abs(p.angularVelocity) > 3 && this.show("trick")) return;
    if (this.distM > this.segStartM + 120 && this.show("gate")) return;

    const lookahead = 780;
    let found: string | null = null;
    this.world.eachNear(p.x + 380, (o) => {
      if (found) return;
      const ox = o.x;
      if (ox < p.x + 110 || ox > p.x + lookahead) return;
      if ((o.kind === "token" || o.kind === "shield" || o.kind === "magnet") && o.got) return;
      if (!this.taught.has(o.kind) && TIPS[o.kind]) found = o.kind;
    }, 620);
    if (found) this.show(found);
  }

  private show(id: string): boolean {
    if (this.taught.has(id)) return false;
    const tip = TIPS[id];
    if (!tip) return false;
    this.taught.add(id);
    this.save.taught = Array.from(this.taught);
    this.saveDirty = 1;
    this.tip = tip;
    this.tipT = tip.tone === "info" ? 5 : 4.2;
    this.sfx.tick();
    this.emit();
    return true;
  }

  /** true when the runner is just rocking on a line and should let go */
  private judgeHold(): boolean {
    const p = this.player;
    if (!p.attached || !this.holdWeb) return false;
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    return Math.abs(ang) > 58 || p.speed() < 190;
  }

  /* ---------------- checkpoints ---------------- */

  /** Point the checkpoint at the next 250 m arch; there is no final gate. */
  private refreshGate() {
    const p = this.player;
    const spacing = LEVEL_METERS * METER;
    const k = Math.max(0, Math.ceil((p.x + 200 - this.startX) / spacing) - 1);
    this.gateIndex = k;
    this.gateHole = this.world.gate(k);
  }

  /** swing through the arch — the district is cleared and saved */
  private reachGate(x: number, y: number) {
    if (this.state !== "playing") return;
    const localMeters = this.gateHole
      ? Math.max(LEVEL_METERS, Math.round((this.gateHole.x - this.startX) / METER))
      : Math.max(0, Math.floor((this.player.x - this.startX) / METER));
    this.distM = this.journeyMeters + localMeters;
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
    this.parts.burst(x, y - 26, "#d6b375", 26, 340, 3.4, 0.9, 380);
    this.parts.ring(x, y - 26, "rgba(228,206,152,0.78)", 14, 0.7);
    this.parts.ring(x, y - 26, "rgba(251,247,231,0.6)", 8, 0.5);
    this.popup(x, y - 150, "CHECKPOINT!", "#d6b375", 38);
    this.save.meters += LEVEL_METERS;
    this.save.alt = Math.max(this.save.alt, this.maxAlt);
    this.persist();
    this.sfx.setWind(0);
    this.emit();
  }

  private updateShake(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.25);
    const amp = this.trauma * this.trauma * 20;
    this.cam.sx = (noise1(this.time * 29.7) - 0.5) * 2 * amp;
    this.cam.sy = (noise1(this.time * 34.3 + 7.7) - 0.5) * 2 * amp;
  }

  /* ---------------- snapshot for the React HUD ---------------- */

  private emit() {
    const gate = this.gateHole;
    const key = [
      this.state,
      this.distM,
      this.tokens,
      this.tricks,
      this.combo,
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
      this.altM,
      this.maxAlt,
      this.player.attached,
      this.player.grounded,
      !!this.aim,
      gate ? Math.round(gate.x / 20) : 0,
      Math.round(this.segStartM / 5),
      this.missedGate,
      this.save.best,
      this.save.tokens,
      this.save.runs,
      this.save.checkpoint,
    ].join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cb({
      state: this.state,
      level: this.level,
      unlocked: this.unlocked,
      theme: this.theme,
      district: themeDef(this.theme).name,
      dist: this.distM,
      tokens: this.tokens,
      tricks: this.tricks,
      combo: this.combo,
      best: this.best,
      newBest: this.newBest,
      muted: this.sfx.muted,
      maxSpeed: this.maxSpeed,
      alt: this.altM,
      maxAlt: this.maxAlt,
      cause: this.cause,
      showHint: this.state === "playing" && !this.firstClick,
      shield: this.shieldActive,
      magnetT: this.magnetT,
      tip: this.tip,
      graceT: this.graceT,
      gliding: this.gliding,
      announce: this.announce,
      lowAlt: this.lowAlt,
      gateM: this.journeyMeters + (gate ? Math.round((gate.x - this.startX) / METER) : LEVEL_METERS),
      segStart: this.segStartM,
      missed: this.missedGate,
      webbed: this.player.attached,
      grounded: this.player.grounded,
      aiming: !!this.aim,
      save: this.save,
    } as Snap);
  }
}

/** cumulative metres the whole route has covered — used by the tools */
export const routeMeters = (x: number): number =>
  Math.max(0, Math.floor((x - ROUTE_START_X) / METER));
