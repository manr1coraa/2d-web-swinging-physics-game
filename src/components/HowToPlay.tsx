import { Wind, RotateCcw, RotateCw, Leaf, Flag, X, RotateCcw as Reset } from "lucide-react";
import { ChunkyButton, Panel } from "./ui";

function Key({ children }: { children: string }) {
  return (
    <kbd className="font-display rounded-lg border border-[#c8bfa7] bg-[#e8e1cb] px-2.5 py-1 text-[11px] font-extrabold text-[#4d5f4f]">
      {children}
    </kbd>
  );
}

export default function HowToPlay({
  onClose,
  onReplayTips,
}: {
  onClose: () => void;
  onReplayTips: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#43584b]/24 p-3 backdrop-blur-sm sm:p-6">
      <Panel className="anim-pop-in flex max-h-full w-full max-w-xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#d5cdb7] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9678]">A little field guide</p>
            <h2 className="font-display mt-0.5 text-2xl font-extrabold text-[#405447]">How to play</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d5cdb7] bg-[#eee7d2] text-[#5b6b5b] transition hover:bg-[#f8f2e1]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 touch-pan-y">
          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#71846b]">Move with the web</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-2"><Key>SPACE</Key><span className="text-[10px] font-bold text-[#88917a]">or touch</span></div>
                <p className="mt-2 text-xs leading-relaxed text-[#5e6b5a]">Hold to catch a branch. The silk stretches a little, then returns its spring as you swing. Let go to drift onward.</p>
              </div>
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-2"><Key>SHIFT</Key><Wind size={15} className="text-[#77958a]" /><span className="text-[10px] font-bold text-[#88917a]">or GLIDE</span></div>
                <p className="mt-2 text-xs leading-relaxed text-[#5e6b5a]">Hold to spread the web-wings and soften your fall. Use it to shape a calm, controlled arc.</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#a47758]">Tuck and turn</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex gap-1.5 text-[#8b7658]">
                <RotateCcw size={19} /><RotateCw size={19} />
              </div>
              <p className="text-xs leading-relaxed text-[#5e6b5a]">
                In the air, hold <Key>A</Key> or <Key>←</Key> to turn one way, and <Key>D</Key> or <Key>→</Key> to turn the other. The spider has angular momentum: a full turn takes time, and releasing the keys lets the spin coast down naturally.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#71846b]">Your endless trail</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#5e6b5a]">
              Follow the line forward and pass through a wooden waymark every <b className="text-[#405447]">250 m</b>. Gather the little seed-leaves along the way. Every five waymarks brings a new landscape; all eight return in a gentle, endless cycle.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]"><Leaf size={12} /> seeds</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]"><Flag size={12} /> waymarks</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]"><Wind size={12} /> quiet breezes</span>
            </div>
          </section>

          <p className="text-center text-[10px] font-semibold text-[#92947e]">P / Esc pauses · R starts a fresh journey · M toggles sound</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#d5cdb7] px-5 py-4">
          <ChunkyButton tone="ghost" size="sm" onClick={onReplayTips}>
            <Reset size={13} />
            Replay hints
          </ChunkyButton>
          <ChunkyButton tone="primary" size="md" onClick={onClose}>Back to the trail</ChunkyButton>
        </div>
      </Panel>
    </div>
  );
}
