export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  grav: number;
  ring: boolean;
}

export class Particles {
  list: Particle[] = [];

  spawn(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length > 420) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      life: p.life ?? 0.6,
      max: p.life ?? 0.6,
      size: 3,
      color: "#ffffff",
      drag: 0.12,
      grav: 700,
      ring: false,
      ...p,
    });
  }

  burst(
    x: number,
    y: number,
    color: string,
    n: number,
    speed: number,
    size = 3,
    life = 0.5,
    grav = 700,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.18,
        life: life * (0.6 + Math.random() * 0.7),
        size: size * (0.6 + Math.random() * 0.9),
        color,
        grav,
      });
    }
  }

  ring(x: number, y: number, color: string, size = 6, life = 0.5) {
    this.spawn({
      x,
      y,
      ring: true,
      color,
      size,
      life,
      grav: 0,
      drag: 0,
    });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const d = Math.pow(0.5, dt * p.drag * 10);
      p.vx *= d;
      p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = p.life / p.max;
      if (p.ring) {
        const r = p.size + (1 - t) * 90;
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + t * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;
        const s = p.size * (p.grav === 0 ? 0.6 + t * 0.6 : 0.5 + t * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
