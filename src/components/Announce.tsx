import { ShieldCheck, Magnet, Zap, Wind, Sparkles, Flag } from "lucide-react";
import type { Announce } from "../game/engine";

/* Flat, quiet callouts: a solid chip with a thin ring. No streaks, no bursts. */
const THEME: Record<
  Announce["kind"],
  { bg: string; border: string; icon: typeof Zap; text: string; sub: string }
> = {
  shield: {
    bg: "rgba(24,58,50,0.94)",
    border: "rgba(64,214,170,0.55)",
    icon: ShieldCheck,
    text: "#8ff0d2",
    sub: "#7fe4c6",
  },
  magnet: {
    bg: "rgba(58,26,36,0.94)",
    border: "rgba(232,96,130,0.55)",
    icon: Magnet,
    text: "#ff9db0",
    sub: "#ff8ea1",
  },
  boost: {
    bg: "rgba(58,44,20,0.94)",
    border: "rgba(232,182,74,0.55)",
    icon: Zap,
    text: "#f0c45f",
    sub: "#e8b64a",
  },
  glide: {
    bg: "rgba(18,42,60,0.94)",
    border: "rgba(92,200,234,0.5)",
    icon: Wind,
    text: "#8fdcff",
    sub: "#7fd2f5",
  },
  perfect: {
    bg: "rgba(22,32,62,0.94)",
    border: "rgba(122,164,255,0.5)",
    icon: Sparkles,
    text: "#a9c2ff",
    sub: "#93aefc",
  },
  level: {
    bg: "rgba(52,42,18,0.94)",
    border: "rgba(232,182,74,0.55)",
    icon: Flag,
    text: "#f2cd77",
    sub: "#e8b64a",
  },
  save: {
    bg: "rgba(24,58,50,0.94)",
    border: "rgba(64,214,170,0.5)",
    icon: ShieldCheck,
    text: "#8ff0d2",
    sub: "#7fe4c6",
  },
};

export default function AnnounceOverlay({ data }: { data: Announce }) {
  const th = THEME[data.kind];
  const Icon = th.icon;
  return (
    <div
      key={data.id}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
    >
      <div
        className="anim-announce flex items-center gap-2.5 rounded-xl border px-5 py-3 backdrop-blur-sm"
        style={{
          background: th.bg,
          borderColor: th.border,
          boxShadow: "0 12px 32px -16px rgba(0,0,0,0.9)",
        }}
      >
        <Icon size={20} strokeWidth={2.4} style={{ color: th.text }} />
        <span
          className="font-display text-2xl font-extrabold uppercase leading-none tracking-[0.06em] sm:text-3xl"
          style={{ color: th.text }}
        >
          {data.title}
        </span>
      </div>
      <div
        className="anim-announce-sub font-display mt-2 text-[10px] font-bold uppercase tracking-[0.28em]"
        style={{ color: th.sub }}
      >
        {data.sub}
      </div>
    </div>
  );
}
