/* Local progress: districts opened, longest run, lifetime totals, hints. */

export interface SaveData {
  version: number;
  /** longest cumulative journey, in metres */
  best: number;
  /** highest district index the player has reached */
  unlocked: number;
  /** the district a "continue" run starts from */
  checkpoint: number;
  meters: number;
  tokens: number;
  tricks: number;
  runs: number;
  /** highest point above the street, in metres */
  alt: number;
  muted: boolean;
  taught: string[];
}

const KEY = "webby_save_v2";
const LEGACY_BEST = "pauchok_best";
const LEGACY_UNLOCK = "webby_unlocked";
const LEGACY_TAUGHT = "webby_taught";

export const emptySave = (): SaveData => ({
  version: 2,
  best: 0,
  unlocked: 0,
  checkpoint: 0,
  meters: 0,
  tokens: 0,
  tricks: 0,
  runs: 0,
  alt: 0,
  muted: false,
  taught: [],
});

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — the run simply is not remembered */
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** read the save, migrating the older single-value keys if needed */
export function loadSave(): SaveData {
  const base = emptySave();
  const raw = safeGet(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        ...base,
        ...parsed,
        version: 2,
        taught: Array.isArray(parsed.taught) ? parsed.taught.filter((t) => typeof t === "string") : [],
      };
    } catch {
      /* fall through to the legacy migration */
    }
  }
  const legacyBest = parseInt(safeGet(LEGACY_BEST) ?? "0", 10) || 0;
  const legacyUnlock = parseInt(safeGet(LEGACY_UNLOCK) ?? "0", 10) || 0;
  const legacyTaught = safeGet(LEGACY_TAUGHT);
  if (legacyBest || legacyUnlock || legacyTaught) {
    let taught: string[] = [];
    if (legacyTaught) {
      try {
        const parsed = JSON.parse(legacyTaught) as string[];
        if (Array.isArray(parsed)) taught = parsed;
      } catch {
        taught = [];
      }
    }
    return { ...base, best: legacyBest, unlocked: legacyUnlock, checkpoint: legacyUnlock, taught };
  }
  return base;
}

export function writeSave(data: SaveData) {
  safeSet(KEY, JSON.stringify(data));
}

export function clearSave() {
  safeRemove(KEY);
  safeRemove(LEGACY_BEST);
  safeRemove(LEGACY_UNLOCK);
  safeRemove(LEGACY_TAUGHT);
}
