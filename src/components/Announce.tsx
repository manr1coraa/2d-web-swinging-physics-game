import { ShieldCheck, Zap, Wind, Sparkles } from "lucide-react";
import type { Announce } from "../game/engine";

const THEME: Record<
  Announce["kind"],
  { from: string; to: string; ring: string; icon: typeof Zap; text: string }
> = {
  shield: {
    from: "#2fe0b0",
    to: "#17a380",
    ring: "rgba(47,224,176,0.55)",
    icon: ShieldCheck,
    text: "#042c24",
  },
  glide: {
    from: "#7fe6ff",
    to: "#2b9fd8",
    ring: "rgba(73,216,255,0.55)",
    icon: Wind,
    text: "#042536",
  },
  perfect: {
    from: "#8fd8ff",
    to: "#4f7dff",
    ring: "rgba(120,180,255,0.55)",
    icon: Sparkles,
    text: "#061a3a",
  },
  save: {
    from: "#9dffe4",
    to: "#22b894",
    ring: "rgba(47,224,176,0.55)",
    icon: ShieldCheck,
    text: "#042c24",
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
      {/* speed streak behind the badge */}
      <div
        className="anim-streak absolute h-[112px] w-[min(680px,92vw)] rounded-full blur-2xl"
        style={{
          background: `linear-gradient(90deg, transparent, ${th.ring}, transparent)`,
        }}
      />
      {/* shockwave */}
      <div
        className="anim-announce-burst absolute h-28 w-28 rounded-full border-4"
        style={{ borderColor: th.ring }}
      />

      <div className="anim-announce flex flex-col items-center">
        <div
          className="flex items-center gap-3 rounded-[22px] border-b-[5px] px-7 py-4"
          style={{
            background: `linear-gradient(180deg, ${th.from}, ${th.to})`,
            borderColor: "rgba(0,0,0,0.35)",
            boxShadow: `0 18px 50px -10px ${th.ring}, inset 0 2px 0 0 rgba(255,255,255,0.4)`,
          }}
        >
          <Icon size={30} strokeWidth={2.6} style={{ color: th.text }} />
          <span
            className="font-display text-4xl font-extrabold uppercase leading-none tracking-[0.06em] sm:text-5xl"
            style={{ color: th.text }}
          >
            {data.title}
          </span>
        </div>
      </div>

      <div
        className="anim-announce-sub font-display mt-3 rounded-full bg-black/55 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.25em] backdrop-blur-sm"
        style={{ color: th.from }}
      >
        {data.sub}
      </div>
    </div>
  );
}
