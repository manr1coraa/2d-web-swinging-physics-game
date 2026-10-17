export interface WebNode {
  x: number;
  y: number;
  px: number;
  py: number;
}

export const WEB_SEGMENTS = 12;

/** what the body is doing right now — the renderer picks a pose from it */
export type Stance = "swing" | "fall" | "run" | "land" | "trick" | "glide";

/**
 * The little spider-person: a small human figure in a woven suit. Everything
 * here is simulation state; the pose itself is solved in the renderer from the
 * anchor, the velocity and the spin.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly r = 15;

  /** where the body was last substep — used to tell a landing from a wall hit */
  prevX = 0;
  prevY = 0;

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
  /** roof height the feet are on, when grounded */
  groundY = 0;
  /** 1 faces right, -1 faces left */
  facing: 1 | -1 = 1;
  /** running cycle phase, advanced by distance travelled on the roof */
  runPhase = 0;
  /** seconds since touchdown — drives the landing squash */
  landT = 9;
  /** seconds since leaving the roof, for coyote-time jumps */
  airT = 9;
  /** 0..1, how tightly the body is tucked (tricks and dives) */
  tuck = 0;
  /** brief stumble flash after brushing a rooftop structure */
  stumbleT = 0;

  trail: { x: number; y: number }[] = [];

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 300;
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
    this.groundY = 0;
    this.facing = 1;
    this.runPhase = 0;
    this.landT = 9;
    this.airT = 9;
    this.tuck = 0;
    this.stumbleT = 0;
    this.trail = [];
  }

  attach(x: number, y: number) {
    this.attached = true;
    this.grounded = false;
    this.airT = 9;
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
    this.airT = 0;
    // No launch multiplier: releasing the line preserves the velocity that
    // the swing actually produced.
    this.webNodes = [];
  }

  stance(): Stance {
    if (this.grounded) return this.landT < 0.16 ? "land" : "run";
    if (Math.abs(this.angularVelocity) > 3.4) return "trick";
    if (this.attached) return "swing";
    return "fall";
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
}
