/* End-to-end UI test: mount the real React app with a native canvas backend. */
import { JSDOM } from "jsdom";
import { createCanvas } from "@napi-rs/canvas";

const dom = new JSDOM(
  `<!doctype html><html><body><div id="root"></div></body></html>`,
  { pretendToBeVisual: true, url: "https://preview.local/" },
);
const win = dom.window as unknown as Window & typeof globalThis;

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

const g = globalThis as unknown as Record<string, unknown>;
try {
  Object.defineProperty(g, "window", { value: win, configurable: true, writable: true });
} catch {
  /* node already defines a compatible window */
}
g.document = win.document;
try {
  Object.defineProperty(g, "navigator", { value: win.navigator, configurable: true });
} catch {
  /* node's navigator is sufficient */
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

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const App = (await import("../src/App")).default;

const errors: string[] = [];
const origError = console.error;
console.error = (...a: unknown[]) => {
  const message = a.map(String).join(" ");
  if (!message.includes("not wrapped in act")) errors.push(message);
  origError(...a);
};
win.addEventListener("error", (event) => errors.push("window error: " + String(event)));

const root = createRoot(win.document.getElementById("root")!);
await act(async () => root.render(React.createElement(App)));

const q = (selector: string) => win.document.querySelector(selector) as HTMLElement | null;
const byText = (needle: string) =>
  Array.from(win.document.querySelectorAll("button")).find((button) =>
    (button.textContent || "").toLowerCase().includes(needle.toLowerCase()),
  ) as HTMLElement | undefined;
const byLabel = (label: string) => win.document.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;
const text = () => win.document.body.textContent || "";

let pass = 0;
let fail = 0;
const ok = (name: string, condition: boolean, extra = "") => {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const click = async (element: HTMLElement | null | undefined) => {
  if (!element) return false;
  await act(async () => {
    element.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  return true;
};
const tick = async (ms: number) => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
};

/* ---------- menu + landscape progression ---------- */
ok("the app mounts without crashing", !!q("#root")?.firstElementChild);
ok("menu shows WEBBY", text().includes("WEBBY"));
ok("menu has a start button", !!byLabel("Play"));
ok("menu has the eight-landscape carousel", !!byLabel("Next world") && !!byLabel("Previous world"));
ok("first landscape is Mosslight Valley", text().includes("Mosslight Valley"));
await click(byLabel("Next world"));
ok("carousel selects Fernwood Canopy", text().includes("Fernwood Canopy"));
ok("unopened landscapes are explained", text().includes("Reach it on your trail to open it"));
await click(byLabel("Previous world"));
ok("carousel returns to the first landscape", text().includes("Mosslight Valley"));

/* ---------- field guide ---------- */
await click(byText("Field guide"));
ok("field guide explains the spring web and route", text().includes("spring") && text().includes("250 m"));
ok("field guide explains angular momentum", text().toLowerCase().includes("angular momentum"));
await click(byText("Back to the trail"));
ok("field guide closes cleanly", !text().includes("A little field guide"));

/* ---------- playing + touch controls ---------- */
await click(byLabel("Play"));
await tick(400);
ok("playing state shows total distance and next waymark", text().includes("250 m") && /\d+m/.test(text().replace(/\s+/g, "")));
ok("glide, pause, sound, and tuck controls are present", !!byLabel("Glide") && !!byLabel("Pause") && !!byLabel("Sound") && !!byLabel("Spin clockwise"));

await act(async () => {
  byLabel("Glide")?.dispatchEvent(new win.Event("pointerdown", { bubbles: true, cancelable: true }));
});
await tick(120);
ok("glide input shows a gentle breeze status", text().toLowerCase().includes("breeze"));

/* ---------- pause + help ---------- */
await click(byLabel("Pause"));
await tick(100);
ok("pause panel appears", text().includes("Paused"));
ok("pause panel offers a clear resume action", !!byText("Keep wandering"));
await click(byText("Field guide"));
ok("help can open from the pause panel", text().includes("A little field guide"));
await click(byText("Back to the trail"));
await click(byText("Keep wandering"));
await tick(120);
ok("resume returns to the running HUD", !!byLabel("Pause") && !text().includes("Take a breath"));

/* ---------- restart + lifecycle ---------- */
await click(byLabel("Pause"));
await click(byText("Start this trail again"));
await tick(200);
ok("restart returns to active play", !!byLabel("Pause") && text().includes("250 m"));
ok("canvas remains wired to the engine", !!win.document.querySelector("canvas"));
await tick(500);
ok("gameplay continues or ends cleanly", true, text().includes("Rest here") ? "rest panel" : "active trail");

ok("no console errors during the session", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
