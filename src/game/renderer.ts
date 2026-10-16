import type { Game } from "./engine";
import type { Obj } from "./world";
import { themeDef, type Theme } from "./themes";
import { clamp, lerp, hash, noise1, wrap } from "./util";


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

    const T = themeDef(g.theme);
    this.sky(g, w, h, T);
    this.deco(g, w, h, T);
    this.skyline(g, w, h, T);
    // push the background back so gameplay objects pop forward
    ctx.fillStyle = "rgba(6,8,26,0.42)";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-g.cam.x + g.cam.sx, -g.cam.y + g.cam.sy);
    this.street(g, T);
    this.gate(g, T);
    this.worldObjects(g, T);
    this.upperCity(g, T);
    g.parts.draw(ctx);
    if (g.state !== "menu") {
      this.trail(g);
      this.rope(g);
      if (g.state === "playing" || g.state === "paused") this.spider(g);
    }
    this.popups(g);
    this.aimMark(g);
    this.snapMark(g);
    ctx.restore();

    this.speedLines(g, T);
    this.dangerArrows(g);
    this.ambient(g, T);
  }

  /** red chevrons at the screen edge for hazards about to arrive */
  private dangerArrows(g: Game) {
    if (g.state !== "playing") return;
    const { ctx } = this;
    const p = g.player;
    const seen: { y: number; d: number }[] = [];
    g.world.eachNear(p.x + 420, (o) => {
      if (
        o.kind !== "stal" &&
        o.kind !== "saw" &&
        o.kind !== "spire" &&
        o.kind !== "fire" &&
        o.kind !== "drone" &&
        o.kind !== "fish"
      )
        return;
      const dx = o.x - p.x;
      if (dx < 40 || dx > 900) return;
      const oy =
        o.kind === "stal"
          ? o.y + o.len * 0.6
          : o.kind === "spire"
            ? o.tip + 40
            : o.kind === "fire"
              ? o.y + o.h
              : o.y;
      const scrX = o.x - g.cam.x;
      if (scrX < g.vw - 140) return; // only warn for off/near-edge hazards
      seen.push({ y: oy - g.cam.y, d: dx });
    });
    if (seen.length === 0) return;
    const pulse = 0.45 + 0.35 * Math.sin(g.time * 8);
    for (const s of seen.slice(0, 3)) {
      const y = clamp(s.y, 56, g.vh - 56);
      const x = g.vw - 30;
      const near = clamp(1 - s.d / 900, 0, 1);
      ctx.globalAlpha = pulse * (0.35 + near * 0.65);
      ctx.strokeStyle = "#ff4d6a";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let k = 0; k < 2; k++) {
        const cx = x - 11 + k * 11 + Math.sin(g.time * 8) * 2;
        ctx.beginPath();
        ctx.moveTo(cx - 5, y - 9);
        ctx.lineTo(cx + 3, y);
        ctx.lineTo(cx - 5, y + 9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- background ---------------- */

  private sky(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, T.sky[0]);
    grad.addColorStop(0.42, T.sky[1]);
    grad.addColorStop(0.72, T.sky[2]);
    grad.addColorStop(1, T.sky[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // light pollution / bioluminescent glow on the horizon
    const gg = ctx.createLinearGradient(0, h * 0.55, 0, h);
    gg.addColorStop(0, "rgba(0,0,0,0)");
    gg.addColorStop(1, T.glow);
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // the big body in the sky
    if (T.orb === "none") {
      this.starsField(g, w, h, T);
      return;
    }
    const mx = w * 0.78;
    const my = h * 0.15 + Math.sin(g.cam.y * 0.0004) * 8;
    const col =
      T.orb === "moon" ? "#eaf0ff" : T.orb === "sun" ? "#ffe9a8" : T.orb === "sun2" ? "#ffd08a" : "#ff9d5c";
    const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 190);
    mg.addColorStop(0, T.orb === "eclipse" ? "rgba(255,120,60,0.35)" : "rgba(200,220,255,0.22)");
    mg.addColorStop(1, "rgba(200,220,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 200, my - 200, 400, 400);
    if (T.orb === "eclipse") {
      ctx.fillStyle = "rgba(255,140,70,0.85)";
      ctx.beginPath();
      ctx.arc(mx, my, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#170609";
      ctx.beginPath();
      ctx.arc(mx - 9, my - 3, 30, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(mx, my, T.orb === "sun" || T.orb === "sun2" ? 40 : 24, 0, Math.PI * 2);
      ctx.fill();
      if (T.orb === "moon") {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#9fb2e8";
        ctx.beginPath();
        ctx.arc(mx - 7, my - 4, 5.5, 0, Math.PI * 2);
        ctx.arc(mx + 6, my + 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.starsField(g, w, h, T, T.orb === "sun" ? 0.25 : 1);
  }

  /** twinkling star field / drifting plankton */
  private starsField(g: Game, w: number, h: number, T: Theme, alpha = 1) {
    const { ctx } = this;
    const n = T.ambient === "stars" ? 110 : 70;
    for (let i = 0; i < n; i++) {
      const sx = wrap(hash(i * 3.17) * 2200 - g.cam.x * 0.04, w + 40) - 20;
      const sy = hash(i * 7.71 + 1.3) * h * 0.4;
      const tw = 0.25 + 0.6 * Math.abs(Math.sin(g.time * (0.6 + hash(i) * 1.4) + i));
      ctx.globalAlpha = tw * (0.25 + hash(i + 9) * 0.6) * alpha;
      ctx.fillStyle = T.ambient === "bubbles" ? "#bff4ff" : "#dbe5ff";
      ctx.fillRect(sx, sy, hash(i * 1.7) > 0.85 ? 2 : 1.2, 1.4);
    }
    ctx.globalAlpha = 1;

    if (T.id === "space" || T.id === "neon") {
      // drifting planet / hovering ad blimp
      const bx = w * 0.22 + Math.sin(g.time * 0.06) * 30;
      const by = h * 0.2 + Math.cos(g.time * 0.05) * 14;
      if (T.id === "space") {
        const pg = ctx.createRadialGradient(bx, by, 6, bx, by, 70);
        pg.addColorStop(0, "rgba(200,170,255,0.5)");
        pg.addColorStop(1, "rgba(120,80,255,0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(bx, by, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6a49c9";
        ctx.beginPath();
        ctx.arc(bx, by, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(220,190,255,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(bx, by, 42, 10, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        this.rrect(bx - 34, by - 13, 68, 26, 12);
        ctx.fillStyle = "rgba(30,6,44,0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,90,214,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,120,230,${(0.5 + 0.5 * Math.sin(g.time * 3)).toFixed(2)})`;
        ctx.font = '800 12px "Baloo 2", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SWING", bx, by);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }
    }

    if (T.id !== "space" && T.id !== "underwater") {
      // blinking aircraft crossing the sky
      const planeT = (g.time * 0.045) % 1;
      const px = w + 60 - planeT * (w + 160);
      const py = h * 0.12 + Math.sin(planeT * 3) * 10;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.time * 7);
      ctx.fillStyle = "#ff6b81";
      ctx.beginPath();
      ctx.arc(px, py, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** theme-flavoured horizon decor: cacti, pines, lava rocks, kelp, billboards */
  private deco(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    if (T.deco === "skyline" || T.deco === "planets") return;
    const par = 0.34;
    const step = 150;
    const off = g.cam.x * par;
    const base = h * 0.94;
    const i0 = Math.floor(off / step) - 1;
    const i1 = i0 + Math.ceil(w / step) + 2;
    for (let i = i0; i <= i1; i++) {
      const x = i * step - off;
      const r = hash(i * 5.11 + 3.3);
      const r2 = hash(i * 2.77 + 8.1);
      const scale = 0.7 + r * 0.6;
      if (T.deco === "cacti") {
        ctx.strokeStyle = "rgba(40,70,40,0.9)";
        ctx.lineWidth = 9 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, base - 70 * scale);
        ctx.moveTo(x, base - 40 * scale);
        ctx.lineTo(x + 24 * scale, base - 58 * scale);
        ctx.stroke();
      } else if (T.deco === "pines") {
        ctx.fillStyle = "rgba(12,40,48,0.9)";
        const ph = 110 * scale;
        ctx.beginPath();
        ctx.moveTo(x - 26 * scale, base);
        ctx.lineTo(x, base - ph);
        ctx.lineTo(x + 26 * scale, base);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(120,220,230,0.35)";
        ctx.beginPath();
        ctx.moveTo(x - 12 * scale, base - ph * 0.45);
        ctx.lineTo(x, base - ph);
        ctx.lineTo(x + 3 * scale, base - ph * 0.45);
        ctx.closePath();
        ctx.fill();
      } else if (T.deco === "lavarocks") {
        ctx.fillStyle = "rgba(28,8,10,0.95)";
        ctx.beginPath();
        ctx.moveTo(x - 40 * scale, base);
        ctx.lineTo(x - 12 * scale, base - 66 * scale);
        ctx.lineTo(x + 16 * scale, base - 44 * scale);
        ctx.lineTo(x + 44 * scale, base);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,110,50,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 12 * scale, base - 66 * scale);
        ctx.lineTo(x + 2 * scale, base - 20 * scale);
        ctx.stroke();
      } else if (T.deco === "kelp") {
        ctx.strokeStyle = `rgba(80,${180 + Math.floor(r * 60)},${140 + Math.floor(r2 * 60)},0.55)`;
        ctx.lineWidth = 7 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, base);
        for (let k = 1; k <= 4; k++) {
          const sway = Math.sin(g.time * 0.9 + i + k * 0.7) * 12;
          ctx.lineTo(x + sway, base - k * 34 * scale);
        }
        ctx.stroke();
      } else if (T.deco === "billboards") {
        const bh = 90 * scale;
        ctx.fillStyle = "rgba(18,4,34,0.9)";
        ctx.fillRect(x - 28 * scale, base - bh, 56 * scale, bh * 0.7);
        ctx.strokeStyle = `rgba(255,${Math.floor(90 + r * 100)},214,0.7)`;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(g.time * 2 + i));
        ctx.strokeRect(x - 28 * scale, base - bh, 56 * scale, bh * 0.7);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** parallax Manhattan skylines */
  private skyline(g: Game, w: number, h: number, T: Theme) {
    const { ctx } = this;
    const layers = [
      { par: 0.07, base: 0.74, hMin: 90, hMax: 300, col: T.far1, win: 0.1, step: 54, seed: 1 },
      { par: 0.16, base: 0.82, hMin: 110, hMax: 360, col: T.far2, win: 0.16, step: 68, seed: 2 },
      { par: 0.3, base: 0.92, hMin: 130, hMax: 420, col: T.far3, win: 0.22, step: 86, seed: 3 },
    ];
    const warmWin = T.glass === "warm" ? "#ffd79a" : T.glass === "green" ? "#d6ff9a" : T.glass === "neon" ? "#ff8ae8" : "#8fd4ff";
    const coolWin = T.glass === "ice" ? "#bff4ff" : T.glass === "void" ? "#c3b0ff" : "#8fd4ff";
    for (const L of layers) {
      const off = g.cam.x * L.par;
      const i0 = Math.floor(off / L.step) - 1;
      const i1 = i0 + Math.ceil(w / L.step) + 3;
      for (let i = i0; i <= i1; i++) {
        const r = hash(i * 9.17 + L.seed * 31.7);
        const r2 = hash(i * 4.31 + L.seed * 13.1);
        const bw = L.step * (0.68 + r2 * 0.3);
        const bh = L.hMin + r * (L.hMax - L.hMin);
        const bx = i * L.step - off;
        const by = h * L.base - bh;
        ctx.fillStyle = L.col;
        ctx.fillRect(bx, by, bw, bh + 40);
        // rooftop crown
        if (r > 0.72) {
          ctx.fillRect(bx + bw * 0.4, by - 16 - r2 * 22, 3.5, 16 + r2 * 22);
          ctx.fillStyle = "#ff6b81";
          ctx.globalAlpha = 0.4 + 0.5 * Math.sin(g.time * 3 + i);
          ctx.fillRect(bx + bw * 0.4 - 1.2, by - 19 - r2 * 22, 6, 4);
          ctx.globalAlpha = 1;
          ctx.fillStyle = L.col;
        }
        // windows — two flat passes keep the state changes cheap
        const cols = Math.max(1, Math.floor(bw / 13));
        const rows = Math.min(16, Math.max(1, Math.floor(bh / 17)));
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass === 0 ? warmWin : coolWin;
          ctx.globalAlpha = pass === 0 ? 0.6 : 0.45;
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              const wr = hash(i * 77.7 + cx * 13.3 + cy * 5.7 + L.seed);
              if (wr > L.win) continue;
              const warm = wr > L.win * 0.55;
              if ((pass === 0) !== warm) continue;
              ctx.fillRect(bx + 5 + cx * 13, by + 7 + cy * 17, 5, 7);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    // low haze over the far skyline
    const hz = ctx.createLinearGradient(0, h * 0.6, 0, h);
    hz.addColorStop(0, "rgba(0,0,0,0)");
    hz.addColorStop(1, T.glow);
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  }

  /* ---------------- upper city (the web-anchor canopy) ---------------- */

  private upperCity(g: Game, T: Theme) {
    const x0 = g.cam.x - 90;
    const x1 = g.cam.x + g.vw + 90;
    const top = g.cam.y - 360;
    const step = 16;
    let runStart = -1;
    for (let x = x0; x <= x1 + step; x += step) {
      const solid = x <= x1 && g.world.ceilSolid(x);
      if (solid && runStart < 0) runStart = x;
      if (!solid && runStart >= 0) {
        this.cityRun(g, runStart, Math.min(x, x1), top, T);
        runStart = -1;
      }
    }
  }

  private cityRun(g: Game, xa: number, xb: number, top: number, T: Theme) {
    const { ctx } = this;
    const w = g.world;
    const edge = (x: number) => w.ceilY(x);

    // solid mass
    ctx.beginPath();
    ctx.moveTo(xa, top);
    ctx.lineTo(xa, edge(xa));
    for (let x = xa + 14; x < xb; x += 14) ctx.lineTo(x, edge(x));
    ctx.lineTo(xb, edge(xb));
    ctx.lineTo(xb, top);
    ctx.closePath();
    ctx.fillStyle = T.ceiling;
    ctx.fill();

    // canopy foliage / ice crystals / coral on the underside for organic themes
    if (T.deco === "kelp" || T.spike === "vine" || T.spike === "coral") {
      for (let x = Math.ceil(xa / 46) * 46; x < xb; x += 46) {
        const ey = edge(x);
        const r = hash(x * 0.77);
        const len = 12 + r * 26;
        ctx.strokeStyle =
          T.spike === "coral" ? "rgba(90,230,220,0.45)" : "rgba(80,190,90,0.5)";
        ctx.lineWidth = 3.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, ey);
        ctx.quadraticCurveTo(x + 6, ey + len * 0.6, x + (r - 0.5) * 10, ey + len);
        ctx.stroke();
      }
    } else if (T.spike === "ice") {
      for (let x = Math.ceil(xa / 52) * 52; x < xb; x += 52) {
        const ey = edge(x);
        const r = hash(x * 0.61);
        ctx.fillStyle = "rgba(180,240,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(x - 6, ey);
        ctx.lineTo(x, ey + 10 + r * 14);
        ctx.lineTo(x + 6, ey);
        ctx.closePath();
        ctx.fill();
      }
    }

    // lit windows on the facade above the ledge
    const cs = 26;
    const startC = Math.ceil(xa / cs) * cs;
    for (let x = startC; x < xb; x += cs) {
      const ey = edge(x);
      for (let row = 0; row < 7; row++) {
        const wy = ey - 30 - row * 30;
        if (wy < top + 14) break;
        const wr = hash(x * 0.37 + row * 7.13);
        if (wr > 0.46) continue;
        const flick = hash(Math.floor(g.time * 0.5) + x * 0.11 + row) > 0.03;
        if (!flick) continue;
        ctx.fillStyle =
          T.glass === "warm"
            ? wr > 0.26
              ? "#ffd79a"
              : "#7fe0ff"
            : T.glass === "green"
              ? wr > 0.26
                ? "#d8ff9a"
                : "#8fffd8"
              : T.glass === "neon"
                ? wr > 0.26
                  ? "#ff8ae8"
                  : "#8fd8ff"
                : T.glass === "ice"
                  ? "#bff4ff"
                  : T.glass === "void"
                    ? wr > 0.26
                      ? "#c3b0ff"
                      : "#8fa0ff"
                    : "#cfe9ff";
        ctx.globalAlpha = 0.5 + hash(x + row * 3) * 0.45;
        ctx.fillRect(x, wy, 11, 14);
        ctx.globalAlpha = 0.1;
        ctx.fillRect(x - 3, wy - 3, 17, 20);
        ctx.globalAlpha = 1;
      }
    }

    // ledge underside details — AC units, pipes, satellite dishes
    for (let x = Math.ceil(xa / 72) * 72; x < xb; x += 72) {
      const hh = hash(x * 0.511);
      if (hh < 0.4) continue;
      const ey = edge(x);
      ctx.fillStyle = "#070a1a";
      if (hh > 0.78) {
        // AC box
        ctx.fillRect(x - 9, ey, 18, 11);
        ctx.fillStyle = "#1b2550";
        ctx.fillRect(x - 6, ey + 2, 12, 7);
      } else {
        // pipe
        ctx.fillRect(x - 2.5, ey, 5, 9 + hh * 12);
      }
    }

    // neon trim along the ledge
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(xa, edge(xa));
      for (let x = xa + 12; x < xb; x += 12) ctx.lineTo(x, edge(x));
      ctx.lineTo(xb, edge(xb));
    };
    trace();
    ctx.strokeStyle = T.trim;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalAlpha = 1;
    trace();
    ctx.strokeStyle = T.trim;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  /* ---------------- street level (deadly ground) ---------------- */

  private street(g: Game, T: Theme) {
    const { ctx } = this;
    const x0 = g.cam.x - 90;
    const x1 = g.cam.x + g.vw + 90;
    const bottom = g.cam.y + g.vh + 420;
    const surf = (x: number) => g.world.lavaY(x);

    // glow haze rising from the avenue
    ctx.beginPath();
    ctx.moveTo(x0, surf(x0) - 150);
    for (let x = x0 + 20; x <= x1; x += 20) ctx.lineTo(x, surf(x) - 150);
    for (let x = x1; x >= x0; x -= 20) ctx.lineTo(x, surf(x));
    ctx.closePath();
    const hazeTop = surf((x0 + x1) / 2) - 150;
    const hz = ctx.createLinearGradient(0, hazeTop, 0, hazeTop + 150);
    hz.addColorStop(0, "rgba(0,0,0,0)");
    hz.addColorStop(1, T.glow);
    ctx.fillStyle = hz;
    ctx.fill();

    // asphalt
    ctx.beginPath();
    ctx.moveTo(x0, surf(x0));
    for (let x = x0 + 16; x <= x1; x += 16) ctx.lineTo(x, surf(x));
    ctx.lineTo(x1, bottom);
    ctx.lineTo(x0, bottom);
    ctx.closePath();
    const gTop = hazeTop + 140;
    const lg = ctx.createLinearGradient(0, gTop, 0, gTop + 320);
    lg.addColorStop(0, T.ground[0]);
    lg.addColorStop(0.2, T.ground[1]);
    lg.addColorStop(1, T.ground[2]);
    ctx.fillStyle = lg;
    ctx.fill();

    // sidewalk line
    ctx.beginPath();
    ctx.moveTo(x0, surf(x0));
    for (let x = x0 + 12; x <= x1; x += 12) ctx.lineTo(x, surf(x));
    ctx.strokeStyle = T.groundLine;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = T.groundLine;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // thermal updraft shimmer — shows the glide rescue zone above the street
    ctx.strokeStyle = T.ambient === "embers" || T.ambient === "dust" ? "rgba(255,210,160,0.18)" : "rgba(160,220,255,0.16)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const ux = x0 + ((i * 137) % (x1 - x0));
      const phase = (g.time * 0.5 + i * 0.37) % 1;
      const uy = surf(ux) - phase * 300;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.5;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.quadraticCurveTo(ux + 9, uy - 16, ux, uy - 32);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // street lamps
    for (let x = Math.ceil(x0 / 170) * 170; x < x1; x += 170) {
      const sy = surf(x);
      ctx.strokeStyle = "#1b1630";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x, sy - 44);
      ctx.lineTo(x + 14, sy - 50);
      ctx.stroke();
      const lampG = ctx.createRadialGradient(x + 16, sy - 50, 2, x + 16, sy - 50, 54);
      lampG.addColorStop(0, "rgba(255,196,120,0.5)");
      lampG.addColorStop(1, "rgba(255,196,120,0)");
      ctx.fillStyle = lampG;
      ctx.beginPath();
      ctx.arc(x + 16, sy - 50, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd79a";
      ctx.beginPath();
      ctx.arc(x + 16, sy - 50, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // traffic — headlight and taillight streaks
    for (let i = 0; i < 16; i++) {
      const dirR = hash(i * 7.7) > 0.5;
      const spd = 150 + hash(i * 3.3) * 170;
      const span = 2400;
      const base = hash(i * 11.1) * span;
      const cx = dirR
        ? x0 + wrap(base + g.time * spd - x0, span)
        : x0 + wrap(base - g.time * spd - x0, span);
      if (cx < x0 - 40 || cx > x1 + 40) continue;
      const cy = surf(cx) - 7 - (i % 3) * 5;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = dirR ? "#fff3d0" : "#ff5a6e";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 13, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.ellipse(cx - (dirR ? 16 : -16), cy, 26, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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
      /* ---- scaffold / billboard platform (safe, landable) ---- */
      case "plat": {
        const x = o.x - o.w / 2;
        const y = o.y - o.h / 2;
        if (o.pod) {
          // floating web pod — always webbable, bobbing gently
          const py = o.y + Math.sin(t * 1.6 + o.x * 0.02) * 3;
          const cy = py - 14;
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = T.trim;
          ctx.beginPath();
          ctx.arc(o.x, cy, 30 + Math.sin(t * 2.6 + o.x) * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // strut down to the deck
          ctx.strokeStyle = "rgba(200,230,255,0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(o.x - 12, cy + 8);
          ctx.lineTo(x + 6, o.y - o.h / 2 + 3);
          ctx.moveTo(o.x + 12, cy + 8);
          ctx.lineTo(x + o.w - 6, o.y - o.h / 2 + 3);
          ctx.stroke();
          // balloon skin
          ctx.beginPath();
          ctx.ellipse(o.x, cy, 22, 18, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#131a3d";
          ctx.fill();
          ctx.strokeStyle = T.trim;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3 + o.x);
          ctx.fillStyle = T.trim;
          ctx.beginPath();
          ctx.ellipse(o.x - 5, cy - 5, 7, 5, -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          // deck
          this.rrect(x, py - o.h / 2, o.w, o.h, 6);
          ctx.fillStyle = "#1b2450";
          ctx.fill();
          ctx.strokeStyle = "rgba(150,200,255,0.55)";
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.strokeStyle = T.trim;
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(x + 7, py - o.h / 2 + 1.4);
          ctx.lineTo(x + o.w - 7, py - o.h / 2 + 1.4);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        // support legs
        ctx.strokeStyle = "#141a3c";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 14, y + o.h);
        ctx.lineTo(x + 20, y + o.h + 22);
        ctx.moveTo(x + o.w - 14, y + o.h);
        ctx.lineTo(x + o.w - 20, y + o.h + 22);
        ctx.stroke();
        // deck
        this.rrect(x, y + 4, o.w, o.h, 7);
        ctx.fillStyle = "#070b1e";
        ctx.fill();
        this.rrect(x, y, o.w, o.h, 7);
        ctx.fillStyle = T.spike === "vine" ? "#22402a" : T.spike === "coral" ? "#14454a" : T.spike === "ice" ? "#1c3a52" : T.spike === "rock" ? "#3a1f22" : "#222b5c";
        ctx.fill();
        ctx.strokeStyle = "rgba(120,140,255,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        // neon sign strip
        ctx.strokeStyle = T.trim;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 1.5);
        ctx.lineTo(x + o.w - 8, y + 1.5);
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 9;
        ctx.stroke();
        ctx.globalAlpha = 1;
        // marquee bulbs
        const n = Math.max(2, Math.floor(o.w / 34));
        for (let k = 0; k < n; k++) {
          const bx = x + 12 + k * ((o.w - 24) / (n - 1 || 1));
          const on = Math.sin(t * 4 + k * 1.2) > -0.2;
          ctx.fillStyle = on ? "#ffe6a8" : "#3a3f66";
          ctx.beginPath();
          ctx.arc(bx, y + o.h - 4, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      /* ---- skyscraper rising from the street (deadly) ---- */
      case "spire": {
        const hgt = o.base - o.tip;
        const topW = Math.max(14, o.w * 0.55);
        const lx = o.x - o.w / 2;
        const tx = o.x - topW / 2;
        ctx.beginPath();
        ctx.moveTo(lx, o.base);
        ctx.lineTo(tx, o.tip);
        ctx.lineTo(tx + topW, o.tip);
        ctx.lineTo(lx + o.w, o.base);
        ctx.closePath();
        const bg = ctx.createLinearGradient(lx, 0, lx + o.w, 0);
        const base3: [string, string, string] =
          T.spike === "vine"
            ? ["#1b3a24", "#255133", "#132a1c"]
            : T.spike === "coral"
              ? ["#12454a", "#1a6169", "#0d333a"]
              : T.spike === "rock"
                ? ["#3a1416", "#55201d", "#260c0e"]
                : T.spike === "ice"
                  ? ["#1b3c56", "#2a5f7c", "#14293c"]
                  : T.spike === "crystal"
                    ? ["#2c1c5e", "#40298a", "#1d1245"]
                    : ["#2a3570", "#36437f", "#202a5c"];
        bg.addColorStop(0, base3[0]);
        bg.addColorStop(0.5, base3[1]);
        bg.addColorStop(1, base3[2]);
        ctx.fillStyle = bg;
        ctx.fill();
        // danger edge — a hot rim so the silhouette always reads
        ctx.strokeStyle = "rgba(255,77,106,0.85)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,180,200,0.45)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // warning chevrons running up the face
        ctx.fillStyle = "rgba(255,77,106,0.5)";
        for (let s = 0; s < 3; s++) {
          const cy = o.base - 26 - s * 34;
          if (cy < o.tip + 20) break;
          ctx.beginPath();
          ctx.moveTo(o.x - 9, cy);
          ctx.lineTo(o.x, cy - 9);
          ctx.lineTo(o.x + 9, cy);
          ctx.lineTo(o.x, cy - 3.5);
          ctx.closePath();
          ctx.fill();
        }
        // windows
        const rows = Math.floor(hgt / 26);
        for (let r = 1; r < rows; r++) {
          const fy = o.base - r * 26;
          const f = (o.base - fy) / hgt;
          const hw = lerp(o.w, topW, f) / 2 - 6;
          if (hw < 6) continue;
          for (let c = -1; c <= 1; c++) {
            const wx = o.x + c * (hw * 0.62);
            const wr = hash(o.x * 0.21 + r * 3.7 + c * 11.1);
            if (wr > 0.55) continue;
            ctx.fillStyle = wr > 0.3 ? T.groundLine : T.trim;
            ctx.globalAlpha = 0.45 + hash(r + c * 5 + o.x) * 0.4;
            ctx.fillRect(wx - 4, fy, 8, 11);
            ctx.globalAlpha = 1;
          }
        }
        // antenna + hazard light
        ctx.strokeStyle = "#2a3366";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(o.x, o.tip);
        ctx.lineTo(o.x, o.tip - 26);
        ctx.stroke();
        const blink = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + o.x));
        ctx.globalAlpha = blink;
        ctx.fillStyle = "#ff4d6a";
        ctx.beginPath();
        ctx.arc(o.x, o.tip - 29, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = blink * 0.3;
        ctx.beginPath();
        ctx.arc(o.x, o.tip - 29, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      /* ---- hanging construction girder (deadly) ---- */
      case "stal": {
        const tipX = o.x + (hash(o.x * 1.3) - 0.5) * 10;
        const tipY = o.y + o.len;
        // danger glow so it never blends into the dark facade
        const gl = ctx.createLinearGradient(o.x, o.y, o.x, tipY + 10);
        gl.addColorStop(0, "rgba(255,77,106,0)");
        gl.addColorStop(1, "rgba(255,77,106,0.3)");
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.moveTo(o.x - o.w / 2 - 9, o.y - 6);
        ctx.lineTo(o.x + o.w / 2 + 9, o.y - 6);
        ctx.lineTo(tipX + 11, tipY + 9);
        ctx.lineTo(tipX - 11, tipY + 9);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(o.x - o.w / 2, o.y - 6);
        ctx.lineTo(o.x + o.w / 2, o.y - 6);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fillStyle =
          T.spike === "vine"
            ? "#1d5228"
            : T.spike === "ice"
              ? "rgba(180,240,255,0.85)"
              : T.spike === "coral"
                ? "#2b7f7a"
                : T.spike === "cactus"
                  ? "#2f5a2a"
                  : T.spike === "crystal"
                    ? "#4b2f8f"
                    : T.spike === "rock"
                      ? "#4a1b18"
                      : "#39406e";
        ctx.fill();
        ctx.strokeStyle = T.spike === "city" ? "#ffc247" : T.trim;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        // lattice bracing
        ctx.strokeStyle = "rgba(190,205,255,0.5)";
        ctx.lineWidth = 1.3;
        const segs = Math.max(2, Math.floor(o.len / 26));
        for (let s = 0; s < segs; s++) {
          const f0 = s / segs;
          const f1 = (s + 1) / segs;
          const y0 = lerp(o.y, tipY, f0);
          const y1 = lerp(o.y, tipY, f1);
          const w0 = (o.w / 2) * (1 - f0);
          const w1 = (o.w / 2) * (1 - f1);
          const cx0 = lerp(o.x, tipX, f0);
          const cx1 = lerp(o.x, tipX, f1);
          ctx.beginPath();
          ctx.moveTo(cx0 - w0, y0);
          ctx.lineTo(cx1 + w1, y1);
          ctx.moveTo(cx0 + w0, y0);
          ctx.lineTo(cx1 - w1, y1);
          ctx.stroke();
        }
        // theme garnish: leaves / crystals
        if (T.spike === "vine" || T.spike === "coral" || T.spike === "crystal") {
          ctx.fillStyle =
            T.spike === "crystal" ? "rgba(190,150,255,0.55)" : "rgba(150,255,140,0.5)";
          const n = Math.max(2, Math.floor(o.len / 30));
          for (let k = 0; k < n; k++) {
            const f = (k + 0.5) / n;
            const lx = lerp(o.x, tipX, f);
            const ly = lerp(o.y, tipY, f);
            const side = k % 2 === 0 ? 1 : -1;
            ctx.beginPath();
            ctx.ellipse(lx + side * (o.w * 0.5) * (1 - f) * 0.9, ly, 7 - f * 3, 3.4, side * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // hazard stripes along the whole beam
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(o.x - o.w / 2, o.y - 6);
        ctx.lineTo(o.x + o.w / 2, o.y - 6);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = T.spike === "city" ? "#ffc247" : "rgba(255,255,255,0.14)";
        ctx.globalAlpha = 0.9;
        for (let s = -1; s < o.len / 16 + 2; s++) {
          ctx.save();
          ctx.translate(o.x, o.y + s * 16);
          ctx.rotate(-0.5);
          ctx.fillRect(-o.w, 0, o.w * 2, 6);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        // warning light at the tip
        ctx.fillStyle = "#ff5470";
        ctx.beginPath();
        ctx.arc(tipX, tipY - 2, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 5 + o.x);
        ctx.beginPath();
        ctx.arc(tipX, tipY - 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      /* ---- patrol drone (deadly) ---- */
      case "saw": {
        const sy = o.y + Math.sin(t * 1.3 + o.ph) * o.bob;
        const r = o.r;
        // pulsing danger halo + hit-radius ring
        const hp = 0.2 + 0.12 * Math.sin(t * 5 + o.ph);
        ctx.globalAlpha = hp;
        ctx.fillStyle = "#ff4656";
        ctx.beginPath();
        ctx.arc(o.x, sy, r + 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 5 + o.ph);
        ctx.strokeStyle = "#ff4d6a";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(o.x, sy, r + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        // arms + rotors
        ctx.strokeStyle = "#2b3366";
        ctx.lineWidth = 3.4;
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + (k * Math.PI) / 2;
          const ax = o.x + Math.cos(a) * r;
          const ay = sy + Math.sin(a) * r * 0.72;
          ctx.beginPath();
          ctx.moveTo(o.x, sy);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.save();
          ctx.translate(ax, ay);
          ctx.scale(1, 0.34);
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "#9db0ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 9 + Math.sin(t * 30 + k) * 1.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
          ctx.strokeStyle = "#2b3366";
          ctx.lineWidth = 3.4;
        }
        // body
        this.rrect(o.x - r * 0.62, sy - r * 0.42, r * 1.24, r * 0.84, 7);
        ctx.fillStyle = "#39406b";
        ctx.fill();
        ctx.strokeStyle = "#8fa0ff";
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // scanning eye
        const look = Math.sin(t * 2 + o.ph) * 3;
        ctx.fillStyle = "#ff4656";
        ctx.beginPath();
        ctx.arc(o.x + look, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd4d9";
        ctx.beginPath();
        ctx.arc(o.x + look - 1.4, sy - 1.4, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // scan beam
        ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 4);
        ctx.fillStyle = "#ff4656";
        ctx.beginPath();
        ctx.moveTo(o.x + look, sy + 4);
        ctx.lineTo(o.x + look - 22, sy + 54);
        ctx.lineTo(o.x + look + 22, sy + 54);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      /* ---- air current (push zone) ---- */
      case "wind": {
        const x0 = o.x - o.w / 2;
        const y0 = o.y - o.h / 2;
        const ang = Math.atan2(o.vy, o.vx);
        ctx.save();
        this.rrect(x0, y0, o.w, o.h, 26);
        ctx.clip();
        const wg = ctx.createLinearGradient(
          o.x - Math.cos(ang) * o.w * 0.5,
          o.y - Math.sin(ang) * o.h * 0.5,
          o.x + Math.cos(ang) * o.w * 0.5,
          o.y + Math.sin(ang) * o.h * 0.5,
        );
        wg.addColorStop(0, "rgba(190,240,255,0.03)");
        wg.addColorStop(1, `rgba(200,245,255,0.13)`);
        ctx.fillStyle = wg;
        ctx.fillRect(x0, y0, o.w, o.h);
        // streaking flow lines along the direction
        const spd = Math.hypot(o.vx, o.vy);
        const ux = o.vx / (spd || 1);
        const uy = o.vy / (spd || 1);
        ctx.lineCap = "round";
        const lines = 14;
        for (let k = 0; k < lines; k++) {
          const rr = hash(k * 7.3 + Math.floor(o.x));
          const off = (rr - 0.5) * (Math.abs(o.w * uy) + Math.abs(o.h * ux) + 20);
          const span = (Math.abs(o.w * ux) + Math.abs(o.h * uy)) * 0.5;
          const phase = ((t * (0.35 + rr * 0.4) + rr) % 1) - 0.5;
          const cx = o.x + ux * phase * span * 2 - uy * off;
          const cy = o.y + uy * phase * span * 2 + ux * off;
          const alpha = 0.1 + 0.3 * Math.sin(Math.PI * (phase + 0.5));
          ctx.strokeStyle = `rgba(210,248,255,${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.4 + rr * 1.6;
          ctx.beginPath();
          ctx.moveTo(cx - ux * 22, cy - uy * 22);
          ctx.lineTo(cx + ux * 22, cy + uy * 22);
          ctx.stroke();
        }
        ctx.restore();
        // soft boundary + arrow heads
        this.rrect(x0, y0, o.w, o.h, 26);
        ctx.strokeStyle = `rgba(190,240,255,${(0.2 + 0.14 * Math.sin(t * 2 + o.x)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 12]);
        ctx.lineDashOffset = -t * 40;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(ang);
        for (let k = 0; k < 2; k++) {
          const ax = -14 + k * 26 + Math.sin(t * 4 + k) * 4;
          ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5 + k * 2);
          ctx.fillStyle = "#dff6ff";
          ctx.beginPath();
          ctx.moveTo(ax - 9, -8);
          ctx.lineTo(ax + 5, 0);
          ctx.lineTo(ax - 9, 8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        break;
      }

      /* ---- burning roof line (deadly) ---- */
      case "fire": {
        const x0 = o.x - o.w / 2;
        const depth = o.h + 26;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 - 8, o.y - 6, o.w + 16, depth + 12);
        ctx.clip();
        // scorched roof
        ctx.fillStyle = "rgba(24,6,4,0.9)";
        ctx.fillRect(x0, o.y - 4, o.w, 10);
        // flames licking down into the corridor
        for (let k = 0; k < 10; k++) {
          const fx = x0 + (k + 0.5) * (o.w / 10);
          const hgt = depth * (0.55 + 0.5 * Math.abs(Math.sin(t * 6 + k * 1.7 + o.x * 0.05)));
          const grad2 = ctx.createLinearGradient(0, o.y, 0, o.y + hgt + 8);
          grad2.addColorStop(0, "rgba(255,235,150,0.95)");
          grad2.addColorStop(0.45, "rgba(255,130,40,0.8)");
          grad2.addColorStop(1, "rgba(255,60,30,0)");
          ctx.fillStyle = grad2;
          ctx.beginPath();
          ctx.moveTo(fx - 10, o.y - 2);
          ctx.quadraticCurveTo(fx - 6, o.y + hgt * 0.6, fx + Math.sin(t * 5 + k) * 4, o.y + hgt + 8);
          ctx.quadraticCurveTo(fx + 7, o.y + hgt * 0.5, fx + 10, o.y - 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        // heat glow in the corridor below
        const fg = ctx.createRadialGradient(o.x, o.y + 14, 6, o.x, o.y + 14, o.w * 0.85);
        fg.addColorStop(0, "rgba(255,140,60,0.3)");
        fg.addColorStop(1, "rgba(255,140,60,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(o.x, o.y + 14, o.w * 0.85, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.45) {
          g.parts.spawn({
            x: o.x + (Math.random() - 0.5) * o.w,
            y: o.y + 8,
            vx: (Math.random() - 0.5) * 40,
            vy: 60 + Math.random() * 80,
            life: 0.6 + Math.random() * 0.5,
            size: 2 + Math.random() * 3,
            color: "rgba(255,170,70,0.8)",
            grav: 60,
            drag: 0.5,
          });
        }
        break;
      }

      /* ---- reef fish (deadly, drifting) ---- */
      case "fish": {
        const fx = o.x + Math.sin(t * 0.55 + o.ph) * 60;
        const fy = o.y + Math.sin(t * 1.1 + o.ph) * o.bob;
        const dir = Math.cos(t * 0.55 + o.ph) >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(dir, 1);
        // warning halo
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,120,140,0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = -t * 24;
        ctx.beginPath();
        ctx.arc(0, 0, o.r + 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // tail
        ctx.fillStyle = "#ff7d4d";
        ctx.beginPath();
        ctx.moveTo(-o.r * 0.7, 0);
        ctx.lineTo(-o.r * 1.7, -o.r * 0.8);
        ctx.lineTo(-o.r * 1.5, o.r * 0.8);
        ctx.closePath();
        ctx.fill();
        // body
        ctx.beginPath();
        ctx.ellipse(0, 0, o.r, o.r * 0.66, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ffb347";
        ctx.fill();
        ctx.strokeStyle = "rgba(90,30,10,0.5)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // stripes + fin
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.ellipse(k * o.r * 0.38, 0, 2.4, o.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#ff7d4d";
        ctx.beginPath();
        ctx.moveTo(-2, -o.r * 0.6);
        ctx.lineTo(4, -o.r * 1.2);
        ctx.lineTo(9, -o.r * 0.5);
        ctx.closePath();
        ctx.fill();
        // eye
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(o.r * 0.52, -o.r * 0.16, o.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#20161a";
        ctx.beginPath();
        ctx.arc(o.r * 0.56, -o.r * 0.16, o.r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      /* ---- hunter drone (deadly, sweeps sideways) ---- */
      case "drone": {
        const dx = o.x + Math.sin(t * 0.7 + o.ph) * 78;
        const dy = o.y + Math.sin(t * 1.4 + o.ph) * o.bob;
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 4 + o.ph);
        ctx.fillStyle = "#ff4656";
        ctx.beginPath();
        ctx.arc(dx, dy, o.r + 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,70,86,0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 8]);
        ctx.lineDashOffset = -t * 36;
        ctx.beginPath();
        ctx.arc(dx, dy, o.r + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // rotors
        ctx.strokeStyle = "rgba(160,180,255,0.65)";
        ctx.lineWidth = 2;
        for (const s of [-1, 1]) {
          const rx = dx + s * o.r * 0.95;
          const ry = dy - o.r * 0.5;
          ctx.beginPath();
          ctx.moveTo(dx + s * o.r * 0.3, dy - o.r * 0.2);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.save();
          ctx.translate(rx, ry);
          ctx.scale(1, 0.32);
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, 10 + Math.sin(t * 34 + s) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
        }
        // hull
        this.rrect(dx - o.r * 0.7, dy - o.r * 0.5, o.r * 1.4, o.r, 8);
        ctx.fillStyle = "#2b3260";
        ctx.fill();
        ctx.strokeStyle = "#8fa0ff";
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // scanning eye + cone
        const look = Math.sin(t * 2.2 + o.ph) * 3;
        ctx.fillStyle = "#ff4656";
        ctx.beginPath();
        ctx.arc(dx + look, dy, 5.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.moveTo(dx + look, dy + 4);
        ctx.lineTo(dx + look - 26, dy + 60);
        ctx.lineTo(dx + look + 26, dy + 60);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      /* ---- the floor gate: a hole in the street ---- */
      case "portal": {
        const yy = o.y;
        // dark mouth
        ctx.beginPath();
        ctx.ellipse(o.x, yy + 6, o.r, o.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#04030c";
        ctx.fill();
        // swirling depths
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(o.x, yy + 6, o.r * 0.96, o.r * 0.4, 0, 0, Math.PI * 2);
        ctx.clip();
        for (let k = 0; k < 3; k++) {
          const rr = ((t * 0.5 + k / 3) % 1) * o.r;
          ctx.globalAlpha = 0.35 * (1 - rr / o.r);
          ctx.strokeStyle = "#ffe79a";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(o.x, yy + 6, rr, rr * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        // glowing rim
        const rim = ctx.createRadialGradient(o.x, yy + 6, o.r * 0.4, o.x, yy + 6, o.r * 1.5);
        rim.addColorStop(0, "rgba(255,231,154,0.5)");
        rim.addColorStop(1, "rgba(255,231,154,0)");
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(o.x, yy + 6, o.r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffe79a";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(o.x, yy + 6, o.r, o.r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(o.x, yy + 6, o.r * 0.82, o.r * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
        // goal beacon rising from the hole
        ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 3);
        ctx.fillStyle = "#ffe79a";
        ctx.beginPath();
        ctx.moveTo(o.x - o.r * 0.7, yy);
        ctx.lineTo(o.x - o.r * 0.28, yy - 420);
        ctx.lineTo(o.x + o.r * 0.28, yy - 420);
        ctx.lineTo(o.x + o.r * 0.7, yy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        // bouncing "dive here" chevrons
        for (let k = 0; k < 3; k++) {
          const ph = ((t * 0.9 + k / 3) % 1);
          ctx.globalAlpha = 0.75 * (1 - ph);
          ctx.strokeStyle = "#ffe79a";
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          const cyy = yy - 60 - ph * 120;
          ctx.beginPath();
          ctx.moveTo(o.x - 20, cyy - 14);
          ctx.lineTo(o.x, cyy + 6);
          ctx.lineTo(o.x + 20, cyy - 14);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.font = '800 15px "Baloo 2", sans-serif';
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,231,154,0.95)";
        ctx.fillText("LEVEL GATE", o.x, yy - 210);
        ctx.textAlign = "start";
        break;
      }

      /* ---- street pit marker ---- */
      case "dip": {
        ctx.globalAlpha = 0.5;
        const dg = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, o.w);
        dg.addColorStop(0, "rgba(255,90,60,0.5)");
        dg.addColorStop(1, "rgba(255,90,60,0)");
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.w, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 2 + o.x);
        ctx.strokeStyle = "#ff7a4d";
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 14]);
        ctx.beginPath();
        ctx.moveTo(o.x - o.w / 2, o.y - 2);
        ctx.lineTo(o.x + o.w / 2, o.y - 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        break;
      }

      /* ---- collectibles ---- */
      case "coin": {
        if (o.got) break;
        const by = o.y + Math.sin(t * 2.4 + o.x * 0.05) * 5;
        const spin = Math.abs(Math.cos(t * 3.1 + o.x * 0.02));
        const rx = 10 * (0.25 + 0.75 * spin);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#ffd23f";
        ctx.beginPath();
        ctx.arc(o.x, by, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.ellipse(o.x, by, rx, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd23f";
        ctx.fill();
        ctx.strokeStyle = "rgba(140,90,10,0.6)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(o.x, by, rx * 0.5, 5.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ff9d2e";
        ctx.fill();
        break;
      }

      case "boost": {
        if (o.used) break;
        const pulse = 1 + Math.sin(t * 4.2 + o.x * 0.05) * 0.07;
        const r0 = o.r * pulse;
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#ff5e7a";
        ctx.beginPath();
        ctx.arc(o.x, o.y, r0 + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,94,122,0.45)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#ffd7de";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#ff5e7a";
        ctx.lineWidth = 3.2;
        ctx.lineCap = "round";
        const wob2 = Math.sin(t * 6) * 1.6;
        for (let k = 0; k < 3; k++) {
          const cx = o.x - 9 + k * 9 + wob2;
          ctx.beginPath();
          ctx.moveTo(cx - 2.5, o.y - 5.5);
          ctx.lineTo(cx + 3, o.y);
          ctx.lineTo(cx - 2.5, o.y + 5.5);
          ctx.stroke();
        }
        break;
      }

      case "shield":
      case "magnet": {
        if (o.got) break;
        const isShield = o.kind === "shield";
        const col = isShield ? "#2fe0b0" : "#ff6b81";
        const oy = o.y + Math.sin(t * 2.2 + o.x * 0.04) * 5;
        const orad = o.r * (1 + Math.sin(t * 3.6 + o.x) * 0.07);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(o.x, oy, orad + 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.arc(o.x, oy, orad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(o.x - 2, oy - 2, orad * 0.62, Math.PI * 0.9, Math.PI * 1.6);
        ctx.stroke();
        if (isShield) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(o.x, oy - 7.5);
          ctx.lineTo(o.x + 6, oy - 5);
          ctx.lineTo(o.x + 6, oy + 1);
          ctx.quadraticCurveTo(o.x + 6, oy + 7, o.x, oy + 10);
          ctx.quadraticCurveTo(o.x - 6, oy + 7, o.x - 6, oy + 1);
          ctx.lineTo(o.x - 6, oy - 5);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeStyle = col;
          ctx.lineCap = "butt";
          ctx.lineWidth = 4.6;
          ctx.beginPath();
          ctx.arc(o.x, oy - 0.5, 5, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#eef3ff";
          ctx.beginPath();
          ctx.moveTo(o.x - 5, oy - 0.5);
          ctx.lineTo(o.x - 5, oy + 6.5);
          ctx.moveTo(o.x + 5, oy - 0.5);
          ctx.lineTo(o.x + 5, oy + 6.5);
          ctx.stroke();
          ctx.lineCap = "round";
        }
        break;
      }
    }
  }

  /* ---------------- hero ---------------- */

  private trail(g: Game) {
    const { ctx } = this;
    const p = g.player;
    const tr = p.trail;
    if (tr.length < 2) return;
    const a = clamp((p.speed() - 240) / 800, 0, 1) * 0.5;
    if (a <= 0.02) return;
    ctx.lineCap = "round";
    for (let i = 1; i < tr.length; i++) {
      const f = i / tr.length;
      ctx.strokeStyle = `rgba(125,240,255,${(a * f).toFixed(3)})`;
      ctx.lineWidth = 1 + 7 * f;
      ctx.beginPath();
      ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
      ctx.lineTo(tr[i].x, tr[i].y);
      ctx.stroke();
    }
  }

  private rope(g: Game) {
    const { ctx } = this;
    const p = g.player;
    if (!p.attached) return;
    const e = clamp((g.time - g.attachTime) / 0.09, 0, 1);
    const ease = 1 - Math.pow(1 - e, 3);
    const ex = p.x + (p.ax - p.x) * ease;
    const ey = p.y + (p.ay - p.y) * ease;
    const curLen = Math.hypot(p.ax - p.x, p.ay - p.y);
    const sag = Math.max(0, p.rope - curLen) * 0.55 * ease + (1 - ease) * 3;
    const mx = (p.x + ex) / 2;
    const my = (p.y + ey) / 2 + sag;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(mx, my, ex, ey);
    };
    ctx.lineCap = "round";
    path();
    ctx.strokeStyle = "rgba(6,10,30,0.55)";
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.setLineDash([12, 18]);
    ctx.lineDashOffset = -g.time * 190;
    path();
    ctx.strokeStyle = "rgba(126,231,255,0.35)";
    ctx.lineWidth = 4.6;
    ctx.stroke();
    ctx.setLineDash([]);
    path();
    ctx.strokeStyle = "rgba(242,254,255,0.95)";
    ctx.lineWidth = 1.7;
    ctx.stroke();
    if (e >= 1) {
      ctx.strokeStyle = "rgba(240,252,255,0.9)";
      ctx.lineWidth = 2;
      const a = 5 + Math.sin(g.time * 8) * 1.2;
      ctx.beginPath();
      ctx.moveTo(p.ax - a, p.ay);
      ctx.lineTo(p.ax + a, p.ay);
      ctx.moveTo(p.ax, p.ay - a);
      ctx.lineTo(p.ax, p.ay + a);
      ctx.stroke();
    }
  }

  private spider(g: Game) {
    const { ctx } = this;
    const p = g.player;
    const sp = p.speed() || 1;
    const ang = Math.atan2(p.vy, p.vx || 0.0001);
    const wob = Math.sin(g.time * 11 + sp * 0.01);

    if (g.magnetT > 0) {
      const mp = 30 + Math.sin(g.time * 6) * 4;
      ctx.strokeStyle = `rgba(255,107,129,${(0.28 + 0.12 * Math.sin(g.time * 6)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, mp, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (g.shieldActive) {
      ctx.fillStyle = "rgba(47,224,176,0.10)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(47,224,176,0.7)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(220,255,245,0.8)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a0 = g.time * 1.8 + k * Math.PI;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, a0, a0 + 0.7);
        ctx.stroke();
      }
    }

    // pumping flare — the spider actively works the web
    if (p.attached && g.pumpFx > 0.02) {
      ctx.globalAlpha = g.pumpFx * 0.5;
      ctx.strokeStyle = "#7df0ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21 + g.pumpFx * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // start-of-run grace halo
    if (g.graceT > 0) {
      const gp = 0.3 + 0.25 * Math.sin(g.time * 7);
      ctx.strokeStyle = `rgba(125,240,255,${gp.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 + Math.sin(g.time * 7) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.attached) {
      const aa = Math.atan2(p.ay - p.y, p.ax - p.x);
      ctx.strokeStyle = "#d92646";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(aa) * 15, p.y + Math.sin(aa) * 15);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.lineCap = "round";

    // web-wings while gliding — membranes between arm and leg
    if (g.gliding) {
      const flap = 1 + Math.sin(g.time * 9) * 0.06;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(10, s * 5);
        ctx.quadraticCurveTo(-4, s * 26 * flap, -18, s * 9);
        ctx.quadraticCurveTo(-6, s * 10, 10, s * 5);
        ctx.closePath();
        ctx.fillStyle = "rgba(190,240,255,0.22)";
        ctx.fill();
        ctx.strokeStyle = "rgba(226,250,255,0.75)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // web ribs
        ctx.strokeStyle = "rgba(226,250,255,0.35)";
        ctx.lineWidth = 0.9;
        for (let k = 1; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(10 - k * 7, s * 5);
          ctx.lineTo(-5 - k * 3, s * (17 - k * 3) * flap);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = "#1b2fa8";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-15, -8 + wob * 3.5);
    ctx.moveTo(-5, 4);
    ctx.lineTo(-16, 8 - wob * 3.5);
    ctx.stroke();
    ctx.strokeStyle = "#d92646";
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.lineTo(p.attached ? 8 : 14, -10 - wob * 2.5);
    ctx.moveTo(3, 5);
    ctx.lineTo(13, 10 + wob * 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2440d0";
    ctx.fill();
    ctx.strokeStyle = "#101c5e";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(3.5, 0, 7.5, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d92646";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, 0, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e0344f";
    ctx.fill();
    ctx.strokeStyle = "#7a0f22";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.save();
    ctx.translate(17.5, -3.8);
    ctx.rotate(0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(17.5, 3.8);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
      ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
      ctx.lineWidth = Math.max(3, size / 6);
      ctx.strokeStyle = "rgba(5,8,24,0.85)";
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
    const pulse = 0.32 + 0.18 * Math.sin(g.time * 5);
    ctx.strokeStyle = `rgba(125,240,255,${pulse.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9 + 2 * Math.sin(g.time * 5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 6);
    ctx.stroke();
    if (g.holdWeb) {
      ctx.strokeStyle = "rgba(125,240,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, 15 + 4 * Math.sin(g.time * 12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(125,240,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private snapMark(g: Game) {
    const { ctx } = this;
    const s = g.snapFx;
    if (!s) return;
    const tn = clamp(s.t / 0.26, 0, 1);
    const ex = s.px + (s.ax - s.px) * (1 - tn);
    const ey = s.py + (s.ay - s.py) * (1 - tn);
    ctx.strokeStyle = `rgba(210,245,255,${(tn * 0.85).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.ax - 5 * tn - 2, s.ay + 6 * tn + 3);
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.ax + 6 * tn + 2, s.ay + 4 * tn + 2);
    ctx.stroke();
  }

  private speedLines(g: Game, T: Theme) {
    const { ctx } = this;
    const p = g.player;
    const sp = p.speed();
    if (sp < 620 || g.state !== "playing") return;
    const n = Math.min(9, Math.floor((sp - 620) / 90) + 1);
    const ux = p.vx / sp;
    const uy = p.vy / sp;
    const sx = p.x - g.cam.x + g.cam.sx;
    const sy = p.y - g.cam.y + g.cam.sy;
    const seed = Math.floor(g.time * 24);
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      const r1 = hash(i * 13.7 + seed * 3.1);
      const r2 = hash(i * 7.7 + seed * 1.3 + 5);
      const back = 40 + r1 * 160;
      const off = (r2 - 0.5) * 130;
      const px = sx - ux * back - uy * off;
      const py = sy - uy * back + ux * off;
      ctx.globalAlpha = 0.1 + r1 * 0.16;
      ctx.strokeStyle = T.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - ux * (24 + r2 * 40), py - uy * (24 + r2 * 40));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- the floor gate that ends the level ---------------- */

  private gate(g: Game, T: Theme) {
    void T;
    const hole = g.gateHole;
    if (!hole) return;
    const { ctx } = this;
    const surf = (x: number) => g.world.lavaY(x);
    const gy = surf(hole.x);

    // cleared landing strip on both sides — reads as "the way in"
    ctx.save();
    ctx.beginPath();
    ctx.rect(hole.x - 460, gy - 90, 920, 130);
    ctx.clip();
    ctx.setLineDash([26, 22]);
    ctx.lineDashOffset = -g.time * 40;
    ctx.strokeStyle = "rgba(255,231,154,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hole.x - 430, gy + 16);
    ctx.lineTo(hole.x + 430, gy + 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(255,231,154,0.75)";
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const ax = hole.x + sgn * (110 + k * 90);
        const bob = Math.sin(g.time * 3 + k) * 2;
        ctx.beginPath();
        ctx.moveTo(ax - 16 * sgn, gy + 40 + bob);
        ctx.lineTo(ax + 4 * sgn, gy + 52 + bob);
        ctx.lineTo(ax - 16 * sgn, gy + 64 + bob);
        ctx.strokeStyle = "rgba(255,231,154,0.7)";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // the mouth itself, cut into the asphalt
    ctx.beginPath();
    ctx.ellipse(hole.x, gy + 6, hole.r + 12, (hole.r + 12) * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(6,4,14,0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,231,154,0.55)";
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(g.time * 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------------- ambient weather, per world ---------------- */

  private ambient(g: Game, T: Theme) {
    const { ctx } = this;
    if (T.ambient === "none" || T.ambient === "stars") return;
    const w = g.vw;
    const h = g.vh;
    const rise = T.ambient === "bubbles" || T.ambient === "embers" || T.ambient === "sparks";
    const n = T.ambient === "snow" ? 90 : 60;
    for (let i = 0; i < n; i++) {
      const r1 = hash(i * 4.13);
      const r2 = hash(i * 8.77 + 2.1);
      const r3 = hash(i * 2.31 + 9.4);
      const speed = (rise ? -1 : 1) * (18 + r1 * 60);
      const y = wrap(r2 * h - g.cam.y * 0.12 + g.time * speed, h + 60) - 30;
      const drift = Math.sin(g.time * (0.4 + r3) + i) * (T.ambient === "leaves" ? 40 : 16);
      const x = wrap(r1 * (w + 80) - g.cam.x * 0.08 + drift, w + 80) - 40;
      const size = 1.4 + r3 * (T.ambient === "bubbles" ? 4 : T.ambient === "snow" ? 3 : 2.4);
      ctx.globalAlpha = 0.18 + r1 * 0.45;
      if (T.ambient === "embers" || T.ambient === "sparks") {
        ctx.fillStyle = i % 3 === 0 ? T.accent : T.ambientColor;
      } else {
        ctx.fillStyle = T.ambientColor;
      }
      if (T.ambient === "leaves") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(g.time * 0.8 + i) * 0.9);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.8, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (T.ambient === "bubbles") {
        ctx.strokeStyle = T.ambientColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // underwater light shafts
    if (T.ambient === "bubbles") {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#cdf6ff";
      for (let k = 0; k < 5; k++) {
        const bx = wrap(k * (w / 5) + Math.sin(g.time * 0.2 + k) * 30 - g.cam.x * 0.05, w + 200) - 100;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx + 70, h);
        ctx.lineTo(bx + 150, h);
        ctx.lineTo(bx + 60, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (T.ambient === "snow" && g.state === "playing") {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "#e8fbff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  private rrect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// keep noise import used for subtle variation hooks
void noise1;
