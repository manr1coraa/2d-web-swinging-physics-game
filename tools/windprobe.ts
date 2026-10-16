import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game } from "../src/game/engine";

rafQueue.length = 0;
const g = new Game(canvas as unknown as HTMLCanvasElement, () => {});
g.start(0);
(g as unknown as { last: number }).last = 0;
g.world.ensure(3000);

// list a few wind zones
let found: { x: number; y: number; w: number; h: number; vx: number; vy: number; strength: number }[] = [];
g.world.eachNear(3000, (o) => {
  if (o.kind === "wind") found.push(o);
});
console.log("zones near 3000:", found.map((z) => `(${z.x.toFixed(0)},${z.y.toFixed(0)}) ${z.w}x${z.h} v=(${z.vx.toFixed(0)},${z.vy.toFixed(0)}) s=${z.strength}`));

const z = found[0];
const p = g.player;
p.attached = false;
p.x = z.x;
p.y = z.y;
p.vx = 0;
p.vy = 0;
console.log("chunks known:", [...g.world.chunks.keys()].sort((a, b) => a - b).join(","));
console.log("player chunk:", Math.floor(p.x / g.world.cw));
let t = 0;
for (let f = 0; f < 30; f++) {
  const cb = rafQueue.shift();
  if (!cb) break;
  t += 1000 / 60;
  cb(t);
  if (f % 6 === 0)
    console.log(
      `f=${f} pos=(${p.x.toFixed(0)},${p.y.toFixed(0)}) v=(${p.vx.toFixed(0)},${p.vy.toFixed(0)}) windGain=${g.windGain.toFixed(2)} state=${g.state}${g.cause ? " cause=" + g.cause : ""}`,
    );
}
