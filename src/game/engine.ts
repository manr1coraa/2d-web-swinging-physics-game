import { World } from "./world";
import { Player } from "./player";
import { Particles } from "./particles";
import { Sfx } from "./audio";
import { Renderer } from "./renderer";
import { clamp, lerp, dist, noise1 } from "./util";
import { live as T } from "./tuning";

export type GameState = "menu" | "playing" | "dying" | "dead" | "paused";

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
}

export interface Snap {
  state: GameState;
  dist: number;
  best: number;
  newBest: boolean;
  cause: string;
  chain: number; // current perfect-release chain, 0 = none
  gliding: boolean;
  glideFuel: number; // 0..1
  tip: Tip | null;
  settings: Settings;
}

export interface Tip {
  id: string;
  title: string;
  text: string;
  tone: "info" | "danger" | "good";
}

/** contextual lessons: three in total, each shown once */
export const TIPS: Record<string, Tip> = {
  swing: {
    id: "swing",
    title: "Hold to swing",
    text: "Hold to hook a ledge. Let go near the bottom of the arc.",
    tone: "info",
  },
  glide: {
    id: "glide",
    title: "Glide",
    text: "Double tap, then hold the second tap. Glide costs fuel.",
    tone: "good",
  },
  street: {
    id: "street",
    title: "Mind the street",
    text: "Touching the street or a hazard ends the run.",
    tone: "danger",
  },
};

export interface Popup {
  x: number;
  y: number;
  str: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

const MAX_SLICE = 0.25; // never simulate more than this much real time at once

const BEST_KEY = "pauchok_best";
const KEY_OWNER = -2; // press id used for the keyboard
const SETTINGS_KEY = "webby_settings";
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
  cam = { x: -200, y: 0, sx: 0, sy: 0, vx: 0, vy: 0, zoom: 1 };
  trauma = 0;

  firstClick = false;
  texts: Popup[] = [];

  // one-button web control
  holdWeb = false;
  aim: { x: number; y: number } | null = null;
  snapFx: { px: number; py: number; ax: number; ay: number; t: number } | null =
    null;
  attachTime = -10;
  gliding = false;
  glideHold = false; // second tap of a double tap is held
  glideFuel = 0;
  private glideOwner = -1; // which press (pointer id / KEY_OWNER) is gliding
  private holdOwner = -1; // which press is currently holding the web
  private lastPressAt = -10; // when the previous press started (real seconds)
  private acc = 0; // fixed-step accumulator
  private slowT = 0; // real seconds of release slow motion left
  lowAlt = 0;
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
  maxSpeed = 0;
  cause = "";
  private coinChain = 0;
  private coinChainT = 0;
  private dyingT = 0;
  private deadAt = -10;
  /** chain of perfect releases; a bad release resets it */

  // power-ups
  shieldActive = false;
  private invulnT = 0;
  private perfectCombo = 0;
  private lastMilestone = 0;

  settings: Settings = { sound: true, music: true, vibration: true };
  private demoT = 0;
  private demoNext = 0;
  private demoDrop = 0;

  private raf = 0;
  private last = 0;
  private cb: (s: Snap) => void;
  private lastKey = "";
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, cb: (s: Snap) => void) {
    this.cb = cb;
    this.renderer = new Renderer(canvas);
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
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
    this.applySettings();
    this.demoReset();
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
    this.player.reset(this.startX, this.world.ceilY(this.startX) + 225, T.startVx);
    this.runT = 0;
    this.distM = 0;
    this.coins = 0;
    this.newBest = false;
    this.maxSpeed = 0;
    this.cause = "";
    this.coinChain = 0;
    this.firstClick = false;
    this.trauma = 0;
    this.shieldActive = false;
    this.invulnT = 0;
    this.perfectCombo = 0;
    this.lastMilestone = 0;
    this.holdWeb = false;
    this.aim = null;
    this.snapFx = null;
    this.autoRetryT = 0;
    this.attachTime = -10;
    this.gliding = false;
    this.glideHold = false;
    this.glideFuel = T.glideFuel;
    this.glideOwner = -1;
    this.holdOwner = -1;
    this.acc = 0;
    this.slowT = 0;
    this.tip = null;
    this.tipT = 0;
    this.tipScanT = 0;
    this.player.syncRender();
    this.cam.x = this.player.rx - this.vw * 0.4;
    this.cam.y = this.player.ry - this.vh * 0.52;
    this.cam.vx = 0;
    this.cam.vy = 0;
    this.cam.zoom = 1;
    this.state = "playing";
    this.sfx.ensure();
    this.sfx.start();
    this.sfx.padStart();
    this.emit();
  }

  toMenu() {
    if (this.state === "playing" || this.state === "dying" || this.state === "paused")
      this.state = "menu";
    this.player.attached = false;
    this.demoReset();
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

  /** change settings; applied at once and remembered */
  setSettings(next: Partial<Settings>) {
    this.settings = { ...this.settings, ...next };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    this.applySettings();
    this.emit();
  }

  private applySettings() {
    this.sfx.setMuted(!this.settings.sound);
    this.sfx.setMusic(this.settings.music);
  }

  /** short haptic pulse where the platform supports it */
  private buzz(ms: number) {
    if (!this.settings.vibration) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
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
    this.pressStart(e.pointerId);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pressEnd(e.pointerId);
  };

  /**
   * One press (finger, mouse button or Space). A single press holds the web.
   * A second press within doubleTapS of the first one glides instead and
   * never fires the web. Glide lasts while that second press is held.
   */
  private pressStart(owner: number) {
    if (this.state !== "playing") return;
    // real time, not game time: a slow frame must not turn two taps into one
    const now = performance.now() / 1000;
    const isDouble = now - this.lastPressAt < T.doubleTapS;
    this.lastPressAt = now;
    if (isDouble) {
      this.lastPressAt = -10; // a third quick tap starts over
      this.release(false);
      this.holdWeb = false;
      this.holdOwner = -1;
      this.glideOwner = owner;
      this.glideHold = true;
      this.parts.ring(this.player.x, this.player.y, "rgba(235,250,255,0.8)", 5, 0.3);
      this.sfx.whoosh();
      this.emit();
      return;
    }
    this.holdOwner = owner;
    this.holdWeb = true;
    this.autoRetryT = 0;
    this.tryAutoAttach();
  }

  private pressEnd(owner: number) {
    if (owner === this.glideOwner) {
      this.glideOwner = -1;
      this.glideHold = false;
      this.emit();
    }
    if (owner === this.holdOwner) {
      this.holdOwner = -1;
      this.holdWeb = false;
      this.release(false);
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyR") {
      e.preventDefault();
      this.start();
    } else if (e.code === "KeyM") {
      this.setSettings({ sound: !this.settings.sound });
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
      else if (this.state === "playing" && !e.repeat) this.pressStart(KEY_OWNER);
    } else if (e.code === "Escape") {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "Enter") {
      this.pressEnd(KEY_OWNER);
    }
  };

  /* ---------------- web ---------------- */

  /** release the current web; rewards letting go near the bottom of the arc */
  private release(_reAim: boolean) {
    const p = this.player;
    if (!p.attached || this.state !== "playing") return;
    // rope angle from straight-down (0 = hanging below the anchor)
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    const sp = p.speed();
    const perfect =
      Math.abs(ang) <= T.perfectAngleDeg && sp >= T.perfectMinSpeed;
    this.snapFx = { px: p.x, py: p.y, ax: p.ax, ay: p.ay, t: 0.26 };
    p.detach();
    this.sfx.whoosh();
    this.parts.burst(p.x, p.y, "rgba(235,250,255,1)", 3, 110, 2.2, 0.35, 220);
    p.stretchOnRelease();
    if (perfect) {
      this.perfectCombo += 1;
      // the chain earns speed one link at a time, up to a cap
      if (this.perfectCombo <= T.perfectChainSpeedCap) {
        const k = 1 + T.perfectGain;
        p.vx *= k;
        p.vy *= k;
      }
      this.slowT = Math.max(this.slowT, T.perfectSlowS);
      this.popup(
        p.x,
        p.y - 52,
        this.perfectCombo > 1 ? `PERFECT ×${this.perfectCombo}` : "PERFECT",
        "#7df0ff",
        20,
      );
      this.parts.ring(p.x, p.y, "rgba(125,240,255,0.9)", 8, 0.45);
      this.sfx.perfect(this.perfectCombo);
      this.buzz(8);
    } else {
      this.perfectCombo = 0;
    }
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
      if (d < minD || d > T.ropeMax) return;
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
    const from = desperate ? -T.ropeMax : 46;
    for (let ox = from; ox <= T.ropeMax + 40; ox += 20) {
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
    this.attachTime = this.time;
    this.firstClick = true;
    this.parts.burst(cand.x, cand.y, "rgba(126,240,255,1)", 4, 120, 2.2, 0.3, 120);
    this.player.squashOnHook();
    this.parts.ring(cand.x, cand.y, "rgba(126,240,255,0.9)", 3, 0.3);
    this.sfx.thwip();
    this.emit();
    return true;
  }

  private popup(x: number, y: number, str: string, color: string, size = 22) {
    if (this.texts.length > 8) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 0.95, max: 0.95 });
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
      this.updateDemo(dt);
      this.world.ensure(this.player.rx + this.vw);
      this.updateCamera(dt, this.player);
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

    if (this.state !== "playing") return;

    this.runT += dt;
    // release slow motion runs on real time and only lasts a few frames
    let simDt = dt;
    if (this.slowT > 0) {
      simDt = dt * T.perfectSlowScale;
      this.slowT = Math.max(0, this.slowT - dt);
    }
    // fixed-step simulation: the physics result never depends on frame rate
    const fixed = 1 / T.stepHz;
    this.acc = Math.min(this.acc + simDt, MAX_SLICE);
    while (this.acc >= fixed && this.state === "playing") {
      this.step(fixed);
      this.acc -= fixed;
    }
    if (this.state !== "playing") return;
    // blend between the last two steps so motion stays smooth at 60 and 120 Hz
    const alpha = this.acc / fixed;
    this.player.interpolate(alpha);

    const p = this.player;
    const sp = p.speed();
    this.maxSpeed = Math.max(this.maxSpeed, sp);

    // trail
    p.trail.push({ x: p.rx, y: p.ry });
    if (p.trail.length > 22) p.trail.shift();

    // power-up timers
    if (this.invulnT > 0) this.invulnT -= dt;
    if (!p.attached && !p.grounded && this.gliding) {
      this.glideFuel = Math.max(0, this.glideFuel - dt);
    } else {
      this.glideFuel = Math.min(T.glideFuel, this.glideFuel + T.glideRefill * dt);
    }
    // coin chain window
    if (this.coinChainT > 0) {
      this.coinChainT -= dt;
      if (this.coinChainT <= 0) this.coinChain = 0;
    }

    this.updateCamera(dt, p);
    p.stepSquash(dt);
    this.updateShake(dt);
    this.world.ensure(p.rx + this.vw);

    this.updateTips(dt);

    // one-button web: keep grabbing while the press is held
    if (this.holdWeb && !p.attached) {
      this.autoRetryT -= dt;
      if (this.autoRetryT <= 0) {
        this.autoRetryT = T.reattachEvery;
        this.tryAutoAttach();
      }
    }
    // predict where the auto-web will grab next (aim indicator)
    this.aim = p.attached ? null : this.findBestAnchor();

    // how close to the street — drives the on-screen warning
    const alt = this.world.lavaY(p.x) - p.y;
    this.lowAlt = clamp(1 - alt / 300, 0, 1);

    // score + milestones
    const m = Math.max(0, Math.floor((p.x - this.startX) / T.metre));
    if (m !== this.distM) this.distM = m;
    const ms = Math.floor(this.distM / 100) * 100;
    if (ms > 0 && ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.popup(p.x, p.y - 90, `${ms} M!`, "#ffd23f", 34);
      this.sfx.milestone();
    }

    const vmax = this.softMax();
    this.sfx.setWind(sp / vmax);
    this.sfx.padLevel(sp / vmax);
    this.emit();
  }

  /** menu backdrop: the spider swings by itself, it never dies here */
  private demoReset() {
    this.world = new World();
    this.world.ensure(0);
    this.player.reset(this.startX, this.world.ceilY(this.startX) + 225, T.startVx);
    this.cam.x = this.player.rx - this.vw * 0.4;
    this.cam.y = this.player.ry - this.vh * 0.52;
    this.cam.vx = 0;
    this.cam.vy = 0;
    this.cam.zoom = 1;
    this.demoT = 0;
    this.demoNext = 0.6;
    this.demoDrop = 0;
    this.acc = 0;
  }

  private updateDemo(dt: number) {
    const p = this.player;
    this.demoT += dt;
    if (p.y > this.world.lavaY(p.x) - 60 || p.x > this.startX + 2600) {
      this.demoReset();
      return;
    }
    if (!p.attached && this.demoT >= this.demoNext) {
      const c = this.findBestAnchor() ?? this.findBestAnchor(true);
      if (c) {
        p.attach(c.x, c.y);
        this.demoDrop = this.demoT + 1.4 + Math.random() * 0.5;
      } else {
        this.demoNext = this.demoT + 0.15;
      }
    } else if (p.attached && this.demoT >= this.demoDrop) {
      p.detach();
      this.demoNext = this.demoT + 0.3;
    }
    const fixed = 1 / T.stepHz;
    this.acc = Math.min(this.acc + dt, MAX_SLICE);
    while (this.acc >= fixed) {
      this.step(fixed);
      this.acc -= fixed;
    }
    p.interpolate(this.acc / fixed);
    p.trail.push({ x: p.rx, y: p.ry });
    if (p.trail.length > 22) p.trail.shift();
    p.stepSquash(dt);
  }

  /**
   * Camera: a critically damped spring follows a target that leads the
   * spider. The view zooms out smoothly as speed rises, so fast flight stays
   * readable without the image jumping.
   */
  private updateCamera(dt: number, p: Player) {
    const cam = this.cam;
    const lk = clamp(p.vx * T.camLead, -30, 260);
    const tx = p.rx - this.vw * 0.4 + lk;
    const ty = clamp(
      p.ry - this.vh * 0.52 + clamp(p.vy * 0.08, -70, 90),
      -280,
      440,
    );
    const step = (
      pos: number,
      vel: number,
      target: number,
      w: number,
    ): [number, number] => {
      // x'' = w²(target − x) − 2w·x'  (critical damping, no overshoot)
      const h = Math.min(dt, 1 / 30);
      const a = w * w * (target - pos) - 2 * w * vel;
      const nv = vel + a * h;
      return [pos + nv * h, nv];
    };
    [cam.x, cam.vx] = step(cam.x, cam.vx, tx, T.camFollow);
    [cam.y, cam.vy] = step(cam.y, cam.vy, ty, T.camFollowY);
    const f = clamp(p.speed() / this.softMax(), 0, 1);
    const zTarget = 1 - T.camZoomOut * f * f;
    cam.zoom = lerp(cam.zoom, zTarget, 1 - Math.exp(-dt * 2));
  }

  /** soft speed ceiling in px/s, scaled to the screen width */
  softMax(): number {
    return T.softMaxScreens * Math.max(this.vw, 360);
  }

  private step(h: number) {
    const p = this.player;
    p.syncPrev();
    // ---- glide: the second tap of a double tap spreads the web-wings ----
    // Gravity is weakened and a wing lift (∝ v_x²) acts while it lasts.
    const glide =
      this.glideHold &&
      !p.attached &&
      !p.grounded &&
      this.glideFuel > 0 &&
      this.state === "playing";
    if (glide && !this.gliding) this.popup(p.x, p.y - 40, "GLIDE", "#7df0ff", 16);
    this.gliding = glide;
    if (glide) {
      // wing: gravity is reduced and lift grows with v_x²
      // speed in screen widths per second, capped at 1
      const sw = Math.min(1, p.vx / Math.max(this.vw, 360));
      p.vy += T.gravity * (T.glideGravity - T.glideLift * sw * sw) * h;
    } else {
      p.vy += T.gravity * h;
    }

    // soft ceiling: quadratic air drag, a = -k·|v|·v, k set so that the
    // free-fall terminal speed equals softMax
    const vmax = this.softMax();
    const k = T.gravity / (vmax * vmax);
    const f = 1 / (1 + k * p.speed() * h);
    p.vx *= f;
    p.vy *= f;

    // gentle self-pump: tangential push along the swing, strongest when slow
    if (p.attached && T.pump > 0) {
      const rx2 = p.x - p.ax;
      const ry2 = p.y - p.ay;
      const d2 = Math.hypot(rx2, ry2) || 0.0001;
      const tx = -ry2 / d2;
      const ty = rx2 / d2;
      const vt = p.vx * tx + p.vy * ty;
      const dir = vt >= 0 ? 1 : -1;
      const k = clamp(1 - p.speed() / (0.6 * vmax), 0.1, 1);
      p.vx += tx * dir * T.pump * k * h;
      p.vy += ty * dir * T.pump * k * h;
    }

    p.x += p.vx * h;
    p.y += p.vy * h;

    // rope: rigid pendulum with honest momentum. Radial speed is removed;
    // tangential speed is kept.
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
            const pullR = 70;
            if (d < pullR) {
              // magnet power-up sucks coins hard, base is a gentle pull
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
        case "shield": {
          if (!o.got && dist(p.x, p.y, o.x, o.y) < 34 + p.r) {
            o.got = true;
            this.shieldActive = true;
            this.popup(p.x, p.y - 56, "SHIELD ON", "#2fe0b0", 22);
            this.parts.burst(o.x, o.y, "#2fe0b0", 12, 190, 2.6, 0.5, 240);
            this.parts.ring(o.x, o.y, "rgba(47,224,176,0.9)", 5, 0.4);
            this.sfx.shieldUp();
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
    this.popup(p.x, p.y - 64, "SAVED!", "#2fe0b0", 28);
    this.parts.burst(p.x, p.y, "#2fe0b0", 20, 340, 3, 0.6, 420);
    this.parts.ring(p.x, p.y, "rgba(47,224,176,0.95)", 10, 0.6);
    this.sfx.shieldBreak();
    this.emit();
  }

  private die(cause: string) {
    if (this.state !== "playing") return;
    if (this.shieldActive && this.invulnT <= 0) {
      this.breakShield(cause);
      return;
    }
    this.state = "dying";
    this.dyingT = 0;
    this.cause = cause;
    this.trauma = 1;
    this.shieldActive = false;
    this.perfectCombo = 0;
    const p = this.player;
    p.attached = false;
    this.parts.burst(p.x, p.y, "#ff4d5e", 22, 380, 3.6, 0.8, 640);
    this.parts.burst(p.x, p.y, "#ffd9de", 8, 220, 2.4, 0.6, 500);
    this.parts.burst(p.x, p.y, "#2b3a8f", 10, 260, 3, 0.7, 620);
    this.parts.ring(p.x, p.y, "rgba(255,255,255,0.9)", 8, 0.6);
    this.sfx.death();
    this.sfx.padStop();
    this.buzz(40);
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

    // core lessons first
    if (this.show("swing")) return;
    if (this.gliding && this.show("glide")) return;
    if (this.runT > 3.5 && this.show("street")) return;

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
    const st = this.settings;
    const key = [
      this.state,
      this.distM,
      this.best,
      this.newBest,
      this.cause,
      this.perfectCombo,
      this.gliding,
      Math.round(this.glideFuel * 10),
      this.tip?.id ?? "",
      st.sound,
      st.music,
      st.vibration,
    ].join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.cb({
      state: this.state,
      dist: this.distM,
      best: this.best,
      newBest: this.newBest,
      cause: this.cause,
      chain: this.perfectCombo,
      gliding: this.gliding,
      glideFuel: this.glideFuel / T.glideFuel,
      tip: this.tip,
      settings: { ...st },
    });
  }
}
