import type { ReactNode } from "react";

/** Soft, tactile buttons that fit the paper-and-brick art direction. */
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
      "bg-[#b4574b] text-[#fff5ea] border-[#8b3f37] shadow-[0_3px_0_0_#8b3f37] hover:bg-[#c26558]",
    gold: "bg-[#d4ae6b] text-[#403726] border-[#ad8952] shadow-[0_3px_0_0_#ad8952] hover:bg-[#dfbd7d]",
    dark: "bg-[#e6dfc8] text-[#405447] border-[#c7bfa7] shadow-[0_3px_0_0_#c7bfa7] hover:bg-[#eee8d4]",
    ghost:
      "bg-[#f6f0dd]/65 text-[#556754] border-[#d3cbb2] shadow-[0_2px_0_0_rgba(91,100,72,0.12)] hover:bg-[#f8f3e5]",
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
      className={`font-display inline-flex items-center justify-center rounded-xl border font-bold tracking-[0.08em] transition-all duration-150 active:translate-y-[2px] active:shadow-none ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Light, quiet icon button for the small in-game controls. */
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
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150 ${
        active
          ? "border-[#a2564b] bg-[#b4574b] text-[#fff5ea]"
          : "border-[#d4ceb8] bg-[#f5efdd]/85 text-[#4c5c60] hover:bg-[#fff8e7] hover:text-[#2f4247]"
      }`}
    >
      {children}
    </button>
  );
}

/** A paper-coloured panel with a soft, wide shadow. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[#d4cbb2] bg-[#f5efdd]/95 text-[#435447] shadow-[0_18px_50px_-24px_rgba(50,61,48,0.42)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

/** Small natural-colour label chip. */
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
    gold: "bg-[#d4ae6b]/22 text-[#725c37] border-[#c7a36a]/50",
    cyan: "bg-[#8fbcb0]/22 text-[#4d7770] border-[#8fbcb0]/55",
    coral: "bg-[#c27b63]/16 text-[#8b5847] border-[#c27b63]/40",
  };
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.08em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
