import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Trophy,
  Pause,
  Home,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Wind,
  Building2,
  ArrowUp,
  Ship,
  Landmark,
  Trees,
  Compass,
  Sun,
  Snowflake,
  Mountain,
  CircleDot,
  Anchor,
} from "lucide-react";
import { Game, LEVEL_METERS, type Snap } from "../game/engine";
import { DISTRICTS, districtForLevel, type DistrictId } from "../game/world";
import { THEME_DEFS } from "../game/themes";
import { emptySave } from "../game/save";
import { ChunkyButton, RoundButton, Panel, Sticker } from "./ui";
import HowToPlay from "./HowToPlay";
import AnnounceOverlay from "./Announce";

const causeText = (cause: string): string => {
  if (cause === "street") return "the avenue caught you";
  if (cause === "drone") return "a delivery drone cut the line";
  const thing = cause.startsWith("crash:") ? cause.slice(6) : "";
  const names: Record<string, string> = {
    chimney: "a brick chimney",
    watertower: "a water tower",
    antenna: "a mast",
    billboard: "a billboard frame",
    crane: "a crane jib",
    scaffold: "a scaffold pole",
    sign: "a rooftop sign",
  };
  if (names[thing]) return `you met ${names[thing]} at speed`;
  return "the route ran out of rooftops";
};

const initialSnap: Snap = {
  state: "menu",
  level: 0,
  unlocked: 0,
  theme: "harbour",
  district: THEME_DEFS.harbour.name,
  dist: 0,
  tokens: 0,
  tricks: 0,
  combo: 0,
  best: 0,
  newBest: false,
  muted: false,
  maxSpeed: 0,
  alt: 0,
  maxAlt: 0,
  cause: "",
  showHint: false,
  shield: false,
  magnetT: 0,
  tip: null,
  graceT: 0,
  gliding: false,
  announce: null,
  lowAlt: 0,
  gateM: LEVEL_METERS,
  segStart: 0,
  missed: false,
  webbed: false,
  grounded: false,
  aiming: false,
  save: emptySave(),
};

const DISTRICT_ICON: Record<DistrictId, typeof Building2> = {
  harbour: Ship,
  brickline: Landmark,
  mosslight: Trees,
  glassmarket: Building2,
  amberrow: Sun,
  pinewharf: Snowflake,
  cloudbreak: Mountain,
  seabreeze: Compass,
};

function holdPointer(action: (down: boolean) => void) {
  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      action(true);
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      event.stopPropagation();
      action(false);
    },
    onPointerLeave: () => action(false),
    onPointerCancel: () => action(false),
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => event.preventDefault(),
  };
}

const safeBottom = { paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } as const;

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [help, setHelp] = useState(false);
  const [district, setDistrict] = useState(0);

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
    if (snap.state === "menu") setDistrict(snap.unlocked % DISTRICTS.length);
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

  const districtIndex = district % DISTRICTS.length;
  const districtLevel =
    Math.floor(snap.unlocked / DISTRICTS.length) * DISTRICTS.length + districtIndex;
  const districtId = districtForLevel(districtLevel);
  const districtUnlocked = snap.unlocked >= districtLevel || districtIndex === 0;
  const districtName = THEME_DEFS[districtId].name;
  const districtTag = THEME_DEFS[districtId].tag;
  const DistrictIcon = DISTRICT_ICON[districtId];
  const inRun = snap.state === "playing" || snap.state === "dying";
  const progress = useMemo(() => {
    const span = Math.max(1, snap.gateM - snap.segStart);
    return Math.min(1, Math.max(0, (snap.dist - snap.segStart) / span));
  }, [snap.dist, snap.gateM, snap.segStart]);
  const checkpointNo = snap.level + 1;

  const pickDistrict = (step: number) =>
    setDistrict((d) => (d + step + DISTRICTS.length) % DISTRICTS.length);
  const playSelected = () =>
    gameRef.current?.start(districtUnlocked ? districtLevel : Math.max(0, snap.save.checkpoint));

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#a9c0c2] text-[#3f4a4f]">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 block h-full w-full touch-none ${help ? "pointer-events-none" : "cursor-pointer"}`}
      />
      <div className="vignette pointer-events-none absolute inset-0" />

      {/* ---------------- in-run HUD ---------------- */}
      {inRun && !help && (
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-2 top-2 flex gap-2 sm:left-5 sm:top-5">
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

          <div className="absolute inset-x-0 top-2 flex flex-col items-center sm:top-4">
            <div className="rounded-2xl border border-[#e7ddc4]/80 bg-[#f6f0df]/85 px-4 py-1.5 text-center shadow-[0_8px_25px_-18px_rgba(40,52,58,0.6)] backdrop-blur-sm sm:px-5 sm:py-2">
              <div className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#8a8574] sm:text-[9px]">
                {snap.district} · district {checkpointNo}
              </div>
              <div className="font-display text-3xl font-extrabold leading-none text-[#3f4a4f] sm:text-5xl">
                {snap.dist}
                <span className="ml-1 text-[10px] font-bold text-[#8a927b] sm:text-sm">m</span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#d7d2bd] sm:w-48">
                  <div
                    className="h-full rounded-full bg-[#b4574b] transition-[width] duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <Flag size={11} className="text-[#92967c]" />
                <span className="text-[9px] font-bold tracking-[0.06em] text-[#7f8974]">
                  {snap.gateM} m
                </span>
              </div>
            </div>
            {snap.missed && (
              <div className="mt-1 rounded-full bg-[#f4edda]/80 px-3 py-1 text-[9px] font-bold text-[#8c8061]">
                Next checkpoint · {snap.gateM} m
              </div>
            )}
          </div>

          <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-5 sm:top-5">
            <div className="font-display flex items-center gap-1.5 rounded-full border border-[#e7ddc4]/80 bg-[#f6f0df]/85 px-3 py-1.5 text-sm font-extrabold text-[#987b4b] shadow-[0_8px_25px_-18px_rgba(40,52,58,0.6)] backdrop-blur-sm">
              <CircleDot size={13} /> {snap.tokens}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-[#e7ddc4]/80 bg-[#f6f0df]/78 px-3 py-1 text-[9px] font-bold text-[#7c7364]">
              <RotateCw size={11} /> {snap.tricks} flips
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-[#e7ddc4]/80 bg-[#f6f0df]/78 px-3 py-1 text-[9px] font-bold text-[#6f7d84]">
              <ArrowUp size={11} /> {snap.alt} m up
            </div>
            {snap.combo > 1 && (
              <div className="font-display rounded-full border border-[#e0c39a] bg-[#f6e6c8]/90 px-3 py-1 text-[10px] font-extrabold text-[#9c6b3f]">
                flow ×{snap.combo}
              </div>
            )}
            {snap.gliding && (
              <div className="rounded-full border border-[#d4e0ce] bg-[#edf1df]/90 px-3 py-1 text-[9px] font-bold text-[#68826f]">
                breeze
              </div>
            )}
            {snap.shield && (
              <div className="rounded-full border border-[#cfd8c2] bg-[#e9efdd]/90 px-3 py-1 text-[9px] font-bold text-[#6a7d5f]">
                spare strand
              </div>
            )}
          </div>

          {/* street warning */}
          {snap.lowAlt > 0.5 && (
            <div className="absolute inset-x-0 bottom-[46%] flex justify-center">
              <div
                className="rounded-full border border-[#e3c1ae] bg-[#f7e4d8]/90 px-4 py-1.5 text-[10px] font-extrabold tracking-[0.1em] text-[#a85f45]"
                style={{ opacity: 0.35 + snap.lowAlt * 0.65 }}
              >
                STREET BELOW
              </div>
            </div>
          )}

          {/* left cluster: spin + jump */}
          <div
            className="pointer-events-auto absolute bottom-3 left-3 flex items-end gap-2 sm:bottom-6 sm:left-6"
            style={safeBottom}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-end gap-2">
                <button
                  aria-label="Spin counterclockwise"
                  title="Spin left / run left (A · ←)"
                  className="flex h-12 w-12 select-none items-center justify-center rounded-full border border-[#d7cdb5] bg-[#f6f0df]/85 text-[#5f6f6a] shadow-[0_5px_18px_-12px_rgba(40,52,58,0.6)] transition active:scale-95 sm:h-14 sm:w-14"
                  {...holdPointer((down) => gameRef.current?.setTrick(down ? -1 : 0))}
                >
                  <RotateCcw size={19} />
                </button>
                <button
                  aria-label="Spin clockwise"
                  title="Spin right / run right (D · →)"
                  className="flex h-12 w-12 select-none items-center justify-center rounded-full border border-[#d7cdb5] bg-[#f6f0df]/85 text-[#5f6f6a] shadow-[0_5px_18px_-12px_rgba(40,52,58,0.6)] transition active:scale-95 sm:h-14 sm:w-14"
                  {...holdPointer((down) => gameRef.current?.setTrick(down ? 1 : 0))}
                >
                  <RotateCw size={19} />
                </button>
              </div>
              <span className="text-[8px] font-bold tracking-[0.12em] text-[#f2ecda] drop-shadow-[0_1px_2px_rgba(30,40,44,0.6)]">
                SPIN · RUN
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                aria-label="Jump"
                title="Jump off the ledge (W · ↑)"
                className="flex h-14 w-14 select-none flex-col items-center justify-center rounded-full border border-[#d7cdb5] bg-[#f6f0df]/85 text-[9px] font-extrabold tracking-[0.08em] text-[#5f6f6a] shadow-[0_5px_18px_-12px_rgba(40,52,58,0.6)] transition active:scale-95 sm:h-16 sm:w-16"
                {...holdPointer((down) => {
                  if (down) gameRef.current?.jump();
                })}
              >
                <ArrowUp size={19} />
                JUMP
              </button>
            </div>
          </div>

          {/* right cluster: web + glide */}
          <div
            className="pointer-events-auto absolute bottom-3 right-3 flex items-end gap-2 sm:bottom-6 sm:right-6"
            style={safeBottom}
          >
            <div className="flex flex-col items-center gap-1">
              <button
                aria-label="Glide"
                title="Hold to glide and holster the web (Shift)"
                className={`font-display flex h-14 w-14 select-none flex-col items-center justify-center gap-0.5 rounded-full border text-[8px] font-extrabold tracking-[0.1em] shadow-[0_5px_18px_-12px_rgba(40,52,58,0.6)] transition active:scale-95 sm:h-16 sm:w-16 ${
                  snap.gliding
                    ? "border-[#718d79] bg-[#718d79] text-[#fff8e7]"
                    : "border-[#d7cdb5] bg-[#f6f0df]/85 text-[#5f6f6a]"
                }`}
                {...holdPointer((down) => gameRef.current?.setGlide(down))}
              >
                <Wind size={18} />
                GLIDE
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                aria-label="Web"
                title="Hold the line (Space) · release to fly"
                className={`font-display flex h-[68px] w-[68px] select-none flex-col items-center justify-center gap-0.5 rounded-full border-2 text-[9px] font-extrabold tracking-[0.1em] shadow-[0_6px_20px_-12px_rgba(40,52,58,0.7)] transition active:scale-95 sm:h-20 sm:w-20 ${
                  snap.webbed
                    ? "border-[#8f443c] bg-[#b4574b] text-[#fff4e6]"
                    : "border-[#d7cdb5] bg-[#f6f0df]/88 text-[#8f443c]"
                }`}
                {...holdPointer((down) => gameRef.current?.setWeb(down))}
              >
                <Anchor size={22} />
                WEB
              </button>
              <span className="text-[8px] font-bold tracking-[0.1em] text-[#f2ecda] drop-shadow-[0_1px_2px_rgba(30,40,44,0.6)]">
                HOLD · LET GO
              </span>
            </div>
          </div>

          {snap.showHint && (
            <div className="absolute inset-x-0 bottom-[38%] flex justify-center px-4">
              <div className="anim-pop-in rounded-2xl border border-[#ded4bb] bg-[#f7f1df]/92 px-4 py-2.5 text-center shadow-[0_8px_28px_-20px_rgba(40,52,58,0.6)]">
                <p className="font-display text-[12px] font-extrabold text-[#495d4e]">
                  The web fires itself at the nearest roof
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#69745f]">
                  Hold to work the line · let go at the top of the swing to fly
                </p>
              </div>
            </div>
          )}

          {snap.tip && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[104px] flex justify-center px-3 sm:bottom-[112px]">
              <div className="anim-pop-in flex max-w-sm items-start gap-2.5 rounded-2xl border border-[#ded4bb] bg-[#f7f1df]/94 px-4 py-3 shadow-[0_8px_28px_-20px_rgba(40,52,58,0.6)] backdrop-blur-sm">
                <span className="mt-0.5 shrink-0 text-[#a06a52]">
                  {snap.tip.tone === "danger" ? <Wind size={15} /> : <Building2 size={15} />}
                </span>
                <div>
                  <div className="font-display text-[12px] font-extrabold text-[#42545a]">
                    {snap.tip.title}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold leading-snug text-[#65706f]">
                    {snap.tip.text}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- menu ---------------- */}
      {snap.state === "menu" && !help && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto px-4 py-5">
          <Panel className="anim-pop-in relative my-auto w-full max-w-md px-5 py-6 text-center sm:px-8 sm:py-8">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7e5cb] text-[#b4574b]">
              <Building2 size={25} />
            </div>
            <h1 className="font-display text-[52px] font-extrabold leading-[0.9] tracking-tight text-[#3f4a4f] sm:text-[66px]">
              WEBBY<span className="text-[#b4574b]">!</span>
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-[12px] font-semibold leading-relaxed text-[#6f7d80] sm:text-[13px]">
              Hard rooftop parkour across an endless city. Your silk fires itself at the nearest
              roof — there is no upper limit, only the avenue below.
            </p>

            <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl border border-[#d8cfb8] bg-[#eee8d5]/80 p-2">
              <RoundButton
                onClick={() => pickDistrict(-1)}
                title="Previous district"
                ariaLabel="Previous district"
              >
                <ChevronLeft size={18} />
              </RoundButton>
              <div className="min-w-0 flex-1 px-1">
                <div className="flex items-center justify-center gap-2">
                  <DistrictIcon size={17} className="shrink-0 text-[#9a6a52]" />
                  <span className="font-display truncate text-lg font-extrabold text-[#42545a] sm:text-xl">
                    {districtName}
                  </span>
                </div>
                <div className="mt-0.5 text-[9px] font-bold tracking-[0.08em] text-[#8a907a]">
                  {districtTag}
                </div>
                {!districtUnlocked && (
                  <div className="mt-1 text-[9px] font-semibold text-[#ae8962]">
                    Clear a checkpoint to open it
                  </div>
                )}
              </div>
              <RoundButton
                onClick={() => pickDistrict(1)}
                title="Next district"
                ariaLabel="Next district"
              >
                <ChevronRight size={18} />
              </RoundButton>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5" aria-label="District progress">
              {DISTRICTS.map((id, i) => {
                const levelOf =
                  Math.floor(snap.unlocked / DISTRICTS.length) * DISTRICTS.length + i;
                const available = snap.unlocked >= levelOf || i === 0;
                return (
                  <span
                    key={id}
                    className={`h-1.5 rounded-full transition-all ${i === districtIndex ? "w-7" : "w-3"}`}
                    style={{
                      background: i === districtIndex ? "#b4574b" : available ? "#a4b295" : "#d4ceb9",
                    }}
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
              {snap.save.checkpoint > 0
                ? `Continue · district ${snap.save.checkpoint + 1}`
                : "Start the run"}
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

            <div className="mt-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
              <Stat icon={<Trophy size={12} />} label="longest run" value={`${snap.save.best} m`} />
              <Stat icon={<CircleDot size={12} />} label="spools" value={snap.save.tokens} />
              <Stat icon={<RotateCw size={12} />} label="flips" value={snap.save.tricks} />
              <Stat icon={<ArrowUp size={12} />} label="highest" value={`${snap.save.alt} m`} />
            </div>
            <p className="mt-3 text-[9px] font-bold tracking-[0.06em] text-[#8b927c]">
              progress is saved on this device · {snap.save.runs} runs
            </p>
          </Panel>
        </div>
      )}

      {/* ---------------- pause ---------------- */}
      {snap.state === "paused" && !help && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#3c4a50]/22 px-5 backdrop-blur-sm">
          <Panel className="anim-pop-in w-full max-w-xs p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87907f]">
              Take a breath
            </p>
            <h2 className="font-display mt-1 text-3xl font-extrabold text-[#42545a]">Paused</h2>
            <p className="mt-2 text-[11px] font-semibold text-[#78837f]">
              {snap.district} · {snap.dist} m · {snap.tokens} spools · {snap.tricks} flips
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.resume()}>
                <Play size={14} className="fill-current" /> Keep swinging
              </ChunkyButton>
              <ChunkyButton tone="dark" size="md" onClick={() => gameRef.current?.retry()}>
                <RotateCcw size={14} /> Restart district
              </ChunkyButton>
              <div className="flex gap-2.5">
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => setHelp(true)}>
                  <HelpCircle size={12} /> Field guide
                </ChunkyButton>
                <ChunkyButton tone="ghost" size="sm" className="flex-1" onClick={() => gameRef.current?.toMenu()}>
                  <Home size={12} /> Districts
                </ChunkyButton>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------------- checkpoint cleared ---------------- */}
      {snap.state === "levelup" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5">
          <Panel className="anim-pop-in w-full max-w-xs px-6 py-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#e7e5cb] text-[#9a6a52]">
              <Flag size={19} />
            </div>
            <h2 className="font-display mt-3 text-2xl font-extrabold text-[#42545a]">
              Checkpoint cleared
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#7d8880]">
              {snap.dist} m · {snap.tokens} spools · {snap.tricks} flips
            </p>
            <div className="mt-4 rounded-xl bg-[#eee8d5] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#96937b]">
                Next district
              </p>
              <p className="font-display mt-1 text-lg font-extrabold text-[#8d6a52]">
                {THEME_DEFS[districtForLevel(snap.level + 1)].name}
              </p>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------------- run over ---------------- */}
      {snap.state === "dead" && !help && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#3c4a50]/20 px-5 backdrop-blur-[2px]">
          <Panel className="anim-pop-in w-full max-w-xs px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8dfc8] text-[#b8795d]">
              <Building2 size={23} />
            </div>
            <h2 className="font-display mt-3 text-3xl font-extrabold text-[#42545a]">Run over</h2>
            <p className="mt-1 text-[11px] font-semibold text-[#8a8977]">{causeText(snap.cause)}</p>
            {snap.newBest && (
              <div className="mt-3">
                <Sticker tone="gold">
                  <Trophy size={11} /> a new longest run
                </Sticker>
              </div>
            )}
            <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl bg-[#eee8d5] p-3">
              <Cell value={snap.dist} label="metres" />
              <Cell value={snap.tokens} label="spools" />
              <Cell value={snap.tricks} label="flips" />
              <Cell value={snap.maxAlt} label="m up" />
            </div>
            <div className="pointer-events-auto mt-4 flex justify-center gap-2.5">
              <ChunkyButton tone="primary" size="md" onClick={() => gameRef.current?.retry()}>
                <RotateCcw size={14} /> Retry district
              </ChunkyButton>
              <RoundButton
                onClick={() => gameRef.current?.toMenu()}
                title="Districts"
                ariaLabel="Menu"
              >
                <Home size={15} />
              </RoundButton>
            </div>
            <p className="mt-3 text-[9px] font-bold tracking-[0.06em] text-[#9a9a86]">
              district {snap.level + 1} stays open · progress saved
            </p>
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
          onEraseSave={() => gameRef.current?.eraseSave()}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#eee8d5] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8e927d]">
        {icon} {label}
      </div>
      <div className="font-display mt-0.5 text-base font-extrabold text-[#42545a]">{value}</div>
    </div>
  );
}

function Cell({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-lg font-extrabold text-[#42545a]">{value}</div>
      <div className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#8e927d]">{label}</div>
    </div>
  );
}
