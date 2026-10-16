import { World } from "./world";
import { Player } from "./player";
import { Particles } from "./particles";
import { Sfx } from "./audio";
import { Renderer } from "./renderer";
import { clamp, lerp, dist, noise1 } from "./util";

export type GameState = "menu" | "playing" | "dying" | "dead" | "paused";

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

export interface Snap {
  state: GameState;
  dist: number;
  best: number;
  newBest: boolean;
  maxSpeed: number;
  cause: string;
  combo: number; // length of the current perfect-release chain
  tip: Tip | null;
  lowAlt: number; // 0..1 — how close to the street you are
  settings: Settings;
}

export interface Tip {
  id: string;
  text: string;
}

/** the only three lessons in the whole game — each is shown once, in the scene */
export const TIPS: Record<string, Tip> = {
  hold: { id: "hold", text: "Держи — паутина. Двойной тап — полёт" },
  release: { id: "release", text: "Отпусти внизу дуги — там самая скорость" },
  street: { id: "street", text: "Не касайся улицы" },
};
const TIP_TIME = 3.2;

export interface Popup {
  x: number;
  y: number;
  str: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

const SETTINGS_KEY = "webby_settings";
const DEFAULT_SETTINGS: Settings = { sound: true, music: true, haptics: true };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

const G = 1930; // gravity px/s^2 — lighter, floatier arcs
const FWD = 175; // forward push — ramps up with distance
const FWD_ATT = 95; // gentle constant swing nudge
const MAXV = 1300;
const ROPE_MAX = 440; // must exceed the corridor height or low flight is a dead end
const PUMP = 700; // tangential self-pump — keeps the swing alive
const REEL = 90; // rope reel speed while pumping
const GLIDE_G = 0.28; // gravity multiplier while gliding
const GLIDE_VY = 215; // sink rate when gliding slowly
const GLIDE_CLIMB = -110; // fast glides actually gain altitude
const GLIDE_FWD = 190; // forward drift from the web-wings
const UPDRAFT_H = 330; // height above the street where thermals kick in
const UPDRAFT_VY = -330; // how hard the updraft lifts you clear
const DOUBLE_TAP = 0.3; // seconds between two taps that count as a double tap
const GRACE = 3.2; // seconds of invulnerability at the start of a run
const METER = 50; // px per meter

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
  gliding = false;
  glideHold = false; // flight is on (double tap held / double Space held)
  private glideTap = false; // this flight was started by a double tap
  private lastTapT = -10;
  private lastTapX = 0;
  private lastTapY = 0;
  private lastSpaceT = -10;
  graceT = 0;
  lowAlt = 0;
  private autoRetryT = 0;
  demoT = 0; // menu backdrop clock
  settings: Settings = loadSettings();

  // tutorial
  tip: Tip | null = null;
  private tipT = 0;
  private taught = new Set<string>();
  private tipScanT = 0;

  distM = 0;
  coins = 0;
  best = 0;
  newBest = false;
  maxSpeed = 0;
  cause = "";
  private coinChain = 0;
  private coinChainT = 0;
  private dyingT = 0;
  private deadAt = -10;

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
    this.sfx.setMuted(!this.settings.sound);
    try {
      this.best = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
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

  start() {
    this.world = new World();
    this.world.ensure(0);
    this.parts.list = [];
    this.texts = [];
    this.player.reset(this.startX, this.world.ceilY(this.startX) + 225);
    this.runT = 0;
    this.distM = 0;
    this.coins = 0;
    this.newBest = false;
    this.maxSpeed = 0;
    this.cause = "";
    this.coinChain = 0;
    this.firstClick = false;
    this.trauma = 0;
    this.perfectCombo = 0;
    this.lastMilestone = 0;
    this.holdWeb = false;
    this.aim = null;
    this.snapFx = null;
    this.autoRetryT = 0;
    this.attachTime = -10;
    this.pumpFx = 0;
    this.gliding = false;
    this.glideHold = false;
    this.graceT = GRACE;
    this.tip = null;
    this.tipT = 0;
    this.tipScanT = 0;
    this.cam.x = this.player.x - this.vw * 0.4;
    this.cam.y = this.player.y - this.vh * 0.52;
    this.state = "playing";
    this.sfx.ensure();
    this.sfx.start();
    if (this.settings.music) this.sfx.padStart();
    // onboarding: first swing is free — shows what to do
    const ax = this.player.x + 135;
    this.player.attach(ax, this.world.ceilY(ax) + 2);
    this.emit();
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
    this.setSetting("sound", this.sfx.muted);
  }

  /** settings from the menu / pause sheet — persisted */
  setSetting<K extends keyof Settings>(k: K, v: boolean) {
    this.settings = { ...this.settings, [k]: v };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    if (k === "sound") this.sfx.setMuted(!v);
    if (k === "music") {
      if (v && this.state === "playing") this.sfx.padStart();
      else this.sfx.padStop();
    }
    if (k === "haptics" && v) this.haptic(12);
    this.emit();
  }

  /** short vibration where the platform supports it (iOS Safari does not) */
  private haptic(pattern: number | number[]) {
    if (!this.settings.haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* unsupported */
    }
  }

  /** flight on/off — driven by a double tap, see onPointerDown */
  setGlide(on: boolean) {
    if (this.glideHold === on) return;
    this.glideHold = on;
    if (on && this.state === "playing") {
      if (this.player.attached) this.release(false);
      this.sfx.whoosh();
    }
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
    // double tap: the second touch is held to fly instead of shooting a web
    const dbl =
      this.time - this.lastTapT < DOUBLE_TAP &&
      Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY) < 80;
    this.lastTapT = this.time;
    this.lastTapX = e.clientX;
    this.lastTapY = e.clientY;
    if (dbl) {
      this.lastTapT = -10;
      this.glideTap = true;
      this.setGlide(true);
      return;
    }
    this.holdWeb = true;
    this.autoRetryT = 0;
    this.tryAutoAttach();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointer.id !== -1 && e.pointerId !== this.pointer.id) return;
    this.pointer.id = -1;
    this.holdWeb = false;
    this.release(false);
    this.endTapGlide();
  };

  private endTapGlide() {
    if (!this.glideTap) return;
    this.glideTap = false;
    this.setGlide(false);
  }

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
        // same rule as touch: hold to web, double-press and hold to fly
        const dbl = this.time - this.lastSpaceT < DOUBLE_TAP;
        this.lastSpaceT = this.time;
        if (dbl) {
          this.lastSpaceT = -10;
          this.glideTap = true;
          this.setGlide(true);
        } else {
          this.holdWeb = true;
          this.autoRetryT = 0;
          this.tryAutoAttach();
        }
      }
    } else if (e.code === "Escape") {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "Enter") {
      this.holdWeb = false;
      this.release(false);
      this.endTapGlide();
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
    this.parts.burst(p.x, p.y, "rgba(235,250,255,1)", 6, 130, 2.4, 0.4, 300);
    if (perfect) {
      p.vx *= 1.045;
      p.vy *= 1.045;
      this.perfectCombo = Math.min(9, this.perfectCombo + 1);
      this.popup(
        p.x,
        p.y - 52,
        this.perfectCombo > 1 ? `Идеально ×${this.perfectCombo}` : "Идеально",
        "#ffb547",
        22,
      );
      this.parts.ring(p.x, p.y, "rgba(125,240,255,0.9)", 8, 0.45);
      this.sfx.perfect(this.perfectCombo);
      this.haptic(8);
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
    const bestRef: {
      cur: { x: number; y: number; d: number; score: number } | null;
    } = { cur: null };
    // when nothing good is ahead, accept anything overhead or slightly behind
    const minD = desperate ? 46 : 70;
    const minBack = desperate ? -190 : 4;
    const maxTheta = desperate ? 100 : 82;

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
      // would the pendulum dip into lava? (rope may also spool +70)
      if (ay + d + 70 + p.r + 12 > w.lavaY(ax)) score += 500;
      // line of sight — the surface must actually block the ray there
      const hit = w.raycast(p.x, p.y, dx / d, dy / d, d + 12);
      if (!hit || dist(hit.x, hit.y, ax, ay) > 18) return;
      const best = bestRef.cur;
      if (!best || score < best.score) {
        bestRef.cur = { x: ax, y: ay, d, score };
      }
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

    const b = bestRef.cur;
    return b ? { x: b.x, y: b.y, d: b.d } : null;
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

  private popup(x: number, y: number, str: string, color: string, size = 22) {
    if (this.texts.length > 8) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 0.6, max: 0.6 });
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
        color: "rgba(214,206,255,0.5)",
        grav: -40,
        drag: 0.03,
      });
    }
    this.parts.update(dt);

    if (this.state === "menu") {
      this.updateMenuDemo(dt);
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
    if (this.graceT > 0) this.graceT = Math.max(0, this.graceT - dt);

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

    this.updateTips(dt);

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

    // score + milestones
    const m = Math.max(0, Math.floor((p.x - this.startX) / METER));
    if (m !== this.distM) this.distM = m;
    const ms = Math.floor(this.distM / 100) * 100;
    if (ms > 0 && ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.popup(p.x, p.y - 90, `${ms} м`, "#ffb547", 26);
      this.sfx.milestone();
    }

    this.sfx.setWind(sp / MAXV);
    this.sfx.padLevel(sp / MAXV);
    this.emit();
  }

  /** menu backdrop: the spider idles on a web while the city drifts past */
  private updateMenuDemo(dt: number) {
    const p = this.player;
    this.demoT += dt;
    this.cam.x += dt * 60;
    const ax = this.cam.x + this.vw * 0.5;
    this.world.ensure(this.cam.x + this.vw + 600);
    const ay = this.world.ceilY(ax) + 2;
    const len = 230;
    const th = 0.5 * Math.sin(this.demoT * 1.3);
    const px0 = p.x;
    const py0 = p.y;
    p.attached = true;
    p.ax = ax;
    p.ay = ay;
    p.rope = len;
    p.rope0 = len;
    p.x = ax + Math.sin(th) * len;
    p.y = ay + Math.cos(th) * len;
    const k = 1 / Math.max(dt, 1e-3);
    p.vx = (p.x - px0) * k;
    p.vy = (p.y - py0) * k;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 22) p.trail.shift();
    this.attachTime = -10;
    this.cam.y = lerp(this.cam.y, 40, 1 - Math.exp(-dt * 2));
    this.updateShake(dt);
  }

  private step(h: number) {
    const p = this.player;
    // ---- glide: holding with no web out spreads the web-wings ----
    // The spider catches air instead of dropping like a stone, which gives
    // you time to find the next ledge (and makes the early game forgiving).
    // flight is only ever entered by a double tap; holding alone never flies
    const glide =
      !p.attached && !p.grounded && this.glideHold && p.vy > -80 && this.state === "playing";
    this.gliding = glide;
    p.vy += (glide ? G * GLIDE_G : G) * h;
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
    // pace quickens the further you go — gently
    const fwd = p.attached
      ? FWD_ATT + Math.min(50, this.distM * 0.25)
      : FWD + Math.min(120, this.distM * 0.65);
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

    // lava — deadly
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
            const pullR = 70;
            if (d < pullR) {
              const f = (1 - Math.exp(-0.45 * (70 - d) * 0.016)) * 0.12;
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
    this.state = "dying";
    this.dyingT = 0;
    this.cause = cause;
    this.trauma = 1;
    this.perfectCombo = 0;
    const p = this.player;
    p.attached = false;
    this.parts.burst(p.x, p.y, "#ff4d5e", 22, 380, 3.6, 0.8, 640);
    this.parts.burst(p.x, p.y, "#ffd9de", 8, 220, 2.4, 0.6, 500);
    this.parts.burst(p.x, p.y, "#2b3a8f", 10, 260, 3, 0.7, 620);
    this.parts.ring(p.x, p.y, "rgba(255,255,255,0.9)", 8, 0.6);
    this.sfx.death();
    this.sfx.padStop();
    this.haptic([30, 50, 60]);
    if (this.distM > this.best) {
      this.best = this.distM;
      this.newBest = true;
    }
    this.sfx.setWind(0);
    this.emit();
  }

  /** three lessons in the whole game, each shown once, inside the scene */
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
    if (this.runT < 1.5 && this.show("hold")) return;
    if (this.runT > 2.5 && p.attached && this.show("release")) return;
    if (this.lowAlt > 0.5 && this.show("street")) return;
  }

  private show(id: string): boolean {
    if (this.taught.has(id)) return false;
    const tip = TIPS[id];
    if (!tip) return false;
    this.taught.add(id);
    try {
      localStorage.setItem(TAUGHT_KEY, JSON.stringify(Array.from(this.taught)));
    } catch {
      /* ignore */
    }
    this.tip = tip;
    this.tipT = TIP_TIME;
    this.emit();
    return true;
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
      this.best,
      this.newBest,
      Math.round(this.maxSpeed),
      this.cause,
      this.perfectCombo,
      this.tip?.id ?? "",
      Math.round(this.lowAlt * 5),
      this.settings.sound,
      this.settings.music,
      this.settings.haptics,
    ].join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cb({
      state: this.state,
      dist: this.distM,
      best: this.best,
      newBest: this.newBest,
      maxSpeed: this.maxSpeed,
      cause: this.cause,
      combo: this.perfectCombo,
      tip: this.tip,
      lowAlt: this.lowAlt,
      settings: this.settings,
    });
  }
}
