import type { Game } from "./engine";
import type { Obj } from "./world";
import { themeDef, type Theme } from "./themes";
import { clamp, hash, wrap } from "./util";


export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private haloGrad: CanvasGradient | null = null;

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

    const T = themeDef(g.theme);
    this.sky(g, w, h, T);
    this.skyline(g, w, h, T);
    this.deco(g, w, h, T);

    ctx.save();
    ctx.translate(-g.cam.x + g.cam.sx, -g.cam.y + g.cam.sy);
    this.street(g, T);
    this.gate(g, T);
    this.worldObjects(g, T);
    this.upperCity(g, T);
    g.parts.draw(ctx);
    if (g.state !== "menu") {
      this.trail(g);
      // Draw silk first, so the spider sits naturally over its attachment.
      this.rope(g);
      if (g.state === "playing" || g.state === "paused") this.spider(g);
    }
    this.popups(g);
    this.aimMark(g);
    this.snapMark(g);
    ctx.restore();

    this.ambient(g, T);
  }

  /* ---------------- background ---------------- */

  private sky(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, T.sky[0]);
    grad.addColorStop(0.43, T.sky[1]);
    grad.addColorStop(0.76, T.sky[2]);
    grad.addColorStop(1, T.sky[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const horizon = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.78);
    horizon.addColorStop(0, "rgba(255,250,220,0)");
    horizon.addColorStop(1, T.glow);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.42, w, h * 0.36);

    // A small matte sun and a wide, barely-there halo—no hard bloom.
    const sx = w * 0.76;
    const sy = h * 0.17 + Math.sin(g.cam.y * 0.00025) * 4;
    const halo = ctx.createRadialGradient(sx, sy, 5, sx, sy, Math.min(w, h) * 0.27);
    halo.addColorStop(0, "rgba(255,246,201,0.27)");
    halo.addColorStop(1, "rgba(255,246,201,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - h * 0.28, sy - h * 0.28, h * 0.56, h * 0.56);
    ctx.fillStyle = "#fff1bd";
    ctx.beginPath();
    ctx.arc(sx, sy, Math.min(24, h * 0.045), 0, Math.PI * 2);
    ctx.fill();

    this.clouds(g, w, h);
  }

  private clouds(g: Game, w: number, h: number) {
    const { ctx } = this;
    const spacing = 250;
    const offset = g.cam.x * 0.035 + g.time * 3;
    const first = Math.floor(offset / spacing) - 2;
    const last = first + Math.ceil(w / spacing) + 4;
    for (let i = first; i <= last; i++) {
      const r = hash(i * 4.17 + 12.6);
      const x = wrap(i * spacing - offset, w + spacing) - spacing * 0.4;
      const y = h * (0.12 + hash(i * 7.3 + 0.4) * 0.22);
      const scale = 0.58 + r * 0.62;
      ctx.fillStyle = `rgba(255,249,220,${(0.11 + r * 0.08).toFixed(3)})`;
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

    // Distant birds are small and slow, just enough to suggest an open route.
    for (let i = 0; i < 3; i++) {
      const phase = (g.time * 0.012 + i * 0.37) % 1;
      const x = wrap(phase * (w + 100) - 40, w + 80) - 20;
      const y = h * (0.27 + i * 0.035);
      ctx.strokeStyle = "rgba(53,82,76,0.38)";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.quadraticCurveTo(x - 2, y + 3, x, y);
      ctx.quadraticCurveTo(x + 3, y - 3, x + 6, y);
      ctx.stroke();
    }
  }

  /** Low-poly tree lines and landmarks, kept far enough back to stay quiet. */
  private deco(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const parallax = 0.29;
    const step = 112;
    const offset = g.cam.x * parallax;
    const base = h * 0.84;
    const first = Math.floor(offset / step) - 2;
    const last = first + Math.ceil(w / step) + 4;

    for (let i = first; i <= last; i++) {
      const x = i * step - offset;
      const r = hash(i * 5.11 + 3.3);
      const r2 = hash(i * 2.77 + 8.1);
      const scale = 0.55 + r * 0.72;
      const height = (82 + r2 * 62) * scale;

      if (T.id === "underwater") {
        ctx.strokeStyle = T.far3;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 4 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base + 18);
        ctx.quadraticCurveTo(x - 9, base - height * 0.4, x + Math.sin(g.time * 0.3 + i) * 10, base - height);
        ctx.stroke();
        for (let k = 1; k <= 3; k++) {
          const yy = base - height * (k / 4);
          ctx.beginPath();
          ctx.ellipse(x + (k % 2 ? 9 : -9), yy, 10 * scale, 3.5 * scale, k % 2 ? -0.6 : 0.6, 0, Math.PI * 2);
          ctx.fillStyle = T.trim;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        continue;
      }

      if (T.id === "desert") {
        ctx.strokeStyle = T.far3;
        ctx.lineWidth = 7 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base + 14);
        ctx.lineTo(x, base - height * 0.72);
        if (r2 > 0.42) {
          ctx.moveTo(x, base - height * 0.42);
          ctx.lineTo(x + 18 * scale, base - height * 0.58);
          ctx.lineTo(x + 18 * scale, base - height * 0.42);
        }
        ctx.stroke();
        continue;
      }

      if (T.id === "volcano") {
        // The old volcano palette is now a soft orchard: rounded, quiet crowns.
        ctx.strokeStyle = "rgba(86,91,67,0.72)";
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(x, base + 12);
        ctx.lineTo(x + (r - 0.5) * 12, base - height * 0.55);
        ctx.stroke();
        ctx.fillStyle = r > 0.5 ? "#b87c62" : "#c18a68";
        ctx.beginPath();
        ctx.moveTo(x - 32 * scale, base - height * 0.38);
        ctx.lineTo(x - 22 * scale, base - height * 0.82);
        ctx.lineTo(x - 5 * scale, base - height);
        ctx.lineTo(x + 18 * scale, base - height * 0.87);
        ctx.lineTo(x + 34 * scale, base - height * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(236,207,154,0.25)";
        ctx.beginPath();
        ctx.moveTo(x - 5 * scale, base - height);
        ctx.lineTo(x + 18 * scale, base - height * 0.87);
        ctx.lineTo(x + 26 * scale, base - height * 0.51);
        ctx.lineTo(x + 3 * scale, base - height * 0.68);
        ctx.closePath();
        ctx.fill();
        continue;
      }

      if (T.id === "jungle") {
        // Broad fernwood crowns replace the narrow pines in the canopy world.
        ctx.strokeStyle = "rgba(66,91,64,0.72)";
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(x, base + 12);
        ctx.lineTo(x + (r - 0.5) * 13, base - height * 0.56);
        ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const yy = base - height * (0.48 + k * 0.16);
          const span = (25 + k * 4) * scale;
          ctx.fillStyle = k === 1 ? "#668969" : T.far3;
          ctx.beginPath();
          ctx.moveTo(x - span, yy + 10 * scale);
          ctx.quadraticCurveTo(x - span * 0.8, yy - 10 * scale, x, yy - 7 * scale);
          ctx.quadraticCurveTo(x + span * 0.8, yy - 15 * scale, x + span, yy + 10 * scale);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "rgba(226,231,182,0.2)";
        ctx.beginPath();
        ctx.ellipse(x - 7 * scale, base - height * 0.74, 12 * scale, 4 * scale, -0.25, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (T.id === "space") {
        // Cloudbreak Peaks: a sparse line of sharp, snow-dusted mountain fins.
        const half = 42 * scale;
        ctx.fillStyle = T.far3;
        ctx.beginPath();
        ctx.moveTo(x - half, base + 12);
        ctx.lineTo(x - half * 0.18, base - height * 0.48);
        ctx.lineTo(x + half * 0.1, base - height);
        ctx.lineTo(x + half * 0.38, base - height * 0.56);
        ctx.lineTo(x + half, base + 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(247,244,222,0.68)";
        ctx.beginPath();
        ctx.moveTo(x + half * 0.1, base - height);
        ctx.lineTo(x + half * 0.32, base - height * 0.64);
        ctx.lineTo(x + half * 0.15, base - height * 0.68);
        ctx.lineTo(x + half * 0.02, base - height * 0.84);
        ctx.lineTo(x - half * 0.02, base - height * 0.72);
        ctx.closePath();
        ctx.fill();
        continue;
      }

      if (T.id === "neon") {
        // Seabreeze Coast: windswept, rounded shore trees and quiet wave lines.
        const trunkX = x + 10 * scale;
        const trunkY = base - height * 0.52;
        ctx.strokeStyle = "rgba(77,94,71,0.72)";
        ctx.lineWidth = 3.5 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base + 10);
        ctx.quadraticCurveTo(x + 5 * scale, base - height * 0.28, trunkX, trunkY);
        ctx.stroke();
        ctx.fillStyle = T.far3;
        for (let k = 0; k < 4; k++) {
          const leafX = trunkX + (k - 1.5) * 12 * scale;
          const leafY = trunkY + (k % 2 ? 3 : -2) * scale;
          ctx.beginPath();
          ctx.ellipse(leafX, leafY, 17 * scale, 6 * scale, (k - 1.5) * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(245,238,210,0.22)";
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) {
          const waveY = base + 12 + k * 11;
          ctx.beginPath();
          ctx.moveTo(x - 27 * scale, waveY);
          ctx.quadraticCurveTo(x, waveY - 4 * scale, x + 28 * scale, waveY);
          ctx.stroke();
        }
        continue;
      }

      // Soft conifers. A second, lighter triangle gives each tree one quiet facet.
      const half = 24 * scale;
      ctx.fillStyle = T.far3;
      ctx.beginPath();
      ctx.moveTo(x - half, base + 10);
      ctx.lineTo(x - half * 0.48, base - height * 0.55);
      ctx.lineTo(x, base - height);
      ctx.lineTo(x + half * 0.42, base - height * 0.58);
      ctx.lineTo(x + half, base + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(239,232,196,0.17)";
      ctx.beginPath();
      ctx.moveTo(x, base - height);
      ctx.lineTo(x + half * 0.42, base - height * 0.58);
      ctx.lineTo(x + half, base + 10);
      ctx.lineTo(x + half * 0.08, base - height * 0.17);
      ctx.closePath();
      ctx.fill();
      if (T.id === "ice") {
        ctx.fillStyle = "rgba(249,247,229,0.7)";
        ctx.beginPath();
        ctx.moveTo(x - half * 0.2, base - height * 0.74);
        ctx.lineTo(x, base - height);
        ctx.lineTo(x + half * 0.2, base - height * 0.72);
        ctx.closePath();
        ctx.fill();
      }

      // A small windmill marks the first valley; the blades turn slowly.
      if (T.id === "city" && ((i % 17) + 17) % 17 === 4) {
        const mx = x + 34 * scale;
        const my = base - height * 0.84;
        ctx.fillStyle = "#efe5cc";
        ctx.beginPath();
        ctx.moveTo(mx - 9 * scale, base + 4);
        ctx.lineTo(mx - 5 * scale, my);
        ctx.lineTo(mx + 6 * scale, my);
        ctx.lineTo(mx + 9 * scale, base + 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#f0eadb";
        ctx.lineWidth = 2 * scale;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(g.time * 0.16 + i);
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -28 * scale);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = "#b66b4f";
        ctx.beginPath();
        ctx.arc(mx, my, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Three quiet mountain ridges create depth without city textures. */
  private skyline(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const colors = [T.far1, T.far2, T.far3];
    const pars = [0.045, 0.11, 0.21];
    const steps = [250, 210, 180];
    const bases = [0.57, 0.68, 0.79];
    for (let layer = 0; layer < 3; layer++) {
      const step = steps[layer];
      const offset = g.cam.x * pars[layer];
      const first = Math.floor(offset / step) - 2;
      const last = first + Math.ceil(w / step) + 4;
      const base = h * bases[layer];
      ctx.fillStyle = colors[layer];
      for (let i = first; i <= last; i++) {
        const x = i * step - offset;
        const a = hash(i * 3.73 + layer * 17.9);
        const b = hash(i * 5.19 + layer * 7.1);
        const peak = base - h * (0.08 + a * (layer === 0 ? 0.16 : 0.11));
        const left = x + step * (0.24 + a * 0.13);
        const right = x + step * (0.62 + b * 0.15);
        ctx.beginPath();
        ctx.moveTo(x - step * 0.1, base + 3);
        ctx.lineTo(left, peak + h * 0.045);
        ctx.lineTo(x + step * 0.5, peak);
        ctx.lineTo(right, peak + h * 0.035);
        ctx.lineTo(x + step * 1.1, base + 3);
        ctx.closePath();
        ctx.fill();

        // One matte sunward face, not a repeating texture.
        ctx.fillStyle = `rgba(255,247,218,${(0.045 + layer * 0.012).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(left, peak + h * 0.045);
        ctx.lineTo(x + step * 0.5, peak);
        ctx.lineTo(x + step * 0.63, base + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = colors[layer];
      }
    }
  }

  /* ---------------- overhead branchway / web anchors ---------------- */

  private upperCity(g: Game, T: Theme) {
    const { ctx } = this;
    const x0 = g.cam.x - 60;
    const x1 = g.cam.x + g.vw + 60;
    const step = 14;
    let runStart: number | null = null;

    const drawRun = (xa: number, xb: number) => {
      const edge = (x: number) => g.world.ceilY(x);
      ctx.beginPath();
      ctx.moveTo(xa, edge(xa));
      for (let x = xa + step; x < xb; x += step) ctx.lineTo(x, edge(x));
      ctx.lineTo(xb, edge(xb));
      for (let x = xb; x >= xa; x -= step) ctx.lineTo(x, edge(x) + 20);
      ctx.closePath();
      ctx.fillStyle = T.ceiling;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(xa, edge(xa));
      for (let x = xa + step; x < xb; x += step) ctx.lineTo(x, edge(x));
      ctx.lineTo(xb, edge(xb));
      ctx.strokeStyle = T.ceiling;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.strokeStyle = T.trim;
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Sparse leaves along the anchor edge make the line read as a bough,
      // without covering the sky or the swinging path.
      for (let x = Math.ceil(xa / 92) * 92; x < xb; x += 92) {
        const ey = edge(x);
        const r = hash(x * 0.77 + g.world.level);
        ctx.fillStyle = T.trim;
        ctx.globalAlpha = 0.3 + r * 0.18;
        ctx.beginPath();
        ctx.ellipse(x + (r - 0.5) * 8, ey + 14, 7 + r * 3, 3.2, r * 0.7 - 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    for (let x = x0; x <= x1 + step; x += step) {
      const solid = x <= x1 && g.world.ceilSolid(x);
      if (solid && runStart === null) runStart = x;
      if (!solid && runStart !== null) {
        drawRun(runStart, Math.min(x, x1));
        runStart = null;
      }
    }
  }

  /* ---------------- rolling hillside ---------------- */

  private street(g: Game, T: Theme) {
    const { ctx } = this;
    const x0 = g.cam.x - 90;
    const x1 = g.cam.x + g.vw + 90;
    const bottom = g.cam.y + g.vh + 460;
    const surf = (x: number) => g.world.lavaY(x);
    const step = 22;

    ctx.beginPath();
    ctx.moveTo(x0, surf(x0));
    for (let x = x0 + step; x <= x1; x += step) ctx.lineTo(x, surf(x));
    ctx.lineTo(x1, bottom);
    ctx.lineTo(x0, bottom);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, surf((x0 + x1) / 2), 0, bottom);
    ground.addColorStop(0, T.ground[0]);
    ground.addColorStop(0.34, T.ground[1]);
    ground.addColorStop(1, T.ground[2]);
    ctx.fillStyle = ground;
    ctx.fill();

    // Large, low-contrast facets echo the hand-cut paper look without adding
    // noisy texture. Their position is deterministic as the camera moves.
    const facet = 190;
    const first = Math.floor(x0 / facet) * facet;
    for (let x = first; x < x1; x += facet) {
      const a = x + facet * 0.22;
      const b = x + facet * 0.77;
      ctx.globalAlpha = 0.075 + hash(x * 0.013) * 0.025;
      ctx.fillStyle = T.groundLine;
      ctx.beginPath();
      ctx.moveTo(a, surf(a));
      ctx.lineTo(b, surf(b));
      ctx.lineTo(x + facet * 0.48, Math.min(surf(a), surf(b)) + 135);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(x0, surf(x0));
    for (let x = x0 + 12; x <= x1; x += 12) ctx.lineTo(x, surf(x));
    ctx.strokeStyle = T.groundLine;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Tiny grass marks along the ridge; no road markings, traffic or lamps.
    const grassStep = 210;
    for (let x = Math.ceil(x0 / grassStep) * grassStep; x < x1; x += grassStep) {
      const y = surf(x) - 2;
      const r = hash(x * 0.03 + 7.7);
      ctx.strokeStyle = T.far3;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y - 7 - r * 5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 9 - r * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- world objects ---------------- */

  private worldObjects(g: Game, T: Theme) {
    const cw = g.world.cw;
    const i0 = Math.max(0, Math.floor((g.cam.x - 120) / cw));
    const i1 = Math.floor((g.cam.x + g.vw + 120) / cw);
    for (let i = i0; i <= i1; i++) {
      const c = g.world.chunks.get(i);
      if (!c) continue;
      for (const o of c.objs) this.obj(g, o, T);
    }
  }

  private obj(g: Game, o: Obj, T: Theme) {
    const { ctx } = this;
    const t = g.time;
    switch (o.kind) {
      case "plat": {
        const x = o.x - o.w / 2;
        const py = o.pod ? o.y + Math.sin(t * 1.1 + o.x * 0.02) * 2.5 : o.y;
        ctx.fillStyle = o.pod ? "#9b805e" : T.ground[2];
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.quadraticCurveTo(x + o.w * 0.22, py - 4, x + o.w * 0.48, py - 1);
        ctx.quadraticCurveTo(x + o.w * 0.78, py + 1, x + o.w, py - 3);
        ctx.lineTo(x + o.w - 2, py + o.h);
        ctx.lineTo(x + 2, py + o.h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = o.pod ? "#6f7658" : T.groundLine;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (o.pod) {
          for (let k = 0; k < 3; k++) {
            const lx = o.x + (k - 1) * 15;
            ctx.fillStyle = k === 1 ? "#9aaf79" : "#6f9a79";
            ctx.beginPath();
            ctx.ellipse(lx, py - 6 - Math.abs(k) * 2, 9, 4, (k - 1) * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case "spire": {
        const height = o.base - o.tip;
        if (T.id === "desert") {
          ctx.strokeStyle = "#678063";
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(8, o.w * 0.42);
          ctx.beginPath();
          ctx.moveTo(o.x, o.base);
          ctx.lineTo(o.x, o.tip + height * 0.16);
          ctx.moveTo(o.x, o.tip + height * 0.58);
          ctx.lineTo(o.x - o.w * 0.55, o.tip + height * 0.38);
          ctx.lineTo(o.x - o.w * 0.55, o.tip + height * 0.25);
          ctx.moveTo(o.x, o.tip + height * 0.68);
          ctx.lineTo(o.x + o.w * 0.55, o.tip + height * 0.5);
          ctx.lineTo(o.x + o.w * 0.55, o.tip + height * 0.35);
          ctx.stroke();
          break;
        }
        ctx.fillStyle = T.far3;
        ctx.beginPath();
        ctx.moveTo(o.x - o.w * 0.68, o.base);
        ctx.lineTo(o.x - o.w * 0.25, o.tip + height * 0.42);
        ctx.lineTo(o.x - o.w * 0.48, o.tip + height * 0.45);
        ctx.lineTo(o.x, o.tip);
        ctx.lineTo(o.x + o.w * 0.34, o.tip + height * 0.4);
        ctx.lineTo(o.x + o.w * 0.62, o.tip + height * 0.39);
        ctx.lineTo(o.x + o.w * 0.74, o.base);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(239,232,196,0.18)";
        ctx.beginPath();
        ctx.moveTo(o.x, o.tip);
        ctx.lineTo(o.x + o.w * 0.34, o.tip + height * 0.4);
        ctx.lineTo(o.x + o.w * 0.62, o.tip + height * 0.39);
        ctx.lineTo(o.x + o.w * 0.74, o.base);
        ctx.lineTo(o.x + o.w * 0.12, o.base - height * 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case "stal": {
        const tipX = o.x + (hash(o.x * 1.3) - 0.5) * 10;
        const tipY = o.y + o.len;
        ctx.strokeStyle = T.ceiling;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.quadraticCurveTo(o.x + 4, o.y + o.len * 0.54, tipX, tipY);
        ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const f = 0.28 + k * 0.2;
          const ly = o.y + o.len * f;
          const lx = o.x + (tipX - o.x) * f;
          ctx.fillStyle = T.trim;
          ctx.globalAlpha = 0.52;
          ctx.beginPath();
          ctx.ellipse(lx + (k % 2 ? 8 : -8), ly, 8, 3, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "saw":
      case "drone": {
        // These legacy object kinds now read as harmless birds, not threats.
        const x = o.x + (o.kind === "drone" ? Math.sin(t * 0.35 + o.ph) * 34 : 0);
        const y = o.y + Math.sin(t * 0.7 + o.ph) * o.bob;
        ctx.fillStyle = "#566f67";
        ctx.beginPath();
        ctx.ellipse(x, y, o.r * 0.72, o.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        const wing = Math.sin(t * 3 + o.ph) * 5;
        ctx.strokeStyle = "#566f67";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.quadraticCurveTo(x - o.r * 0.6, y - o.r - wing, x - o.r, y - 5);
        ctx.moveTo(x + 3, y);
        ctx.quadraticCurveTo(x + o.r * 0.6, y - o.r + wing, x + o.r, y - 5);
        ctx.stroke();
        break;
      }

      case "wind": {
        const x0 = o.x - o.w / 2;
        const y0 = o.y - o.h / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, o.w, o.h);
        ctx.clip();
        ctx.strokeStyle = "rgba(255,249,220,0.28)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        for (let k = 0; k < 5; k++) {
          const phase = (t * (0.08 + k * 0.012) + k * 0.21) % 1;
          const x = x0 + phase * (o.w + 40) - 20;
          const y = o.y + (k - 2) * o.h * 0.13;
          ctx.beginPath();
          ctx.moveTo(x - 22, y + 2);
          ctx.quadraticCurveTo(x, y - 6, x + 24, y);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case "fire": {
        // Fire is no longer generated; retain a quiet lantern if old saves contain one.
        const flicker = 0.4 + Math.sin(t * 1.4 + o.x) * 0.08;
        ctx.fillStyle = `rgba(219,163,104,${flicker.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y + o.h * 0.3, 11, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,241,189,0.72)";
        ctx.beginPath();
        ctx.ellipse(o.x, o.y + o.h * 0.26, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "fish": {
        const x = o.x + Math.sin(t * 0.28 + o.ph) * 42;
        const y = o.y + Math.sin(t * 0.58 + o.ph) * o.bob;
        const dir = Math.cos(t * 0.28 + o.ph) >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.fillStyle = "#d7bd81";
        ctx.beginPath();
        ctx.moveTo(-o.r * 0.62, 0);
        ctx.lineTo(-o.r * 1.35, -o.r * 0.56);
        ctx.lineTo(-o.r * 1.28, o.r * 0.56);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#88afa6";
        ctx.beginPath();
        ctx.ellipse(0, 0, o.r, o.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(245,240,213,0.72)";
        ctx.beginPath();
        ctx.ellipse(o.r * 0.48, -o.r * 0.1, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case "coin": {
        if (o.got) break;
        const y = o.y + Math.sin(t * 1.4 + o.x * 0.03) * 3;
        ctx.save();
        ctx.translate(o.x, y);
        ctx.rotate(Math.sin(t * 0.7 + o.x) * 0.16);
        ctx.fillStyle = "#d5aa60";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 13, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f0d79e";
        ctx.beginPath();
        ctx.ellipse(-2, -2, 3, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(113,111,72,0.56)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(2, -7);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case "shield":
      case "magnet": {
        if (o.got) break;
        const y = o.y + Math.sin(t * 1.1 + o.x * 0.02) * 3;
        const color = o.kind === "shield" ? "#97aa78" : "#d3a666";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(o.x, y, 9, 13, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,248,218,0.65)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(o.x, y + 8);
        ctx.lineTo(o.x + 2, y - 8);
        ctx.stroke();
        break;
      }
    }
  }

  /* ---------------- spider and segmented web ---------------- */

  private trail(g: Game) {
    const { ctx } = this;
    const p = g.player;
    const points = p.trail;
    if (points.length < 2) return;
    const alpha = clamp((p.speed() - 180) / 760, 0, 1) * 0.24;
    if (alpha < 0.02) return;
    ctx.lineCap = "round";
    for (let i = 1; i < points.length; i++) {
      const f = i / points.length;
      ctx.globalAlpha = alpha * f;
      ctx.strokeStyle = "#fbf0d3";
      ctx.lineWidth = 0.8 + 2.8 * f;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private rope(g: Game) {
    const { ctx } = this;
    const p = g.player;
    if (!p.attached) return;
    const nodes = p.webNodes;
    if (nodes.length < 2) return;

    const path = () => {
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < nodes.length - 1; i++) {
        const next = nodes[i + 1];
        const mx = (nodes[i].x + next.x) * 0.5;
        const my = (nodes[i].y + next.y) * 0.5;
        ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my);
      }
      const last = nodes[nodes.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    path();
    ctx.strokeStyle = "rgba(49,66,57,0.25)";
    ctx.lineWidth = 4.2;
    ctx.stroke();
    path();
    ctx.strokeStyle = "rgba(247,243,225,0.88)";
    ctx.lineWidth = 2.1;
    ctx.stroke();
    path();
    ctx.strokeStyle = "rgba(255,255,248,0.58)";
    ctx.lineWidth = 0.85;
    ctx.stroke();

    // A small silk knot at the fixed end clarifies the anchor and direction.
    ctx.fillStyle = "#f3ecd3";
    ctx.beginPath();
    ctx.arc(p.ax, p.ay, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(71,93,76,0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.ax, p.ay, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  private spider(g: Game) {
    const { ctx } = this;
    const p = g.player;
    const sp = p.speed();
    const wob = Math.sin(g.time * 7 + sp * 0.006) * 1.3;

    if (g.graceT > 0) {
      ctx.strokeStyle = "rgba(246,228,184,0.46)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24 + Math.sin(g.time * 3) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (g.shieldActive) {
      ctx.strokeStyle = "rgba(143,171,131,0.58)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Soft contact shadow keeps the little body legible, without a neon halo.
    if (!this.haloGrad) {
      this.haloGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 24);
      this.haloGrad.addColorStop(0, "rgba(40,47,38,0.19)");
      this.haloGrad.addColorStop(1, "rgba(40,47,38,0)");
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = this.haloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.rotation);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (g.gliding) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = "rgba(240,236,214,0.35)";
        ctx.beginPath();
        ctx.moveTo(3, side * 3);
        ctx.quadraticCurveTo(-7, side * 23, -18, side * 11);
        ctx.quadraticCurveTo(-8, side * 6, 3, side * 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,250,230,0.58)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    const legColor = "#39443c";
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 2.2;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const rootX = -5 + k * 4.5;
        const rootY = side * 2.5;
        const reach = 10 + (3 - k) * 1.5;
        const lift = wob * (side === 1 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        ctx.lineTo(rootX - reach * 0.55, side * (8 + k * 2) + lift);
        ctx.lineTo(rootX - reach, side * (4 + k * 2) + lift);
        ctx.stroke();
      }
    }

    // Abdomen, thorax, and head: warm earth colours with a tiny pale face.
    ctx.fillStyle = "#3e6554";
    ctx.beginPath();
    ctx.ellipse(-3, 0, 10.5, 8.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bd7056";
    ctx.beginPath();
    ctx.ellipse(3, 0, 7.1, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d48867";
    ctx.beginPath();
    ctx.arc(11, 0, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8efda";
    ctx.beginPath();
    ctx.ellipse(13.5, -2.1, 1.8, 1.2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(13.5, 2.1, 1.8, 1.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- feedback ---------------- */

  private popups(g: Game) {
    const { ctx } = this;
    if (g.texts.length === 0) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const tp of g.texts) {
      const f = Math.min(1, (tp.life / tp.max) * 1.8);
      const pop = 1 + Math.max(0, tp.life / tp.max - 0.82) * 1.2;
      const size = tp.size * pop;
      ctx.globalAlpha = f;
      ctx.font = `700 ${size}px "Nunito", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, size / 7);
      ctx.strokeStyle = "rgba(246,239,216,0.82)";
      ctx.strokeText(tp.str, tp.x, tp.y);
      ctx.fillStyle = tp.color;
      ctx.fillText(tp.str, tp.x, tp.y);
    }
    ctx.globalAlpha = 1;
  }

  private aimMark(g: Game) {
    const { ctx } = this;
    if (!g.aim || g.state !== "playing" || g.player.attached) return;
    const { x, y } = g.aim;
    const pulse = 0.28 + 0.14 * Math.sin(g.time * 3.2);
    ctx.strokeStyle = `rgba(208,170,112,${pulse.toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 8 + Math.sin(g.time * 3.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y - 5);
    ctx.stroke();
    if (g.holdWeb) {
      ctx.fillStyle = "rgba(246,233,199,0.84)";
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private snapMark(g: Game) {
    const { ctx } = this;
    const s = g.snapFx;
    if (!s) return;
    const progress = clamp(s.t / 0.26, 0, 1);
    const ex = s.px + (s.ax - s.px) * (1 - progress);
    const ey = s.py + (s.ay - s.py) * (1 - progress);
    ctx.strokeStyle = `rgba(246,239,216,${(progress * 0.78).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  /* ---------------- floating route waymark ---------------- */

  private gate(g: Game, T: Theme) {
    const marker = g.gateHole;
    if (!marker) return;
    const { ctx } = this;
    const r = marker.r;
    const cy = marker.y + Math.sin(g.time * 0.8) * 2;
    const left = marker.x - r * 0.78;
    const right = marker.x + r * 0.78;

    // A quiet, open wooden arch: the crown reads as a waymark, while the two
    // short posts frame a clear path through the center. The physical target
    // remains a generous circle rather than a pixel-perfect hoop.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.arc(marker.x, cy, r, Math.PI, Math.PI * 2);
    ctx.moveTo(left, cy + 1);
    ctx.lineTo(left, cy + r * 0.82);
    ctx.moveTo(right, cy + 1);
    ctx.lineTo(right, cy + r * 0.82);
    ctx.strokeStyle = "rgba(66,78,59,0.42)";
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(marker.x, cy, r, Math.PI, Math.PI * 2);
    ctx.moveTo(left, cy + 1);
    ctx.lineTo(left, cy + r * 0.82);
    ctx.moveTo(right, cy + 1);
    ctx.lineTo(right, cy + r * 0.82);
    ctx.strokeStyle = T.trim;
    ctx.lineWidth = 5.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(marker.x, cy, r - 4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = "rgba(255,248,223,0.66)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // A small leaf on the crown makes it feel like a trail marker, not a portal.
    ctx.fillStyle = "#98a878";
    ctx.beginPath();
    ctx.ellipse(marker.x + 1, cy - r + 2, 10, 4, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(70,91,69,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marker.x - 5, cy - r + 5);
    ctx.lineTo(marker.x + 7, cy - r - 1);
    ctx.stroke();
  }

  /* ---------------- ambient weather, per world ---------------- */

  private ambient(g: Game, T: Theme) {
    const { ctx } = this;
    if (T.ambient === "none") return;
    const w = g.vw;
    const h = g.vh;
    const count = T.ambient === "snow" ? 20 : 14;
    for (let i = 0; i < count; i++) {
      const r1 = hash(i * 4.13);
      const r2 = hash(i * 8.77 + 2.1);
      const r3 = hash(i * 2.31 + 9.4);
      const speed = T.ambient === "bubbles" ? -12 : 7 + r1 * 9;
      const y = wrap(r2 * h + g.time * speed - g.cam.y * 0.04, h + 30) - 15;
      const x = wrap(r1 * (w + 50) - g.cam.x * 0.035 + Math.sin(g.time * 0.22 + i) * 18, w + 50) - 25;
      const size = 1.2 + r3 * (T.ambient === "snow" ? 2.1 : 1.4);
      ctx.globalAlpha = 0.07 + r1 * 0.1;
      ctx.fillStyle = T.ambientColor;
      if (T.ambient === "leaves") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(g.time * 0.3 + i) * 0.55);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.7, size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (T.ambient === "bubbles") {
        ctx.strokeStyle = T.ambientColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, size + 1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }


}
