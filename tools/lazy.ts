import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game, LEVEL_METERS } from "../src/game/engine";

/* The "never let go" monkey: how far can pure holding carry you? */
const lv = parseInt(process.argv[2] ?? "1", 10) - 1;
rafQueue.length = 0;
const game = new Game(canvas as unknown as HTMLCanvasElement, () => {});
game.start(lv);
let t = performance.now();
let lastX = game.player.x;
let maxX = game.player.x;
for (let f = 0; f < 60 * 60; f++) {
  const cb = rafQueue.shift();
  if (!cb) break;
  t += 1000 / 60;
  game.holdWeb = true;
  cb(t);
  if (f % 300 === 0) {
    console.log(
      `t=${(f / 60).toFixed(0)}s x=${game.player.x.toFixed(0)} (dist ${game.distM}m) att=${game.player.attached ? 1 : 0} state=${game.state}`,
    );
  }
  maxX = Math.max(maxX, game.player.x);
  if (game.state !== "playing") {
    console.log("ended", game.state, game.cause, "at", Math.round(game.player.x));
    break;
  }
}
console.log(`max x=${maxX.toFixed(0)} = ${(maxX / 50).toFixed(0)} m of ${LEVEL_METERS}`);
void lastX;
