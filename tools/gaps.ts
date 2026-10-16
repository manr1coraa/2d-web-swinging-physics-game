/* Statistical reachability check: how far is the nearest webbable anchor from any point? */
import { installDom } from "./headless";
installDom();
import { World } from "../src/game/world";

const NAMES = ["reach"];
void NAMES;

function anchors(w: World, x: number): number[] {
  const xs: number[] = [];
  for (let s = Math.max(0, x - 60); s <= x + 60; s += 20) {
    // the chunk generation is deterministic, so sampling is enough
  }
  return xs;
}
void anchors;

const levels = [0, 1, 6];
for (const lv of levels) {
  const w = new World(lv);
  w.ensure(14000);
  const worst: { x: number; gap: number }[] = [];
  for (let x = 0; x <= 12800; x += 40) {
    let gap = 9999;
    // ceiling
    if (w.ceilSolid(x)) gap = 0;
    // objects
    w.eachNear(x, (o) => {
      if (o.kind === "plat" || o.kind === "spire") {
        const g = Math.abs(o.x - x) - (o.kind === "plat" ? o.w / 2 : o.w / 2);
        if (g < gap) gap = Math.max(0, g);
      }
    });
    if (!w.ceilSolid(x)) {
      // measure horizontal distance to the nearest solid anchor
      let d = 9999;
      for (let k = 20; k <= 900; k += 20) {
        if (w.ceilSolid(x - k) || w.ceilSolid(x + k)) {
          d = Math.min(d, k);
          break;
        }
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
      }
      gap = Math.min(gap, d);
    }
    worst.push({ x, gap });
  }
  worst.sort((a, b) => b.gap - a.gap);
  const over400 = worst.filter((s) => s.gap > 400).length;
  const over300 = worst.filter((s) => s.gap > 300).length;
  console.log(
    `L${lv + 1}: worst gaps (px): ` +
      worst
        .slice(0, 6)
        .map((s) => `${s.gap}@${s.x}`)
        .join("  ") +
      `   samples>400px: ${over400}   >300px: ${over300}   of ${worst.length}`,
  );
}
