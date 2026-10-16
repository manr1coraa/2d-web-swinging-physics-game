/* Render real frames of the game to PNG (dev inspection only). */
import { installDom, rafQueue } from "./headless";
import { createCanvas } from "@napi-rs/canvas";
import { Game } from "../src/game/engine";
import { botStep, newBot } from "./bot";
import { themeForLevel } from "../src/game/world";
import { writeFileSync, mkdirSync } from "node:fs";

installDom((w, h) => createCanvas(w, h));
const W = 1280;
const H = 760;
mkdirSync("/tmp/shots", { recursive: true });

let theCanvas = createCanvas(1, 1);
function canvasEl() {
  const c = createCanvas(W, H);
  theCanvas = c;
  const el = {
    width: W,
    height: H,
    style: {},
    getContext: (t: string) => c.getContext(t as "2d"),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return el;
}

type Mode = "menu" | "play" | "gate";

function shoot(level: number, mode: Mode, seconds: number, name: string) {
  const el = canvasEl();
  const g = new Game(el as unknown as HTMLCanvasElement, () => {});
  g.dpr = 1;
  (g as unknown as { last: number }).last = 0;
  if (mode === "menu") {
    (g as unknown as { resize: () => void }).resize();
    g.vw = W;
    g.vh = H;
    g.state = "menu";
    g.world.ensure(1400);
    let t = 0;
    for (let f = 0; f < 240; f++) {
      const cb = rafQueue.shift();
      if (!cb) break;
      t += 1000 / 60;
      cb(t);
    }
    (g.renderer as unknown as { render: (x: Game) => void }).render(g);
  } else {
    (g as unknown as { resize: () => void }).resize();
    g.vw = W;
    g.vh = H;
    g.start(level);
    (g as unknown as { last: number }).last = 0;
    const bot = newBot();
    let t = 0;
    const frames = Math.floor(seconds * 60);
    for (let f = 0; f < frames; f++) {
      const cb = rafQueue.shift();
      if (!cb) break;
      t += 1000 / 60;
      botStep(g, bot);
      cb(t);
      if (mode === "gate" && g.gateHole && g.player.x > g.gateHole.x - 520) break;
      if (g.state !== "playing" && g.state !== "levelup") break;
    }
    (g.renderer as unknown as { render: (x: Game) => void }).render(g);
  }
  writeFileSync(
    `/tmp/shots/${name}.png`,
    (theCanvas as unknown as { toBuffer: (t: string) => Buffer }).toBuffer("image/png"),
  );
  g.dispose();
  rafQueue.length = 0;
  console.log(`wrote /tmp/shots/${name}.png  (level ${level + 1}, ${themeForLevel(level)}, ${mode})`);
}

shoot(0, "menu", 4, "00-menu");
// one level per world: with LEVELS_PER_WORLD=5 each world shares a single theme
const WORLDS: [number, string][] = [
  [0, "city"],
  [5, "jungle"],
  [10, "underwater"],
  [15, "desert"],
  [20, "ice"],
  [25, "volcano"],
  [30, "space"],
  [35, "neon"],
];
WORLDS.forEach(([lv, name], i) => shoot(lv, "play", 6, `${String(i + 1).padStart(2, "0")}-${name}`));
shoot(0, "gate", 30, "09-gate");
