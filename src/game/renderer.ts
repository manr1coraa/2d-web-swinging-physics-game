import type { Game } from "./engine";
import type { Obj } from "./world";
import { clamp, lerp, hash, noise1, wrap } from "./util";

const CONCRETE = "#0b1024";
const TRIM = "#49d8ff";

/* ---- districts: the sky shifts as you travel (dusk → harbour → deep night) ---- */
const SKY_STOPS: [string, string, string, string][] = [
  ["#070b22", "#121a3e", "#2b2254", "#5c3161"], // city night
  ["#0a1230", "#16285a", "#2f3d6e", "#7a4f6e"], // harbour: cooler, more blue
  ["#03040f", "#0c1028", "#1e1640", "#3d2452"], // deep night: darker, quieter
];
const DISTRICT_M = 260; // metres per district
const BLEND_M = 90; // last part of each district fades into the next

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const out = [16, 8, 0].map((s) =>
    Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t),
  );
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function skyAt(dist: number): [string, string, string, string] {
  const n = SKY_STOPS.length;
  const d = Math.max(0, dist);
  const idx = Math.floor(d / DISTRICT_M);
  const inside = d - idx * DISTRICT_M;
  const cur = SKY_STOPS[idx % n];
  const next = SKY_STOPS[(idx + 1) % n];
  const t = clamp((inside - (DISTRICT_M - BLEND_M)) / BLEND_M, 0, 1);
  return [0, 1, 2, 3].map((k) => mixHex(cur[k], next[k], t)) as [
    string,
    string,
    string,
    string,
  ];
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

    this.sky(w, h, g.distM);
    this.stars(g, w, h);
    this.skyline(g, w, h);
    // push the background back so gameplay objects pop forward
    ctx.fillStyle = "rgba(6,8,26,0.42)";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // zoom about the screen centre, then follow the camera
    ctx.translate(w / 2, h / 2);
    ctx.scale(g.cam.zoom, g.cam.zoom);
    ctx.translate(-w / 2, -h / 2);
    ctx.translate(-g.cam.x + g.cam.sx, -g.cam.y + g.cam.sy);
    this.street(g);
    this.worldObjects(g);
    this.upperCity(g);
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

    this.speedLines(g);
    this.dangerArrows(g);
  }

  /** red chevrons at the screen edge for hazards about to arrive */
  private dangerArrows(g: Game) {
    if (g.state !== "playing") return;
    const { ctx } = this;
    const p = g.player;
    const seen: { y: number; d: number }[] = [];
    g.world.eachNear(p.rx + 420, (o) => {
      if (o.kind !== "stal" && o.kind !== "saw" && o.kind !== "spire") return;
      const dx = o.x - p.rx;
      if (dx < 40 || dx > 900) return;
      const oy =
        o.kind === "stal"
          ? o.y + o.len * 0.6
          : o.kind === "spire"
            ? o.tip + 40
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

  private sky(w: number, h: number, dist = 0) {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const sky = skyAt(dist);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.42, sky[1]);
    grad.addColorStop(0.72, sky[2]);
    grad.addColorStop(1, sky[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // city light pollution glow on the horizon
    const gg = ctx.createLinearGradient(0, h * 0.55, 0, h);
    gg.addColorStop(0, "rgba(255,150,90,0)");
    gg.addColorStop(1, "rgba(255,150,90,0.22)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // moon
    const mx = w * 0.78;
    const my = h * 0.15;
    const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 190);
    mg.addColorStop(0, "rgba(180,200,255,0.22)");
    mg.addColorStop(1, "rgba(180,200,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 200, my - 200, 400, 400);
    ctx.fillStyle = "#eaf0ff";
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#9fb2e8";
    ctx.beginPath();
    ctx.arc(mx - 7, my - 4, 5.5, 0, Math.PI * 2);
    ctx.arc(mx + 6, my + 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private stars(g: Game, w: number, h: number) {
    const { ctx } = this;
    for (let i = 0; i < 70; i++) {
      const sx = wrap(hash(i * 3.17) * 2200 - g.cam.x * 0.04, w + 40) - 20;
      const sy = hash(i * 7.71 + 1.3) * h * 0.4;
      const tw =
        0.25 + 0.6 * Math.abs(Math.sin(g.time * (0.6 + hash(i) * 1.4) + i));
      ctx.globalAlpha = tw * (0.25 + hash(i + 9) * 0.6);
      ctx.fillStyle = "#dbe5ff";
      ctx.fillRect(sx, sy, hash(i * 1.7) > 0.85 ? 2 : 1.2, 1.4);
    }
    ctx.globalAlpha = 1;

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

  /** parallax Manhattan skylines */
  private skyline(g: Game, w: number, h: number) {
    const { ctx } = this;
    const layers = [
      { par: 0.07, base: 0.74, hMin: 90, hMax: 300, col: "#121735", win: 0.1, step: 54, seed: 1 },
      { par: 0.16, base: 0.82, hMin: 110, hMax: 360, col: "#19204a", win: 0.16, step: 68, seed: 2 },
      { par: 0.3, base: 0.92, hMin: 130, hMax: 420, col: "#232a63", win: 0.22, step: 86, seed: 3 },
    ];
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
          ctx.fillStyle = pass === 0 ? "#ffd79a" : "#8fd4ff";
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
    hz.addColorStop(0, "rgba(40,30,70,0)");
    hz.addColorStop(1, "rgba(60,36,80,0.5)");
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  }

  /* ---------------- upper city (the web-anchor canopy) ---------------- */

  private upperCity(g: Game) {
    const x0 = g.cam.x - 90;
    const x1 = g.cam.x + g.vw + 90;
    const top = g.cam.y - 360;
    const step = 16;
    let runStart = -1;
    for (let x = x0; x <= x1 + step; x += step) {
      const solid = x <= x1 && g.world.ceilSolid(x);
      if (solid && runStart < 0) runStart = x;
      if (!solid && runStart >= 0) {
        this.cityRun(g, runStart, Math.min(x, x1), top);
        runStart = -1;
      }
    }
  }

  private cityRun(g: Game, xa: number, xb: number, top: number) {
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
    ctx.fillStyle = CONCRETE;
    ctx.fill();

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
        ctx.fillStyle = wr > 0.26 ? "#ffd79a" : "#7fe0ff";
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
    ctx.strokeStyle = "rgba(73,216,255,0.2)";
    ctx.lineWidth = 9;
    ctx.stroke();
    trace();
    ctx.strokeStyle = TRIM;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  /* ---------------- street level (deadly ground) ---------------- */

  private street(g: Game) {
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
    hz.addColorStop(0, "rgba(255,170,90,0)");
    hz.addColorStop(1, "rgba(255,170,90,0.2)");
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
    lg.addColorStop(0, "#453049");
    lg.addColorStop(0.2, "#241a33");
    lg.addColorStop(1, "#0d0a1a");
    ctx.fillStyle = lg;
    ctx.fill();

    // sidewalk line
    ctx.beginPath();
    ctx.moveTo(x0, surf(x0));
    for (let x = x0 + 12; x <= x1; x += 12) ctx.lineTo(x, surf(x));
    ctx.strokeStyle = "rgba(255,186,110,0.3)";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = "#ffd09a";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // thermal updraft shimmer — shows the glide rescue zone above the street
    ctx.strokeStyle = "rgba(160,220,255,0.16)";
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

  private worldObjects(g: Game) {
    const cw = g.world.cw;
    const i0 = Math.max(0, Math.floor((g.cam.x - 120) / cw));
    const i1 = Math.floor((g.cam.x + g.vw + 120) / cw);
    for (let i = i0; i <= i1; i++) {
      const c = g.world.chunks.get(i);
      if (!c) continue;
      for (const o of c.objs) this.obj(g, o);
    }
  }

  private obj(g: Game, o: Obj) {
    const { ctx } = this;
    const t = g.time;
    switch (o.kind) {
      /* ---- scaffold / billboard platform (safe, landable) ---- */
      case "plat": {
        const x = o.x - o.w / 2;
        const y = o.y - o.h / 2;
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
        ctx.fillStyle = "#222b5c";
        ctx.fill();
        ctx.strokeStyle = "rgba(120,140,255,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        // neon sign strip
        ctx.strokeStyle = TRIM;
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
        bg.addColorStop(0, "#2a3570");
        bg.addColorStop(0.5, "#36437f");
        bg.addColorStop(1, "#202a5c");
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
            ctx.fillStyle = wr > 0.3 ? "#ffd79a" : "#79dcff";
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
        ctx.fillStyle = "#39406e";
        ctx.fill();
        ctx.strokeStyle = "#ffc247";
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
        // hazard stripes along the whole beam
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(o.x - o.w / 2, o.y - 6);
        ctx.lineTo(o.x + o.w / 2, o.y - 6);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = "#ffc247";
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

      case "shield": {
        if (o.got) break;
        const isShield = true;
        const col = "#2fe0b0";
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
    const ex = p.rx + (p.ax - p.rx) * ease;
    const ey = p.ry + (p.ay - p.ry) * ease;
    const curLen = Math.hypot(p.ax - p.rx, p.ay - p.ry);
    const sag = Math.max(0, p.rope - curLen) * 0.55 * ease + (1 - ease) * 3;
    const mx = (p.rx + ex) / 2;
    const my = (p.ry + ey) / 2 + sag;
    // taut rope glows brighter, slack rope is dimmer: tension you can read
    const taut = clamp(curLen / Math.max(1, p.rope), 0, 1) * ease;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(p.rx, p.ry);
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
    ctx.strokeStyle = `rgba(126,231,255,${(0.2 + 0.35 * taut).toFixed(3)})`;
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

    if (g.shieldActive) {
      ctx.fillStyle = "rgba(47,224,176,0.10)";
      ctx.beginPath();
      ctx.arc(p.rx, p.ry, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(47,224,176,0.7)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = "rgba(220,255,245,0.8)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a0 = g.time * 1.8 + k * Math.PI;
        ctx.beginPath();
        ctx.arc(p.rx, p.ry, 26, a0, a0 + 0.7);
        ctx.stroke();
      }
    }

    if (p.attached) {
      const aa = Math.atan2(p.ay - p.ry, p.ax - p.rx);
      ctx.strokeStyle = "#d92646";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.rx, p.ry);
      ctx.lineTo(p.rx + Math.cos(aa) * 15, p.ry + Math.sin(aa) * 15);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(p.rx, p.ry);
    ctx.scale(p.sqx, p.sqy);
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

  private speedLines(g: Game) {
    const { ctx } = this;
    const p = g.player;
    const sp = p.speed();
    if (sp < 620 || g.state !== "playing") return;
    const n = Math.min(9, Math.floor((sp - 620) / 90) + 1);
    const ux = p.vx / sp;
    const uy = p.vy / sp;
    const sx = p.rx - g.cam.x + g.cam.sx;
    const sy = p.ry - g.cam.y + g.cam.sy;
    const seed = Math.floor(g.time * 24);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const r1 = hash(i * 13.7 + seed * 3.1);
      const r2 = hash(i * 7.7 + seed * 1.3 + 5);
      const back = 40 + r1 * 160;
      const off = (r2 - 0.5) * 130;
      const px = sx - ux * back - uy * off;
      const py = sy - uy * back + ux * off;
      ctx.strokeStyle = `rgba(220,235,255,${(0.1 + r1 * 0.16).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - ux * (24 + r2 * 40), py - uy * (24 + r2 * 40));
      ctx.stroke();
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
