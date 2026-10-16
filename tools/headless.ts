/* Minimal DOM stubs so the engine can be driven in Node for automated play-tests. */
const gradStub = { addColorStop() {} };
function makeCtx(canvas: unknown) {
  const store: Record<string, unknown> = { canvas };
  return new Proxy(store, {
    get(t, p: string) {
      if (p in t) return t[p];
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => gradStub;
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "getImageData") return () => ({ data: [] });
      return () => undefined;
    },
    set(t, p: string, v) {
      t[p] = v;
      return true;
    },
  });
}

export const rafQueue: ((t: number) => void)[] = [];

/** canvas factory: harnesses with the native backend pass createCanvas here */
export type CanvasFactory = (w: number, h: number) => unknown;

function realCanvas(factory: CanvasFactory | null, w = 1280, h = 720): unknown {
  if (factory) return factory(w, h);
  return null as unknown as never;
}

export function installDom(factory: CanvasFactory | null = null) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const real = factory ? realCanvas(factory) : null;
  const canvas = real ?? {
    width: 0,
    height: 0,
    style: {},
    getContext: () => makeCtx(canvas),
    addEventListener: (k: string, fn: (e: unknown) => void) => {
      (listeners[k] ||= []).push(fn);
    },
    removeEventListener: () => {},
  };
  const win = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: (k: string, fn: (e: unknown) => void) => {
      (listeners[k] ||= []).push(fn);
    },
    removeEventListener: () => {},
    requestAnimationFrame: (fn: (t: number) => void) => {
      rafQueue.push(fn);
      return rafQueue.length;
    },
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    localStorage: {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.store[k] = v;
      },
      removeItem(k: string) {
        delete this.store[k];
      },
    },
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = win;
  g.document = {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    // offscreen canvases (baked backdrops) need the real backend when we have it
    createElement: (tag?: string) => (factory && tag === "canvas" ? realCanvas(factory, 320, 320) : canvas),
  };
  g.localStorage = win.localStorage;
  g.requestAnimationFrame = win.requestAnimationFrame;
  g.cancelAnimationFrame = () => {};
  g.performance = { now: () => Date.now() };
  g.HTMLCanvasElement = class {};
  return canvas;
}
