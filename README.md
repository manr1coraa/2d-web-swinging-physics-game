# WEBBY!

A calm 2D web-swinging game about timing, balance, and finding a comfortable rhythm. Catch a branch with a springy silk line, let go with your momentum, and wander through an endless sequence of hand-coloured landscapes.

Built with React, TypeScript, Vite, Tailwind CSS, and Canvas 2D.

## Run locally

```bash
npm ci
npm run dev       # Vite preview on port 5173
npm run build     # single-file production build in dist/index.html
```

## Controls

| Action | Keyboard | Touch / pointer |
| --- | --- | --- |
| Catch or hold a web | `Space` | Hold the playfield |
| Release and drift | Release `Space` | Lift your finger |
| Glide and soften a fall | `Shift`, `G`, or `↓` | Hold **Glide** |
| Tuck into a turn | `A` / `←` or `D` / `→` | Hold either turn button |
| Pause / fresh start / sound | `P` or `Esc` / `R` / `M` | On-screen buttons |

A caught line stretches slightly and returns a little spring; it does not snap the spider forward with an artificial launch. In the air, turns build angular momentum in the chosen direction and coast down when the input is released.

## The journey

- Pass through a wooden waymark every **250 m**. The arch is a real goal in the air, not a magnet. Miss it and the next one appears farther along.
- Gather seed-leaves and complete somersaults. Seeds and turns carry across waymarks; your longest trail is remembered locally.
- The route is endless. Each landscape lasts five waymarks, then the eight-landscape cycle repeats:
  1. Mosslight Valley
  2. Fernwood Canopy
  3. Tidal Cove
  4. Amber Dunes
  5. Pine Snowfield
  6. Autumn Orchard
  7. Cloudbreak Peaks
  8. Seabreeze Coast
- Terrain rolls gently rather than dropping into abrupt pits. The opening is quiet; hanging hazards do not appear in the first ten chunks and remain rare afterward. Wildlife is scenery, and speed rings and the old neon-city clutter are gone.

## Regression tools

The headless tools are TypeScript sources in `tools/`. Rebuild their ignored local bundles after source changes:

```bash
for t in sim gaps mechanics ab lazy; do
  npx esbuild tools/$t.ts --bundle --format=cjs --platform=node --outfile=tools/$t.cjs
done
for t in e2e perf spike; do
  npx esbuild tools/$t.ts --bundle --format=esm --platform=node \
    --outfile=tools/$t.mjs --external:jsdom --external:@napi-rs/canvas
done
```

Then run the physics, progression, and generation checks:

```bash
node tools/mechanics.cjs      # endless route, spring tether, tricks, terrain, wildlife
node tools/ab.cjs              # expected contrast: rigid baseline vs bounded spring web
node tools/gaps.cjs            # anchor reachability across generated chunks
node tools/sim.cjs SAFE        # scripted route through the eight starting landscapes
node tools/lazy.cjs 1          # diagnostic: holding the web without timing releases
```

The browser-style UI test is `tools/e2e.ts`; it needs `jsdom` and `@napi-rs/canvas` available to Node. `tools/orig/` preserves the original physics baseline for the A/B comparison.
