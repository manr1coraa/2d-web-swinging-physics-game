# WEBBY! — rooftop parkour over an endless city

A 2D web-swinging parkour game. You are a small spider-person in a woven suit,
running the rooftops of an endless flat-vector city. There is **no ceiling**:
the sky is open, and the only deadly surface is the street far below.

- **Auto-attack web.** In the air the silk snaps by itself to the nearest good
  anchor — parapet corners, chimneys, water towers, masts, crane jibs, and
  grabs on building facades. A dashed aim line shows where the next strand
  will land.
- **Hold to pump and reel.** Holding the line (SPACE / touch / WEB button)
  pumps the swing and reels you *up* the strand — that is how you climb the
  city. Release on the upswing for free flight; a release at the sweet spot is
  a **PERFECT** release and grants a longer ballistic arc (never a speed boost).
- **Mantle & wall-kick.** Reel a line all the way to a ledge and the runner
  vaults over the edge onto the roof. Touching a facade lets you wall-kick
  (jump) off it, so alleys are never dead ends.
- **Grounded parkour.** Run with A/D, jump with W (coyote-time included),
  spin in the air for flips and flow combos, glide with SHIFT (web holstered).
- **Hazards.** Hard props (chimneys, water towers, masts, AC boxes, billboards,
  vents, cranes, scaffolds) kill on a fast side hit and stumble you on a slow
  one; patrol drones kill on contact; clotheslines, roof gardens and skylights
  pass through. Soft props never kill.
- **Districts & checkpoints.** Every district is exactly **250 m** and ends at
  a wooden Waymark arch: pass through the visible hoop (no magnetism) to clear
  the checkpoint. Eight themed districts cycle forever while the pace climbs:
  Old Harbour, Brickline, Mosslight Row, Glassmarket, Amber Row, Pinewharf,
  Cloudbreak Heights, Seabreeze Coast.
- **Saving.** Progress lives in `localStorage` (`webby_save_v2`): unlocked
  district, continue point, best distance, spools, flips, max altitude, run
  counter, mute and seen hints. Dying restarts the current district; unlocks
  stay.

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Hold / release web | `SPACE`, `ENTER`, pointer on canvas | `WEB` button, tap canvas |
| Run / spin | `A` `D` or `←` `→` | `SPIN ⟲ ⟳` buttons |
| Jump / wall-kick | `W` `↑` `K` | `JUMP` button |
| Glide | `SHIFT` `G` `↓` `S` | `GLIDE` button |
| Pause / restart / mute | `P`/`ESC`, `R`, `M` | HUD buttons |

## Run it

```bash
npm ci
npm run dev        # vite dev server on :5173 (host 0.0.0.0, strict port)
npm run build      # single-file bundle in dist/index.html
npm run preview    # serves dist/ on :4173
```

## Tools & regression checks

Headless tools live in `tools/` (their own `node_modules`, bundles are
git-ignored). Rebuild bundles after editing tools or the game:

```bash
npm i --no-save --prefix tools jsdom @napi-rs/canvas esbuild   # once
for t in sim gaps ab lazy bot; do
  npx --prefix tools esbuild tools/$t.ts --bundle --format=cjs --platform=node --outfile=tools/$t.cjs
done
for t in e2e perf spike; do
  npx --prefix tools esbuild tools/$t.ts --bundle --format=esm --platform=node \
    --outfile=tools/$t.mjs --external:jsdom --external:@napi-rs/canvas
done
```

| Command | What it checks |
| --- | --- |
| `npx tsc --noEmit` | typecheck of `src/` |
| `npm run build` | production single-file build |
| `node tools/sim.cjs SAFE [level]` | the built-in bot plays a district end to end (`TRACE_SIM=1` samples) |
| `node tools/gaps.cjs` | every roof gap is jumpable/swingable |
| `node tools/lazy.cjs 1` | world generation stays lazy & pruned |
| `node tools/ab.cjs` | springy rope vs the frozen rigid baseline in `tools/orig/` |
| `node tools/mechanics.cjs` | mechanics matrix (WIP: porting to the city API) |
| `node tools/e2e.mjs` | UI flow in jsdom (WIP: porting to the city API) |
| `node tools/render.mjs` | renders real PNG frames with `@napi-rs/canvas` for visual checks |

`tools/orig/` is a frozen copy of the pre-spring engine used only as the A/B
baseline — never edit it.

## Architecture

- `src/game/world.ts` — lazy city generator: buildings, roof segments, props,
  anchors (ledge/prop/wall), drones, Waymark gates, hazards, raycasts.
- `src/game/engine.ts` — physics & game loop: Verlet rope web, auto-anchor
  search, mantle, wall-kick, glide, tricks, checkpoints, saving hooks.
- `src/game/player.ts` — runner state, stance, rope nodes, attach/detach.
- `src/game/renderer.ts` — flat-vector city painter: parallax skyline, street,
  facades, roof decks, props, the articulated spider-person, web, particles.
- `src/game/themes.ts` — eight district palettes + ambient flavour.
- `src/game/save.ts` — `localStorage` save/migrate/clear.
- `src/game/audio.ts`, `src/game/particles.ts` — SFX and particle pool.
- `src/components/` — React shell: HUD, menu with district carousel, field
  guide, pause/checkpoint/run-over panels.
