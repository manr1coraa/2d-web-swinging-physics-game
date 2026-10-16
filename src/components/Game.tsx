import { useEffect, useRef, useState } from "react";
import { Game, type Snap } from "../game/engine";
import {
  BackIcon,
  GhostButton,
  IconButton,
  PauseIcon,
  PrimaryButton,
  Sheet,
  SlidersIcon,
  Toggle,
} from "./ui";

const CAUSE: Record<string, string> = {
  lava: "Ты упал на улицу",
  spike: "Зацепился за балку",
  saw: "Тебя сбил дрон",
  spire: "Врезался в небоскрёб",
};

const initialSnap: Snap = {
  state: "menu",
  dist: 0,
  best: 0,
  newBest: false,
  maxSpeed: 0,
  cause: "",
  combo: 0,
  tip: null,
  lowAlt: 0,
  settings: { sound: true, music: true, haptics: true },
};

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

  // while the settings sheet is open, keys belong to the sheet, not the game
  useEffect(() => {
    if (!settingsOpen) return;
    const block = (e: KeyboardEvent) => {
      if (e.code === "Escape") setSettingsOpen(false);
      e.stopPropagation();
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", block, true);
    window.addEventListener("keyup", block, true);
    return () => {
      window.removeEventListener("keydown", block, true);
      window.removeEventListener("keyup", block, true);
    };
  }, [settingsOpen]);

  const g = () => gameRef.current;
  const { state } = snap;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      {/* the game canvas receives taps everywhere the overlays leave free */}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

      {/* low-altitude warning: a soft red floor glow, no text */}
      {state === "playing" && snap.lowAlt > 0.25 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to top, rgba(255,90,110,${(snap.lowAlt * 0.32).toFixed(3)}), transparent 30%)`,
          }}
        />
      )}

      {state === "playing" && (
        <Hud
          dist={snap.dist}
          combo={snap.combo}
          tip={snap.tip}
          onPause={() => g()?.pause()}
        />
      )}

      {state === "menu" && (
        <Menu best={snap.best} onPlay={() => g()?.start()} onSettings={() => setSettingsOpen(true)} />
      )}

      {state === "paused" && (
        <Pause
          dist={snap.dist}
          onResume={() => g()?.resume()}
          onRestart={() => g()?.start()}
          onSettings={() => setSettingsOpen(true)}
          onMenu={() => g()?.toMenu()}
        />
      )}

      {state === "dead" && (
        <Death snap={snap} onRetry={() => g()?.start()} onMenu={() => g()?.toMenu()} />
      )}

      {settingsOpen && (
        <Settings
          values={snap.settings}
          onChange={(k, v) => g()?.setSetting(k, v)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------- in-run HUD: distance, combo, one hint ---------------- */

function Hud({
  dist,
  combo,
  tip,
  onPause,
}: {
  dist: number;
  combo: number;
  tip: Snap["tip"];
  onPause: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute left-5 flex"
        style={{ top: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <IconButton label="Пауза" onClick={onPause}>
          <PauseIcon />
        </IconButton>
      </div>

      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <div className="text-[34px] font-bold leading-none tabular-nums">
          {dist}
          <span className="ml-1 text-base font-semibold text-paper/60">м</span>
        </div>
        {combo > 1 && (
          <div className="anim-fade mt-1.5 text-[13px] font-semibold tabular-nums text-amber">
            ×{combo}
          </div>
        )}
      </div>

      {tip && (
        <div
          className="absolute inset-x-0 flex justify-center px-6"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 48px)" }}
        >
          <div
            key={tip.id}
            className="anim-rise rounded-full bg-ink/70 px-4 py-2.5 text-center text-[15px] font-medium text-paper"
          >
            {tip.text}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- main menu: live scene behind, one action ---------------- */

function Menu({
  best,
  onPlay,
  onSettings,
}: {
  best: number;
  onPlay: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <div className="text-[22px] font-bold tracking-tight">Webby</div>
        <IconButton label="Настройки" onClick={onSettings}>
          <SlidersIcon />
        </IconButton>
      </div>

      <div
        className="bg-gradient-to-t from-ink via-ink/80 to-transparent px-6 pt-32"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
      >
        <p className="text-sm font-medium text-paper/55">
          {best > 0 ? `Рекорд · ${best} м` : "Первый забег"}
        </p>
        <h1 className="mt-1.5 text-[36px] font-bold leading-[1.05] tracking-[-0.02em]">
          Качайся
          <br />
          над городом
        </h1>
        <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-paper/60">
          Держи, чтобы выстрелить паутиной. Отпусти в нужный момент и лети дальше.
        </p>
        <div className="mt-7">
          <PrimaryButton onClick={onPlay}>Играть</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pause ---------------- */

function Pause({
  dist,
  onResume,
  onRestart,
  onSettings,
  onMenu,
}: {
  dist: number;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMenu: () => void;
}) {
  return (
    <Sheet>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[28px] font-bold">Пауза</h2>
        <span className="text-sm font-medium tabular-nums text-paper/55">{dist} м</span>
      </div>
      <div className="mt-6 flex flex-col gap-2.5">
        <PrimaryButton onClick={onResume}>Продолжить</PrimaryButton>
        <GhostButton onClick={onRestart}>Начать заново</GhostButton>
        <GhostButton onClick={onSettings}>Настройки</GhostButton>
        <GhostButton onClick={onMenu}>В меню</GhostButton>
      </div>
    </Sheet>
  );
}

/* ---------------- settings: sound, music, vibration ---------------- */

function Settings({
  values,
  onChange,
  onClose,
}: {
  values: Snap["settings"];
  onChange: (k: keyof Snap["settings"], v: boolean) => void;
  onClose: () => void;
}) {
  const rows: { key: keyof Snap["settings"]; label: string; hint?: string }[] = [
    { key: "sound", label: "Звуки" },
    { key: "music", label: "Музыка" },
    { key: "haptics", label: "Вибрация", hint: "Работает не на всех устройствах" },
  ];
  return (
    <Sheet className="z-20">
      <div className="flex items-center gap-3">
        <IconButton label="Назад" onClick={onClose} className="!bg-paper/[0.08]">
          <BackIcon />
        </IconButton>
        <h2 className="text-[28px] font-bold">Настройки</h2>
      </div>
      <div className="mt-5 divide-y divide-paper/10 overflow-hidden rounded-2xl bg-paper/[0.06]">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-[17px] font-medium">{r.label}</div>
              {r.hint && <div className="mt-0.5 text-xs text-paper/45">{r.hint}</div>}
            </div>
            <Toggle checked={values[r.key]} onChange={(v) => onChange(r.key, v)} />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <GhostButton onClick={onClose}>Готово</GhostButton>
      </div>
    </Sheet>
  );
}

/* ---------------- death: calm, factual, one tap to go again ---------------- */

function Death({
  snap,
  onRetry,
  onMenu,
}: {
  snap: Snap;
  onRetry: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      className="anim-fade pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink via-ink/75 to-transparent px-6 pt-40"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
    >
      <p className="text-sm font-medium text-paper/55">{CAUSE[snap.cause] ?? "Забег окончен"}</p>
      <div className="mt-1 text-[76px] font-bold leading-none tabular-nums">
        {snap.dist}
        <span className="ml-2 text-2xl font-semibold text-paper/50">м</span>
      </div>
      <p className="mt-3 text-[15px] text-paper/60">
        {snap.newBest ? (
          <span className="font-semibold text-amber">Новый рекорд</span>
        ) : (
          <>Рекорд · {snap.best} м</>
        )}
      </p>
      <div className="mt-7 flex flex-col gap-2.5">
        <PrimaryButton onClick={onRetry}>Ещё раз</PrimaryButton>
        <GhostButton onClick={onMenu}>В меню</GhostButton>
      </div>
    </div>
  );
}
