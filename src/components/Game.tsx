import { useEffect, useRef, useState } from "react";
import { Game, type Snap, type Settings } from "../game/engine";
import { Button, IconButton, Toggle } from "./ui";
import {
  CloseIcon,
  GearIcon,
  MusicIcon,
  MuteIcon,
  PauseIcon,
  SoundIcon,
  VibrateIcon,
} from "./icons";
import DebugPanel from "./DebugPanel";

/** one short line on the death screen, says what ended the run */
const causeText: Record<string, string> = {
  lava: "Touched the street",
  spike: "Hit a construction girder",
  saw: "Hit a patrol drone",
  spire: "Flew into a tower",
};

const initialSnap: Snap = {
  state: "menu",
  dist: 0,
  best: 0,
  newBest: false,
  cause: "",
  chain: 0,
  gliding: false,
  glideFuel: 1,
  tip: null,
  settings: { sound: true, music: true, vibration: true },
};

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const game = () => gameRef.current;
  const setSettings = (next: Partial<Settings>) => game()?.setSettings(next);
  const { settings } = snap;

  return (
    <div className="fixed inset-0 select-none">
      {/* canvas first: every overlay below paints on top of it */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* ---------- HUD while flying: distance and chain only ---------- */}
      {snap.state === "playing" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}
        >
          <div className="flex items-baseline gap-1 tabular-nums text-white">
            <span className="text-[34px] font-semibold leading-none tracking-tight">
              {snap.dist}
            </span>
            <span className="text-[14px] font-medium text-white/50">m</span>
          </div>
          <div className="mt-2 h-4 text-[13px] font-semibold tabular-nums text-[#7df0ff]">
            {snap.chain >= 2 ? `×${snap.chain}` : ""}
          </div>
          {snap.gliding && (
            <div className="mt-1 h-[3px] w-16 overflow-hidden rounded-full bg-white/15">
              <div
                className="ease-ios h-full bg-[#7df0ff]/80 transition-[width] duration-100"
                style={{ width: `${Math.round(snap.glideFuel * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {snap.state === "playing" && (
        <div
          className="absolute left-4"
          style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <IconButton label="Pause" onClick={() => game()?.pause()}>
            <PauseIcon size={20} />
          </IconButton>
        </div>
      )}

      {/* ---------- tutorial: at most three lines per game ---------- */}
      {snap.tip && snap.state === "playing" && (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center px-6"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 36px)" }}
        >
          <div key={snap.tip.id} className="anim-fade max-w-sm text-center">
            <div className="text-[15px] font-semibold text-white/90">
              {snap.tip.title}
            </div>
            <div className="mt-0.5 text-[14px] leading-snug text-white/55">
              {snap.tip.text}
            </div>
          </div>
        </div>
      )}

      {/* ---------- menu: the live scene shows behind the title ---------- */}
      {snap.state === "menu" && !settingsOpen && (
        <>
          <div
            className="absolute right-4"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
              <GearIcon size={20} />
            </IconButton>
          </div>
          {/* soft dim behind the title so the scene stays visible but quiet */}
          <div className="pointer-events-none absolute inset-0 bg-[#06061a]/35" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="anim-fade text-center">
              <div className="text-[56px] font-bold leading-none tracking-[-0.02em] text-white">
                WEBBY
              </div>
              <div className="mt-3 text-[15px] text-white/55">
                Hold to hook. Let go to fly.
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center gap-4">
              <Button primary onClick={() => game()?.start()}>
                Play
              </Button>
              {snap.best > 0 && (
                <div className="text-[14px] tabular-nums text-white/45">
                  Best {snap.best} m
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---------- death: calm summary, tap to restart ---------- */}
      {snap.state === "dead" && (
        <div className="anim-fade pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#06061a]/30 px-6">
          <div className="text-center">
            <div className="text-[13px] font-medium uppercase tracking-wide text-white/45">
              {snap.newBest ? "New best" : "Distance"}
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-1 tabular-nums text-white">
              <span className="text-[64px] font-bold leading-none tracking-tight">
                {snap.dist}
              </span>
              <span className="text-[18px] font-medium text-white/50">m</span>
            </div>
            <div className="mt-4 text-[15px] text-white/60">
              {causeText[snap.cause] ?? "The run is over"}
            </div>
            <div className="mt-1 text-[13px] tabular-nums text-white/35">
              Best {snap.best} m
            </div>
          </div>
          <div
            className="absolute inset-x-0 text-center text-[13px] text-white/35"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 40px)" }}
          >
            Tap to restart
          </div>
        </div>
      )}

      {/* ---------- pause ---------- */}
      {snap.state === "paused" && !settingsOpen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#06061a]/40 px-6">
          <div className="text-[28px] font-semibold text-white">Paused</div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button primary onClick={() => game()?.resume()}>
              Resume
            </Button>
            <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
            <button
              onClick={() => game()?.toMenu()}
              className="pointer-events-auto mt-2 px-4 py-2 text-[15px] text-white/50"
            >
              Quit to menu
            </button>
          </div>
        </div>
      )}

      {/* ---------- settings sheet ---------- */}
      {settingsOpen && (
        <div className="absolute inset-0 flex items-end justify-center bg-[#06061a]/50">
          <div
            className="anim-sheet w-full max-w-md rounded-t-[22px] bg-[#101430] px-6 pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[18px] font-semibold text-white">Settings</div>
              <IconButton label="Close" onClick={() => setSettingsOpen(false)}>
                <CloseIcon size={18} />
              </IconButton>
            </div>
            <div className="divide-y divide-white/10">
              <Toggle
                label="Sound"
                icon={settings.sound ? <SoundIcon size={20} /> : <MuteIcon size={20} />}
                on={settings.sound}
                onChange={(v) => setSettings({ sound: v })}
              />
              <Toggle
                label="Music"
                icon={<MusicIcon size={20} />}
                on={settings.music}
                onChange={(v) => setSettings({ music: v })}
              />
              {canVibrate && (
                <Toggle
                  label="Vibration"
                  icon={<VibrateIcon size={20} />}
                  on={settings.vibration}
                  onChange={(v) => setSettings({ vibration: v })}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <DebugPanel />
    </div>
  );
}
