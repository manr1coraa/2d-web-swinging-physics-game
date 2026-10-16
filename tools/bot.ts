/* A scripted "competent player" that drives the real engine through its input API. */
import type { Game } from "../src/game/engine";

type Key = { code: string; repeat?: boolean; preventDefault?: () => void };

export interface BotState {
  holding: boolean;
  gliding: boolean;
  lastReleaseX: number;
}

export function newBot(): BotState {
  return { holding: false, gliding: false, lastReleaseX: 0 };
}

const key = (code: string, repeat = false): Key => ({ code, repeat, preventDefault() {} });

export function botStep(game: Game, b: BotState, aggressive = true) {
  const g = game as unknown as {
    onKey: (e: Key) => void;
    onKeyUp: (e: Key) => void;
  };
  const p = game.player;
  const ang = p.attached ? (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI : 0;
  const rising = p.vy < 0;
  const ahead = p.x > p.ax - 20;

  // ---- gate dive: near the hole, cut the line and drop in ----
  const gate = game.gateHole;
  const diving =
    !!gate &&
    game.state === "playing" &&
    p.x > gate.x - 620 &&
    p.x < gate.x + 80 &&
    p.y < gate.y - 40;

  // ---- release logic: let go on the upswing past the sweet spot ----
  let wantHold = !diving;
  if (p.attached) {
    const sweet = rising && ahead && ang > (aggressive ? 16 : 26) && ang < 74 && p.vx > 120;
    const tooFar = ang > 96; // swung past the anchor — cut it
    const stalled = p.speed() < 120 && ang > 60;
    wantHold = !(sweet || tooFar || stalled);
  }

  if (wantHold && !b.holding) {
    g.onKey(key("Space"));
    b.holding = true;
  } else if (!wantHold && b.holding) {
    g.onKeyUp(key("Space"));
    b.holding = false;
    b.lastReleaseX = p.x;
  }

  // ---- hazard look-ahead: cut the swing or climb over trouble ----
  let danger = false;
  let dangerDist = 999;
  if (game.state === "playing") {
    for (let k = 1; k <= 14; k++) {
      const tt = k * 0.075;
      const fx = p.x + p.vx * tt;
      const fy = p.y + p.vy * tt + 0.5 * 965 * tt * tt;
      if (fx < p.x + 40) continue;
      if (game.world.hazardNear(fx, fy, 40, game.time)) {
        danger = true;
        dangerDist = Math.min(dangerDist, p.vx * tt);
        break;
      }
    }
  }
  if (danger && p.attached && b.holding && dangerDist < 340) {
    g.onKeyUp(key("Space"));
    b.holding = false;
  }

  // ---- glide when there is nothing to grab and we are dropping ----
  const needGlide =
    !diving &&
    !p.attached &&
    game.state === "playing" &&
    (danger || (game.aim === null && p.vy > 120));
  if (needGlide && !b.gliding) {
    game.setGlide(true);
    b.gliding = true;
  } else if (!needGlide && b.gliding) {
    game.setGlide(false);
    b.gliding = false;
  }
}
