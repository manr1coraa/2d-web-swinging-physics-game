import type { ReactNode } from "react";

/** chunky tactile button with a solid bottom edge — indie arcade feel */
export function ChunkyButton({
  children,
  onClick,
  tone = "primary",
  size = "md",
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "dark" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}) {
  const tones = {
    primary:
      "bg-[#ff5172] text-white border-[#b81f42] shadow-[0_8px_0_0_#b81f42,0_18px_34px_-10px_rgba(255,81,114,0.75)] hover:bg-[#ff6682]",
    gold: "bg-[#ffc53d] text-[#4a2e00] border-[#b8801a] shadow-[0_8px_0_0_#b8801a,0_18px_34px_-12px_rgba(255,197,61,0.7)] hover:bg-[#ffd25f]",
    dark: "bg-[#222a52] text-white border-[#121734] shadow-[0_8px_0_0_#121734,0_16px_30px_-14px_rgba(0,0,0,0.9)] hover:bg-[#2b3463]",
    ghost:
      "bg-white/8 text-white/80 border-white/10 shadow-[0_6px_0_0_rgba(255,255,255,0.07)] hover:bg-white/14 hover:text-white",
  };
  const sizes = {
    sm: "px-4 py-2 text-xs gap-1.5",
    md: "px-6 py-3 text-sm gap-2",
    lg: "px-9 py-4 text-base gap-2.5",
  };
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`font-display inline-flex items-center justify-center rounded-2xl border-b-2 font-extrabold uppercase tracking-[0.1em] transition-all duration-100 active:translate-y-[6px] active:shadow-none ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/** round icon button */
export function RoundButton({
  children,
  onClick,
  title,
  ariaLabel,
  active = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border-b-2 transition-all duration-100 active:translate-y-[4px] active:shadow-none ${
        active
          ? "border-[#b81f42] bg-[#ff5172] text-white shadow-[0_5px_0_0_#b81f42]"
          : "border-black/40 bg-[#1b2246]/85 text-white/75 shadow-[0_5px_0_0_rgba(0,0,0,0.4)] hover:bg-[#242d5c] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** soft panel card */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1a2048]/95 to-[#121634]/95 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/** rotated sticker badge */
export function Sticker({
  children,
  tone = "gold",
  className = "",
}: {
  children: ReactNode;
  tone?: "gold" | "cyan" | "coral";
  className?: string;
}) {
  const tones = {
    gold: "bg-[#ffc53d] text-[#4a2e00] shadow-[0_6px_0_0_#b8801a]",
    cyan: "bg-[#49d8ff] text-[#06293a] shadow-[0_6px_0_0_#1a93bd]",
    coral: "bg-[#ff5172] text-white shadow-[0_6px_0_0_#b81f42]",
  };
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
