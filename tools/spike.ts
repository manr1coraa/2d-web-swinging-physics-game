/* Find which rendering step causes the occasional huge frame. */
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

type Any = Record<string, unknown>;
const renderer = g.renderer as unknown as Any;
const names = [
  "sky",
  "deco",
  "skyline",
  "street",
  "gate",
  "worldObjects",
  "upperCity",
  "trail",
  "rope",
  "spider",
  "popups",
  "aimMark",
  "snapMark",
  "speedLines",
  "dangerArrows",
  "ambient",
  "obj",
];
const times: Record<string, number> = {};
for (const n of names) {
  const fn = renderer[n];
  if (typeof fn !== "function") continue;
  times[n] = 0;
  renderer[n] = function (this: unknown, ...args: unknown[]) {
    const t0 = performance.now();
    const out = (fn as (...a: unknown[]) => unknown).apply(this, args);
    times[n] += performance.now() - t0;
    return out;
  };
}
const partsDraw = g.parts.draw.bind(g.parts);
g.parts.draw = (ctx: CanvasRenderingContext2D) => {
  const t0 = performance.now();
  partsDraw(ctx);
  times["particles"] = (times["particles"] ?? 0) + (performance.now() - t0);
};

g.start(0);
(g as unknown as { last: number }).last = 0;
const bot = newBot();
let t = 0;
for (let f = 0; f < 700; f++) {
  const cb = rafQueue.shift();
  if (!cb) break;
  t += 1000 / 60;
  botStep(g, bot);
  for (const k of Object.keys(times)) times[k] = 0;
  const t0 = performance.now();
  cb(t);
  const cost = performance.now() - t0;
  if (cost > 60) {
    const top = Object.entries(times)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} ${v.toFixed(0)}ms`)
      .join("  ");
    console.log(`frame ${f}: total ${cost.toFixed(0)}ms  →  ${top}`);
  }
  if (g.state !== "playing") break;
}
console.log("done");
process.exit(0);
