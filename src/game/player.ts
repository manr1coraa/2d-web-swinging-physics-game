export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly r = 16;

  attached = false;
  ax = 0; // anchor
  ay = 0;
  rope = 0; // current rope length
  rope0 = 0; // length at the moment of attach

  grounded = false;
  trail: { x: number; y: number }[] = [];

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 440;
    this.vy = 0;
    this.attached = false;
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
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    // small launch boost on release — feels great
    this.vx *= 1.05;
    this.vy *= 1.05;
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
}
