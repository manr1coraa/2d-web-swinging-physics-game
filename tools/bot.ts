/* A scripted "competent runner" that drives the real engine through its input API. */
import type { Game } from "../src/game/engine";
import { propBox } from "../src/game/world";

export interface BotState {
  holding: boolean;
  gliding: boolean;
  runDir: number;
  lastReleaseX: number;
  jumpCd: number;
  trickT: number;
}

export function newBot(): BotState {
  return { holding: false, gliding: false, runDir: 0, lastReleaseX: 0, jumpCd: 0, trickT: 0 };
}

export function botStep(game: Game, b: BotState, aggressive = true) {
  const p = game.player;
  const w = game.world;
  const dt = 1 / 60;
  b.jumpCd = Math.max(0, b.jumpCd - dt);
  b.trickT = Math.max(0, b.trickT - dt);

  const glide = (on: boolean) => {
    if (on === b.gliding) return;
    game.setGlide(on);
    b.gliding = on;
  };
  const hold = (on: boolean) => {
    if (on === b.holding) return;
    game.setWeb(on);
    b.holding = on;
  };
  const run = (dir: -1 | 0 | 1) => {
    if (dir === b.runDir) return;
    game.setTrick(dir);
    b.runDir = dir;
  };

  /* ---------------- on a roof: parkour ---------------- */
  if (p.grounded) {
    glide(false);
    hold(false);
    run(1);
    let needJump = false;
    const roofAhead = w.roofYAt(p.x + 74);
    if (roofAhead === null) needJump = true; // a ledge: jump the alley
    else if (roofAhead < p.groundY - 20) needJump = true; // a step up
    w.eachNear(
      p.x,
      (o) => {
        if (o.kind === "token" || o.kind === "shield" || o.kind === "magnet") return;
        if (o.kind === "drone" || o.kind === "clothesline") return;
        const box = propBox(o);
        if (box.x0 < p.x + 130 && box.x1 > p.x + 6 && box.y1 > p.groundY - 46) needJump = true;
      },
      200,
    );
    // a drone hovering over the roof: leave now
    w.eachNear(
      p.x,
      (o) => {
        if (o.kind !== "drone") return;
        if (Math.abs(o.x - p.x) < 190) needJump = true;
      },
      260,
    );
    if (needJump && b.jumpCd <= 0) {
      game.jump();
      b.jumpCd = 0.42;
    }
    return;
  }

  /* ---------------- in the air ---------------- */
  const gate = game.gateHole;
  const nearGate =
    !!gate && game.state === "playing" && p.x > gate.x - 900 && p.x < gate.x + 70;

  // steer through the checkpoint hoop: glide down to it, swing up to it
  if (nearGate && gate) {
    const err = gate.y - p.y; // positive: the runner is above the hoop
    if (p.x < gate.x - 40) {
      glide(err > 26);
      hold(err < -30);
      run(0);
      return;
    }
    glide(false);
  }

  // hazard look-ahead: cut the line and climb over trouble
  let danger = false;
  let dangerDist = 999;
  if (game.state === "playing") {
    for (let k = 1; k <= 12; k++) {
      const tt = k * 0.08;
      const fx = p.x + p.vx * tt;
      const fy = p.y + p.vy * tt + 0.5 * 1200 * tt * tt;
      if (fx < p.x + 30) continue;
      if (w.hazardNear(fx, fy, 34, game.time)) {
        danger = true;
        dangerDist = Math.min(dangerDist, Math.max(0, fx - p.x));
        break;
      }
    }
  }

  // the avenue is close and there is nothing to grab: glide for a soft landing
  const alt = w.streetY - p.y;
  const noAnchor = game.aim === null;
  const sinking = p.vy > (aggressive ? 150 : 110);
  if (!nearGate && alt < (aggressive ? 180 : 250) && sinking && (noAnchor || danger)) {
    glide(true);
    hold(false);
    run(0);
    return;
  }
  glide(false);

  /* release on the upswing past the sweet spot, otherwise work the line */
  let wantHold = true;
  if (p.attached) {
    const ang = (Math.atan2(p.x - p.ax, p.y - p.ay) * 180) / Math.PI;
    const rising = p.vy < 0;
    const ahead = p.x > p.ax - 24;
    const sweet = rising && ahead && ang > (aggressive ? 20 : 32) && ang < 78 && p.vx > 110;
    const tooFar = ang > 100;
    // dangling on a short line with no pace: let go and find another roof
    const hanging = p.rope < 110 && p.speed() < 200 && Math.abs(ang) < 42;
    const stalled = p.speed() < 130 && ang > 55;
    wantHold = !(sweet || tooFar || stalled || hanging);
    if (danger && dangerDist < 320) wantHold = false;
  }
  hold(wantHold);

  // a free flight with room to spare is a chance to put up a trick
  if (!p.attached && !danger && p.airT > 0.34 && b.trickT <= 0 && !nearGate) {
    b.trickT = 0.6;
    run(p.vx > 60 ? 1 : -1);
  } else if (b.trickT <= 0 && b.runDir !== 0 && !p.grounded) {
    run(0);
  }
}
