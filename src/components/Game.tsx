import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Game, type Snap } from "../game/engine";
import { ChunkyButton, RoundButton, Panel, Sticker } from "./ui";
import HowToPlay from "./HowToPlay";
import AnnounceOverlay from "./Announce";

const causeText: Record<string, string> = {
  lava: "splattered on the avenue",
  spike: "clipped a construction girder",
  saw: "swatted by a patrol drone",
  spire: "flew straight into a tower",
};

const initialSnap: Snap = {
  state: "menu",
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
};

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [mouseIdle, setMouseIdle] = useState(false);
  const [help, setHelp] = useState(false);

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

  const openHelp = () => {
    gameRef.current?.pause();
    setHelp(true);
  };

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
          <div className="absolute inset-x-0 top-3 flex justify-center sm:top-5">
            <div className="font-display text-7xl font-extrabold leading-none text-white [text-shadow:0_4px_0_rgba(8,10,30,0.5),0_14px_38px_rgba(0,0,0,0.5)] sm:text-8xl">
              {snap.dist}
              <span className="ml-1.5 text-2xl font-bold text-white/40">m</span>
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

      {/* ============ MENU ============ */}
      {snap.state === "menu" && !help && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="anim-pop-in">
            <Sticker tone="cyan">one button · endless city</Sticker>
          </div>

          <h1 className="anim-pop-in-d1 mt-4 -rotate-2 font-display text-[82px] font-extrabold leading-[0.86] tracking-tight text-white [text-shadow:0_6px_0_#1a2048,0_10px_0_rgba(6,10,30,0.45),0_28px_60px_rgba(0,0,0,0.6)] sm:text-[120px]">
            WEBBY<span className="text-[#ff5172]">!</span>
          </h1>

          <p className="anim-pop-in-d1 mt-5 max-w-xs text-sm font-bold leading-relaxed text-white/50">
            Swing the Manhattan skyline. Hold to shoot a web, release to fly,
            never touch the street.
          </p>

          <div className="anim-pop-in-d2 relative mt-9">
            <span className="anim-ring pointer-events-none absolute -inset-3 rounded-full border-2 border-[#ff5172]" />
            <button
              onClick={() => gameRef.current?.start()}
              aria-label="Play"
              className="relative flex h-[86px] w-[86px] items-center justify-center rounded-full border-b-[6px] border-[#b81f42] bg-[#ff5172] text-white shadow-[0_14px_40px_-6px_rgba(255,81,114,0.7)] transition-all duration-100 hover:bg-[#ff6682] active:translate-y-[6px] active:border-b-0 active:shadow-none"
            >
              <Play className="ml-1 h-9 w-9 fill-current" />
            </button>
          </div>
          <div className="anim-pulse-soft font-display mt-5 text-[11px] font-extrabold uppercase tracking-[0.3em] text-white/40">
            tap to start
          </div>

          <div className="anim-pop-in-d2 mt-8 flex items-center gap-2.5">
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
            <div className="anim-pop-in-d2 absolute bottom-7">
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
            <h2 className="font-display text-4xl font-extrabold text-white">
              PAUSED
            </h2>
            <p className="mt-1.5 text-xs font-bold text-white/40">
              {snap.dist} m · {snap.coins} coins
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
              <div className="font-display text-7xl font-extrabold leading-none text-white">
                {snap.dist}
                <span className="ml-1 text-xl font-bold text-white/35">m</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                <div>
                  <Trophy size={14} className="mx-auto text-[#ffc53d]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {snap.best}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                    best
                  </div>
                </div>
                <div>
                  <Coins size={14} className="mx-auto text-[#ffc53d]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {snap.coins}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                    coins
                  </div>
                </div>
                <div>
                  <Gauge size={14} className="mx-auto text-[#49d8ff]" />
                  <div className="font-display mt-1 text-lg font-extrabold text-white">
                    {Math.round(snap.maxSpeed / 10)}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/35">
                    km/h
                  </div>
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
