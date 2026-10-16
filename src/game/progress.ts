/**
 * Missions and lifetime progress.
 *
 * All missions are visible at once and there is no timer: you can do them in
 * any order and at your own pace. Progress is kept across runs in
 * localStorage, so a mission finished once stays finished.
 */

export interface Lifetime {
  bestDist: number; // metres, best single run
  bestChain: number; // longest run of PERFECT releases
  flips: number; // single flips, all time
  doubles: number; // double flips, all time
  windT: number; // seconds of holding Space inside an updraft, all time
  tears: number; // webs torn on burning buildings, all time
}

export type StatKey = keyof Lifetime;

export interface MissionDef {
  id: string;
  title: string;
  text: string;
  stat: StatKey;
  target: number;
}

export const MISSIONS: MissionDef[] = [
  { id: "d300", title: "Warm-up", text: "Fly 300 m in one run", stat: "bestDist", target: 300 },
  { id: "d1000", title: "Long haul", text: "Fly 1000 m in one run", stat: "bestDist", target: 1000 },
  { id: "chain3", title: "Clean line", text: "3 PERFECT releases in a row", stat: "bestChain", target: 3 },
  { id: "chain6", title: "Metronome", text: "6 PERFECT releases in a row", stat: "bestChain", target: 6 },
  { id: "flip1", title: "First flip", text: "Complete a flip in the air", stat: "flips", target: 1 },
  { id: "flip10", title: "Acrobat", text: "Complete 10 flips in total", stat: "flips", target: 10 },
  { id: "double1", title: "Double", text: "Complete a double flip", stat: "doubles", target: 1 },
  { id: "wind1", title: "Thermal", text: "Hold Space inside an updraft for 3 s", stat: "windT", target: 3 },
  { id: "tear1", title: "Hot ledge", text: "Let a web tear on a burning building", stat: "tears", target: 1 },
];

const KEY = "webby_progress";

const emptyLife = (): Lifetime => ({
  bestDist: 0,
  bestChain: 0,
  flips: 0,
  doubles: 0,
  windT: 0,
  tears: 0,
});

class Progress {
  life: Lifetime = emptyLife();
  done = new Set<string>();

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const j = JSON.parse(raw) as { life?: Partial<Lifetime>; done?: string[] };
        this.life = { ...emptyLife(), ...(j.life ?? {}) };
        this.done = new Set(j.done ?? []);
      }
    } catch {
      /* ignore broken storage */
    }
  }

  /** add to a counter */
  add(k: "flips" | "doubles" | "windT" | "tears", v: number) {
    this.life[k] += v;
  }

  /** raise a record */
  max(k: "bestDist" | "bestChain", v: number) {
    if (v > this.life[k]) this.life[k] = v;
  }

  /** returns the ids of missions completed by this call */
  check(): string[] {
    const fresh: string[] = [];
    for (const m of MISSIONS) {
      if (!this.done.has(m.id) && this.life[m.stat] >= m.target) {
        this.done.add(m.id);
        fresh.push(m.id);
      }
    }
    if (fresh.length) this.save();
    return fresh;
  }

  save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ life: this.life, done: Array.from(this.done) }),
      );
    } catch {
      /* ignore */
    }
  }

  /** every mission with its current progress, for the menu */
  list() {
    return MISSIONS.map((m) => ({
      id: m.id,
      title: m.title,
      text: m.text,
      done: this.done.has(m.id),
      progress: Math.min(this.life[m.stat], m.target),
      target: m.target,
    }));
  }
}

export const progress = new Progress();
export type MissionView = ReturnType<Progress["list"]>[number];
