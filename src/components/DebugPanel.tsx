import { useEffect, useState } from "react";
import { live, resetLive, tuning, tuningRanges } from "../game/tuning";

/** Dev panel: press ` (backquote / ~) to toggle. Edits apply immediately. */
export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="absolute left-2 top-2 z-50 max-h-[92vh] w-72 overflow-y-auto rounded-md bg-black/85 p-3 font-mono text-[11px] text-white/90"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">tuning (~)</span>
        <button
          className="rounded border border-white/30 px-2 py-0.5"
          onClick={() => {
            resetLive();
            bump((n) => n + 1);
          }}
        >
          reset
        </button>
      </div>
      {tuningRanges.map(([key, min, max, step, label]) => (
        <label key={key} className="mb-1.5 block">
          <div className="flex justify-between">
            <span>{label}</span>
            <span className="tabular-nums">{live[key]}</span>
          </div>
          <input
            type="range"
            className="w-full"
            min={min}
            max={max}
            step={step}
            value={live[key]}
            onChange={(e) => {
              live[key] = Number(e.target.value);
              bump((n) => n + 1);
            }}
          />
          <div className="text-[9px] text-white/40">default {tuning[key]}</div>
        </label>
      ))}
    </div>
  );
}
