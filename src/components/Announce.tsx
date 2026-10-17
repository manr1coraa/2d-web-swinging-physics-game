import { ShieldCheck, Magnet, Leaf, Wind, Sparkles, Flag } from "lucide-react";
import type { Announce } from "../game/engine";

const ICONS: Record<Announce["kind"], typeof Leaf> = {
  shield: ShieldCheck,
  magnet: Magnet,
  glide: Wind,
  perfect: Sparkles,
  level: Flag,
  save: ShieldCheck,
};

export default function AnnounceOverlay({ data }: { data: Announce }) {
  const Icon = ICONS[data.kind];
  return (
    <div key={data.id} className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      <div className="anim-announce flex items-center gap-2.5 rounded-2xl border border-[#d2c29c] bg-[#f6f0df]/92 px-5 py-3 shadow-[0_10px_35px_-20px_rgba(56,69,53,0.55)] backdrop-blur-sm">
        <Icon size={19} strokeWidth={2} className="text-[#73866b]" />
        <span className="font-display text-xl font-extrabold tracking-[0.04em] text-[#465b4c] sm:text-2xl">
          {data.title}
        </span>
      </div>
      <div className="anim-announce-sub font-display mt-2 text-[10px] font-bold tracking-[0.12em] text-[#736e58]">
        {data.sub}
      </div>
    </div>
  );
}
