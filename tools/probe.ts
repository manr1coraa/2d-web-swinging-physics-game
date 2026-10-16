import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game } from "../src/game/engine";

rafQueue.length = 0;
const game = new Game(canvas as unknown as HTMLCanvasElement, () => {});
console.log("perf now:", performance.now(), "last:", (game as unknown as { last: number }).last);
game.start(0);
let t = performance.now();
for (let f = 0; f < 600; f++) {
  const cb = rafQueue.shift();
  if (!cb) { console.log("no cb at frame", f); break; }
  t += 1000 / 60;
  game.holdWeb = true;
  cb(t);
  if (f % 60 === 0) {
    const p = game.player;
    console.log(
      `f=${f} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} vx=${p.vx.toFixed(0)} vy=${p.vy.toFixed(0)} att=${p.attached} rope=${p.rope.toFixed(0)} state=${game.state} dist=${game.distM} hold=${game.holdWeb}`,
    );
  }
  if (game.state !== "playing") { console.log("ended", game.state, game.cause); break; }
}
