import {
  Wind,
  RotateCcw,
  RotateCw,
  Building2,
  Flag,
  X,
  RotateCcw as Reset,
  Trash2,
  Anchor,
  ArrowUp,
  CircleDot,
} from "lucide-react";
import { ChunkyButton, Panel } from "./ui";

function Key({ children }: { children: string }) {
  return (
    <kbd className="font-display rounded-lg border border-[#c8bfa7] bg-[#e8e1cb] px-2 py-0.5 text-[10px] font-extrabold text-[#4d5f4f] sm:px-2.5 sm:py-1 sm:text-[11px]">
      {children}
    </kbd>
  );
}

export default function HowToPlay({
  onClose,
  onReplayTips,
  onEraseSave,
}: {
  onClose: () => void;
  onReplayTips: () => void;
  onEraseSave: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#3c4a50]/26 p-2 backdrop-blur-sm sm:p-6">
      <Panel className="anim-pop-in flex max-h-full w-full max-w-xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#d5cdb7] px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9678]">
              A little field guide
            </p>
            <h2 className="font-display mt-0.5 text-xl font-extrabold text-[#42545a] sm:text-2xl">
              How to play
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d5cdb7] bg-[#eee7d2] text-[#5b6b5b] transition hover:bg-[#f8f2e1]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 touch-pan-y sm:space-y-4 sm:px-5">
          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#a26a52]">
              The web fires itself
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#5e6b5a]">
              The silk is on <b className="text-[#42545a]">auto-attack</b>: in the air it always
              grabs the nearest rooftop that is safe to swing from — a parapet corner, a chimney
              cap, a water tank, a mast tip or a crane jib. The dotted line shows where it will
              stick next.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-2">
                  <Key>SPACE</Key>
                  <Anchor size={14} className="text-[#9a6a52]" />
                  <span className="text-[10px] font-bold text-[#88917a]">or hold WEB</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5e6b5a]">
                  Hold to work the line: you pump along the swing and reel the silk in. Let go at
                  the top of the arc to fly — a clean, forward release counts as PERFECT and buys a
                  longer free arc before the web grabs again.
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-2">
                  <Key>SHIFT</Key>
                  <Wind size={14} className="text-[#77958a]" />
                  <span className="text-[10px] font-bold text-[#88917a]">or hold GLIDE</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5e6b5a]">
                  Gliding softens the fall and holsters the web, so you can drop on purpose onto a
                  lower roof. Near the avenue the updraft always gives you one more chance.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#71846b]">
              Rooftops are parkour
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-1.5">
                  <Key>A</Key>
                  <Key>D</Key>
                  <RotateCcw size={13} className="text-[#7a8a72]" />
                  <RotateCw size={13} className="text-[#7a8a72]" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5e6b5a]">
                  On a roof these run. In the air they spin: the body has real angular momentum, so a
                  somersault is a full 2π turn that coasts down when you release.
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-1.5">
                  <Key>W</Key>
                  <ArrowUp size={13} className="text-[#7a8a72]" />
                  <span className="text-[10px] font-bold text-[#88917a]">JUMP</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5e6b5a]">
                  Jump off a ledge or over a chimney. A short coyote window forgives a late press,
                  and the web catches you once you are airborne.
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f1df] p-3">
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#7a8a72]" />
                  <span className="text-[10px] font-bold text-[#88917a]">no ceiling</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#5e6b5a]">
                  The city has no upper boundary. Climb as high as the roofs allow — the only limit
                  is that above the last anchor there is nothing left to grab.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8d0ba] bg-[#eee8d5]/75 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#8d6a52]">
              Districts, checkpoints and the save
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#5e6b5a]">
              Every district is <b className="text-[#42545a]">250 m</b> of rooftops. Fly through the
              scaffold arch to clear it: the district is saved, the next one opens, and the city
              gets a little tighter. All eight districts cycle forever. Dying sends you back to the
              start of the district you are in — everything you already cleared stays unlocked.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]">
                <Flag size={12} /> checkpoints
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]">
                <CircleDot size={12} /> web-spools
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5efdc] px-3 py-1.5 text-[10px] font-bold text-[#71846b]">
                <RotateCw size={12} /> flips and flow
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e0cdbd] bg-[#f6ece2]/80 p-4">
            <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#a85f45]">
              What ends a run
            </h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#6b5f56]">
              <li>· Touching the avenue. There is no floor to bounce on.</li>
              <li>
                · Hitting a chimney, tank, mast, billboard, crane or scaffold faster than a run —
                a slow brush only stumbles and costs your flow.
              </li>
              <li>· Delivery drones patrol some roofs. Read the path and swing under or over.</li>
              <li>
                · Clotheslines, laundry, gardens and skylights are harmless: you smash straight
                through them.
              </li>
            </ul>
          </section>

          <p className="text-center text-[10px] font-semibold text-[#92947e]">
            P / Esc pauses · R restarts the district · M toggles sound
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d5cdb7] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-2">
            <ChunkyButton tone="ghost" size="sm" onClick={onReplayTips}>
              <Reset size={13} /> Replay hints
            </ChunkyButton>
            <ChunkyButton tone="ghost" size="sm" onClick={onEraseSave}>
              <Trash2 size={13} /> Erase save
            </ChunkyButton>
          </div>
          <ChunkyButton tone="primary" size="md" onClick={onClose}>
            Back to the rooftops
          </ChunkyButton>
        </div>
      </Panel>
    </div>
  );
}
