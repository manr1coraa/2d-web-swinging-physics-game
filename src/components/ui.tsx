import type { ReactNode } from "react";

/** Flat text button. Primary is the single accent: pale cyan, no gradient. */
export function Button({
  children,
  onClick,
  primary = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`pointer-events-auto ease-ios rounded-full px-8 py-3 text-[17px] font-semibold transition-[transform,opacity] duration-150 active:scale-[0.97] active:opacity-80 ${
        primary ? "bg-[#7df0ff] text-[#06121f]" : "bg-white/10 text-white/90"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Round icon button for the corners of the screen. */
export function IconButton({
  children,
  onClick,
  label,
  active = false,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`pointer-events-auto ease-ios flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 ${
        active ? "bg-white/20 text-white" : "bg-white/10 text-white/70 active:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

/** iOS-style switch row used in settings. */
export function Toggle({
  label,
  icon,
  on,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="pointer-events-auto flex w-full items-center gap-3 py-3.5 text-left"
    >
      <span className="text-white/60">{icon}</span>
      <span className="flex-1 text-[16px] text-white/90">{label}</span>
      <span
        className={`ease-ios relative h-[28px] w-[48px] rounded-full transition-colors duration-200 ${
          on ? "bg-[#7df0ff]" : "bg-white/15"
        }`}
      >
        <span
          className={`ease-ios absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform duration-200 ${
            on ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
