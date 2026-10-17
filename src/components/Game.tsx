import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Leaf,
  Trophy,
  Pause,
  Home,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Wind,
  Trees,
  Snowflake,
  Sun,
  Waves,
  Flower2,
  Mountain,
  Compass,
} from "lucide-react";
import { Game, LEVEL_METERS, type Snap } from "../game/engine";
import { LEVELS_PER_WORLD, THEMES, themeForLevel, type ThemeId } from "../game/world";
import { THEME_DEFS } from "../game/themes";
import { ChunkyButton, RoundButton, Panel, Sticker } from "./ui";
import HowToPlay from "./HowToPlay";
import AnnounceOverlay from "./Announce";

const causeText: Record<string, string> = {
  lava: "the hillside caught the web",
  spike: "a branch crossed the path",
  saw: "a little bird bumped the swing",
  spire: "a pine stood in the way",
  fire: "a warm lantern marked the trail",
  fish: "a fish drifted past",
  drone: "a bird crossed the way",
};

const initialSnap: Snap = {
  state: "menu",
  level: 0,
  unlocked: 0,
  theme: "city",
  dist: 0,
  coins: 0,
  tricks: 0,
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

const WORLD_ICON: Record<ThemeId, typeof Leaf> = {
  city: Sun,
  jungle: Trees,
  underwater: Waves,
  desert: Sun,
  ice: Snowflake,
  volcano: Flower2,
  space: Mountain,
  neon: Compass,
};

const WORLDS = THEMES.map((_, i) => i * LEVELS_PER_WORLD);

function holdPointer(action: (down: boolean) => void) {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      action(true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action(false);
    },
    onPointerLeave: () => action(false),
    onPointerCancel: () => action(false),
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
  };
}

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [help, setHelp] = useState(false);
  const [world, setWorld] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, (next) => setSnap(next));
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (snap.state === "menu") {
      const furthestWorld = Math.floor(snap.unlocked / LEVELS_PER_WORLD) % WORLDS.length;
      setWorld(furthestWorld);
    }
  }, [snap.state, snap.unlocked]);

  useEffect(() => {
    if (!help) return;
    const block = (event: KeyboardEvent) => {
      if (event.code === "Escape") setHelp(false);
      event.stopPropagation();
      if (event.code === "Space") event.preventDefault();
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup", block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup", block, true);
    };
  }, [help]);

  const worldStart = WORLDS[world] ?? 0;
  const worldUnlocked = snap.unlocked >= worldStart;
  const currentWorldId = themeForLevel(worldStart);
  const worldName = THEME_DEFS[currentWorldId].name;
  const worldTag = THEME_DEFS[currentWorldId].tag;
  const WorldIcon = WORLD_ICON[currentWorldId];
  const inRun = snap.state === "playing" || snap.state === "dying";
  const progress = useMemo(() => {
    const span = Math.max(1, snap.gateM - snap.segStart);
    return Math.min(1, Math.max(0, (snap.dist - snap.segStart) / span));
  }, [snap.dist, snap.gateM, snap.segStart]);
  const openedWorlds = Math.min(WORLDS.length, Math.floor(snap.unlocked / LEVELS_PER_WORLD) + 1);

  const pickWorld = (index: number) => setWorld((index + WORLDS.length) % WORLDS.length);
  const playSelected = () => gameRef.current?.start(worldUnlocked ? worldStart : 0);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#b9d2c2] text-[#405447]">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 block h-full w-full touch-none ${help ? "pointer-events-none" : "cursor-pointer"}`}
      />
      <div className="vignette pointer-events-none absolute inset-0" />

      {/* ---------------- compact in-run HUD ---------------- */}
      {inRun && !help && (
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-3 top-3 flex gap-2 sm:left-5 sm:top-5">
            <RoundButton onClick={() => gameRef.current?.pause()} title="Pause (P)" ariaLabel="Pause">
              <Pause size={16} />
            </RoundButton>
            <RoundButton
              onClick={() => gameRef.current?.toggleMute()}
              title="Sound (M)"
              ariaLabel="Sound"
            >
              {snap.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </RoundButton>
          </div>

          <div className="absolute inset-x-0 top-3 flex flex-col items-center sm:top-4">
            <div className="rounded-2xl border border-[#e7ddc4]/80 bg-[#f6f0df]/82 px-5 py-2 text-center shadow-[0_8px_25px_-18px_rgba(50,67,53,0.55)] backdrop-blur-sm">
              <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#879179]">
                {THEME_DEFS[snap.theme].name}
              </div>
              <div className="font-display text-4xl font-extrabold leading-none text-[#405447] sm:text-5xl">
                {snap.dist}<span className="ml-1 text-[11px] font-bold text-[#8a927b] sm:text-sm">m</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-36 overflow-hidden rounded-full bg-[#d7d2bd] sm:w-48">
                  <div
                    className="h-full rounded-full bg-[#8da276] transition-[width] duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <Flag size={12} className="text-[#92967c]" />
                <span className="text-[9px] font-bold tracking-[0.06em] text-[#7f8974]">{snap.gateM} m</span>
              </div>
            </div>
            {snap.missed && (
              <div className="mt-1 rounded-full bg-[#f4edda]/75 px-3 py-1 text-[9px] font-bold text-[#8c8061]">
                Next waymark · {snap.gateM} m
              </div>
            )}
          </div>

          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 sm:right-5 sm:top-5">
            <div className="font-display flex items-center gap-1.5 rounded-full border border-[#e7ddc4]/80 bg-[#f6f0df]/82 px-3.5 py-2 text-sm font-extrabold text-[#987b4b] shadow-[0_8px_25px_-18px_rgba(50,67,53,0.55)] backdrop-blur-sm">
              <Leaf size={14} /> {snap.coins}
            </div>
            {snap.tricks > 0 && (
              <div className="rounded-full border border-[#e7ddc4]/80 bg-[#f6f0df]/75 px-3 py-1 text-[9px] font-bold text-[#8a705b]">
                {snap.tricks} {snap.tricks === 1 ? "turn" : "turns"}
              </div>
            )}
            {snap.gliding && (
              <div className="rounded-full border border-[#d4e0ce] bg-[#edf1df]/88 px-3 py-1 text-[9px] font-bold text-[#68826f]">
                breeze
              </div>
            )}
          </div>

          {/* Small, symmetric tuck controls for touch. */}
          <div className="pointer-events-auto absolute bottom-5 left-4 flex items-end gap-2 sm:bottom-6 sm:left-6">
            <button
              aria-label="Spin counterclockwise"
              title="Tuck left (A / ←)"
              className={`flex h-12 w-12 select-none items-center justify-center rounded-full border border-[#d7cdb5] bg-[#f6f0df]/82 text-[#65755d] shadow-[0_5px_18px_-12px_rgba(50,67,53,0.55)] transition active:scale-95 ${snap.state !== "playing" ? "opacity-50" : ""}`}
              {...holdPointer((down) => gameRef.current?.setTrick(down ? -1 : 0))}
            >
              <RotateCcw size={18} />
            </button>
            <button
              aria-label="Spin clockwise"
              title="Tuck right (D / →)"
              className={`flex h-12 w-12 select-none items-center justify-center rounded-full border border-[#d7cdb5] bg-[#f6f0df]/82 text-[#65755d] shadow-[0_5px_18px_-12px_rgba(50,67,53,0.55)] transition active:scale-95 ${snap.state !== "playing" ? "opacity-50" : ""}`}
              {...holdPointer((down) => gameRef.current?.setTrick(down ? 1 : 0))}
            >
              <RotateCw size={18} />
            </button>
            <span className="mb-1 text-[9px] font-bold tracking-[0.08em] text-[#65745f]/70">TUCK</span>
          </div>

          <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center sm:bottom-6 sm:right-6">
            <button
              aria-label="Glide"
              title="Hold to glide (Shift)"
              className={`font-display flex h-[62px] w-[62px] select-none flex-col items-center justify-center gap-0.5 rounded-full border text-[9px] font-extrabold tracking-[0.1em] shadow-[0_5px_18px_-12px_rgba(50,67,53,0.55)] transition active:scale-95 ${
                snap.gliding
                  ? "border-[#718d79] bg-[#718d79] text-[#fff8e7]"
                  : "border-[#d7cdb5] bg-[#f6f0df]/84 text-[#65755d]"
              }`}
              {...holdPointer((down) => gameRef.current?.setGlide(down))}
            >
              <Wind size={19} />
              GLIDE
            </button>
          </div>

          {snap.tip && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[88px] flex justify-center px-3 sm:bottom-[94px]">
              <div className="anim-pop-in flex max-w-sm items-start gap-2.5 rounded-2xl border border-[#ded4bb] bg-[#f7f1df]/92 px-4 py-3 shadow-[0_8px_28px_-20px_rgba(50,67,53,0.55)] backdrop-blur-sm">
                <span className="mt-0.5 shrink-0 text-[#8a987b]">{snap.tip.tone === "danger" ? <Wind size={15} /> : <Leaf size={15} />}</span>
                <div>
                  <div className="font-display text-[12px] font-extrabold text-[#495d4e]">{snap.tip.title}</div>
                  <div className="mt-0.5 text-[10px] font-semibold leading-snug text-[#69745f]">{snap.tip.text}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- quiet world picker ---------------- */}
      {snap.state === "menu" && !help && (
        <div className="absolute inset-0 flex items-center justify-center px-4 py-5">
          <Panel className="anim-pop-in relative w-full max-w-md px-6 py-7 text-center sm:px-8 sm:py-8">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7e5cb] text-[#6d8b72]">
              <Leaf size={25} />
            </div>
            <h1 className="font-display text-[56px] font-extrabold leading-[0.9] tracking-tight text-[#405447] sm:text-[68px]">
              WEBBY<span className="text-[#bd7056]">!</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-[13px] font-semibold leading-relaxed text-[#72806d]">
              A little endless journey on a springy web. Follow the breeze, gather seeds, and take your time.
            </p>

            <div className="mt-6 flex items-center justify-between gap-2 rounded-2xl border border-[#d8cfb8] bg-[#eee8d5]/80 p-2">
              <RoundButton onClick={() => pickWorld(world - 1)} title="Previous landscape" ariaLabel="Previous world">
                <ChevronLeft size={18} />
              </RoundButton>
              <div className="min-w-0 flex-1 px-1">
                <div className="flex items-center justify-center gap-2">
                  <WorldIcon size={18} className="shrink-0 text-[#7f9774]" />
                  <span className="font-display truncate text-lg font-extrabold text-[#465b4c] sm:text-xl">{worldName}</span>
                </div>
                <div className="mt-1 text-[9px] font-bold tracking-[0.08em] text-[#8a907a]">{worldTag}</div>
                {!worldUnlocked && <div className="mt-1 text-[9px] font-semibold text-[#ae8962]">Reach it on your trail to open it</div>}
              </div>
              <RoundButton onClick={() => pickWorld(world + 1)} title="Next landscape" ariaLabel="Next world">
                <ChevronRight size={18} />
              </RoundButton>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5" aria-label="Landscape progress">
              {WORLDS.map((level, i) => {
                const available = snap.unlocked >= level;
                return (
                  <span
                    key={level}
                    className={`h-1.5 rounded-full transition-all ${i === world ? "w-7" : "w-3"}`}
                    style={{ background: i === world ? "#718c70" : available ? "#a4b295" : "#d4ceb9" }}
                  />
                );
              })}
            </div>

            <ChunkyButton
              tone="primary"
              size="lg"
              ariaLabel="Play"
              onClick={playSelected}
              className="mt-5 w-full"
            >
              <Play size={17} className="fill-current" />
              {snap.best > 0 ? "Continue the journey" : "Begin wandering"}
            </ChunkyButton>

            <div className="mt-3 flex items-center justify-center gap-2">
              <ChunkyButton tone="ghost" size="sm" onClick={() => setHelp(true)}>
                <HelpCircle size={14} /> Field guide
              </ChunkyButton>
              <RoundButton
                onClick={() => gameRef.current?.toggleMute()}
                title="Sound (M)"
                ariaLabel="Sound"
              >
                {snap.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </RoundButton>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[9px] font-bold text-[#8b927c]">
              <span className="rounded-full bg-[#ece6d2] px-2.5 py-1">8 landscapes</span>
              <span className="rounded-full bg-[#ece6d2] px-2.5 py-1">endless waymarks</span>
              <span className="rounded-full bg-[#ece6d2] px-2.5 py-1">{openedWorlds}/8 opened</span>
            </div>
            {snap.best > 0 && (
              <div className="mt-3 flex justify-center">
                <Sticker tone="gold"><Trophy size={11} /> longest trail · {snap.best} m</Sticker>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- pause ---------------- */}
      {snap.state === "paused" && !help && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#485b4b]/20 px-5 backdrop-blur-sm">
          <Panel className="anim-pop-in w-full max-w-xs p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#879078]">Take a breath</p>
            <h2 className="font-display mt-1 text-3xl font-extrabold text-[#465b4c]">Paused</h2>
            <p className="mt-2 text-[11px] font-semibold text-[#7c8771]">
              {snap.dist} m · {snap.coins} seeds · {snap.tricks} turns
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.resume()}>
                <Play size={14} className="fill-current" /> Keep wandering
              </ChunkyButton>
              <ChunkyButton tone="dark" size="md" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={14} /> Start this trail again
              </ChunkyButton>
              <div className="flex gap-2.5">
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => setHelp(true)}>
                  <HelpCircle size={12} /> Field guide
                </ChunkyButton>
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => gameRef.current?.toMenu()}>
                  <Home size={12} /> Landscapes
                </ChunkyButton>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------------- waymark reached ---------------- */}
      {snap.state === "levelup" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5">
          <Panel className="anim-pop-in w-full max-w-xs px-6 py-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#e7e5cb] text-[#788d6c]"><Flag size={19} /></div>
            <h2 className="font-display mt-3 text-2xl font-extrabold text-[#465b4c]">Waymark reached</h2>
            <p className="mt-1 text-xs font-semibold text-[#7d8872]">{snap.dist} m · {snap.coins} seeds collected</p>
            <div className="mt-4 rounded-xl bg-[#eee8d5] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#96937b]">A new trail ahead</p>
              <p className="font-display mt-1 text-lg font-extrabold text-[#6b866f]">{THEME_DEFS[themeForLevel(snap.level + 1)].name}</p>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------------- journey paused ---------------- */}
      {snap.state === "dead" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#485b4b]/18 px-5 backdrop-blur-[2px]">
          <Panel className="anim-pop-in w-full max-w-xs px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8dfc8] text-[#b8795d]"><Leaf size={23} /></div>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-[#465b4c]">Rest here</h2>
            <p className="mt-1 text-[11px] font-semibold text-[#8a8977]">{causeText[snap.cause] ?? "the trail came to a pause"}</p>
            {snap.newBest && <div className="mt-3"><Sticker tone="gold"><Trophy size={11} /> a new longest trail</Sticker></div>}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#eee8d5] p-3">
              <div><div className="font-display text-lg font-extrabold text-[#465b4c]">{snap.dist}</div><div className="text-[9px] font-bold text-[#8e927d]">metres</div></div>
              <div><div className="font-display text-lg font-extrabold text-[#987b4b]">{snap.coins}</div><div className="text-[9px] font-bold text-[#8e927d]">seeds</div></div>
              <div><div className="font-display text-lg font-extrabold text-[#8a705b]">{snap.tricks}</div><div className="text-[9px] font-bold text-[#8e927d]">turns</div></div>
            </div>
            <div className="pointer-events-auto mt-4 flex justify-center gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.start()}>
                <RotateCcw size={14} /> Wander again
              </ChunkyButton>
              <RoundButton onClick={() => gameRef.current?.toMenu()} title="Landscapes" ariaLabel="Menu"><Home size={15} /></RoundButton>
            </div>
          </Panel>
        </div>
      )}

      {snap.announce && !help && <AnnounceOverlay data={snap.announce} />}

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
