/* Frame cost of update + render, measured with a real canvas backend. */
import { installDom, rafQueue } from "./headless";
import { createCanvas } from "@napi-rs/canvas";
import { Game } from "../src/game/engine";
import { botStep, newBot } from "./bot";

installDom((w, h) => createCanvas(w, h));
const W = 1280;
const H = 720;
const c = createCanvas(W, H);
const el = {
  width: W,
  height: H,
  style: {},
  getContext: (t: string) => c.getContext(t as "2d"),
  addEventListener: () => {},
  removeEventListener: () => {},
};
const g = new Game(el as unknown as HTMLCanvasElement, () => {});
g.dpr = 1;
(g as unknown as { resize: () => void }).resize();
g.vw = W;
g.vh = H;

for (const level of [0, 2, 6]) {
  g.start(level);
  void 0;
  (g as unknown as { last: number }).last = 0;
  const bot = newBot();
  // split the frame cost into "update" and "render" so a spike can be traced
  const gAny = g as unknown as { update: (dt: number) => void; renderer: { render: (x: Game) => void } };
  const upd = gAny.update.bind(g);
  const ren = gAny.renderer.render.bind(gAny.renderer);
  let updMs = 0;
  let renMs = 0;
  gAny.update = (dt: number) => {
    const a = performance.now();
    upd(dt);
    updMs = performance.now() - a;
  };
  gAny.renderer.render = (x: Game) => {
    const a = performance.now();
    ren(x);
    renMs = performance.now() - a;
  };
  const samples: { f: number; ms: number; u: number; r: number; parts: number; chunks: number }[] = [];
  let t = 0;
  for (let f = 0; f < 900; f++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    botStep(g, bot);
    const t0 = performance.now();
    cb(t);
    const cost = performance.now() - t0;
    if (f > 120)
      samples.push({
        f,
        ms: cost,
        u: updMs,
        r: renMs,
        parts: g.parts.list.length,
        chunks: g.world.chunks.size,
      });
    if (g.state !== "playing") break;
  }
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const avg = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
  const p95 = ms[Math.floor(ms.length * 0.95)] ?? 0;
  const worst = samples.reduce((a, b) => (b.ms > a.ms ? b : a), { f: 0, ms: 0 });
  const sm = samples.find((s2) => s2.f === worst.f);
  console.log(
    `level ${level + 1} (${g.theme}): avg ${avg.toFixed(2)} ms  p95 ${p95.toFixed(2)} ms  max ${worst.ms.toFixed(2)} ms @frame ${worst.f}` +
      (sm ? ` (update ${sm.u.toFixed(1)} / render ${sm.r.toFixed(1)} / particles ${sm.parts} / chunks ${sm.chunks})` : "") +
      `  over ${ms.length} frames`,
  );
  const sorted = samples.slice().sort((a, b) => b.ms - a.ms).slice(0, 5);
  console.log(
    "   slowest: " +
      sorted.map((sp) => `f${sp.f}:${sp.ms.toFixed(0)}ms(u${sp.u.toFixed(0)}/r${sp.r.toFixed(0)})`).join("  "),
  );
}
