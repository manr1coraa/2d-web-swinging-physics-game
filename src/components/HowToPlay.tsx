import type { ReactNode } from "react";
import { X, RotateCcw } from "lucide-react";
import { ChunkyButton, Panel } from "./ui";

/* ---- tiny illustrations matching the in-game art ---- */

const Ledge = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <rect x="2" y="4" width="36" height="17" rx="2" fill="#0b1024" />
    <rect x="6" y="8" width="6" height="7" fill="#ffd79a" opacity=".8" />
    <rect x="16" y="8" width="6" height="7" fill="#7fe0ff" opacity=".7" />
    <rect x="26" y="8" width="6" height="7" fill="#ffd79a" opacity=".5" />
    <path d="M2 21h36" stroke="#49d8ff" strokeWidth="2.5" />
    <path d="M20 21v9" stroke="#f2feff" strokeWidth="1.6" />
    <circle cx="20" cy="33" r="3.5" fill="#e0344f" />
  </svg>
);

const Street = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <rect x="2" y="22" width="36" height="16" rx="2" fill="#241a33" />
    <path d="M2 22h36" stroke="#ffd09a" strokeWidth="2.5" />
    <ellipse cx="12" cy="28" rx="6" ry="1.6" fill="#fff3d0" />
    <ellipse cx="28" cy="33" rx="6" ry="1.6" fill="#ff5a6e" />
    <path d="M8 16v-5M20 13V8M32 16v-5" stroke="#ff5172" strokeWidth="2" strokeLinecap="round" opacity=".7" />
  </svg>
);

const Tower = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <path d="M13 38 L16 12 L24 12 L27 38 Z" fill="#1d2655" stroke="#8296ff" strokeOpacity=".4" strokeWidth="1.5" />
    <rect x="18" y="17" width="4" height="5" fill="#ffd79a" opacity=".8" />
    <rect x="18" y="26" width="4" height="5" fill="#79dcff" opacity=".7" />
    <path d="M20 12V5" stroke="#2a3366" strokeWidth="2" />
    <circle cx="20" cy="4" r="2.6" fill="#ff4d6a" />
  </svg>
);

const Girder = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <path d="M10 4 L30 4 L21 34 Z" fill="#1a1f42" stroke="#ffbe46" strokeOpacity=".7" strokeWidth="1.5" />
    <path d="M10 8 L28 14 M30 8 L13 15 M13 17 L26 22" stroke="#7c8cdc" strokeOpacity=".5" strokeWidth="1.2" />
    <rect x="10" y="3" width="6" height="3.5" fill="#ffc247" />
    <rect x="23" y="3" width="6" height="3.5" fill="#ffc247" />
    <circle cx="21" cy="33" r="3" fill="#ff5470" />
  </svg>
);

const Drone = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <path d="M11 13 L20 20 L29 13 M11 27 L20 20 L29 27" stroke="#2b3366" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="10" cy="12" rx="7" ry="2.4" stroke="#9db0ff" strokeWidth="1.6" fill="none" />
    <ellipse cx="30" cy="12" rx="7" ry="2.4" stroke="#9db0ff" strokeWidth="1.6" fill="none" />
    <ellipse cx="10" cy="28" rx="7" ry="2.4" stroke="#9db0ff" strokeWidth="1.6" fill="none" />
    <ellipse cx="30" cy="28" rx="7" ry="2.4" stroke="#9db0ff" strokeWidth="1.6" fill="none" />
    <rect x="13" y="16" width="14" height="9" rx="3.5" fill="#39406b" stroke="#8fa0ff" strokeWidth="1.4" />
    <circle cx="20" cy="20.5" r="3" fill="#ff4656" />
  </svg>
);

const Scaffold = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <path d="M9 26 L7 36 M31 26 L33 36" stroke="#141a3c" strokeWidth="3" strokeLinecap="round" />
    <rect x="4" y="14" width="32" height="12" rx="3.5" fill="#222b5c" stroke="#7c8cff" strokeOpacity=".45" strokeWidth="1.5" />
    <path d="M9 15.5h22" stroke="#49d8ff" strokeWidth="2.6" />
    <circle cx="10" cy="23" r="1.8" fill="#ffe6a8" />
    <circle cx="20" cy="23" r="1.8" fill="#ffe6a8" />
    <circle cx="30" cy="23" r="1.8" fill="#3a3f66" />
  </svg>
);

const WindZone = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <rect x="3" y="7" width="34" height="26" rx="11" fill="#bff2ff" opacity=".12" />
    <rect x="3" y="7" width="34" height="26" rx="11" fill="none" stroke="#8fe6ff" strokeWidth="1.4" strokeDasharray="4 5" opacity=".7" />
    <path d="M9 16h14a4 4 0 100-4" stroke="#dff6ff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M9 21h20a4 4 0 110 4" stroke="#dff6ff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".8" />
    <path d="M9 26h11" stroke="#dff6ff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".6" />
  </svg>
);

const FireRoof = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <rect x="2" y="24" width="36" height="14" rx="2" fill="#1b0d12" />
    <path d="M2 24h36" stroke="#ffb066" strokeWidth="2" />
    <path d="M12 24c0-6 3-9 3-13 3 4 6 6 6 13z" fill="#ff8a3d" opacity=".9" />
    <path d="M22 24c0-5 2.4-7.5 2.4-11 2.6 3.4 5 5 5 11z" fill="#ff8a3d" opacity=".7" />
    <path d="M14 24c0-3.4 1.6-5 1.6-7 1.8 2.2 3.4 3.4 3.4 7z" fill="#ffe07a" />
  </svg>
);

const Fish = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <circle cx="20" cy="20" r="15" stroke="#ff7d8f" strokeWidth="1.4" strokeDasharray="4 5" fill="none" opacity=".7" />
    <path d="M9 20l-5-5v10z" fill="#ff7d4d" />
    <ellipse cx="20" cy="20" rx="11" ry="7.5" fill="#ffb347" stroke="#5a1e0a" strokeOpacity=".5" strokeWidth="1.4" />
    <path d="M16 13.5v13M21 13v14" stroke="#fff" strokeWidth="1.8" opacity=".75" />
    <circle cx="26.4" cy="18" r="2.4" fill="#fff" />
    <circle cx="26.7" cy="18" r="1.2" fill="#20161a" />
  </svg>
);

const Pod = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <ellipse cx="20" cy="12" rx="11" ry="8.5" fill="#131a3d" stroke="#49d8ff" strokeWidth="1.8" />
    <ellipse cx="16" cy="9.5" rx="3.6" ry="2.6" fill="#49d8ff" opacity=".45" />
    <path d="M13 20l-3 6M27 20l3 6" stroke="#c8e6ff" strokeOpacity=".55" strokeWidth="1.8" />
    <rect x="5" y="26" width="30" height="9" rx="4" fill="#1b2450" stroke="#96c8ff" strokeOpacity=".6" strokeWidth="1.5" />
    <path d="M9 27.4h22" stroke="#49d8ff" strokeWidth="2.2" />
  </svg>
);

const Gate = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <rect x="1" y="20" width="38" height="18" rx="2" fill="#241a33" />
    <path d="M1 20h14M25 20h14" stroke="#ffd09a" strokeWidth="2.4" />
    <ellipse cx="20" cy="21" rx="11" ry="4.6" fill="#04030c" stroke="#ffe79a" strokeWidth="2" />
    <path d="M20 12v6M16 14.5L20 18.5l4-4" stroke="#ffe79a" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 34h6M26 34h6" stroke="#ffe79a" strokeWidth="2" strokeLinecap="round" opacity=".6" />
  </svg>
);

const Coin = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <circle cx="20" cy="20" r="14" fill="#ffd23f" opacity=".16" />
    <ellipse cx="20" cy="20" rx="8.5" ry="11" fill="#ffd23f" stroke="#8c5a0a" strokeOpacity=".6" strokeWidth="1.6" />
    <ellipse cx="20" cy="20" rx="4" ry="6" fill="#ff9d2e" />
  </svg>
);

const Ring = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <circle cx="20" cy="20" r="14" fill="#ff5e7a" opacity=".14" />
    <circle cx="20" cy="20" r="13" stroke="#ff5e7a" strokeWidth="5" fill="none" opacity=".5" />
    <circle cx="20" cy="20" r="13" stroke="#ffd7de" strokeWidth="2" fill="none" />
    <path d="M13 15l4 5-4 5M19 15l4 5-4 5" stroke="#ff5e7a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <circle cx="20" cy="20" r="14" fill="#2fe0b0" opacity=".15" />
    <circle cx="20" cy="20" r="13" stroke="#2fe0b0" strokeWidth="2.2" fill="rgba(255,255,255,.06)" />
    <path d="M20 11 l7 2.6 v5 c0 5-3.4 8.4-7 10 -3.6-1.6-7-5-7-10v-5z" fill="#2fe0b0" />
  </svg>
);

const MagnetIcon = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9">
    <circle cx="20" cy="20" r="14" fill="#ff6b81" opacity=".15" />
    <circle cx="20" cy="20" r="13" stroke="#ff6b81" strokeWidth="2.2" fill="rgba(255,255,255,.06)" />
    <path d="M13 24v-4a7 7 0 0114 0v4" stroke="#ff6b81" strokeWidth="4.5" fill="none" />
    <path d="M13 24v4M27 24v4" stroke="#eef3ff" strokeWidth="4.5" />
  </svg>
);

interface Row {
  icon: ReactNode;
  name: string;
  desc: string;
  tone: "danger" | "good" | "info";
}

const HAZARDS: Row[] = [
  { icon: <Street />, name: "The street", desc: "Touch the avenue and the run is over.", tone: "danger" },
  { icon: <Tower />, name: "Skyscraper", desc: "Towers from street level. Web over the roof.", tone: "danger" },
  { icon: <Girder />, name: "Girder", desc: "Striped steel beams hanging from above.", tone: "danger" },
  { icon: <Drone />, name: "Patrol drone", desc: "Hovering rotors. Give the red eye space.", tone: "danger" },
  { icon: <FireRoof />, name: "Burning roof", desc: "Flames along a ledge. Never web through them.", tone: "danger" },
  { icon: <Fish />, name: "Reef fish", desc: "Trench dwellers that drift sideways. Swim clear.", tone: "danger" },
];

const GOODIES: Row[] = [
  { icon: <Ledge />, name: "Ledges", desc: "Any building edge takes your web.", tone: "info" },
  { icon: <Scaffold />, name: "Scaffold", desc: "Safe to land on and to swing from.", tone: "good" },
  { icon: <Coin />, name: "Coins", desc: "Laid along the perfect arc. Chain them.", tone: "good" },
  { icon: <Ring />, name: "Boost ring", desc: "A burst of speed — aim for long gaps.", tone: "good" },
  { icon: <ShieldIcon />, name: "Shield", desc: "Absorbs one fatal hit and bounces you up.", tone: "good" },
  { icon: <MagnetIcon />, name: "Magnet", desc: "Vacuums nearby coins for 9 seconds.", tone: "good" },
  { icon: <WindZone />, name: "Air current", desc: "Ride the arrows: they fling you forward and up.", tone: "good" },
  { icon: <Pod />, name: "Web pod", desc: "A floating anchor when the next roof is too far.", tone: "good" },
  { icon: <Gate />, name: "Level gate", desc: "At 250 m, dive into the hole in the street.", tone: "good" },
];

function LegendRow({ r }: { r: Row }) {
  const ring =
    r.tone === "danger"
      ? "border-[#ff5172]/30 bg-[#ff5172]/8"
      : r.tone === "good"
        ? "border-[#2fe0b0]/25 bg-[#2fe0b0]/8"
        : "border-[#49d8ff]/25 bg-[#49d8ff]/8";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-2.5 ${ring}`}>
      <div className="shrink-0">{r.icon}</div>
      <div className="min-w-0">
        <div className="font-display text-[13px] font-extrabold leading-tight text-white">
          {r.name}
        </div>
        <div className="text-[11px] font-semibold leading-snug text-white/50">
          {r.desc}
        </div>
      </div>
    </div>
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
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#05040f]/70 p-3 backdrop-blur-md sm:p-6">
      <Panel className="anim-pop-in flex max-h-full w-full max-w-2xl flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-2xl font-extrabold text-white">
            How to play
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white/70 transition hover:bg-white/15 hover:text-white active:scale-90"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* controls */}
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#49d8ff]">
              Controls
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <kbd className="font-display rounded-lg border-b-2 border-black/50 bg-[#2a3364] px-2.5 py-1 text-[11px] font-extrabold text-white">
                    SPACE
                  </kbd>
                  <span className="text-[11px] font-bold text-white/40">or TAP</span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-snug text-white/60">
                  <b className="text-white/90">Hold</b> and the web fires itself
                  at the best ledge ahead — the marker shows where.
                </p>
              </div>
              <div>
                <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">
                  Release
                </div>
                <p className="mt-2 text-xs font-semibold leading-snug text-white/60">
                  The line snaps and you launch along the arc. Let go on the way{" "}
                  <b className="text-white/90">up and forward</b> for a{" "}
                  <b className="text-[#49d8ff]">PERFECT</b> combo.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <kbd className="font-display rounded-lg border-b-2 border-black/50 bg-[#2a3364] px-2.5 py-1 text-[11px] font-extrabold text-white">
                    SHIFT
                  </kbd>
                  <span className="text-[11px] font-bold text-white/40">
                    or the GLIDE button
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-snug text-white/60">
                  <b className="text-white/90">Hold</b> to spread{" "}
                  <b className="text-[#49d8ff]">web-wings</b>. Speed turns into
                  altitude — a fast glide <b className="text-white/90">climbs</b>
                  , and thermals off the avenue always lift you clear. You can
                  never sink into the street while gliding.
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">
                Pumping
              </div>
              <p className="mt-1.5 text-xs font-semibold leading-snug text-white/60">
                While attached your spider works the line himself — reeling in
                on the way up, kicking out on the way down — so a swing{" "}
                <b className="text-white/90">gains</b> speed instead of dying.
                Release on the way <b className="text-white/90">up and forward</b>{" "}
                for a <b className="text-[#49d8ff]">PERFECT</b> combo.
              </p>
            </div>
          </div>

          {/* goal of a level */}
          <div className="mt-4 rounded-2xl border border-[#ffc53d]/25 bg-[#ffc53d]/8 p-4">
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#ffc53d]">
              Goal of every level
            </div>
            <p className="mt-2 text-xs font-semibold leading-snug text-white/60">
              Ride out <b className="text-white/90">250 m</b>, then dive through
              the <b className="text-[#ffe79a]">glowing hole</b> in the street.
              The gate drops you into the next world — jungle, trench, desert,
              glacier, volcano, orbit or neon — and your progress is stored
              automatically. Hit the avenue instead and that is a splat, so line
              the dive up early: the beacon and the bouncing chevrons mark the way.
            </p>
            <p className="mt-2 text-xs font-semibold leading-snug text-white/60">
              Back in the menu you can <b className="text-white/90">pick any
              unlocked world</b> and replay it from the start.
            </p>
          </div>

          {/* legend */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="font-display mb-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#ff5172]">
                Avoid
              </div>
              <div className="flex flex-col gap-2">
                {HAZARDS.map((r) => (
                  <LegendRow key={r.name} r={r} />
                ))}
              </div>
            </div>
            <div>
              <div className="font-display mb-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#2fe0b0]">
                Collect & use
              </div>
              <div className="flex flex-col gap-2">
                {GOODIES.map((r) => (
                  <LegendRow key={r.name} r={r} />
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold text-white/35">
            P / Esc — pause · R — restart · M — mute
          </p>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <ChunkyButton tone="ghost" size="sm" onClick={onReplayTips}>
            <RotateCcw size={13} />
            Replay tips
          </ChunkyButton>
          <ChunkyButton tone="primary" size="md" onClick={onClose}>
            Got it
          </ChunkyButton>
        </div>
      </Panel>
    </div>
  );
}
