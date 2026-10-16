import type { ReactNode } from "react";

/** tactile button with a solid bottom edge — flat colours, no gradients */
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
      "bg-[#e8465f] text-white border-[#8f1f33] shadow-[4px_4px_0_0_#000] hover:bg-[#f4576f]",
    gold: "bg-[#e8b64a] text-[#2e1f00] border-[#8f6a12] shadow-[4px_4px_0_0_#000] hover:bg-[#f0c45f]",
    dark: "bg-[#1c2340] text-white/90 border-[#0c1024] shadow-[4px_4px_0_0_#000] hover:bg-[#232b4c]",
    ghost:
      "bg-white/6 text-white/70 border-white/10 shadow-[3px_3px_0_0_#000] hover:bg-white/12 hover:text-white",
  };
  const sizes = {
    sm: "px-3.5 py-2 text-[11px] gap-1.5",
    md: "px-5 py-2.5 text-xs gap-2",
    lg: "px-7 py-3.5 text-sm gap-2.5",
  };
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`font-display inline-flex items-center justify-center rounded-none border-2 font-bold uppercase tracking-[0.12em] transition-all duration-100 active:translate-y-[4px] active:shadow-none ${tones[tone]} ${sizes[size]} ${className}`}
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
      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-100 ${
        active
          ? "border-[#e8465f]/60 bg-[#e8465f] text-white"
          : "border-white/10 bg-[#12172c]/80 text-white/60 hover:bg-[#1b2138] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** soft panel card — flat, quiet */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#12172c]/95 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

/** small label chip */
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
    gold: "bg-[#e8b64a]/15 text-[#f0c45f] border-[#e8b64a]/30",
    cyan: "bg-[#5cc8ea]/15 text-[#8fdcff] border-[#5cc8ea]/30",
    coral: "bg-[#e8465f]/15 text-[#ff8b9d] border-[#e8465f]/30",
  };
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
