/* Regression checks for the relaxed spring-web physics and endless trail. */
import { installDom, rafQueue } from "./headless";
const canvas = installDom();
import { Game, LEVEL_METERS, MAX_LEVELS } from "../src/game/engine";
import { World, themeForLevel, worldOfLevel, LEVELS_PER_WORLD, GATE_SPACING, ROUTE_START_X, gateX, THEMES } from "../src/game/world";
import { WEB_SEGMENTS } from "../src/game/player";

let pass = 0;
let fail = 0;
const ok = (name: string, condition: boolean, extra = "") => {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

function newGame(level = 0) {
  rafQueue.length = 0;
  const game = new Game(canvas as unknown as HTMLCanvasElement, () => {});
  game.start(level);
  (game as unknown as { last: number }).last = 0;
  return game;
}

function frame(game: Game, time: { value: number }) {
  const callback = rafQueue.shift();
  if (!callback) return false;
  time.value += 1000 / 60;
  callback(time.value);
  return true;
}

function flattenWorld(game: Game) {
  const world = game.world as unknown as {
    ceilY: (...args: number[]) => number;
    ceilSolid: (...args: number[]) => boolean;
    lavaY: (...args: number[]) => number;
    eachNear: (...args: unknown[]) => void;
    raycast: (...args: unknown[]) => null;
    solidAt: (...args: unknown[]) => boolean;
    hazardNear: (...args: unknown[]) => boolean;
  };
  world.ceilY = () => -1000;
  world.ceilSolid = () => false;
  world.lavaY = () => 100000;
  world.eachNear = () => {};
  world.raycast = () => null;
  world.solidAt = () => false;
  world.hazardNear = () => false;
}

function chunks(world: World, count: number) {
  for (let i = 0; i < count; i++) world.chunkAt(i * world.cw + 1);
  return Array.from({ length: count }, (_, i) => world.chunks.get(i)!).filter(Boolean);
}

/* ---------- endless landscape progression ---------- */
{
  const distinct = new Set(Array.from({ length: THEMES.length * LEVELS_PER_WORLD }, (_, i) => themeForLevel(i)));
  ok("the journey has eight distinct landscapes", THEMES.length === 8 && distinct.size === 8, [...distinct].join(", "));
  ok("each landscape lasts five 250 m waymarks", Array.from({ length: 8 }, (_, world) => {
    const start = world * LEVELS_PER_WORLD;
    return Array.from({ length: LEVELS_PER_WORLD }, (_, step) => themeForLevel(start + step)).every((theme) => theme === themeForLevel(start));
  }).every(Boolean));
  ok("the eight-landscape route loops without a level cap", MAX_LEVELS === Number.POSITIVE_INFINITY && themeForLevel(40) === themeForLevel(0));
  ok("every waymark stretch is 250 m", LEVEL_METERS === 250 && GATE_SPACING === 250 * 50);
}

/* ---------- route marker geometry and the 250 m objective ---------- */
{
  const world = new World(0);
  const gx = gateX(0);
  const gateChunk = world.chunkAt(gx);
  ok("first waymark is exactly 250 m from the route start", gx - ROUTE_START_X === GATE_SPACING, `x=${gx}`);
  ok("the approach stays open rather than cutting a hole in the hillside", !gateChunk.isGap && world.ceilSolid(gx));

  const game = newGame(0);
  const target = game.gateHole!;
  ok("the active arch floats above the rolling ground", target.y < game.world.lavaY(target.x) - 100, `height=${(game.world.lavaY(target.x) - target.y).toFixed(0)}px`);
  const player = game.player;
  player.detach();
  player.x = target.x - 120;
  player.y = target.y;
  player.vx = 250;
  player.vy = 0;
  (game as unknown as { collide: () => void }).collide();
  ok("the waymark requires passing through its open center", game.state === "playing");

  player.x = target.x - 70;
  player.y = target.y;
  (game as unknown as { collide: () => void }).collide();
  ok("passing beside the arch does not count as a clear", game.state === "playing");

  player.x = target.x - 40;
  player.y = target.y;
  (game as unknown as { collide: () => void }).collide();
  ok("passing through the arch starts a calm transition", game.state === "levelup", `state=${game.state}`);
  ok("a completed stretch records exactly 250 m", game.distM === LEVEL_METERS, `distance=${game.distM}m`);

  game.coins = 7;
  game.tricks = 2;
  const time = { value: 0 };
  for (let i = 0; i < 110; i++) frame(game, time);
  ok("the next stretch opens and unlocks progression", game.state === "playing" && game.level === 1 && game.unlocked >= 1, `level=${game.level + 1}`);
  ok("the next landscape follows the first waymark", game.theme === themeForLevel(1), `theme=${game.theme}`);
  ok("collected seeds and earned turns carry between waymarks", game.coins === 7 && game.tricks === 2);
  const journeyMeters = (game as unknown as { journeyMeters: number }).journeyMeters;
  const nextWaymark = journeyMeters + Math.round(((game.gateHole?.x ?? ROUTE_START_X) - ROUTE_START_X) / 50);
  ok("the next target is 250 m farther on the cumulative journey", game.gateHole?.x === gateX(0) && journeyMeters === 250 && nextWaymark === 500, `distance=${game.distM}m next=${nextWaymark}m`);

  const collision = (game as unknown as { collide: () => void }).collide;
  for (let waymark = 1; waymark < LEVELS_PER_WORLD; waymark++) {
    const next = game.gateHole!;
    game.player.detach();
    game.player.x = next.x - 40;
    game.player.y = next.y;
    game.player.vx = 250;
    game.player.vy = 0;
    collision.call(game);
    for (let i = 0; i < 110; i++) frame(game, time);
  }
  const totalMeters = (game as unknown as { journeyMeters: number }).journeyMeters;
  ok("five waymarks open the next landscape without a level cap", game.level === LEVELS_PER_WORLD && game.theme === themeForLevel(LEVELS_PER_WORLD) && game.unlocked >= LEVELS_PER_WORLD, `next=${game.theme} distance=${totalMeters}m`);
  ok("the cumulative journey advances in exact 250 m steps", totalMeters === LEVELS_PER_WORLD * LEVEL_METERS);
  game.dispose();
}

/* ---------- quiet, coherent procedural generation ---------- */
{
  const world = new World(0);
  const generated = chunks(world, 180);
  const earlyStal = generated.slice(0, 10).some((chunk) => chunk.objs.some((object) => object.kind === "stal"));
  const stalCounts = generated.slice(10).map((chunk) => chunk.objs.filter((object) => object.kind === "stal").length);
  const stalRate = stalCounts.filter((count) => count > 0).length / Math.max(1, stalCounts.length);
  ok("hanging hazards are absent for the first ten chunks", !earlyStal);
  ok("later hanging hazards stay rare and capped at one per chunk", Math.max(...stalCounts) <= 1 && stalRate < 0.35, `chunk rate=${(stalRate * 100).toFixed(0)}%`);

  const spireCounts = generated.map((chunk) => chunk.objs.filter((object) => object.kind === "spire").length);
  const spireRate = spireCounts.filter((count) => count > 0).length / generated.length;
  ok("stone spires are also sparse and absent from the opening", spireCounts.slice(0, 10).every((count) => count === 0) && Math.max(...spireCounts) <= 1 && spireRate < 0.12, `chunk rate=${(spireRate * 100).toFixed(0)}%`);

  const kinds = new Set(generated.flatMap((chunk) => chunk.objs.map((object) => object.kind)));
  ok("the trail avoids speed rings and old lethal city clutter", !kinds.has("boost") && !kinds.has("saw") && !kinds.has("drone") && !kinds.has("fire"), [...kinds].join(", "));

  let windViolations = 0;
  for (let i = 0; i < generated.length; i++) {
    const count = generated[i].objs.filter((object) => object.kind === "wind").length;
    const next = generated[i + 1]?.objs.filter((object) => object.kind === "wind").length ?? 0;
    if (count > 1 || (count > 0 && next > 0)) windViolations++;
  }
  ok("quiet air currents never overlap or fill consecutive chunks", windViolations === 0, `violations=${windViolations}`);

  let minGround = Number.POSITIVE_INFINITY;
  let maxGround = Number.NEGATIVE_INFINITY;
  let maxStep = 0;
  for (let x = 0; x <= 16000; x += 12) {
    const y = world.lavaY(x);
    minGround = Math.min(minGround, y);
    maxGround = Math.max(maxGround, y);
    if (x > 0) maxStep = Math.max(maxStep, Math.abs(y - world.lavaY(x - 12)));
  }
  ok("the hillside varies gently without deep, abrupt pits", maxGround - minGround < 320 && maxStep < 18, `range=${(maxGround - minGround).toFixed(0)}px max step=${maxStep.toFixed(1)}px`);
}

/* ---------- flexible tether behavior ---------- */
{
  const game = newGame(0);
  flattenWorld(game);
  const player = game.player;
  player.detach();
  player.x = 600;
  player.y = 300;
  player.vx = 520;
  player.vy = -120;
  player.attach(700, 60);
  player.rope = 220;
  player.rope0 = 220;
  game.holdWeb = true;

  let maxRatio = 0;
  for (let i = 0; i < 600; i++) {
    (game as unknown as { step: (h: number) => void }).step(1 / 240);
    const chord = Math.hypot(player.x - player.ax, player.y - player.ay);
    maxRatio = Math.max(maxRatio, chord / Math.max(1, player.rope));
  }
  const nodes = player.webNodes;
  const endpointsMatch =
    nodes.length === WEB_SEGMENTS + 1 &&
    Math.hypot(nodes[0].x - player.ax, nodes[0].y - player.ay) < 0.01 &&
    Math.hypot(nodes[nodes.length - 1].x - player.x, nodes[nodes.length - 1].y - player.y) < 0.01;
  const finiteNodes = nodes.every((node) => [node.x, node.y, node.px, node.py].every(Number.isFinite));
  ok("the spring web gives a little, bounded travel", maxRatio > 1.02 && maxRatio <= 1.18, `max length/rest=${maxRatio.toFixed(3)}`);
  ok("the 12 silk segments stay ordered from anchor to spider", endpointsMatch && finiteNodes, `nodes=${nodes.length}`);
  const before = [player.vx, player.vy];
  player.detach();
  ok("releasing the web preserves velocity instead of adding a launch", !player.attached && player.webNodes.length === 0 && player.vx === before[0] && player.vy === before[1]);
  game.dispose();
}

/* ---------- trick direction, spin momentum, and score counting ---------- */
{
  const game = newGame(0);
  const player = game.player;
  player.detach();
  player.vx = 260;
  player.vy = 0;
  player.rotation = 0;
  player.lastFlipAngle = 0;
  player.angularVelocity = 0;
  const engine = game as unknown as { trickDir: -1 | 0 | 1; stepRotation: (h: number) => void };
  engine.trickDir = 1;
  for (let i = 0; i < 120; i++) engine.stepRotation(1 / 60);
  const positiveRotation = player.rotation;
  const turns = game.tricks;
  const velocityBeforeRelease = player.angularVelocity;
  engine.trickDir = 0;
  engine.stepRotation(1 / 60);
  ok("right tuck rotates in its chosen direction and completes a real turn", positiveRotation > 2 * Math.PI && turns >= 1, `angle=${positiveRotation.toFixed(1)} rad turns=${turns}`);
  ok("spin carries momentum briefly after the input is released", player.angularVelocity > 0 && player.angularVelocity < velocityBeforeRelease);
  game.dispose();

  const reverse = newGame(0);
  const p = reverse.player;
  p.detach();
  p.vx = 260;
  p.vy = 0;
  p.rotation = 0;
  p.lastFlipAngle = 0;
  p.angularVelocity = 0;
  const reverseEngine = reverse as unknown as { trickDir: -1 | 0 | 1; stepRotation: (h: number) => void };
  reverseEngine.trickDir = -1;
  for (let i = 0; i < 120; i++) reverseEngine.stepRotation(1 / 60);
  ok("left tuck follows the opposite rotation direction", p.rotation < -2 * Math.PI && reverse.tricks >= 1, `angle=${p.rotation.toFixed(1)} rad turns=${reverse.tricks}`);
  reverse.dispose();
}

/* ---------- peaceful wildlife ---------- */
{
  const game = newGame(10);
  for (let i = 0; i < 180; i++) game.world.chunkAt(i * game.world.cw + 1);
  let fish: { x: number; y: number } | null = null;
  for (const chunk of game.world.chunks.values()) {
    const found = chunk.objs.find((object) => object.kind === "fish");
    if (found?.kind === "fish") {
      fish = found;
      break;
    }
  }
  ok("tidal cove includes drifting wildlife", !!fish);
  if (fish) {
    for (const chunk of game.world.chunks.values()) chunk.objs = chunk.objs.filter((object) => object.kind === "fish");
    game.player.detach();
    game.player.x = fish.x;
    game.player.y = fish.y;
    game.player.vx = 0;
    game.player.vy = 0;
    (game as unknown as { graceT: number }).graceT = 0;
    (game as unknown as { collide: () => void }).collide();
    ok("fish are safe to pass through", game.state === "playing" && game.cause === "");
  }
  game.dispose();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
