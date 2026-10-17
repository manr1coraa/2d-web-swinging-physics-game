import { ShieldCheck, Magnet, Wind, Sparkles, Flag, Building2 } from "lucide-react";
import type { Announce } from "../game/engine";

const ICONS: Record<Announce["kind"], typeof Building2> = {
  shield: ShieldCheck,
  magnet: Magnet,
  glide: Wind,
  perfect: Sparkles,
  level: Flag,
  district: Building2,
  save: ShieldCheck,
};

export default function AnnounceOverlay({ data }: { data: Announce }) {
  const Icon = ICONS[data.kind];
  return (
    <div
      key={data.id}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
    >
      <div className="anim-announce flex items-center gap-2.5 rounded-2xl border border-[#d2c29c] bg-[#f6f0df]/94 px-5 py-3 shadow-[0_10px_35px_-20px_rgba(40,52,58,0.6)] backdrop-blur-sm">
        <Icon size={19} strokeWidth={2} className="text-[#a26a52]" />
        <span className="font-display text-xl font-extrabold tracking-[0.04em] text-[#42545a] sm:text-2xl">
          {data.title}
        </span>
      </div>
      <div className="anim-announce-sub font-display mt-2 text-[10px] font-bold tracking-[0.12em] text-[#f0e9d8] drop-shadow-[0_1px_3px_rgba(30,40,44,0.7)]">
        {data.sub}
      </div>
    </div>
  );
}
