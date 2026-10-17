/* Render real frames with the native canvas backend and write PNGs (dev inspection). */
import { installDom, rafQueue } from "./headless";
import { createCanvas } from "@napi-rs/canvas";
import { Game } from "../src/game/engine";
import { botStep, newBot } from "./bot";
import { writeFileSync, mkdirSync } from "node:fs";

installDom((w, h) => createCanvas(w, h));
const OUT = process.env.SHOTS ?? "/tmp/shots";
mkdirSync(OUT, { recursive: true });

function makeEl(W: number, H: number) {
  const c = createCanvas(W, H);
  return {
    canvas: c,
    el: {
      width: W,
      height: H,
      style: {},
      getContext: (t: string) => c.getContext(t as "2d"),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  };
}

function shoot(name: string, W: number, H: number, level: number, seconds: number, mode: "menu" | "play") {
  rafQueue.length = 0;
  const { canvas, el } = makeEl(W, H);
  const g = new Game(el as unknown as HTMLCanvasElement, () => {});
  g.dpr = 1;
  g.vw = W;
  g.vh = H;
  (g as unknown as { last: number }).last = 0;
  const bot = newBot();
  if (mode === "play") g.start(level);
  let t = 0;
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    if (mode === "play") botStep(g, bot, false);
    cb(t);
    if (mode === "play" && g.state !== "playing") break;
  }
  (g.renderer as unknown as { render: (x: Game) => void }).render(g);
  writeFileSync(`${OUT}/${name}.png`, canvas.toBuffer("image/png"));
  const p = g.player;
  console.log(
    `${name}: state=${g.state} cause=${g.cause || "-"} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} dist=${g.distM}m att=${p.attached ? 1 : 0} gr=${p.grounded ? 1 : 0} tokens=${g.tokens} tricks=${g.tricks}`,
  );
  g.dispose();
}

shoot("menu-wide", 1280, 760, 0, 3.5, "menu");
shoot("play-wide-1", 1280, 760, 0, 1.6, "play");
shoot("play-wide-4", 1280, 760, 0, 4.5, "play");
shoot("play-wide-9", 1280, 760, 0, 9, "play");
shoot("play-d3", 1280, 760, 2, 6, "play");
shoot("play-mobile-1", 390, 780, 0, 2.2, "play");
shoot("play-mobile-5", 390, 780, 0, 5.5, "play");
