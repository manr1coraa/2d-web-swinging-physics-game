import type { Game } from "./engine";
import { propBox, dronePos, segYAt, type Building, type Prop } from "./world";
import { themeDef, type Theme } from "./themes";
import { clamp, hash, lerp } from "./util";

/* ------------------------------------------------------------------ *
 * The city painter. Flat, hand-coloured surfaces — no glow, no neon.
 * Everything is drawn from the same palette so a rooftop always reads
 * as "something you can land on or grab".
 * ------------------------------------------------------------------ */

/** two-bone inverse kinematics: returns the joint position */
function joint(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  l1: number,
  l2: number,
  bend: number,
): { x: number; y: number } {
  let dx = tx - sx;
  let dy = ty - sy;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.001;
  const min = Math.abs(l1 - l2) + 0.001;
  if (d > max) d = max;
  if (d < min) d = min;
  dx = dx / (Math.hypot(dx, dy) || 1);
  dy = dy / (Math.hypot(dx, dy) || 1);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { x: sx + dx * a - dy * h * bend, y: sy + dy * a + dx * h * bend };
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(public canvas: HTMLCanvasElement) {
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2d context unavailable");
    this.ctx = c;
  }

  render(g: Game) {
    const { ctx } = this;
    const w = g.vw;
    const h = g.vh;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const T = themeDef(g.theme);
    this.sky(g, w, h, T);
    this.backdrop(g, w, h, T);

    ctx.save();
    // zoom out a little as the run gets fast, so the next roof stays readable
    const z = g.cam.zoom || 1;
    ctx.translate(w / 2, h / 2);
    ctx.scale(z, z);
    ctx.translate(-w / 2, -h / 2);
    ctx.translate(-g.cam.x + g.cam.sx, -g.cam.y + g.cam.sy);

    this.street(g, T);
    this.city(g, T, w, h, z);
    this.gate(g, T);
    g.parts.draw(ctx);
    this.trail(g);
    this.aimMark(g, T);
    this.web(g, T);
    if (g.state !== "dead") this.figure(g, T);
    this.popups(g);
    this.snapMark(g);
    ctx.restore();

    this.ambient(g, w, h, T);
    this.heightHaze(g, w, h, T);
  }

  /* ---------------- sky ---------------- */

  private sky(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, T.sky[0]);
    grad.addColorStop(0.42, T.sky[1]);
    grad.addColorStop(0.76, T.sky[2]);
    grad.addColorStop(1, T.sky[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // warmth pooled near the horizon
    const horizon = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.8);
    horizon.addColorStop(0, "rgba(255,250,220,0)");
    horizon.addColorStop(1, T.glow);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.4, w, h * 0.4);

    // a matte sun and a wide, barely-there halo
    const sx = w * 0.77;
    const sy = h * 0.16 + clamp(g.cam.y * 0.02, -h * 0.1, h * 0.18);
    const halo = ctx.createRadialGradient(sx, sy, 5, sx, sy, Math.min(w, h) * 0.28);
    halo.addColorStop(0, "rgba(255,247,205,0.3)");
    halo.addColorStop(1, "rgba(255,247,205,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - h * 0.3, sy - h * 0.3, h * 0.6, h * 0.6);
    ctx.fillStyle = "#fff2c2";
    ctx.beginPath();
    ctx.arc(sx, sy, Math.min(23, h * 0.042), 0, Math.PI * 2);
    ctx.fill();

    this.clouds(g, w, h);
  }

  private clouds(g: Game, w: number, h: number) {
    const { ctx } = this;
    const spacing = 260;
    const offset = g.cam.x * 0.05 + g.time * 3.4;
    const lift = clamp(g.cam.y * 0.06, -h * 0.4, h * 0.5);
    const first = Math.floor(offset / spacing) - 2;
    const last = first + Math.ceil(w / spacing) + 4;
    for (let i = first; i <= last; i++) {
      const r = hash(i * 4.17 + 12.6);
      const x = i * spacing - offset;
      const y = h * (0.1 + hash(i * 7.3 + 0.4) * 0.3) + lift * (0.4 + r * 0.6);
      if (y < -70 || y > h + 70) continue;
      const scale = 0.56 + r * 0.66;
      ctx.fillStyle = `rgba(255,250,226,${(0.1 + r * 0.09).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x - 54 * scale, y + 7 * scale);
      ctx.lineTo(x - 39 * scale, y - 8 * scale);
      ctx.lineTo(x - 14 * scale, y - 7 * scale);
      ctx.lineTo(x + 3 * scale, y - 22 * scale);
      ctx.lineTo(x + 25 * scale, y - 20 * scale);
      ctx.lineTo(x + 43 * scale, y - 4 * scale);
      ctx.lineTo(x + 59 * scale, y + 4 * scale);
      ctx.lineTo(x + 52 * scale, y + 12 * scale);
      ctx.lineTo(x - 43 * scale, y + 13 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------------- parallax skyline ---------------- */

  private backdrop(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const layers = [
      { d: 0.16, sp: 190, col: T.far[0], scale: 0.62, haze: 0.5 },
      { d: 0.34, sp: 150, col: T.far[1], scale: 0.82, haze: 0.3 },
      { d: 0.56, sp: 118, col: T.far[2], scale: 1.0, haze: 0.14 },
    ];
    layers.forEach((L, li) => {
      const ox = g.cam.x * L.d;
      // the layer's own ground line: it sinks as the runner climbs
      const ground = h * 0.82 - g.cam.y * (L.d * 0.42) + (1 - L.d) * 40;
      const first = Math.floor(ox / L.sp) - 1;
      const last = first + Math.ceil(w / L.sp) + 3;
      ctx.fillStyle = L.col;
      ctx.beginPath();
      for (let i = first; i <= last; i++) {
        const r1 = hash(i * 3.77 + li * 11.3);
        const r2 = hash(i * 8.13 + li * 5.7);
        const bw = L.sp * (0.6 + r2 * 0.36);
        const bx = i * L.sp - ox;
        const bh = (70 + r1 * 250) * L.scale;
        const top = ground - bh;
        ctx.rect(bx, top, bw, bh + h);
        // a water tank or a mast on some roofs, tiny but readable
        if (r2 > 0.72) ctx.rect(bx + bw * 0.3, top - 12 * L.scale, bw * 0.24, 12 * L.scale);
        if (r1 > 0.86) ctx.rect(bx + bw * 0.62, top - 26 * L.scale, 2, 26 * L.scale);
      }
      ctx.fill();

      // a handful of lit windows in the nearer layers
      if (li > 0) {
        ctx.fillStyle = `rgba(250,232,180,${0.1 + li * 0.05})`;
        ctx.beginPath();
        for (let i = first; i <= last; i++) {
          const r1 = hash(i * 3.77 + li * 11.3);
          const r2 = hash(i * 8.13 + li * 5.7);
          const bw = L.sp * (0.6 + r2 * 0.36);
          const bx = i * L.sp - ox;
          const bh = (70 + r1 * 250) * L.scale;
          const top = ground - bh;
          for (let k = 0; k < 7; k++) {
            const rr = hash(i * 12.9 + k * 4.1 + li);
            if (rr < 0.62) continue;
            const wx = bx + 6 + ((k * 37) % Math.max(10, bw - 12));
            const wy = top + 10 + ((k * 53) % Math.max(12, bh - 18));
            ctx.rect(wx, wy, 4 * L.scale, 6 * L.scale);
          }
        }
        ctx.fill();
      }

      // atmospheric haze between the layers
      ctx.fillStyle = `rgba(226,232,224,${L.haze * 0.42})`;
      ctx.fillRect(0, 0, w, h);
    });

    // cloud floor when the runner climbs above the whole city
    const high = clamp((340 - g.cam.y) / 620, 0, 1);
    if (high > 0.02) {
      ctx.fillStyle = `rgba(252,250,238,${0.16 * high})`;
      const cy = h * 0.86;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const x = ((i * 197 - g.cam.x * 0.22) % (w + 400)) - 200;
        ctx.ellipse(x, cy + Math.sin(i * 2.3) * 18, 130 + (i % 3) * 44, 30 + (i % 2) * 14, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  /* ---------------- the avenue ---------------- */

  private street(g: Game, T: Theme) {
    const { ctx } = this;
    const y = g.world.streetY;
    const left = g.cam.x - 200;
    const right = g.cam.x + g.vw / (g.cam.zoom || 1) + 200;
    if (y < g.cam.y - 200 || y > g.cam.y + g.vh + 600) return;

    ctx.fillStyle = T.street;
    ctx.fillRect(left, y, right - left, 900);
    // sidewalk kerb
    ctx.fillStyle = T.streetLine;
    ctx.fillRect(left, y - 5, right - left, 6);
    ctx.fillStyle = "rgba(255,252,238,0.16)";
    const dash = 68;
    const start = Math.floor(left / dash) * dash;
    for (let x = start; x < right; x += dash) ctx.fillRect(x + 12, y + 44, dash - 30, 5);

    // parked cars and lamp posts, deterministic per stretch
    for (let x = start; x < right; x += dash * 2) {
      const r = hash(x * 0.017 + 3.1);
      if (r > 0.42) {
        const cw = 44 + r * 26;
        const cx = x + 8;
        ctx.fillStyle = r > 0.24 ? T.accent : T.accent2;
        ctx.beginPath();
        ctx.roundRect?.(cx, y + 8, cw, 16, 5);
        ctx.roundRect?.(cx + cw * 0.2, y - 1, cw * 0.56, 12, 4);
        ctx.fill();
        ctx.fillStyle = "rgba(40,42,40,0.55)";
        ctx.beginPath();
        ctx.arc(cx + cw * 0.22, y + 25, 5, 0, Math.PI * 2);
        ctx.arc(cx + cw * 0.78, y + 25, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (r < 0.2) {
        const lx = x + 40;
        ctx.strokeStyle = T.propDark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.lineTo(lx, y - 74);
        ctx.lineTo(lx + 13, y - 78);
        ctx.stroke();
        ctx.fillStyle = "#f6e3ac";
        ctx.beginPath();
        ctx.ellipse(lx + 15, y - 78, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // haze that swallows the bottoms of the buildings
    const haze = ctx.createLinearGradient(0, y - 300, 0, y + 30);
    haze.addColorStop(0, "rgba(226,226,208,0)");
    haze.addColorStop(1, T.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(left, y - 300, right - left, 330);
  }

  /* ---------------- the buildings you actually land on ---------------- */

  private city(g: Game, T: Theme, w: number, h: number, z: number) {
    const centreX = g.cam.x + w / 2 / z;
    const span = w / 2 / z + 460;
    const buildings = g.world.buildingsNear(centreX, span);
    const topView = g.cam.y - 120;
    const bottomView = g.cam.y + h / z + 160;

    for (const b of buildings) this.building(g, b, T, topView, bottomView);
    for (const b of buildings) this.roofDeck(g, b, T);
    for (const b of buildings) {
      for (const p of b.props) this.prop(g, p, T);
    }
  }

  private building(g: Game, b: Building, T: Theme, topView: number, bottomView: number) {
    const { ctx } = this;
    const peak = Math.min(...b.segs.map((s) => Math.min(s.y0, s.y1)));
    // a pitched roof sits on top of the facade instead of stretching it up
    const top =
      b.shape === "peaked"
        ? Math.max(b.segs[0].y0, b.segs[b.segs.length - 1].y1)
        : peak;
    const bottom = Math.min(b.baseY, bottomView + 40);
    if (bottom < topView) return;
    const wall = T.wall[b.tone % T.wall.length];

    // facade
    ctx.fillStyle = wall;
    ctx.fillRect(b.x0, top, b.x1 - b.x0, bottom - top);

    // the shaded side gives every block a little volume
    const shade = ctx.createLinearGradient(b.x0, 0, b.x1, 0);
    shade.addColorStop(0, T.wallShade);
    shade.addColorStop(0.42, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(255,252,238,0.07)");
    ctx.fillStyle = shade;
    ctx.fillRect(b.x0, top, b.x1 - b.x0, bottom - top);

    // windows: one path per colour, culled to what is on screen
    const gx = b.style === 2 ? 30 : 26;
    const gy = b.style === 2 ? 42 : 36;
    const ww = b.style === 2 ? 19 : 13;
    const wh = b.style === 2 ? 27 : 17;
    const y0 = Math.max(top + 16, topView - 20);
    const y1 = Math.min(bottom - 12, bottomView + 20);
    const cols = Math.max(1, Math.floor((b.x1 - b.x0 - 16) / gx));
    const rowStart = Math.floor((y0 - top) / gy);
    const rowEnd = Math.ceil((y1 - top) / gy);

    ctx.fillStyle = T.window;
    ctx.beginPath();
    for (let row = rowStart; row <= rowEnd; row++) {
      const wy = top + 14 + row * gy;
      if (wy < y0 - gy || wy > y1) continue;
      for (let c = 0; c < cols; c++) {
        const wx = b.x0 + 9 + c * gx;
        ctx.rect(wx, wy, ww, wh);
      }
    }
    ctx.fill();

    // a few warm windows, stable per building
    ctx.fillStyle = T.windowLit;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    let lit = 0;
    for (let row = rowStart; row <= rowEnd && lit < 26; row++) {
      const wy = top + 14 + row * gy;
      if (wy < y0 - gy || wy > y1) continue;
      for (let c = 0; c < cols && lit < 26; c++) {
        const rr = hash(b.winSeed + row * 3.1 + c * 7.7);
        if (rr > 0.16) continue;
        ctx.rect(b.x0 + 9 + c * gx, wy, ww, wh);
        lit++;
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // the gable of a pitched roof is painted roof, not wall
    if (b.shape === "peaked") {
      const s0 = b.segs[0];
      const s1 = b.segs[b.segs.length - 1];
      ctx.fillStyle = T.roof;
      ctx.beginPath();
      ctx.moveTo(s0.x0 - 2, s0.y0 + 4);
      ctx.lineTo(s0.x1, Math.min(s0.y1, s1.y0));
      ctx.lineTo(s1.x1 + 2, s1.y1 + 4);
      ctx.closePath();
      ctx.fill();
    }

    // cornice / parapet band along the top of every roof segment
    ctx.fillStyle = T.wallEdge;
    for (const s of b.segs) {
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.lineTo(s.x1, s.y1 + 7);
      ctx.lineTo(s.x0, s.y0 + 7);
      ctx.closePath();
      ctx.fill();
    }

    // style flourishes: pilasters, balconies, a shopfront awning
    if (b.style === 1) {
      ctx.fillStyle = "rgba(255,250,236,0.08)";
      for (let c = 0; c <= cols; c++) ctx.fillRect(b.x0 + 6 + c * gx, top + 10, 4, bottom - top - 16);
    } else if (b.style === 3) {
      ctx.fillStyle = T.accent2;
      for (let row = rowStart; row <= rowEnd; row += 2) {
        const wy = top + 14 + row * gy + wh;
        if (wy < y0 || wy > y1) continue;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(b.x0 + 6, wy, b.x1 - b.x0 - 12, 3);
        ctx.globalAlpha = 1;
      }
    }

    // a fire escape ladder on some facades, purely decorative
    if (hash(b.i * 5.31 + g.world.level) > 0.72) {
      const lx = b.x0 + (b.x1 - b.x0) * (0.2 + hash(b.i * 2.7) * 0.6);
      ctx.strokeStyle = T.propMetal;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      const yTop = Math.max(top + 24, topView);
      const yBot = Math.min(bottom - 20, topView + 520);
      ctx.moveTo(lx, yTop);
      ctx.lineTo(lx, yBot);
      ctx.moveTo(lx + 16, yTop);
      ctx.lineTo(lx + 16, yBot);
      for (let y = yTop; y < yBot; y += 18) {
        ctx.moveTo(lx, y);
        ctx.lineTo(lx + 16, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    void g.time;
  }

  /** the walkable roof deck: surface, parapets and the risers between tiers */
  private roofDeck(g: Game, b: Building, T: Theme) {
    const { ctx } = this;
    ctx.lineJoin = "round";
    // risers between tiers
    ctx.fillStyle = T.wall[b.tone % T.wall.length];
    for (let i = 0; i < b.segs.length - 1; i++) {
      const a = b.segs[i];
      const c = b.segs[i + 1];
      const x = a.x1;
      const yTop = Math.min(a.y1, c.y0);
      const yBot = Math.max(a.y1, c.y0);
      if (yBot - yTop > 1) {
        ctx.fillRect(x - 3, yTop, 7, yBot - yTop + 8);
        ctx.fillStyle = T.wallEdge;
        ctx.fillRect(x - 4, yTop - 3, 9, 5);
        ctx.fillStyle = T.wall[b.tone % T.wall.length];
      }
    }
    // the deck itself
    ctx.strokeStyle = T.roof;
    ctx.lineWidth = 11;
    ctx.beginPath();
    b.segs.forEach((s, i) => {
      if (i === 0) ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
    });
    ctx.stroke();
    // a light cap so the landing surface always reads
    ctx.strokeStyle = T.roofLine;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    b.segs.forEach((s, i) => {
      if (i === 0) ctx.moveTo(s.x0, s.y0 - 4.5);
      ctx.lineTo(s.x1, s.y1 - 4.5);
    });
    ctx.stroke();

    // parapet blocks at every roof edge — these are the grab points
    for (const s of b.segs) {
      for (const [x, y] of [
        [s.x0 + 4, s.y0],
        [s.x1 - 4, s.y1],
      ] as [number, number][]) {
        ctx.fillStyle = T.roof;
        ctx.fillRect(x - 5, y - 14, 10, 14);
        ctx.fillStyle = T.roofLine;
        ctx.fillRect(x - 6, y - 16, 12, 4);
      }
    }

    // a hatch or a stair head on wide roofs
    if (b.x1 - b.x0 > 260 && hash(b.i * 9.1) > 0.55) {
      const hx = b.x0 + (b.x1 - b.x0) * 0.5;
      const hy = this.deckY(b, hx);
      ctx.fillStyle = T.propDark;
      ctx.fillRect(hx - 17, hy - 22, 34, 22);
      ctx.fillStyle = T.prop;
      ctx.fillRect(hx - 19, hy - 25, 38, 5);
      ctx.fillStyle = T.windowLit;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(hx - 10, hy - 17, 9, 9);
      ctx.globalAlpha = 1;
    }
    void g.time;
  }

  private deckY(b: Building, x: number): number {
    for (const s of b.segs) if (x >= s.x0 && x <= s.x1) return segYAt(s, x);
    return b.segs[b.segs.length - 1]?.y1 ?? 600;
  }

  /* ---------------- rooftop clutter ---------------- */

  private prop(g: Game, p: Prop, T: Theme) {
    const { ctx } = this;
    switch (p.kind) {
      case "chimney": {
        const box = propBox(p);
        ctx.fillStyle = T.prop;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        ctx.fillStyle = T.propDark;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, 5);
        ctx.fillStyle = T.wallEdge;
        ctx.fillRect(box.x0 - 3, box.y0 - 4, box.x1 - box.x0 + 6, 5);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = T.propDark;
        for (let y = box.y0 + 10; y < box.y1 - 4; y += 9) ctx.fillRect(box.x0 + 2, y, box.x1 - box.x0 - 4, 2);
        ctx.globalAlpha = 1;
        break;
      }
      case "watertower": {
        const box = propBox(p);
        const legTop = box.y0 + p.h * 0.42;
        ctx.strokeStyle = T.propDark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(box.x0 + 4, box.y1);
        ctx.lineTo(box.x0 + 8, legTop);
        ctx.moveTo(box.x1 - 4, box.y1);
        ctx.lineTo(box.x1 - 8, legTop);
        ctx.moveTo(box.x0 + 10, box.y1);
        ctx.lineTo(box.x1 - 10, legTop);
        ctx.stroke();
        ctx.fillStyle = T.prop;
        ctx.beginPath();
        ctx.roundRect?.(box.x0, box.y0 + 6, box.x1 - box.x0, legTop - box.y0 - 2, 5);
        ctx.fill();
        ctx.fillStyle = T.propDark;
        ctx.beginPath();
        ctx.moveTo(box.x0 - 2, box.y0 + 8);
        ctx.lineTo((box.x0 + box.x1) / 2, box.y0 - 8);
        ctx.lineTo(box.x1 + 2, box.y0 + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = T.wallEdge;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(box.x0 + 3, box.y0 + 12, (box.x1 - box.x0) * 0.35, 3);
        ctx.globalAlpha = 1;
        break;
      }
      case "antenna": {
        const box = propBox(p);
        ctx.strokeStyle = T.propMetal;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(p.x, box.y1);
        ctx.lineTo(p.x, box.y0);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let k = 1; k <= 3; k++) {
          const y = box.y1 - ((box.y1 - box.y0) * k) / 4;
          const wdt = 9 - k * 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x - wdt, y);
          ctx.lineTo(p.x + wdt, y);
          ctx.stroke();
        }
        // a calm red bead, blinking slowly
        const blink = 0.45 + 0.55 * Math.sin(g.time * 2.1 + (p.seed ?? 0));
        ctx.fillStyle = `rgba(196,96,74,${0.45 + blink * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, box.y0 - 2, 3.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "ac": {
        const box = propBox(p);
        ctx.fillStyle = T.propMetal;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        ctx.fillStyle = T.propDark;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, 3);
        ctx.beginPath();
        ctx.arc(p.x, (box.y0 + box.y1) / 2 + 1, Math.min(8, p.h * 0.34), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(50,54,52,0.5)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        break;
      }
      case "vent": {
        const box = propBox(p);
        ctx.fillStyle = T.propMetal;
        ctx.fillRect(box.x0, box.y0 + 4, box.x1 - box.x0, box.y1 - box.y0 - 4);
        ctx.fillStyle = T.propDark;
        ctx.beginPath();
        ctx.moveTo(box.x0 - 3, box.y0 + 5);
        ctx.lineTo(p.x, box.y0 - 3);
        ctx.lineTo(box.x1 + 3, box.y0 + 5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "skylight": {
        const box = propBox(p);
        ctx.fillStyle = "rgba(226,238,236,0.72)";
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        ctx.strokeStyle = T.propDark;
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
        ctx.beginPath();
        ctx.moveTo((box.x0 + box.x1) / 2, box.y0);
        ctx.lineTo((box.x0 + box.x1) / 2, box.y1);
        ctx.stroke();
        break;
      }
      case "garden": {
        const box = propBox(p);
        ctx.fillStyle = T.propDark;
        ctx.fillRect(box.x0, box.y1 - 9, box.x1 - box.x0, 9);
        ctx.fillStyle = "#7d9a6d";
        for (let k = 0; k < 5; k++) {
          const bx = box.x0 + 6 + ((box.x1 - box.x0 - 12) * k) / 4;
          const sway = Math.sin(g.time * 1.1 + k) * 1.6;
          ctx.beginPath();
          ctx.ellipse(bx + sway, box.y1 - 13 - (k % 2) * 4, 7, 6 + (k % 3) * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "billboard": {
        const box = propBox(p);
        ctx.strokeStyle = T.propDark;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(box.x0 + 14, box.y1);
        ctx.lineTo(box.x0 + 14, box.y0 + 8);
        ctx.moveTo(box.x1 - 14, box.y1);
        ctx.lineTo(box.x1 - 14, box.y0 + 8);
        ctx.stroke();
        ctx.fillStyle = T.wallEdge;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, 46);
        // a quiet poster: hills, a sun and two lines of "type"
        ctx.fillStyle = T.accent2;
        ctx.beginPath();
        ctx.moveTo(box.x0 + 4, box.y0 + 42);
        ctx.lineTo(box.x0 + 26, box.y0 + 18);
        ctx.lineTo(box.x0 + 48, box.y0 + 42);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = T.accent;
        ctx.beginPath();
        ctx.moveTo(box.x0 + 34, box.y0 + 42);
        ctx.lineTo(box.x0 + 58, box.y0 + 12);
        ctx.lineTo(box.x0 + 82, box.y0 + 42);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f2d695";
        ctx.beginPath();
        ctx.arc(box.x1 - 24, box.y0 + 14, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(70,66,58,0.5)";
        ctx.fillRect(box.x0 + 6, box.y0 + 3, 40, 4);
        ctx.fillRect(box.x0 + 6, box.y0 + 9, 26, 3);
        ctx.strokeStyle = T.propDark;
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, 46);
        break;
      }
      case "crane": {
        const box = propBox(p);
        const top = box.y0;
        ctx.strokeStyle = T.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x, box.y1);
        ctx.lineTo(p.x, top);
        ctx.stroke();
        // lattice
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "rgba(60,52,44,0.55)";
        ctx.beginPath();
        for (let y = box.y1; y > top + 10; y -= 22) {
          ctx.moveTo(p.x - 6, y);
          ctx.lineTo(p.x + 6, y - 11);
          ctx.moveTo(p.x + 6, y);
          ctx.lineTo(p.x - 6, y - 11);
        }
        ctx.stroke();
        // jib
        ctx.strokeStyle = T.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x - 40, top + 8);
        ctx.lineTo(p.x + 120, top + 2);
        ctx.stroke();
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x, top - 16);
        ctx.lineTo(p.x + 112, top + 2);
        ctx.moveTo(p.x, top - 16);
        ctx.lineTo(p.x - 36, top + 8);
        ctx.stroke();
        // counterweight and a hanging hook
        ctx.fillStyle = T.propDark;
        ctx.fillRect(p.x - 46, top + 2, 14, 14);
        const swing = Math.sin(g.time * 0.8 + (p.seed ?? 0)) * 6;
        ctx.strokeStyle = "rgba(60,52,44,0.6)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x + 104, top + 3);
        ctx.lineTo(p.x + 104 + swing, top + 42);
        ctx.stroke();
        ctx.fillStyle = T.propMetal;
        ctx.beginPath();
        ctx.arc(p.x + 104 + swing, top + 45, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "scaffold": {
        const box = propBox(p);
        ctx.strokeStyle = T.propMetal;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(box.x0, box.y1);
        ctx.lineTo(box.x0, box.y0);
        ctx.moveTo(box.x1, box.y1);
        ctx.lineTo(box.x1, box.y0);
        for (let y = box.y1; y > box.y0; y -= 34) {
          ctx.moveTo(box.x0 - 4, y);
          ctx.lineTo(box.x1 + 4, y);
          ctx.moveTo(box.x0, y);
          ctx.lineTo(box.x1, y - 17);
        }
        ctx.stroke();
        ctx.fillStyle = T.accent2;
        for (let y = box.y1 - 34; y > box.y0; y -= 34) ctx.fillRect(box.x0 - 5, y - 4, box.x1 - box.x0 + 10, 5);
        break;
      }
      case "clothesline": {
        const box = propBox(p);
        const sag = 12 + Math.sin(g.time * 0.9 + (p.ph ?? 0)) * 3;
        ctx.strokeStyle = "rgba(70,64,56,0.6)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(box.x0, p.y - 4);
        ctx.quadraticCurveTo(p.x, p.y + sag, box.x1, p.y - 4);
        ctx.stroke();
        const cols = [T.accent, T.accent2, T.wallEdge, "#c8b48f"];
        for (let k = 1; k <= 5; k++) {
          const t = k / 6;
          const lx = lerp(box.x0, box.x1, t);
          const ly = lerp(p.y - 4, p.y - 4, t) + sag * 4 * t * (1 - t);
          const sway = Math.sin(g.time * 1.4 + k + (p.ph ?? 0)) * 3;
          ctx.fillStyle = cols[(k + (p.tone ?? 0)) % cols.length];
          ctx.beginPath();
          ctx.moveTo(lx - 6, ly);
          ctx.lineTo(lx + 6, ly);
          ctx.lineTo(lx + 4 + sway, ly + 17 + (k % 3) * 4);
          ctx.lineTo(lx - 4 + sway, ly + 17 + (k % 3) * 4);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case "drone": {
        const d = dronePos(p, g.time);
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.fillStyle = T.propDark;
        ctx.beginPath();
        ctx.roundRect?.(-11, -5, 22, 11, 4);
        ctx.fill();
        ctx.strokeStyle = T.propMetal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-13, -6);
        ctx.lineTo(-6, -3);
        ctx.moveTo(13, -6);
        ctx.lineTo(6, -3);
        ctx.stroke();
        const blur = 0.5 + 0.5 * Math.sin(g.time * 22);
        ctx.strokeStyle = `rgba(80,86,82,${0.35 + blur * 0.3})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(-13, -7, 8, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(13, -7, 8, 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        // the little parcel it is carrying
        ctx.fillStyle = "#cbb389";
        ctx.fillRect(-6, 6, 12, 9);
        ctx.strokeStyle = "rgba(70,60,48,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-6, 6, 12, 9);
        ctx.restore();
        break;
      }
      case "token": {
        if (p.got) return;
        const bob = Math.sin(g.time * 2.2 + (p.seed ?? 0)) * 4;
        const spin = g.time * 1.6 + (p.seed ?? 0);
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.rotate(Math.sin(spin) * 0.25);
        ctx.fillStyle = "#e8d3a0";
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,96,58,0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
        // a woven spiral: these are spools of silk
        ctx.strokeStyle = "rgba(120,96,58,0.6)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          ctx.moveTo(0, 0);
          const a = (k / 4) * Math.PI * 2 + spin * 0.4;
          ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "shield": {
        if (p.got) return;
        const bob = Math.sin(g.time * 1.8) * 4;
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.fillStyle = "#93a97f";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(12, -8);
        ctx.lineTo(12, 4);
        ctx.quadraticCurveTo(12, 14, 0, 18);
        ctx.quadraticCurveTo(-12, 14, -12, 4);
        ctx.lineTo(-12, -8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(58,72,54,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "rgba(246,244,226,0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(0, 6);
        ctx.lineTo(7, -2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "magnet": {
        if (p.got) return;
        const bob = Math.sin(g.time * 1.5 + 1) * 4;
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.strokeStyle = "#bd8066";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.strokeStyle = "#c9a27c";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 15, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  /* ---------------- the checkpoint arch ---------------- */

  private gate(g: Game, T: Theme) {
    const { ctx } = this;
    const gate = g.gateHole;
    if (!gate) return;
    const roof = g.world.roofYAt(gate.x) ?? g.world.streetY - 200;
    const { x, y, r } = gate;
    const legBottom = Math.min(roof + 6, g.world.streetY);

    // scaffold legs
    ctx.strokeStyle = T.propMetal;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const lx = x + side * (r + 22);
      ctx.moveTo(lx, legBottom);
      ctx.lineTo(lx, y - r - 26);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(70,66,58,0.45)";
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const lx = x + side * (r + 22);
      for (let yy = legBottom - 26; yy > y - r - 20; yy -= 34) {
        ctx.moveTo(lx - 7, yy);
        ctx.lineTo(lx + 7, yy);
        ctx.moveTo(lx - 7, yy);
        ctx.lineTo(lx + 7, yy - 17);
      }
    }
    ctx.stroke();

    // top beam and a hanging banner
    ctx.fillStyle = T.propDark;
    ctx.fillRect(x - r - 34, y - r - 34, (r + 34) * 2, 9);
    ctx.fillStyle = T.accent;
    ctx.fillRect(x - r - 6, y - r - 25, (r + 6) * 2, 26);
    ctx.fillStyle = "rgba(255,250,236,0.9)";
    ctx.font = "700 13px 'Baloo 2', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CHECKPOINT", x, y - r - 7);
    // little flags on the beam
    for (let k = -2; k <= 2; k++) {
      const fx = x + k * 30;
      const sway = Math.sin(g.time * 2 + k) * 2;
      ctx.fillStyle = k % 2 === 0 ? T.accent2 : T.wallEdge;
      ctx.beginPath();
      ctx.moveTo(fx - 6, y - r - 25);
      ctx.lineTo(fx + 6, y - r - 25);
      ctx.lineTo(fx + sway, y - r - 9);
      ctx.closePath();
      ctx.fill();
    }

    // the hoop: the opening you have to fly through
    ctx.strokeStyle = "rgba(70,64,54,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 16, y - r - 25);
    ctx.lineTo(x - 12, y - r);
    ctx.moveTo(x + 16, y - r - 25);
    ctx.lineTo(x + 12, y - r);
    ctx.stroke();

    const inner = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    inner.addColorStop(0, "rgba(252,246,224,0.34)");
    inner.addColorStop(0.72, "rgba(252,246,224,0.12)");
    inner.addColorStop(1, "rgba(252,246,224,0)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = T.roofLine;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = T.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
    ctx.stroke();
    // rope lashing at the four quarters
    ctx.strokeStyle = "rgba(70,64,54,0.4)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6));
      ctx.lineTo(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8));
      ctx.stroke();
    }
    ctx.textAlign = "left";
  }

  /* ---------------- silk ---------------- */

  private trail(g: Game) {
    const { ctx } = this;
    const tr = g.player.trail;
    if (tr.length < 3) return;
    ctx.lineCap = "round";
    for (let i = 1; i < tr.length; i++) {
      const t = i / tr.length;
      ctx.strokeStyle = `rgba(250,246,230,${(t * 0.2).toFixed(3)})`;
      ctx.lineWidth = 1 + t * 5;
      ctx.beginPath();
      ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
      ctx.lineTo(tr[i].x, tr[i].y);
      ctx.stroke();
    }
  }

  private web(g: Game, T: Theme) {
    const { ctx } = this;
    const p = g.player;
    if (!p.attached) return;
    const nodes = p.webNodes;
    if (nodes.length < 2) return;

    // the strand itself, drawn through the verlet chain so it sags and whips
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(58,54,46,0.28)";
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();

    const tension = clamp((Math.hypot(p.x - p.ax, p.y - p.ay) / Math.max(1, p.rope) - 1) * 6, 0, 1);
    ctx.strokeStyle = `rgba(252,249,238,${0.82 + tension * 0.16})`;
    ctx.lineWidth = 2.6 - tension * 0.7;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();

    // the pad where the silk stuck
    ctx.save();
    ctx.translate(p.ax, p.ay);
    ctx.fillStyle = "rgba(250,247,236,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(250,247,236,0.55)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
    }
    ctx.stroke();
    ctx.restore();

    // pumping puts a visible ripple along the line
    if (g.pumpFx > 0.05) {
      const t = (g.time * 2.4) % 1;
      const idx = Math.floor(t * (nodes.length - 1));
      const n = nodes[idx];
      ctx.fillStyle = `rgba(255,252,240,${0.5 * g.pumpFx})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    void T;
  }

  private aimMark(g: Game, T: Theme) {
    const { ctx } = this;
    const aim = g.aim;
    if (!aim || g.state !== "playing") return;
    const p = g.player;
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = "rgba(250,246,230,0.5)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6);
    ctx.lineTo(aim.x, aim.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 0.7 + 0.3 * Math.sin(g.time * 7);
    ctx.strokeStyle = `rgba(250,246,230,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 7 + pulse * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(250,246,230,0.75)";
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    void T;
  }

  private snapMark(g: Game) {
    const fx = g.snapFx;
    if (!fx) return;
    const { ctx } = this;
    const t = clamp(fx.t / 0.26, 0, 1);
    ctx.strokeStyle = `rgba(250,246,230,${t * 0.6})`;
    ctx.lineWidth = 1 + t * 2;
    ctx.beginPath();
    ctx.moveTo(fx.px, fx.py);
    ctx.lineTo(lerp(fx.px, fx.ax, 1 - t), lerp(fx.py, fx.ay, 1 - t));
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + fx.t * 6;
      ctx.beginPath();
      ctx.moveTo(fx.px + Math.cos(a) * 8, fx.py + Math.sin(a) * 8);
      ctx.lineTo(fx.px + Math.cos(a) * (14 + (1 - t) * 20), fx.py + Math.sin(a) * (14 + (1 - t) * 20));
      ctx.stroke();
    }
  }

  /* ---------------- the little spider-person ---------------- */

  private figure(g: Game, T: Theme) {
    const { ctx } = this;
    const p = g.player;
    const suit = "#b4574b";
    const suitDark = "#8f443c";
    const legs = "#4c6274";
    const legsDark = "#3b4e5e";
    const cream = "#f7f2e2";

    /* --- body angle --- */
    const spinning = !p.grounded && Math.abs(p.angularVelocity) > 3.1;
    let angle: number;
    if (spinning) {
      angle = p.rotation + (p.facing < 0 ? Math.PI : 0);
    } else if (p.grounded) {
      angle = clamp(p.vx * 0.00042, -0.24, 0.24);
    } else if (p.attached) {
      const ropeAng = Math.atan2(p.x - p.ax, p.y - p.ay);
      angle = clamp(ropeAng * 0.62 + p.vx * 0.00016, -0.85, 0.85);
    } else {
      angle = clamp(Math.atan2(p.vy, Math.max(120, Math.abs(p.vx))) * 0.42, -0.7, 0.7);
    }

    const squash = p.landT < 0.2 ? 1 - (1 - p.landT / 0.2) * 0.16 : 1;
    const stretch = p.landT < 0.2 ? 1 + (1 - p.landT / 0.2) * 0.1 : 1;
    const face = p.facing;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.scale(face * stretch, squash);

    /* --- pose targets (local space, +x is forward) --- */
    const hipY = 2;
    const shY = -8.5;
    const headY = -16.5;
    const handR: { x: number; y: number } = { x: 8, y: 0 };
    const handL: { x: number; y: number } = { x: -8, y: 2 };
    const footR: { x: number; y: number } = { x: 5, y: 18 };
    const footL: { x: number; y: number } = { x: -4, y: 18 };
    let membrane = 0;
    let tuckK = clamp(p.tuck, 0, 1);
    if (spinning) tuckK = 1;

    const stance = p.stance();
    if (stance === "swing" || (p.attached && !spinning)) {
      // the web arm points at the anchor, the other arm balances behind
      const ax = (p.ax - p.x) * face;
      const ay = p.ay - p.y;
      const len = Math.hypot(ax, ay) || 1;
      const c = Math.cos(-angle);
      const s = Math.sin(-angle);
      const lx = (ax * c - ay * s) / len;
      const ly = (ax * s + ay * c) / len;
      handR.x = lx * 19;
      handR.y = shY + ly * 19;
      handL.x = -10 - clamp(p.vx * 0.006, 0, 5);
      handL.y = shY + 4;
      footR.x = 9 + clamp(p.vx * 0.008, 0, 6);
      footR.y = 15;
      footL.x = -7;
      footL.y = 19;
    } else if (stance === "run" || stance === "land") {
      const ph = p.runPhase;
      if (stance === "land") {
        tuckK = 0.6;
        handR.x = 11;
        handR.y = 4;
        handL.x = -9;
        handL.y = 5;
        footR.x = 8;
        footR.y = 15;
        footL.x = -7;
        footL.y = 15;
      } else {
        const sw = Math.sin(ph * 2);
        const cw = Math.cos(ph * 2);
        footR.x = sw * 11;
        footR.y = 17 - Math.max(0, cw) * 5;
        footL.x = -sw * 11;
        footL.y = 17 - Math.max(0, -cw) * 5;
        handR.x = -sw * 9;
        handR.y = shY + 8 + cw * 2;
        handL.x = sw * 9;
        handL.y = shY + 8 - cw * 2;
      }
    } else if (g.gliding) {
      membrane = 1;
      handR.x = 16;
      handR.y = shY - 2;
      handL.x = -15;
      handL.y = shY - 1;
      footR.x = 12;
      footR.y = 15;
      footL.x = -11;
      footL.y = 16;
    } else {
      // free flight: arms up when falling, tucked when rising fast
      const falling = p.vy > 40;
      if (falling) {
        handR.x = 12;
        handR.y = shY - 10;
        handL.x = -11;
        handL.y = shY - 8;
        footR.x = 8;
        footR.y = 16;
        footL.x = -7;
        footL.y = 17;
      } else {
        handR.x = -4;
        handR.y = shY + 10;
        handL.x = -13;
        handL.y = shY + 6;
        footR.x = 4;
        footR.y = 18;
        footL.x = -6;
        footL.y = 19;
      }
    }

    if (tuckK > 0.05) {
      // a real tuck pulls the knees to the chest and wraps the arms around
      handR.x = lerp(handR.x, 5, tuckK);
      handR.y = lerp(handR.y, 5, tuckK);
      handL.x = lerp(handL.x, 2, tuckK);
      handL.y = lerp(handL.y, 7, tuckK);
      footR.x = lerp(footR.x, 8, tuckK);
      footR.y = lerp(footR.y, 9, tuckK);
      footL.x = lerp(footL.x, 4, tuckK);
      footL.y = lerp(footL.y, 11, tuckK);
    }

    /* --- web-wings under the arms while gliding --- */
    if (membrane > 0) {
      ctx.fillStyle = "rgba(232,226,208,0.5)";
      ctx.beginPath();
      ctx.moveTo(2, shY + 1);
      ctx.lineTo(handR.x, handR.y);
      ctx.lineTo(footR.x, footR.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1, shY + 1);
      ctx.lineTo(handL.x, handL.y);
      ctx.lineTo(footL.x, footL.y - 4);
      ctx.closePath();
      ctx.fill();
    }

    /* --- legs (behind the torso) --- */
    this.limb(ctx, -1, hipY, footL.x, footL.y, 10, 10, -1, 4.6, legsDark);
    this.limb(ctx, 1, hipY, footR.x, footR.y, 10, 10, 1, 4.8, legs);
    // boots
    ctx.fillStyle = suit;
    for (const f of [footL, footR]) {
      ctx.beginPath();
      ctx.ellipse(f.x + 1.4, f.y + 0.6, 4.1, 2.9, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- torso --- */
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.moveTo(-4.6, hipY + 1.5);
    ctx.quadraticCurveTo(-5.6, shY + 2, -4.2, shY - 1.5);
    ctx.lineTo(4.2, shY - 1.5);
    ctx.quadraticCurveTo(5.6, shY + 2, 4.6, hipY + 1.5);
    ctx.closePath();
    ctx.fill();
    // the slate panel down the side of the suit
    ctx.fillStyle = legs;
    ctx.beginPath();
    ctx.moveTo(-4.6, hipY + 1.5);
    ctx.quadraticCurveTo(-5.6, shY + 2, -4.2, shY - 1.5);
    ctx.lineTo(-1.6, shY - 1.5);
    ctx.quadraticCurveTo(-2.6, shY + 3, -1.8, hipY + 1.5);
    ctx.closePath();
    ctx.fill();
    // a small woven emblem on the chest
    ctx.strokeStyle = "rgba(48,36,32,0.75)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(1.6, shY + 2.4);
    ctx.lineTo(3.6, shY + 4.2);
    ctx.moveTo(1.6, shY + 4.6);
    ctx.lineTo(3.6, shY + 2.6);
    ctx.moveTo(2.6, shY + 1.6);
    ctx.lineTo(2.6, shY + 5.4);
    ctx.stroke();

    /* --- arms --- */
    this.limb(ctx, -2.6, shY, handL.x, handL.y, 9, 9, -1, 4.2, suitDark);
    this.limb(ctx, 2.6, shY, handR.x, handR.y, 9, 9, 1, 4.4, suit);
    ctx.fillStyle = suit;
    for (const hnd of [handL, handR]) {
      ctx.beginPath();
      ctx.arc(hnd.x, hnd.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- head and mask --- */
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.arc(0.6, headY, 6.6, 0, Math.PI * 2);
    ctx.fill();
    // the woven lines of the mask
    ctx.strokeStyle = "rgba(70,40,36,0.35)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      ctx.moveTo(0.6 - 6.4 + k * 0.6, headY - 3 + k * 3);
      ctx.lineTo(0.6 + 6.4 - k * 0.6, headY - 3 + k * 3);
    }
    ctx.moveTo(0.6, headY - 6.4);
    ctx.lineTo(0.6, headY + 6.4);
    ctx.stroke();
    // the two white lenses
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.ellipse(3.1, headY - 1.1, 2.9, 2.1, -0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-1.9, headY - 0.6, 2.2, 1.7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(50,38,34,0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(3.1, headY - 1.1, 2.9, 2.1, -0.32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // a stumble puff rings the body after a hard brush
    if (p.stumbleT > 0) {
      const t = p.stumbleT / 0.34;
      ctx.strokeStyle = `rgba(214,150,120,${t * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + (1 - t) * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the spare strand charm, when it is carrying you
    if (g.shieldActive) {
      const pulse = 0.5 + 0.5 * Math.sin(g.time * 4);
      ctx.strokeStyle = `rgba(147,169,127,${0.35 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    void T;
  }

  /** a tapered two-bone limb drawn with a soft outline */
  private limb(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    l1: number,
    l2: number,
    bend: number,
    width: number,
    color: string,
  ) {
    const j = joint(sx, sy, tx, ty, l1, l2, bend);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(j.x, j.y, tx, ty);
    ctx.stroke();
  }

  /* ---------------- overlays ---------------- */

  private popups(g: Game) {
    const { ctx } = this;
    ctx.textAlign = "center";
    for (const t of g.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `800 ${t.size}px 'Baloo 2', system-ui, sans-serif`;
      ctx.fillStyle = "rgba(46,42,34,0.35)";
      ctx.fillText(t.str, t.x + 1.5, t.y + 2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  private ambient(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const kind = T.ambient;
    if (kind === "none") return;
    const n = kind === "birds" ? 4 : 26;
    for (let i = 0; i < n; i++) {
      const seed = i * 12.9898 + g.world.level * 4.1;
      if (kind === "birds") {
        const phase = (g.time * 0.02 + hash(seed) * 1) % 1;
        const x = ((phase * (w + 160)) - 80 + hash(seed + 1) * 120) % (w + 160);
        const y = h * (0.18 + hash(seed + 2) * 0.4) + Math.sin(g.time * 0.8 + i) * 8;
        const flap = Math.sin(g.time * 6 + i) * 3;
        ctx.strokeStyle = "rgba(56,72,70,0.4)";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - 6, y + flap * 0.4);
        ctx.quadraticCurveTo(x - 2, y - 2 + flap, x, y);
        ctx.quadraticCurveTo(x + 3, y - 2 + flap, x + 7, y + flap * 0.4);
        ctx.stroke();
        continue;
      }
      const drift = kind === "snow" ? 26 : kind === "leaves" ? 46 : 34;
      const x = (hash(seed) * w + g.time * drift * (0.4 + hash(seed + 3) * 0.8) - g.cam.x * 0.12) % (w + 40);
      const y =
        kind === "snow"
          ? (hash(seed + 1) * h + g.time * (24 + hash(seed + 4) * 30)) % (h + 20)
          : (hash(seed + 1) * h + Math.sin(g.time * 0.6 + i) * 26 + g.time * 8) % (h + 40);
      ctx.fillStyle = T.ambientColor;
      ctx.globalAlpha = 0.5 + hash(seed + 5) * 0.4;
      ctx.beginPath();
      if (kind === "leaves") {
        ctx.ellipse(x - 20, y - 20, 3.4, 2, g.time + i, 0, Math.PI * 2);
      } else {
        ctx.arc(x - 20, y - 20, kind === "snow" ? 2.1 : 1.6, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** the higher you climb, the thinner the air looks */
  private heightHaze(g: Game, w: number, h: number, T: Theme) {
    const high = clamp((300 - g.cam.y) / 900, 0, 0.42);
    if (high <= 0.01) return;
    const { ctx } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(236,242,238,${high})`);
    grad.addColorStop(1, "rgba(236,242,238,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    void T;
  }
}
