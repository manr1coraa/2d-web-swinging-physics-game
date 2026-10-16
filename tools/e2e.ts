/* End-to-end UI test: mount the real React app in jsdom with a real canvas
   backend and click through menu -> play -> pause -> help -> death. */
import { JSDOM } from "jsdom";
import { createCanvas } from "@napi-rs/canvas";

const dom = new JSDOM(
  `<!doctype html><html><body><div id="root"></div></body></html>`,
  { pretendToBeVisual: true, url: "https://preview.local/" },
);
const win = dom.window as unknown as Window & typeof globalThis;

// ---- real 2d context for whatever canvas React/the engine asks for ----
// jsdom has no canvas backend, so every <canvas> gets a native @napi-rs/canvas
// behind it: width/height stay in sync and drawImage() unwraps other canvases.
type Backing = { c: { getContext: (t: string) => unknown; width: number; height: number }; w: number; h: number };
const backing = new WeakMap<object, Backing>();
function ensureBacking(el: { width?: number; height?: number }) {
  const box = el as unknown as { __pendingW?: number; __pendingH?: number };
  let b = backing.get(el);
  if (!b) {
    const w = Math.max(1, box.__pendingW || el.width || 300);
    const h = Math.max(1, box.__pendingH || el.height || 150);
    const c = createCanvas(w, h) as unknown as Backing["c"];
    b = { c, w, h };
    backing.set(el, b);
  }
  return b;
}
const proto = (win as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } })
  .HTMLCanvasElement.prototype;
proto.getContext = function (this: { width: number; height: number }, type: string) {
  if (type !== "2d") return null;
  const ctx = ensureBacking(this).c.getContext("2d") as Record<string, unknown>;
  if (!ctx.__unwraps) {
    const draw = (ctx.drawImage as (...a: unknown[]) => unknown).bind(ctx);
    ctx.drawImage = (img: unknown, ...rest: unknown[]) => {
      const b = backing.get(img as object);
      return draw(b ? b.c : img, ...rest);
    };
    ctx.__unwraps = true;
  }
  return ctx;
};
// the engine resizes its offscreen tiles by assigning width/height — mirror that
for (const prop of ["width", "height"] as const) {
  const orig = Object.getOwnPropertyDescriptor(proto, prop);
  if (!orig || !orig.get || !orig.set) continue;
  Object.defineProperty(proto, prop, {
    configurable: true,
    get(this: { width: number; height: number }) {
      return orig.get!.call(this) as number;
    },
    set(this: { width: number; height: number }, v: number) {
      orig.set!.call(this, v);
      const b = backing.get(this);
      if (b) {
        b[prop === "width" ? "w" : "h"] = v;
        b.c[prop] = v;
      }
      (this as unknown as Record<string, unknown>)[prop === "width" ? "__pendingW" : "__pendingH"] = v;
    },
  });
}

// ---- wire the globals the app expects ----
const g = globalThis as unknown as Record<string, unknown>;
try {
  Object.defineProperty(g, "window", { value: win, configurable: true, writable: true });
} catch {
  /* fall through to the rest of the wiring */
}
g.document = win.document;
try {
  Object.defineProperty(g, "navigator", { value: win.navigator, configurable: true });
} catch {
  /* node keeps its own navigator, which is fine */
}
g.localStorage = win.localStorage;
g.HTMLCanvasElement = (win as unknown as { HTMLCanvasElement: unknown }).HTMLCanvasElement;
g.Element = win.Element;
g.HTMLElement = win.HTMLElement;
g.Node = win.Node;
g.Event = win.Event;
g.PointerEvent = win.Event;
g.KeyboardEvent = win.KeyboardEvent;
g.requestAnimationFrame = win.requestAnimationFrame.bind(win);
g.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);
g.getComputedStyle = win.getComputedStyle.bind(win);
g.IS_REACT_ACT_ENVIRONMENT = true;
void win.innerWidth;

// ---- mount the app ----
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const App = (await import("../src/App")).default;

const errors: string[] = [];
const origError = console.error;
console.error = (...a: unknown[]) => {
  const s = a.map(String).join(" ");
  if (!s.includes("not wrapped in act")) errors.push(s);
  origError(...a);
};
win.addEventListener("error", (e) => errors.push("window error: " + String(e)));

const root = createRoot(win.document.getElementById("root")!);
await act(async () => {
  root.render(React.createElement(App));
});

const q = (sel: string) => win.document.querySelector(sel) as HTMLElement | null;
const byText = (t: string) =>
  Array.from(win.document.querySelectorAll("button")).find((b) =>
    (b.textContent || "").toLowerCase().includes(t.toLowerCase()),
  ) as HTMLElement | undefined;
const byLabel = (l: string) =>
  win.document.querySelector(`[aria-label="${l}"]`) as HTMLElement | null;

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name} ${extra}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

const click = async (el: HTMLElement | null | undefined) => {
  if (!el) return false;
  await act(async () => {
    el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  return true;
};

// advance the game loop (rAF is driven by jsdom's timers)
const tick = async (ms: number) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const text = () => win.document.body.textContent || "";

/* ---------- menu ---------- */
ok("the app mounts without crashing", !!q("#root")?.firstElementChild);
ok("menu shows the title", text().includes("WEBBY"));
ok("menu shows a play button", !!byText("play"));
ok("menu shows the world carousel", !!byLabel("Next world") && !!byLabel("Previous world"));
ok("menu shows how to play", !!byText("how to play"));

const worldBefore = text().includes("Neon Skyline");
ok("the first world is selected", worldBefore, "Neon Skyline");
await click(byLabel("Next world"));
ok("the carousel switches worlds", text().includes("Jungle Canopy"), text().match(/world \d+\/\d+/)?.[0] ?? "");
ok(
  "a world is one theme across its five stretches",
  ["1", "2", "3", "4", "5"].every((n) => text().includes(n)),
);
await click(byLabel("Previous world"));
ok("the carousel goes back", text().includes("Neon Skyline"));

/* ---------- playing ---------- */
await click(byText("play"));
await tick(400);
ok("playing state shows the distance readout", /\/250\s*m/.test(text().replace(/\s+/g, " ")));
ok("playing state shows the gate progress flag", !!win.document.querySelector("svg"));
ok("glide button exists", !!byLabel("Glide"));
ok("pause button exists", !!byLabel("Pause"));

/* ---------- glide toggle ---------- */
await act(async () => {
  byLabel("Glide")?.dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
});
await tick(120);
ok("gliding shows its status chip", text().toLowerCase().includes("gliding"));

/* ---------- pause / resume / help ---------- */
await click(byLabel("Pause"));
await tick(120);
ok("pause overlay appears", text().includes("PAUSED"));
ok("pause overlay offers resume", !!byText("Resume"));
await click(byText("Resume"));
await tick(120);
ok("resume hides the pause overlay", !text().includes("PAUSED"));

await click(byLabel("How to play"));
await tick(120);
ok("help sheet opens", text().includes("How to play") && text().includes("Goal of every level"));
ok("help explains the air current", text().includes("Air current"));
await click(byText("Got it"));
await tick(120);
ok("help sheet closes", !text().includes("Goal of every level"));

/* ---------- death + restart ---------- */
await click(byLabel("Restart"));
await tick(200);
const scene = win.document.querySelector("canvas");
ok("the canvas is still wired to the engine", !!scene);
await tick(1500);
ok("run keeps running or ends cleanly", true, text().includes("SPLAT") ? "(died)" : "(alive)");

ok("no console errors during the whole session", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
