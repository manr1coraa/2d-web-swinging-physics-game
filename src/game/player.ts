import { live as T } from "./tuning";
import { clamp } from "./util";

export class Player {
  // simulation state (advanced at the fixed step rate)
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly r = 16;

  // previous step, used to interpolate the drawn position
  px = 0;
  py = 0;
  // drawn position: blended between the last two steps each frame
  rx = 0;
  ry = 0;

  attached = false;
  ax = 0; // anchor
  ay = 0;
  rope = 0; // rope length, fixed while attached
  rope0 = 0; // length at the moment of attach

  grounded = false;
  trail: { x: number; y: number }[] = [];

  // squash & stretch: a damped spring back to (1, 1)
  sqx = 1;
  sqy = 1;
  private sqvx = 0;
  private sqvy = 0;

  reset(x: number, y: number, vx: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = 0;
    this.attached = false;
    this.grounded = false;
    this.trail = [];
    this.syncPrev();
    this.syncRender();
  }

  /** impulse on hooking: the body squashes flat, then springs back */
  squashOnHook() {
    this.sqvx -= 3.2;
    this.sqvy += 3.6;
  }

  /** impulse on release: the body stretches along the throw */
  stretchOnRelease() {
    this.sqvx += 2.6;
    this.sqvy -= 3.0;
  }

  /** advance the squash spring (critically damped around 1) */
  stepSquash(dt: number) {
    const h = Math.min(dt, 1 / 30);
    const k = 260;
    const c = 2 * Math.sqrt(k);
    this.sqvx += (-k * (this.sqx - 1) - c * this.sqvx) * h;
    this.sqvy += (-k * (this.sqy - 1) - c * this.sqvy) * h;
    this.sqx += this.sqvx * h;
    this.sqy += this.sqvy * h;
  }

  /** remember the state before a physics step */
  syncPrev() {
    this.px = this.x;
    this.py = this.y;
  }

  /** draw exactly the simulated position (used when nothing is stepping) */
  syncRender() {
    this.rx = this.x;
    this.ry = this.y;
  }

  /** blend the last two steps; alpha is 0..1 of the way to the next step */
  interpolate(alpha: number) {
    this.rx = this.px + (this.x - this.px) * alpha;
    this.ry = this.py + (this.y - this.py) * alpha;
  }

  /**
   * Hook onto an anchor. The tangential speed is kept, the radial part is
   * removed: a web can't add energy, it only redirects it.
   */
  attach(x: number, y: number) {
    this.attached = true;
    this.grounded = false;
    this.ax = x;
    this.ay = y;
    const rx = this.x - x;
    const ry = this.y - y;
    const d = Math.hypot(rx, ry) || 0.0001;
    this.rope = clamp(d, T.ropeMin, T.ropeMax);
    this.rope0 = this.rope;
    const nx = rx / d;
    const ny = ry / d;
    const vr = this.vx * nx + this.vy * ny;
    this.vx -= vr * nx;
    this.vy -= vr * ny;
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
}
