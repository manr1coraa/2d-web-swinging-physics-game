/* Hand-drawn icons for WEBBY: one stroke weight, round caps, 24px grid. */
type P = { size?: number };

const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const PauseIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <path d="M9 6.5v11M15 6.5v11" />
  </svg>
);

export const CloseIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

/* gear: a ring with a web-strand spoke pattern instead of teeth */
export const GearIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6" />
  </svg>
);

export const SoundIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
  </svg>
);

export const MuteIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);

export const MusicIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <path d="M9 17.5V6l9-2v11.5" />
    <circle cx="6.8" cy="17.5" r="2.2" />
    <circle cx="15.8" cy="15.5" r="2.2" />
  </svg>
);

export const VibrateIcon = ({ size }: P) => (
  <svg {...base(size)} aria-hidden>
    <rect x="8" y="3.5" width="8" height="17" rx="2" />
    <path d="M4 8.5v7M20 8.5v7" />
  </svg>
);
