import type { ReactNode } from "react";

/* ---------- icons: single 2px stroke family, drawn for this game ---------- */

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PauseIcon() {
  return (
    <svg {...base} fill="currentColor" stroke="none">
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...base}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/* ---------- primitives ---------- */

export function IconButton({
  children,
  label,
  onClick,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-ink/45 text-paper transition-transform duration-150 ease-ios active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto flex h-14 w-full items-center justify-center rounded-2xl bg-paper text-[17px] font-semibold text-ink transition-transform duration-150 ease-ios active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto flex h-12 w-full items-center justify-center rounded-2xl bg-paper/[0.08] text-[17px] font-medium text-paper transition-colors duration-150 ease-ios active:bg-paper/[0.14] ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`pointer-events-auto relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-ios ${
        checked ? "bg-amber" : "bg-paper/20"
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-paper shadow-sm transition-transform duration-200 ease-ios ${
          checked ? "translate-x-[20px]" : ""
        }`}
      />
    </button>
  );
}

/** bottom sheet used for pause and settings */
export function Sheet({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`absolute inset-0 flex items-end bg-ink/60 anim-fade ${className}`}>
      <div className="anim-sheet w-full rounded-t-[28px] bg-ink-2 px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-paper/20" />
        {children}
      </div>
    </div>
  );
}
