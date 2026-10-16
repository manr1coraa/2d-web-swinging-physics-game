import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game, LEVEL_METERS } from "../src/game/engine";
import { botStep, newBot } from "./bot";

interface Result {
  level: number;
  dist: number;
  state: string;
  cause: string;
  cleared: boolean;
  seconds: number;
  x: number;
}

function play(level: number, maxSeconds = 120, aggressive = true): Result {
  void 0;
  rafQueue.length = 0;
  const game = new Game(canvas as unknown as HTMLCanvasElement, () => {});
  game.start(level);
  (game as unknown as { last: number }).last = 0; // deterministic dt
  const bot = newBot();
  let t = 0;
  let frames = 0;
  let cleared = false;
  const campaign = process.env.CAMPAIGN === "1";
  const transitions: string[] = [];
  let logFrames = true;
  let startLevel = level;
  let watchdogX = -1;
  let stuckFrames = 0;

  while (frames < maxSeconds * 60) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    frames++;
    botStep(game, bot, aggressive);
    cb(t);
    if (game.state === "levelup") {
      cleared = true;
      if (!campaign) break;
      // let the gate cutscene play out, then keep playing the next world
      while (game.state === "levelup" && frames < maxSeconds * 60 * 3) {
        const cb2 = rafQueue.shift();
        if (!cb2) break;
        t += 1000 / 60;
        frames++;
        cb2(t);
      }
      if (game.state === "playing" && game.level > startLevel) {
        transitions.push(`level ${game.level + 1} (${game.theme})`);
        startLevel = game.level;
        cleared = false;
      } else if (logFrames) {
        logFrames = false;
      }
      continue;
    }
    if (game.state === "dead" || game.state === "dying") break;
    const x = Math.round(game.player.x / 40);
    if (x <= watchdogX) stuckFrames++;
    else stuckFrames = 0;
    watchdogX = Math.max(watchdogX, x);
    if (stuckFrames > 60 * 4) {
      // the harness monkey sat on the button too long: bail out and glide
      (game as unknown as { onKeyUp: (e: { code: string; preventDefault(): void }) => void }).onKeyUp({
        code: "Space",
        preventDefault() {},
      });
      bot.holding = false;
      game.setGlide(true);
    }
    if (stuckFrames > 60 * 12) break; // 12s without progress — a dead end
  }
  const res: Result = {
    level,
    dist: game.distM,
    state: game.state,
    cause: game.cause,
    cleared,
    seconds: frames / 60,
    x: Math.round(game.player.x),
  };
  game.dispose();
  for (const tr of transitions) console.log(`   ↳ cleared into ${tr}`);
  return res;
}

const args = process.argv.slice(2).map((a) => a.toUpperCase());
const aggressive = !args.includes("SAFE");
const nums = args.filter((a) => /^\d+$/.test(a)).map((a) => parseInt(a, 10) - 1);
const levels = nums.length ? nums : Array.from({ length: 8 }, (_, i) => i);

let clears = 0;
for (const lv of levels) {
  const r = play(lv, 120, aggressive);
  if (r.cleared) clears++;
  const tag = r.cleared ? "CLEAR" : `${r.state}${r.cause ? ":" + r.cause : ""}`;
  console.log(
    `L${String(lv + 1).padStart(2)} ${tag.padEnd(16)} dist=${String(r.dist).padStart(3)}/${LEVEL_METERS}m x=${String(r.x).padStart(6)} t=${r.seconds.toFixed(1)}s`,
  );
}
console.log(`\ncleared ${clears}/${levels.length}`);
