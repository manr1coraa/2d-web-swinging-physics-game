/* Compare the preserved rigid-pendulum baseline with the spring-web revision. */
import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game as NewGame } from "../src/game/engine";
import { Game as OrigGame } from "./orig/engine";

const FRAMES = 150;
const DT = 1000 / 60;
type Trace = {
  frames: number;
  samples: { x: number; y: number; vx: number; vy: number; rope: number; chord: number; speed: number; nodes: number }[];
};

function flatten(game: { world: unknown }) {
  const world = game.world as {
    ceilY: (...args: number[]) => number;
    ceilSolid: (...args: number[]) => boolean;
    lavaY: (...args: number[]) => number;
    eachNear: (...args: unknown[]) => void;
    raycast: (...args: unknown[]) => null;
    solidAt: (...args: unknown[]) => boolean;
    hazardNear?: (...args: unknown[]) => boolean;
  };
  world.ceilY = () => 118;
  world.ceilSolid = () => true;
  world.lavaY = () => 900;
  world.eachNear = () => {};
  world.raycast = () => null;
  world.solidAt = (_x: number, y: number) => y < 118;
  if (world.hazardNear) world.hazardNear = () => false;
}

function trace(GameClass: typeof NewGame, isNew: boolean): Trace {
  rafQueue.length = 0;
  const game = new GameClass(canvas as unknown as HTMLCanvasElement, () => {});
  game.start();
  (game as unknown as { last: number }).last = 0;
  flatten(game as unknown as { world: unknown });

  const player = game.player;
  player.x = 600;
  player.y = 300;
  player.vx = 520;
  player.vy = -120;
  player.attach(700, 60);
  player.rope = 220;
  player.rope0 = 220;
  game.holdWeb = true;

  const samples: Trace["samples"] = [];
  let time = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    const callback = rafQueue.shift();
    if (!callback) break;
    time += DT;
    callback(time);
    const chord = Math.hypot(player.x - player.ax, player.y - player.ay);
    samples.push({
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      rope: player.rope,
      chord,
      speed: player.speed(),
      nodes: isNew ? player.webNodes.length : 0,
    });
    if (game.state !== "playing") break;
  }

  game.dispose();
  rafQueue.length = 0;
  return { frames: samples.length, samples };
}

const original = trace(OrigGame as unknown as typeof NewGame, false);
const spring = trace(NewGame, true);

function summarize(result: Trace) {
  let maxRatio = 0;
  let maxSpeed = 0;
  let finite = true;
  for (const frame of result.samples) {
    maxRatio = Math.max(maxRatio, frame.chord / Math.max(1, frame.rope));
    maxSpeed = Math.max(maxSpeed, frame.speed);
    finite &&= [frame.x, frame.y, frame.vx, frame.vy, frame.rope, frame.chord, frame.speed].every(Number.isFinite);
  }
  return { maxRatio, maxSpeed, finite };
}

const oldStats = summarize(original);
const newStats = summarize(spring);
const comparable = Math.min(original.frames, spring.frames);
let maxPositionDifference = 0;
for (let i = 0; i < comparable; i++) {
  const a = original.samples[i];
  const b = spring.samples[i];
  maxPositionDifference = Math.max(maxPositionDifference, Math.hypot(a.x - b.x, a.y - b.y));
}

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("Rigid baseline vs spring-web physics (same starting swing)");
console.log(`  baseline: ${original.frames} frames, max tether ratio ${oldStats.maxRatio.toFixed(3)}, peak speed ${oldStats.maxSpeed.toFixed(0)} px/s`);
console.log(`  spring  : ${spring.frames} frames, max tether ratio ${newStats.maxRatio.toFixed(3)}, peak speed ${newStats.maxSpeed.toFixed(0)} px/s`);
console.log(`  max position difference: ${maxPositionDifference.toFixed(1)} px (expected: physics are intentionally different)`);

check("both engines complete the same 150-frame test", comparable === FRAMES && original.frames === spring.frames, `${original.frames}/${spring.frames}`);
check("legacy baseline remains taut rather than overstretching", oldStats.maxRatio <= 1.01, `ratio=${oldStats.maxRatio.toFixed(3)}`);
check("new web has a little spring travel", newStats.maxRatio >= 1.02, `ratio=${newStats.maxRatio.toFixed(3)}`);
check("new spring stretch remains bounded near the 1.16 safety limit", newStats.maxRatio <= 1.18, `ratio=${newStats.maxRatio.toFixed(3)}`);
check("new web keeps its anchor-to-spider node chain", spring.samples.every((sample) => sample.nodes === 13), "12 silk segments");
check("both trajectories stay finite", oldStats.finite && newStats.finite);
check("new swing stays inside its speed ceiling", newStats.maxSpeed <= 851, `peak=${newStats.maxSpeed.toFixed(0)} px/s`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
void TAU;
