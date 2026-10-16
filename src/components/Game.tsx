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
  Map,
  Waves,
  Trees,
  Snowflake,
  Flame,
  Rocket,
  Building2,
  Sun,
  Droplets,
  ChevronRight,
} from "lucide-react";
import { Game, LEVEL_METERS, MAX_LEVELS, type Snap } from "../game/engine";
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
  gateM: LEVEL_METERS,
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

/** one tile in the world picker */
function LevelTile({
  index,
  unlocked,
  selected,
  onPick,
}: {
  index: number;
  unlocked: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const tid = themeForLevel(index);
  const th = THEME_DEFS[tid];
  const Icon = THEME_ICON[tid];
  return (
    <button
      onClick={onPick}
      disabled={!unlocked}
      className={`relative flex flex-col items-start gap-0.5 overflow-hidden rounded-2xl border-b-[3px] px-2.5 py-2 text-left transition-all duration-100 ${
        unlocked
          ? selected
            ? "border-black/50 ring-2 ring-white/80"
            : "border-black/40 hover:brightness-125"
          : "cursor-not-allowed border-black/50 opacity-45"
      }`}
      style={{
        background: `linear-gradient(160deg, ${th.sky[1]}, ${th.sky[3]})`,
      }}
      title={unlocked ? `${th.name} — start here` : "Locked — clear the level before it"}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-[15px] font-extrabold leading-none text-white drop-shadow">
          {String(index + 1).padStart(2, "0")}
        </span>
        {unlocked ? (
          <Icon size={13} style={{ color: th.trim }} />
        ) : (
          <Lock size={12} className="text-white/70" />
        )}
      </div>
      <span
        className="font-display truncate text-[8.5px] font-bold uppercase tracking-[0.08em]"
        style={{ color: th.trim }}
      >
        {th.name}
      </span>
    </button>
  );
}

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [mouseIdle, setMouseIdle] = useState(false);
  const [help, setHelp] = useState(false);
  const [pick, setPick] = useState<number | null>(null);

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
      if (e.code === "Escape") {
        setHelp(false);
      }
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

  const playing = snap.state === "playing" || snap.state === "dying";
  const hideCursor = snap.state === "playing" && mouseIdle && !help;
  const theme = THEME_DEFS[snap.theme];
  const selected = pick ?? snap.unlocked;
  const selTheme = THEME_DEFS[themeForLevel(selected)];

  const levelTiles = useMemo(
    () =>
      Array.from({ length: MAX_LEVELS }, (_, i) => (
        <LevelTile
          key={i}
          index={i}
          unlocked={i <= snap.unlocked}
          selected={i === selected}
          onPick={() => setPick(i)}
        />
      )),
    [snap.unlocked, selected],
  );

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
      <div className="grain pointer-events-none absolute inset-0" />

      {/* ============ HUD ============ */}
      {playing && !help && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-2 flex flex-col items-center sm:top-3">
            <div
              className="font-display anim-pop-in mb-1 flex items-center gap-1.5 rounded-full border-b-2 border-black/45 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#06293a]"
              style={{ background: theme.trim, borderColor: "rgba(0,0,0,0.35)" }}
            >
              {(() => {
                const Icon = THEME_ICON[snap.theme];
                return <Icon size={12} />;
              })()}
              level {snap.level + 1} · {theme.name}
            </div>

            <div className="font-display text-6xl font-extrabold leading-none text-white [text-shadow:0_4px_0_rgba(8,10,30,0.5),0_14px_38px_rgba(0,0,0,0.5)] sm:text-7xl">
              {snap.dist}
              <span className="ml-1.5 text-xl font-bold text-white/40">
                /{gateM}m
              </span>
            </div>

            {/* progress to the floor gate */}
            {snap.missed && (
              <div className="font-display anim-pop-in mt-1 rounded-full bg-[#ff2d55]/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white">
                gate missed · next one at {gateM} m
              </div>
            )}
            <div className="mt-1.5 flex w-[220px] items-center gap-2 sm:w-[280px]">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full border border-black/40 bg-black/45">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${theme.trim}, #ffe79a)`,
                  }}
                />
              </div>
              <Flag size={13} className="shrink-0 text-[#ffe79a]" />
            </div>
          </div>

          <div className="pointer-events-auto absolute left-3 top-3 flex gap-2 sm:left-5 sm:top-4">
            <RoundButton onClick={() => gameRef.current?.pause()} title="Pause (P)" ariaLabel="Pause">
              <Pause size={16} />
            </RoundButton>
            <RoundButton onClick={() => gameRef.current?.start()} title="Restart (R)" ariaLabel="Restart">
              <RotateCcw size={16} />
            </RoundButton>
            <RoundButton onClick={openHelp} title="How to play" ariaLabel="How to play">
              <HelpCircle size={16} />
            </RoundButton>
          </div>

          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 sm:right-5 sm:top-4">
            <div className="font-display flex items-center gap-1.5 rounded-2xl border-b-2 border-black/40 bg-[#1b2246]/85 px-3.5 py-2.5 text-lg font-extrabold leading-none text-[#ffc53d]">
              <Coins size={15} />
              {snap.coins}
            </div>
            {snap.windGain > 0.12 && (
              <div className="font-display anim-pop-in flex items-center gap-1.5 rounded-2xl border-b-2 border-[#1a93bd] bg-[#bff2ff]/95 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#06293a]">
                <Wind size={13} /> air current
              </div>
            )}
            {snap.gliding && (
              <div className="font-display anim-pop-in flex items-center gap-1.5 rounded-2xl border-b-2 border-[#1a93bd] bg-[#49d8ff]/90 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#06293a]">
                <Wind size={13} /> gliding
              </div>
            )}
            {snap.graceT > 0 && (
              <div className="font-display flex items-center gap-1.5 rounded-2xl border-b-2 border-[#1a93bd] bg-[#49d8ff]/90 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#06293a]">
                <Sparkles size={13} /> safe {Math.ceil(snap.graceT)}s
              </div>
            )}
            {snap.shield && (
              <div className="font-display anim-pop-in flex items-center gap-1.5 rounded-2xl border-b-2 border-[#19876a] bg-[#2fe0b0]/90 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#05312a]">
                <ShieldCheck size={13} /> shield
              </div>
            )}
            {snap.magnetT > 0 && (
              <div className="font-display anim-pop-in flex items-center gap-1.5 rounded-2xl border-b-2 border-[#b83a54] bg-[#ff6b81]/90 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#3d0813]">
                <Magnet size={13} /> {Math.ceil(snap.magnetT)}s
              </div>
            )}
          </div>

          {/* low altitude warning — never die without being told */}
          {snap.lowAlt > 0.25 && snap.state === "playing" && (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: `inset 0 -140px 120px -90px rgba(255,60,90,${(snap.lowAlt * 0.85).toFixed(2)})`,
                }}
              />
              <div className="absolute inset-x-0 bottom-28 flex justify-center">
                <div
                  className="font-display flex items-center gap-2 rounded-full bg-[#ff2d55] px-5 py-2 text-sm font-extrabold uppercase tracking-[0.2em] text-white shadow-[0_8px_30px_rgba(255,45,85,0.6)]"
                  style={{ opacity: Math.min(1, snap.lowAlt * 1.6) }}
                >
                  <AlertTriangle size={15} />
                  {snap.gliding ? "climbing out" : "pull up!"}
                </div>
              </div>
            </>
          )}

          {/* GLIDE button — hold to spread the web-wings */}
          <div className="pointer-events-auto absolute bottom-5 right-4 sm:bottom-7 sm:right-6">
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
              className={`font-display flex h-[72px] w-[72px] select-none flex-col items-center justify-center gap-0.5 rounded-full border-b-[5px] text-[9px] font-extrabold uppercase tracking-[0.12em] transition-all duration-100 active:translate-y-[5px] active:border-b-0 ${
                snap.gliding
                  ? "anim-glide-chip border-[#1a93bd] bg-[#49d8ff] text-[#06293a]"
                  : "border-black/45 bg-[#1b2246]/85 text-white/75 backdrop-blur-sm"
              }`}
            >
              <Wind size={22} strokeWidth={2.6} />
              glide
            </button>
            <div className="font-display mt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
              hold · shift
            </div>
          </div>

          {/* contextual tutorial banner */}
          {snap.tip && (
            <div className="absolute inset-x-0 bottom-6 flex justify-center px-3">
              <div
                className={`anim-pop-in flex max-w-md items-start gap-3 rounded-2xl border-b-2 px-4 py-3 backdrop-blur-md ${
                  snap.tip.tone === "danger"
                    ? "border-[#b81f42] bg-[#2a1430]/95"
                    : snap.tip.tone === "good"
                      ? "border-[#19876a] bg-[#0f2a2c]/95"
                      : "border-[#1a93bd] bg-[#101f3d]/95"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${
                    snap.tip.tone === "danger"
                      ? "text-[#ff5172]"
                      : snap.tip.tone === "good"
                        ? "text-[#2fe0b0]"
                        : "text-[#49d8ff]"
                  }`}
                >
                  {snap.tip.tone === "danger" ? (
                    <AlertTriangle size={17} />
                  ) : snap.tip.tone === "good" ? (
                    <Sparkles size={17} />
                  ) : (
                    <Info size={17} />
                  )}
                </div>
                <div>
                  <div className="font-display text-sm font-extrabold leading-tight text-white">
                    {snap.tip.title}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold leading-snug text-white/60">
                    {snap.tip.text}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ MENU / WORLD PICKER ============ */}
      {snap.state === "menu" && !help && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="anim-pop-in">
            <Sticker tone="cyan">one button · {MAX_LEVELS} worlds</Sticker>
          </div>

          <h1 className="anim-pop-in-d1 mt-3 -rotate-2 font-display text-[62px] font-extrabold leading-[0.86] tracking-tight text-white [text-shadow:0_6px_0_#1a2048,0_10px_0_rgba(6,10,30,0.45),0_28px_60px_rgba(0,0,0,0.6)] sm:text-[92px]">
            WEBBY<span className="text-[#ff5172]">!</span>
          </h1>

          <p className="anim-pop-in-d1 mt-3 max-w-sm text-[13px] font-bold leading-relaxed text-white/50">
            Swing 250 m, then dive through the hole in the street. Every gate
            drops you into a new world — and your progress is saved.
          </p>

          <Panel className="anim-pop-in-d1 mt-4 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Map size={14} className="text-white/50" />
                <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/55">
                  pick a world
                </span>
              </div>
              <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/35">
                {snap.unlocked + 1}/{MAX_LEVELS} open
              </span>
            </div>
            <div className="grid max-h-[38vh] grid-cols-4 gap-1.5 overflow-y-auto p-3 sm:grid-cols-6">
              {levelTiles}
            </div>
          </Panel>

          <div className="anim-pop-in-d2 mt-4 flex flex-col items-center gap-1.5">
            <button
              onClick={() => gameRef.current?.start(selected)}
              aria-label="Play"
              className="font-display flex items-center gap-3 rounded-[26px] border-b-[6px] border-[#b81f42] bg-[#ff5172] px-8 py-4 text-lg font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_14px_40px_-6px_rgba(255,81,114,0.7)] transition-all duration-100 hover:bg-[#ff6682] active:translate-y-[6px] active:border-b-0 active:shadow-none"
              style={{
                background: `linear-gradient(180deg, ${selTheme.trim}, #ff5172)`,
                borderColor: "rgba(0,0,0,0.4)",
              }}
            >
              <Play className="h-6 w-6 fill-current" />
              play level {selected + 1}
            </button>
            <span className="font-display flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/40">
              {selTheme.name}
              <ChevronRight size={11} />
              {selTheme.tag}
            </span>
          </div>

          <div className="anim-pop-in-d2 mt-4 flex items-center gap-2.5">
            <ChunkyButton tone="dark" size="sm" onClick={() => setHelp(true)}>
              <HelpCircle size={14} />
              How to play
            </ChunkyButton>
            <RoundButton
              onClick={() => gameRef.current?.toggleMute()}
              title="Sound (M)"
              ariaLabel="Sound"
            >
              {snap.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </RoundButton>
          </div>

          {snap.best > 0 && (
            <div className="anim-pop-in-d2 absolute bottom-5">
              <Sticker tone="gold" className="rotate-[-3deg]">
                <Trophy size={12} /> best {snap.best} m
              </Sticker>
            </div>
          )}
        </div>
      )}

      {/* ============ PAUSE ============ */}
      {snap.state === "paused" && !help && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05040f]/55 px-6 backdrop-blur-md">
          <Panel className="anim-pop-in w-full max-w-xs p-6 text-center">
            <h2 className="font-display text-4xl font-extrabold text-white">PAUSED</h2>
            <p className="mt-1.5 text-xs font-bold text-white/40">
              level {snap.level + 1} · {snap.dist}/{LEVEL_METERS} m · {snap.coins} coins
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.resume()}>
                <Play size={15} className="fill-current" />
                Resume
              </ChunkyButton>
              <ChunkyButton tone="dark" size="md" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={15} />
                Restart
              </ChunkyButton>
              <div className="flex gap-2.5">
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => setHelp(true)}>
                  <HelpCircle size={13} />
                  Help
                </ChunkyButton>
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => gameRef.current?.toMenu()}>
                  <Home size={13} />
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
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="anim-pop-in anim-badge">
              <Sticker tone="gold" className="rotate-[-2deg]">
                <Flag size={12} /> gate cleared
              </Sticker>
            </div>
            <h2 className="anim-pop-in mt-3 rotate-1 font-display text-6xl font-extrabold leading-none text-[#ffe79a] [text-shadow:0_6px_0_rgba(70,40,0,0.6),0_18px_50px_rgba(255,208,110,0.4)] sm:text-7xl">
              LEVEL {snap.level + 1}!
            </h2>
            <Panel className="anim-pop-in-d1 mt-4 w-full px-5 py-4">
              <div className="font-display text-2xl font-extrabold text-white">
                {LEVEL_METERS} m · {snap.coins} coins
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                diving into
              </div>
              <div className="font-display mt-1 text-3xl font-extrabold" style={{ color: THEME_DEFS[themeForLevel(snap.level + 1)].trim }}>
                {THEME_DEFS[themeForLevel(snap.level + 1)].name}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
                {THEME_DEFS[themeForLevel(snap.level + 1)].tag}
              </div>
            </Panel>
            <p className="anim-pulse-soft font-display mt-4 text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/50">
              progress saved
            </p>
          </div>
        </div>
      )}

      {/* ============ DEATH ============ */}
      {snap.state === "dead" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#05040f]/45 px-6 backdrop-blur-[2px]">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <h2 className="anim-pop-in rotate-2 font-display text-6xl font-extrabold leading-none text-[#ff5172] [text-shadow:0_6px_0_rgba(60,8,24,0.6),0_18px_50px_rgba(255,81,114,0.35)] sm:text-7xl">
              SPLAT!
            </h2>
            <p className="anim-pop-in mt-2.5 text-xs font-bold uppercase tracking-[0.15em] text-white/40">
              {causeText[snap.cause] ?? "end of the line"}
            </p>

            {snap.newBest && (
              <div className="anim-badge anim-pop-in mt-4">
                <Sticker tone="gold">
                  <Trophy size={12} /> new best!
                </Sticker>
              </div>
            )}

            <Panel className="anim-pop-in-d1 mt-5 w-full px-5 py-5">
              <div className="font-display text-6xl font-extrabold leading-none text-white">
                {snap.dist}
                <span className="ml-1 text-xl font-bold text-white/35">
                  /{LEVEL_METERS} m
                </span>
              </div>
              <div className="font-display mt-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
                level {snap.level + 1} · {theme.name}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                <div>
                  <Trophy size={14} className="mx-auto text-[#ffc53d]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {snap.best}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">best</div>
                </div>
                <div>
                  <Coins size={14} className="mx-auto text-[#ffc53d]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {snap.coins}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">coins</div>
                </div>
                <div>
                  <Gauge size={14} className="mx-auto text-[#49d8ff]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {Math.round(snap.maxSpeed / 10)}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">km/h</div>
                </div>
              </div>
            </Panel>

            <div className="anim-pop-in-d2 pointer-events-auto mt-5 flex items-center gap-2.5">
              <ChunkyButton tone="primary" size="lg" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={16} strokeWidth={2.6} />
                Fly again
              </ChunkyButton>
              <RoundButton onClick={() => gameRef.current?.toMenu()} title="Menu" ariaLabel="Menu">
                <Home size={16} />
              </RoundButton>
            </div>
            <p className="anim-pop-in-d2 mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/25">
              tap anywhere · R
            </p>
          </div>
        </div>
      )}

      {/* ============ TRANSFORMATION CALLOUT ============ */}
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
