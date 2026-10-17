import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game } from "../src/game/engine";
import { botStep, newBot } from "./bot";

const lv = parseInt(process.argv[2] ?? "3", 10) - 1;
rafQueue.length = 0;
const game = new Game(canvas as unknown as HTMLCanvasElement, () => {});
game.start(lv);
const deterministic = process.env.DETERMINISTIC === "1";
if (deterministic) (game as unknown as { last: number }).last = 0;
const bot = newBot();
const aggressive = !process.argv.slice(3).some((arg) => arg.toUpperCase() === "SAFE");
let t = deterministic ? 0 : performance.now();
const ring: string[] = [];
for (let f = 0; f < 60 * 60; f++) {
  const cb = rafQueue.shift();
  if (!cb) break;
  t += 1000 / 60;
  botStep(game, bot, aggressive);
  cb(t);
  const p = game.player;
  if (process.env.TRACE_SIM === "1" && f % 300 === 0) {
    console.log(`   t=${(f / 60).toFixed(0)}s x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} v=${p.speed().toFixed(0)} attached=${p.attached ? 1 : 0} glide=${game.gliding ? 1 : 0} aim=${game.aim ? Math.round(game.aim.x) : "none"} gate=${game.gateHole?.x ?? "none"}`);
  }
  let near = "";
  game.world.eachNear(p.x + 260, (o) => {
    if (o.kind !== "spire") return;
    const dx = o.x - p.x;
    if (dx < -200 || dx > 700) return;
    near += ` spire@${o.x.toFixed(0)}tip${o.tip.toFixed(0)}`;
  });
  ring.push(
    `f=${f} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} v=${p.speed().toFixed(0)} att=${p.attached ? 1 : 0}${p.attached ? ` a=(${p.ax.toFixed(0)},${p.ay.toFixed(0)}) rope=${p.rope.toFixed(0)}` : ""} arm=${game.aim ? `(${game.aim.x.toFixed(0)},${game.aim.y.toFixed(0)})` : "n"} glide=${game.gliding ? 1 : 0} hold=${bot.holding ? 1 : 0}${near}`,
  );
  if (ring.length > 100) ring.shift();
  if (game.state !== "playing") {
    console.log("ENDED:", game.state, game.cause);
    break;
  }
}
console.log(ring.filter((_, i) => i % 8 === 0).join("\n"));
