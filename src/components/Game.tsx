import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Coins,
  Trophy,
  Gauge,
  Pause,
  ShieldCheck,
  Magnet,
  Home,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  Info,
  Wind,
  Lock,
  Flag,
  Waves,
  Trees,
  Snowflake,
  Flame,
  Rocket,
  Building2,
  Sun,
  Droplets,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Game, MAX_LEVELS, type Snap } from "../game/engine";
import { themeForLevel, type ThemeId } from "../game/world";
import { THEME_DEFS } from "../game/themes";
import { ChunkyButton, RoundButton, Panel, Sticker } from "./ui";
import HowToPlay from "./HowToPlay";
import AnnounceOverlay from "./Announce";

const causeText: Record<string, string> = {
  lava: "splattered on the avenue",
  spike: "clipped a construction girder",
  saw: "swatted by a patrol drone",
  spire: "flew straight into a tower",
  fire: "roasted on a burning rooftop",
  fish: "kissed a very big fish",
  drone: "shot down by a hunter drone",
};

const initialSnap: Snap = {
  state: "menu",
  level: 0,
  unlocked: 0,
  theme: "city",
  dist: 0,
  coins: 0,
  best: 0,
  newBest: false,
  muted: false,
  maxSpeed: 0,
  cause: "",
  showHint: false,
  shield: false,
  magnetT: 0,
  tip: null,
  graceT: 0,
  gliding: false,
  announce: null,
  lowAlt: 0,
  windGain: 0,
  gateM: 250,
  segStart: 0,
  missed: false,
};

const THEME_ICON: Record<ThemeId, typeof Wind> = {
  city: Building2,
  jungle: Trees,
  underwater: Waves,
  desert: Sun,
  ice: Snowflake,
  volcano: Flame,
  space: Rocket,
  neon: Droplets,
};

/** Worlds are grouped in fives; you pick a world, and it starts at its first level. */
const WORLDS = Array.from({ length: MAX_LEVELS / 5 }, (_, i) => i * 5);

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [mouseIdle, setMouseIdle] = useState(false);
  const [help, setHelp] = useState(false);
  const [world, setWorld] = useState(0); // world index, not level index

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, (s) => setSnap(s));
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  // cursor hides only while swinging with an idle mouse
  useEffect(() => {
    let timer = window.setTimeout(() => setMouseIdle(true), 1600);
    const wake = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      setMouseIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setMouseIdle(true), 1600);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      clearTimeout(timer);
    };
  }, []);

  // swallow game hotkeys while the help sheet is open
  useEffect(() => {
    if (!help) return;
    const block = (e: KeyboardEvent) => {
      if (e.code === "Escape") setHelp(false);
      e.stopPropagation();
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup", block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup", block, true);
    };
  }, [help]);

  // keep the picker on the furthest world the player has opened
  useEffect(() => {
    if (snap.state === "menu") setWorld(Math.floor(snap.unlocked / 5));
  }, [snap.state, snap.unlocked]);

  const playing = snap.state === "playing" || snap.state === "dying";
  const hideCursor = snap.state === "playing" && mouseIdle && !help;
  const theme = THEME_DEFS[snap.theme];

  const worldStart = WORLDS[world];
  const worldUnlocked = snap.unlocked >= worldStart;
  const worldThemes = useMemo(
    () =>
      Array.from({ length: 5 }, (_, k) => {
        const lv = worldStart + k;
        const tid = themeForLevel(lv);
        return { lv, tid, def: THEME_DEFS[tid] };
      }),
    [worldStart],
  );
  const worldName = THEME_DEFS[themeForLevel(worldStart)].name;
  const worldTag = THEME_DEFS[themeForLevel(worldStart)].tag;
  const WorldIcon = THEME_ICON[themeForLevel(worldStart)];

  const openHelp = () => {
    gameRef.current?.pause();
    setHelp(true);
  };

  const gateM = Math.max(snap.gateM, snap.segStart + 1);
  const progress = Math.min(
    1,
    Math.max(0, (snap.dist - snap.segStart) / (gateM - snap.segStart)),
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070b22]">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 block h-full w-full touch-none ${
          hideCursor ? "cursor-none" : "cursor-pointer"
        } ${help ? "pointer-events-none" : ""}`}
      />

      <div className="vignette pointer-events-none absolute inset-0" />

      {/* ============ HUD ============ */}
      {playing && !help && (
        <div className="pointer-events-none absolute inset-0">
          {/* distance + gate progress */}
          <div className="absolute inset-x-0 top-3 flex flex-col items-center">
            <div className="font-display text-5xl font-extrabold leading-none text-white/95 [text-shadow:0_3px_0_rgba(8,10,30,0.55),0_10px_26px_rgba(0,0,0,0.55)] sm:text-6xl">
              {snap.dist}
              <span className="ml-1.5 text-lg font-bold text-white/35">
                /{gateM}m
              </span>
            </div>
            <div className="mt-2 flex w-[200px] items-center gap-2 sm:w-[260px]">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/45">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${progress * 100}%`,
                    background: theme.trim,
                  }}
                />
              </div>
              <Flag size={12} className="shrink-0 text-white/45" />
            </div>
            {snap.missed && (
              <div className="font-display mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff8b9d]">
                gate missed · next at {gateM} m
              </div>
            )}
          </div>

          {/* controls */}
          <div className="pointer-events-auto absolute left-3 top-3 flex gap-1.5 sm:left-4 sm:top-4">
            <RoundButton onClick={() => gameRef.current?.pause()} title="Pause (P)" ariaLabel="Pause">
              <Pause size={15} />
            </RoundButton>
            <RoundButton onClick={() => gameRef.current?.start()} title="Restart (R)" ariaLabel="Restart">
              <RotateCcw size={15} />
            </RoundButton>
            <RoundButton onClick={openHelp} title="How to play" ariaLabel="How to play">
              <HelpCircle size={15} />
            </RoundButton>
          </div>

          {/* coins + live power-ups */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4">
            <div className="font-display flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#12172c]/80 px-3 py-2 text-base font-bold leading-none text-[#e8b64a]">
              <Coins size={14} />
              {snap.coins}
            </div>
            {snap.shield && (
              <div className="font-display flex items-center gap-1.5 rounded-xl border border-[#40d6aa]/40 bg-[#12172c]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8ff0d2]">
                <ShieldCheck size={12} /> shield
              </div>
            )}
            {snap.magnetT > 0 && (
              <div className="font-display flex items-center gap-1.5 rounded-xl border border-[#e86082]/40 bg-[#12172c]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff9db0]">
                <Magnet size={12} /> {Math.ceil(snap.magnetT)}s
              </div>
            )}
            {snap.gliding && (
              <div className="font-display flex items-center gap-1.5 rounded-xl border border-[#5cc8ea]/40 bg-[#12172c]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fdcff]">
                <Wind size={12} /> gliding
              </div>
            )}
            {snap.graceT > 0 && snap.graceT < 3 && (
              <div className="font-display flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#12172c]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                <Sparkles size={12} /> safe {Math.ceil(snap.graceT)}s
              </div>
            )}
          </div>

          {/* hazard warning — a soft edge glow, nothing more */}
          {snap.lowAlt > 0.25 && snap.state === "playing" && (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: `inset 0 -120px 110px -100px rgba(255,60,90,${(snap.lowAlt * 0.7).toFixed(2)})`,
                }}
              />
              <div className="absolute inset-x-0 bottom-24 flex justify-center">
                <div
                  className="font-display flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#ff8b9d]"
                  style={{ opacity: Math.min(1, snap.lowAlt * 1.6) }}
                >
                  <AlertTriangle size={14} />
                  {snap.gliding ? "climbing out" : "pull up"}
                </div>
              </div>
            </>
          )}

          {/* GLIDE */}
          <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center sm:bottom-6 sm:right-5">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                gameRef.current?.setGlide(true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                gameRef.current?.setGlide(false);
              }}
              onPointerLeave={() => gameRef.current?.setGlide(false)}
              onPointerCancel={() => gameRef.current?.setGlide(false)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Glide"
              className={`font-display flex h-[68px] w-[68px] select-none flex-col items-center justify-center gap-0.5 rounded-full border text-[9px] font-bold uppercase tracking-[0.12em] transition-colors duration-100 ${
                snap.gliding
                  ? "border-[#5cc8ea]/60 bg-[#2a6f8c] text-white"
                  : "border-white/12 bg-[#12172c]/80 text-white/60"
              }`}
            >
              <Wind size={20} strokeWidth={2.4} />
              glide
            </button>
            <div className="font-display mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              hold · shift
            </div>
          </div>

          {/* contextual lesson — flat, quiet */}
          {snap.tip && (
            <div className="absolute inset-x-0 bottom-6 flex justify-center px-3">
              <div className="anim-pop-in flex max-w-md items-start gap-2.5 rounded-xl border border-white/10 bg-[#0e1226]/90 px-3.5 py-2.5 backdrop-blur-sm">
                <div className="mt-0.5 shrink-0 text-white/40">
                  {snap.tip.tone === "danger" ? (
                    <AlertTriangle size={15} />
                  ) : snap.tip.tone === "good" ? (
                    <Sparkles size={15} />
                  ) : (
                    <Info size={15} />
                  )}
                </div>
                <div>
                  <div className="font-display text-[13px] font-bold leading-tight text-white/90">
                    {snap.tip.title}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold leading-snug text-white/45">
                    {snap.tip.text}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ MENU ============ */}
      {snap.state === "menu" && !help && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          <h1 className="anim-pop-in font-display text-[58px] font-extrabold leading-[0.9] tracking-tight text-white [text-shadow:0_6px_24px_rgba(0,0,0,0.7)] sm:text-[76px]">
            WEBBY<span className="text-[#e8465f]">!</span>
          </h1>
          <p className="anim-pop-in mt-2.5 max-w-xs text-[13px] font-semibold leading-relaxed text-white/40">
            Swing 250 m, then drop through the hole in the street.
          </p>

          <div className="anim-pop-in-d1 mt-7 flex w-full max-w-sm flex-col items-center gap-3">
            {/* world picker: one world, five levels, no wall of tiles */}
            <div className="flex w-full items-center justify-between gap-2">
              <button
                onClick={() => setWorld((w) => Math.max(0, w - 1))}
                disabled={world === 0}
                aria-label="Previous world"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#12172c]/80 text-white/55 transition-colors hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center gap-2">
                  <WorldIcon size={15} style={{ color: THEME_DEFS[themeForLevel(worldStart)].trim }} />
                  <span className="font-display truncate text-xl font-extrabold text-white">
                    {worldName}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  {worldTag} · world {world + 1}/{WORLDS.length}
                </div>
                {!worldUnlocked && (
                  <div className="font-display mt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                    <Lock size={11} /> clear world {world} first
                  </div>
                )}
                {/* level pips: which of this world's five stretches are open */}
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {Array.from({ length: 5 }, (_, k) => {
                    const lv = worldStart + k;
                    const open = lv <= snap.unlocked;
                    return (
                      <span
                        key={k}
                        className="h-1.5 w-6 rounded-full"
                        style={{
                          background: open
                            ? THEME_DEFS[themeForLevel(lv)].trim
                            : "rgba(255,255,255,0.12)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setWorld((w) => Math.min(WORLDS.length - 1, w + 1))}
                disabled={world === WORLDS.length - 1}
                aria-label="Next world"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#12172c]/80 text-white/55 transition-colors hover:text-white disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <button
              onClick={() => gameRef.current?.start(worldUnlocked ? worldStart : 0)}
              aria-label="Play"
              className="font-display mt-1 flex items-center gap-2.5 rounded-xl border-b-2 border-[#8f1f33] bg-[#e8465f] px-8 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#f4576f] active:translate-y-[3px] active:border-b-0"
            >
              <Play className="h-5 w-5 fill-current" />
              play
            </button>

            {/* a compact preview of what the world holds */}
            <div className="flex items-center justify-center gap-1.5">
              {worldThemes.map(({ lv, def }) => (
                <span
                  key={lv}
                  title={def.name}
                  className="rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{
                    borderColor: `${def.trim}44`,
                    color: lv <= snap.unlocked ? def.trim : "rgba(255,255,255,0.25)",
                    background: "rgba(10,13,28,0.7)",
                  }}
                >
                  lv{lv + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="anim-pop-in-d2 mt-7 flex items-center gap-2">
            <ChunkyButton tone="ghost" size="sm" onClick={() => setHelp(true)}>
              <HelpCircle size={13} />
              how to play
            </ChunkyButton>
            <RoundButton
              onClick={() => gameRef.current?.toggleMute()}
              title="Sound (M)"
              ariaLabel="Sound"
            >
              {snap.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </RoundButton>
          </div>

          {snap.best > 0 && (
            <div className="anim-pop-in-d2 absolute bottom-6">
              <Sticker tone="gold">
                <Trophy size={11} /> best {snap.best} m
              </Sticker>
            </div>
          )}
        </div>
      )}

      {/* ============ PAUSE ============ */}
      {snap.state === "paused" && !help && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05070f]/60 px-6 backdrop-blur-sm">
          <Panel className="anim-pop-in w-full max-w-xs p-6 text-center">
            <h2 className="font-display text-3xl font-extrabold text-white">PAUSED</h2>
            <p className="mt-1.5 text-[11px] font-semibold text-white/40">
              level {snap.level + 1} · {snap.dist}/{gateM} m · {snap.coins} coins
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.resume()}>
                <Play size={14} className="fill-current" />
                Resume
              </ChunkyButton>
              <ChunkyButton tone="dark" size="md" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={14} />
                Restart
              </ChunkyButton>
              <div className="flex gap-2.5">
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => setHelp(true)}>
                  <HelpCircle size={12} />
                  Help
                </ChunkyButton>
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => gameRef.current?.toMenu()}>
                  <Home size={12} />
                  Menu
                </ChunkyButton>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ============ LEVEL CLEAR ============ */}
      {snap.state === "levelup" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="flex w-full max-w-xs flex-col items-center text-center">
            <h2 className="anim-pop-in font-display text-4xl font-extrabold leading-none text-white">
              LEVEL {snap.level + 1} CLEAR
            </h2>
            <Panel className="anim-pop-in-d1 mt-4 w-full px-5 py-4">
              <div className="font-display text-lg font-bold text-white/85">
                {gateM} m · {snap.coins} coins
              </div>
              <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                next world
              </div>
              <div
                className="font-display mt-1 text-2xl font-extrabold"
                style={{ color: THEME_DEFS[themeForLevel(snap.level + 1)].trim }}
              >
                {THEME_DEFS[themeForLevel(snap.level + 1)].name}
              </div>
            </Panel>
            <p className="anim-pulse-soft font-display mt-3.5 text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
              progress saved
            </p>
          </div>
        </div>
      )}

      {/* ============ DEATH ============ */}
      {snap.state === "dead" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#05070f]/50 px-6 backdrop-blur-[2px]">
          <div className="flex w-full max-w-xs flex-col items-center text-center">
            <h2 className="anim-pop-in font-display text-5xl font-extrabold leading-none text-[#e8465f]">
              SPLAT!
            </h2>
            <p className="anim-pop-in mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
              {causeText[snap.cause] ?? "end of the line"}
            </p>

            {snap.newBest && (
              <div className="anim-pop-in mt-3">
                <Sticker tone="gold">
                  <Trophy size={11} /> new best
                </Sticker>
              </div>
            )}

            <Panel className="anim-pop-in-d1 mt-4 w-full px-5 py-4">
              <div className="font-display text-5xl font-extrabold leading-none text-white">
                {snap.dist}
                <span className="ml-1 text-base font-bold text-white/30">
                  /{gateM} m
                </span>
              </div>
              <div className="font-display mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                level {snap.level + 1} · {theme.name}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3.5">
                <div>
                  <Trophy size={13} className="mx-auto text-[#e8b64a]" />
                  <div className="font-display mt-1 text-base font-bold text-white/90">
                    {snap.best}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">best</div>
                </div>
                <div>
                  <Coins size={13} className="mx-auto text-[#e8b64a]" />
                  <div className="font-display mt-1 text-base font-bold text-white/90">
                    {snap.coins}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">coins</div>
                </div>
                <div>
                  <Gauge size={13} className="mx-auto text-[#5cc8ea]" />
                  <div className="font-display mt-1 text-base font-bold text-white/90">
                    {Math.round(snap.maxSpeed / 10)}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">km/h</div>
                </div>
              </div>
            </Panel>

            <div className="anim-pop-in-d2 pointer-events-auto mt-4 flex items-center gap-2.5">
              <ChunkyButton tone="primary" size="lg" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={15} strokeWidth={2.4} />
                Fly again
              </ChunkyButton>
              <RoundButton onClick={() => gameRef.current?.toMenu()} title="Menu" ariaLabel="Menu">
                <Home size={15} />
              </RoundButton>
            </div>
            <p className="anim-pop-in-d2 mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/20">
              tap anywhere · R
            </p>
          </div>
        </div>
      )}

      {/* ============ CALLOUTS ============ */}
      {snap.announce && !help && <AnnounceOverlay data={snap.announce} />}

      {/* ============ HOW TO PLAY ============ */}
      {help && (
        <HowToPlay
          onClose={() => setHelp(false)}
          onReplayTips={() => {
            gameRef.current?.resetTutorial();
            setHelp(false);
          }}
        />
      )}
    </div>
  );
}
