import { installDom, rafQueue } from "./headless";
import { createCanvas } from "@napi-rs/canvas";
import { Game } from "../src/game/engine";
import { botStep, newBot } from "./bot";
import { writeFileSync } from "node:fs";
installDom();

const W = 440;
const H = 330; // small viewport = zoomed-in look, so the character is legible
const full = createCanvas(W, H);
const el = {
  width: W,
  height: H,
  style: {},
  getContext: (t: string) => full.getContext(t as "2d"),
  addEventListener: () => {},
  removeEventListener: () => {},
};
const g = new Game(el as unknown as HTMLCanvasElement, () => {});
g.dpr = 1;
(g as unknown as { resize: () => void }).resize();
g.vw = W;
g.vh = H;

function frame(level: number, secs: number, glide: boolean) {
  g.start(level);
  (g as unknown as { last: number }).last = 0;
  const bot = newBot();
  let t = 0;
  for (let f = 0; f < secs * 60; f++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    botStep(g, bot);
    cb(t);
    if (g.state !== "playing") break;
  }
  if (glide) {
    // pose the wings so the glide silhouette can be checked
    for (let f = 0; f < 20; f++) {
      g.setGlide(true);
      const cb = rafQueue.shift();
      if (!cb) break;
      t += 1000 / 60;
      cb(t);
    }
  }
  (g.renderer as unknown as { render: (x: Game) => void }).render(g);
}

const crop = createCanvas(360, 300);
const cctx = crop.getContext("2d");

function shot(name: string) {
  const p = g.player;
  const sx = p.x - g.cam.x + g.cam.sx;
  const sy = p.y - g.cam.y + g.cam.sy;
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(full, 0, 0, W, H, 0, 0, 440, 330);
  const big = createCanvas(880, 660);
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(crop, 0, 0, 440, 330, 0, 0, 880, 660);
  writeFileSync(`/tmp/shots/${name}.png`, big.toBuffer("image/png"));
  console.log(name, "spider on screen at", sx.toFixed(0), sy.toFixed(0), "state", g.state, g.cause);
}

frame(0, 7, false);
shot("zoom-city");
frame(2, 6, false);
shot("zoom-underwater");
frame(4, 6, false);
shot("zoom-ice");
