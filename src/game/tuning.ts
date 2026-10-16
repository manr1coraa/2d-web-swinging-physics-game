/**
 * All gameplay / feel constants live here.
 *
 * Values are read at runtime (not cached), so the debug panel (press ~)
 * can change them on the fly. Units: px, seconds, px/s, px/s².
 */
export const tuning = {
  // ---- simulation -------------------------------------------------------
  /** fixed physics step rate. Rendering interpolates between steps. */
  stepHz: 120,
  /** gravity, px/s². Only force that makes you fall. */
  gravity: 1930,
  /** horizontal speed at the very start of a run (a launch, not a push). */
  startVx: 440,
  /**
   * Soft speed ceiling in screens per second. Air drag grows with v², so the
   * speed approaches this value smoothly instead of hitting a hard clamp.
   */
  softMaxScreens: 1.8,

  // ---- web / pendulum ---------------------------------------------------
  /** shortest rope a web may be attached with */
  ropeMin: 56,
  /** longest rope (must exceed the height of the lower corridors) */
  ropeMax: 440,
  /** auto-aim: ideal forward angle of the web from vertical, degrees */
  aimIdealDeg: 40,
  /** auto-aim: ideal rope length, px */
  aimIdealLen: 215,
  /** seconds between re-scans while the press is held and nothing is hooked */
  reattachEvery: 0.075,

  // ---- release skill ----------------------------------------------------
  /** a release counts as "perfect" within this angle of the lowest point */
  perfectAngleDeg: 22,
  /** and only if the spider is at least this fast */
  perfectMinSpeed: 420,
  /** speed gain per link of a perfect chain (applied to velocity) */
  perfectGain: 0.03,
  /** chain links that stop adding speed (the multiplier keeps counting) */
  perfectChainSpeedCap: 8,
  /** real-time slow motion after a perfect release, seconds (≤ 0.08) */
  perfectSlowS: 0.06,
  /** time scale during that slow motion */
  perfectSlowScale: 0.4,

  // ---- glide (double tap, hold on the second tap) -----------------------
  /** max gap between two taps to count as a double tap, seconds */
  doubleTapS: 0.3,
  /** gravity multiplier while gliding */
  glideGravity: 0.2,
  /**
   * Wing lift while gliding. Lift = gravity × glideLift × (v_x / screen width)²,
   * capped at v_x = 1 screen/s. It grows with speed like a real wing, so there
   * is no constant push. Gliding holds height at about 0.75 screen widths/s
   * (glideGravity 0.2). Above that the glider rises slowly.
   */
  glideLift: 0.6,
  /** fuel: seconds of glide available after a full refill */
  glideFuel: 1.6,
  /** fuel regained per second while swinging or standing on a platform */
  glideRefill: 0.6,

  // ---- camera -----------------------------------------------------------
  /** camera spring stiffness (natural frequency, rad/s), horizontal */
  camFollow: 7,
  /** camera spring stiffness, vertical. The spring is critically damped. */
  camFollowY: 4.2,
  /** how far the camera leads along the velocity, px per px/s */
  camLead: 0.22,
  /** zoom-out at top speed: 0 = none, 0.22 = view shrinks to 78% */
  camZoomOut: 0.22,

  // ---- scoring ----------------------------------------------------------
  /** px per metre on the distance counter */
  metre: 50,
} as const;

/** Mutable copy used at runtime. The debug panel writes into this. */
export const live: { -readonly [K in keyof typeof tuning]: number } = {
  ...tuning,
};

/** Debug-panel rows: [key, min, max, step, label]. */
export const tuningRanges: [keyof typeof tuning, number, number, number, string][] = [
  ["gravity", 600, 3000, 10, "gravity"],
  ["startVx", 0, 800, 10, "start vx"],
  ["softMaxScreens", 0.8, 3, 0.05, "soft max (screens/s)"],
  ["ropeMin", 30, 200, 2, "rope min"],
  ["ropeMax", 200, 600, 5, "rope max"],
  ["perfectAngleDeg", 5, 45, 1, "perfect angle°"],
  ["perfectMinSpeed", 100, 900, 10, "perfect min speed"],
  ["perfectGain", 0, 0.1, 0.005, "perfect gain"],
  ["perfectSlowS", 0, 0.08, 0.005, "slow-mo s"],
  ["perfectSlowScale", 0.1, 1, 0.05, "slow-mo scale"],
  ["doubleTapS", 0.12, 0.6, 0.01, "double tap s"],
  ["glideGravity", 0, 1, 0.01, "glide gravity"],
  ["glideLift", 0, 1.5, 0.01, "glide lift"],
  ["glideFuel", 0.2, 4, 0.05, "glide fuel s"],
  ["glideRefill", 0, 2, 0.05, "glide refill /s"],
  ["camFollow", 1, 20, 0.5, "camera follow"],
  ["camFollowY", 1, 20, 0.5, "camera follow y"],
  ["camLead", 0, 0.5, 0.01, "camera lead"],
  ["camZoomOut", 0, 0.4, 0.01, "camera zoom-out"],
];

/** Restore every value to the committed default. */
export function resetLive() {
  Object.assign(live, tuning);
}
