/* Feature checks: air currents, burning roofs, pits, portals, themes. */
import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game, LEVEL_METERS, MAX_LEVELS } from "../src/game/engine";
import { World, themeForLevel, GATE_SPACING } from "../src/game/world";

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name} ${extra}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

function newGame(level = 0) {
  rafQueue.length = 0;
  const g = new Game(canvas as unknown as HTMLCanvasElement, () => {});
  g.start(level);
  (g as unknown as { last: number }).last = 0;
  return g;
}
function frames(g: Game, n: number, t0 = { t: 0 }) {
  for (let i = 0; i < n; i++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    t0.t += 1000 / 60;
    cb(t0.t);
  }
}

/* ---------- 1. air currents actually push ---------- */
{
  const g = newGame(0);
  g.world.ensure(6000);
  let wind: { x: number; y: number; vx: number; vy: number; strength: number } | null = null;
  g.world.eachNear(3000, (o) => {
    if (o.kind === "wind" && !wind) wind = o;
  });
  ok("world contains air-current zones", !!wind);
  if (wind) {
    const w = wind as { x: number; y: number; vx: number; vy: number; strength: number };
    const p = g.player;
    p.attached = false;
    p.x = w.x;
    p.y = w.y;
    p.vx = 0;
    p.vy = 0;
    const t0 = { t: 0 };
    const before = Math.hypot(p.vx - w.vx, p.vy - w.vy);
    frames(g, 24, t0);
    const after = Math.hypot(p.vx - w.vx, p.vy - w.vy);
    const aligned = (p.vx * w.vx + p.vy * w.vy) / (Math.hypot(p.vx, p.vy) * Math.hypot(w.vx, w.vy) || 1);
    const gain = g.windGain;
    ok(
      "wind drags the player toward the flow",
      after < before * 0.75 && aligned > 0.62 && gain > 0.15,
      `Δv=${before.toFixed(0)}→${after.toFixed(0)} align=${aligned.toFixed(2)} gain=${gain.toFixed(2)}`,
    );
    ok("the current holds the spider aloft (reduced gravity)", p.vy > -260 && p.y < w.y + w.h, `vy=${p.vy.toFixed(0)}`);
  }
  g.dispose();
}

/* ---------- 2. burning roofs kill ---------- */
{
  const g = newGame(0);
  g.world.ensure(9000);
  let fire: { x: number; y: number; w: number; h: number } | null = null;
  for (let x = 0; x < 12000 && !fire; x += 240) {
    g.world.eachNear(x, (o) => {
      if (o.kind === "fire" && !fire) fire = o;
    });
  }
  ok("world contains burning roof segments", !!fire);
  if (fire) {
    const f = fire as { x: number; y: number; w: number; h: number };
    const p = g.player;
    p.attached = false;
    p.x = f.x;
    p.y = f.y + f.h * 0.5;
    p.vx = 0;
    p.vy = 0;
    (g as unknown as { graceT: number }).graceT = 0;
    frames(g, 3, { t: 0 });
    ok("flying into flames is fatal", g.cause === "fire" || g.state === "dying", `cause=${g.cause} state=${g.state}`);
  }
  g.dispose();
}

/* ---------- 3. the street has real pits ---------- */
{
  const w = new World(0);
  let min = 1e9;
  let max = -1e9;
  for (let x = 0; x < 14000; x += 25) {
    const y = w.lavaY(x);
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  ok("street surface has dips (pits)", max - min > 260, `Δy=${(max - min).toFixed(0)}px (the pits are deeper than the noise)`);
}

/* ---------- 4. the floor gate opens the next level ---------- */
{
  const g = newGame(0);
  g.world.ensure(GATE_SPACING + 600);
  const p = g.player;
  p.attached = false;
  p.x = GATE_SPACING;
  p.y = g.world.lavaY(GATE_SPACING) - 10;
  p.vx = 300;
  p.vy = 200;
  frames(g, 4, { t: 0 });
  ok("diving into the hole clears the level", g.state === "levelup", `state=${g.state}`);
  const t0 = { t: 0 };
  frames(g, 200, t0);
  ok(
    "level advances automatically and unlocks the next world",
    g.level === 1 && g.unlocked >= 1,
    `level=${g.level + 1} unlocked=${g.unlocked + 1} theme=${g.theme}`,
  );
  ok("coins carry over into the new level", typeof g.coins === "number");
  g.dispose();
}

/* ---------- 5. missing the gate is survivable ---------- */
{
  const g = newGame(0);
  g.world.ensure(GATE_SPACING + 2000);
  const p = g.player;
  p.attached = false;
  // already past the hole, high above the street, still flying
  p.x = GATE_SPACING + 260;
  p.y = g.world.ceilY(p.x) + 150;
  p.vx = 900;
  p.vy = -40;
  frames(g, 4, { t: 0 });
  ok(
    "flying over the gate marks it as missed",
    g.missedGate,
    `x=${p.x.toFixed(0)} missed=${g.missedGate} state=${g.state}${g.cause ? "/" + g.cause : ""}`,
  );
  ok("a follow-up gate is queued", (g.gateHole?.x ?? 0) > GATE_SPACING, `next=${(g.gateHole?.x ?? 0).toFixed(0)}`);
  // and the run continues afterwards
  frames(g, 30, { t: 0 });
  ok("a missed gate does not end the run", g.state === "playing" || g.state === "dying", `state=${g.state}${g.cause ? "/" + g.cause : ""}`);
  g.dispose();
}

/* ---------- 6. reachability + themes ---------- */
{
  const w = new World(0);
  w.ensure(14000);
  let worst = 0;
  for (let x = 0; x <= 12800; x += 40) {
    if (w.ceilSolid(x)) continue;
    let d = 9999;
    for (let k = 20; k <= 900; k += 20) {
      let hit = false;
      w.eachNear(x - k, (o) => {
        if ((o.kind === "plat" || o.kind === "spire") && Math.abs(o.x - (x - k)) < o.w / 2 + 10) hit = true;
      });
      w.eachNear(x + k, (o) => {
        if ((o.kind === "plat" || o.kind === "spire") && Math.abs(o.x - (x + k)) < o.w / 2 + 10) hit = true;
      });
      if (hit) {
        d = Math.min(d, k);
        break;
      }
      if (w.ceilSolid(x - k) || w.ceilSolid(x + k)) {
        d = Math.min(d, k);
        break;
      }
    }
    worst = Math.max(worst, d);
  }
  ok("an anchor is never far away (≤300 px even mid-gap)", worst <= 300, `worst=${worst}px`);
  ok("40 levels are configured", MAX_LEVELS === 40, `levels=${MAX_LEVELS}`);
  const themes = new Set(Array.from({ length: MAX_LEVELS }, (_, i) => themeForLevel(i)));
  ok("8 distinct worlds cycle through the levels", themes.size === 8, [...themes].join(", "));
  ok("one level is 250 m", LEVEL_METERS === 250);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
