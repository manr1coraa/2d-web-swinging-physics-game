export interface WebNode {
  x: number;
  y: number;
  px: number;
  py: number;
}

export const WEB_SEGMENTS = 12;

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly r = 16;

  attached = false;
  ax = 0; // anchor
  ay = 0;
  rope = 0; // web's unstretched length
  rope0 = 0; // length at the moment of attach
  webNodes: WebNode[] = [];

  // The body has angular momentum of its own. rotation is deliberately
  // unbounded, so a full somersault is a real 2π turn rather than an animation.
  rotation = 0;
  angularVelocity = 0;
  /** unwrapped angle at which the last complete somersault was recorded */
  lastFlipAngle = 0;
  flips = 0;

  grounded = false;
  trail: { x: number; y: number }[] = [];

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 260;
    this.vy = 0;
    this.attached = false;
    this.ax = 0;
    this.ay = 0;
    this.rope = 0;
    this.rope0 = 0;
    this.webNodes = [];
    this.rotation = 0;
    this.angularVelocity = 0;
    this.lastFlipAngle = 0;
    this.flips = 0;
    this.grounded = false;
    this.trail = [];
  }

  attach(x: number, y: number) {
    this.attached = true;
    this.grounded = false;
    this.ax = x;
    this.ay = y;
    this.rope = Math.max(56, Math.hypot(this.x - x, this.y - y));
    this.rope0 = this.rope;

    // A short Verlet chain gives the line weight and a little sag without
    // changing the location of either endpoint.
    const count = WEB_SEGMENTS + 1;
    this.webNodes = Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const x0 = x + (this.x - x) * t;
      const y0 = y + (this.y - y) * t + Math.sin(Math.PI * t) * 2;
      return { x: x0, y: y0, px: x0, py: y0 };
    });

    this.rotation = Math.atan2(this.vy, this.vx || 0.0001);
    this.angularVelocity *= 0.25;
    this.lastFlipAngle = this.rotation;
    this.flips = 0;
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.lastFlipAngle = this.rotation;
    this.flips = 0;
    // No launch multiplier: releasing the line preserves the velocity that
    // the swing actually produced.
    this.webNodes = [];
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
}
