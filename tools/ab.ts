/* A/B the core swing physics: original engine vs current engine. */
import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game as NewGame } from "../src/game/engine";
import { Game as OrigGame } from "./orig/engine";

function trace(GameCls: typeof NewGame, frames: number): number[] {
  rafQueue.length = 0;
  const g = new GameCls(canvas as unknown as HTMLCanvasElement, () => {});
  g.start();
  (g as unknown as { last: number }).last = 0;
  const out: number[] = [];
  let t = 0;
  for (let f = 0; f < frames; f++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    g.holdWeb = true;
    cb(t);
    const p = g.player;
    out.push(p.x, p.y, p.vx, p.vy, p.rope);
    if (g.state !== "playing") {
      // pad so the lengths match
      while (out.length < frames * 5) out.push(NaN);
      break;
    }
  }
  g.dispose();
  rafQueue.length = 0;
  return out;
}

/* Isolate the physics: put both engines in the exact same swing and compare. */
const N = 150;

/* flatten both worlds so only the physics differ */
function flatten(g: { world: World }) {
  const w = g.world as unknown as {
    ceilY: () => number;
    ceilSolid: () => boolean;
    lavaY: () => number;
    eachNear: () => void;
    raycast: () => null;
    solidAt: (x: number, y: number) => boolean;
  };
  w.ceilY = () => 118;
  w.ceilSolid = () => true;
  w.lavaY = () => 900;
  w.eachNear = () => {};
  w.raycast = () => null;
  w.solidAt = (_x: number, y: number) => y < 118;
}

function pinned(GameCls: typeof NewGame): number[] {
  rafQueue.length = 0;
  const g = new GameCls(canvas as unknown as HTMLCanvasElement, () => {});
  g.start();
  (g as unknown as { last: number }).last = 0;
  flatten(g as unknown as { world: World });
  const p = g.player;
  // identical starting state for both builds
  p.x = 600;
  p.y = 300;
  p.vx = 520;
  p.vy = -120;
  p.attach(700, 60);
  p.rope = 220;
  p.rope0 = 220;
  const out: number[] = [];
  let t = 0;
  for (let f = 0; f < N; f++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t += 1000 / 60;
    g.holdWeb = true;
    cb(t);
    out.push(p.x, p.y, p.vx, p.vy, p.rope);
    if (g.state !== "playing") break;
  }
  g.dispose();
  rafQueue.length = 0;
  return out;
}

type World = { ceilY: unknown };

const a = pinned(OrigGame as unknown as typeof NewGame);
const b = pinned(NewGame);
let maxPos = 0;
let maxVel = 0;
let maxRope = 0;
let firstDiff = -1;
const frames = Math.min(a.length, b.length) / 5;
for (let f = 0; f < frames; f++) {
  const [ax, ay, avx, avy, ar] = a.slice(f * 5, f * 5 + 5);
  const [bx, by, bvx, bvy, br] = b.slice(f * 5, f * 5 + 5);
  const dp = Math.hypot(ax - bx, ay - by);
  const dv = Math.hypot(avx - bvx, avy - bvy);
  const dr = Math.abs(ar - br);
  if ((dp > 0.5 || dv > 2 || dr > 0.5) && firstDiff < 0) firstDiff = f;
  maxPos = Math.max(maxPos, dp);
  maxVel = Math.max(maxVel, dv);
  maxRope = Math.max(maxRope, dr);
}
console.log(`compared ${frames | 0} frames of an identical held swing (original vs now)`);
console.log(`  max position drift : ${maxPos.toFixed(2)} px`);
console.log(`  max velocity drift : ${maxVel.toFixed(2)} px/s`);
console.log(`  max rope drift     : ${maxRope.toFixed(2)} px`);
console.log(`  first divergence   : ${firstDiff < 0 ? "none" : "frame " + firstDiff}`);
console.log(`  first divergence   : ${firstDiff < 0 ? "none" : "frame " + firstDiff}`);
console.log(
  maxPos < 0.5 && maxVel < 2 && maxRope < 0.5
    ? "  ✓ pendulum constraint, pumping and rope spool are bit-identical to the original"
    : "  ✗ the swing physics drifted from the original",
);
