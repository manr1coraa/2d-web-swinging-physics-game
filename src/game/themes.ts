import type { ThemeId } from "./world";

export interface Theme {
  id: ThemeId;
  name: string;
  tag: string;
  /** sky gradient, top → bottom */
  sky: [string, string, string, string];
  glow: string; // horizon light pollution / bioluminescence
  far1: string;
  far2: string;
  far3: string;
  glass: "warm" | "cool" | "green" | "ice" | "neon" | "void";
  /** ceiling / canopy mass */
  ceiling: string;
  trim: string;
  /** street gradient, top → bottom */
  ground: [string, string, string];
  groundLine: string;
  /** hazards */
  spike: "city" | "vine" | "ice" | "cactus" | "crystal" | "rock" | "coral" | "bone";
  spinner: "saw" | "jelly" | "copter";
  /** ambient particles */
  ambient: "none" | "bubbles" | "snow" | "leaves" | "embers" | "stars" | "dust" | "sparks";
  ambientColor: string;
  /** accent used for HUD-ish world glows */
  accent: string;
  /** floating decorations drawn in the sky/water */
  deco: "stars" | "kelp" | "skyline" | "cacti" | "pines" | "lavarocks" | "planets" | "billboards";
  /** is there a "moon"/big body in the sky */
  orb: "moon" | "sun" | "eclipse" | "none" | "sun2";
}

export const THEME_DEFS: Record<ThemeId, Theme> = {
  city: {
    id: "city",
    name: "Neon Skyline",
    tag: "the classic",
    sky: ["#070b22", "#121a3e", "#2b2254", "#5c3161"],
    glow: "rgba(255,150,90,0.22)",
    far1: "#121735",
    far2: "#19204a",
    far3: "#232a63",
    glass: "warm",
    ceiling: "#0b1024",
    trim: "#49d8ff",
    ground: ["#453049", "#241a33", "#0d0a1a"],
    groundLine: "#ffd09a",
    spike: "city",
    spinner: "saw",
    ambient: "none",
    ambientColor: "rgba(214,206,255,0.5)",
    accent: "#49d8ff",
    deco: "skyline",
    orb: "moon",
  },
  jungle: {
    id: "jungle",
    name: "Jungle Canopy",
    tag: "vines & humidity",
    sky: ["#04140f", "#0a2a1c", "#14512f", "#3f7a35"],
    glow: "rgba(180,255,120,0.18)",
    far1: "#0b2418",
    far2: "#123326",
    far3: "#1c4a30",
    glass: "green",
    ceiling: "#06231a",
    trim: "#8bff6a",
    ground: ["#2c3a1c", "#1a2611", "#080d07"],
    groundLine: "#c7f07a",
    spike: "vine",
    spinner: "jelly",
    ambient: "leaves",
    ambientColor: "rgba(180,240,120,0.55)",
    accent: "#8bff6a",
    deco: "kelp",
    orb: "sun",
  },
  underwater: {
    id: "underwater",
    name: "Abyss Trench",
    tag: "fish & bubbles",
    sky: ["#02121f", "#04304a", "#075a72", "#0e8ba0"],
    glow: "rgba(120,255,240,0.16)",
    far1: "#062738",
    far2: "#08374c",
    far3: "#0b4a61",
    glass: "ice",
    ceiling: "#03202e",
    trim: "#5ff5ff",
    ground: ["#0d3a44", "#072630", "#020f16"],
    groundLine: "#8ff0ff",
    spike: "coral",
    spinner: "jelly",
    ambient: "bubbles",
    ambientColor: "rgba(200,250,255,0.6)",
    accent: "#5ff5ff",
    deco: "kelp",
    orb: "none",
  },
  desert: {
    id: "desert",
    name: "Canyon Dust",
    tag: "sand & sun",
    sky: ["#2a1320", "#5c2a2a", "#b4573a", "#e8a75c"],
    glow: "rgba(255,200,120,0.3)",
    far1: "#4a2430",
    far2: "#65333a",
    far3: "#8a4a44",
    glass: "warm",
    ceiling: "#3a2028",
    trim: "#ffb163",
    ground: ["#6b4326", "#402616", "#170d08"],
    groundLine: "#ffcf8a",
    spike: "cactus",
    spinner: "copter",
    ambient: "dust",
    ambientColor: "rgba(255,220,170,0.45)",
    accent: "#ffb163",
    deco: "cacti",
    orb: "sun2",
  },
  ice: {
    id: "ice",
    name: "Glacier Run",
    tag: "ice & aurora",
    sky: ["#04101f", "#0a2540", "#12607a", "#69d8d0"],
    glow: "rgba(140,255,230,0.2)",
    far1: "#0d2438",
    far2: "#123349",
    far3: "#1a4560",
    glass: "ice",
    ceiling: "#0a1d30",
    trim: "#8ef4ff",
    ground: ["#1a3348", "#0d1d2c", "#03080f"],
    groundLine: "#c9f6ff",
    spike: "ice",
    spinner: "saw",
    ambient: "snow",
    ambientColor: "rgba(230,250,255,0.7)",
    accent: "#8ef4ff",
    deco: "pines",
    orb: "moon",
  },
  volcano: {
    id: "volcano",
    name: "Volcano Rim",
    tag: "ash & fire",
    sky: ["#13060a", "#33101a", "#6b1f1c", "#c4531f"],
    glow: "rgba(255,120,60,0.32)",
    far1: "#2a1119",
    far2: "#3d1a1f",
    far3: "#5c2a24",
    glass: "warm",
    ceiling: "#1c0c12",
    trim: "#ff8a3d",
    ground: ["#4d1b16", "#2a0e0d", "#0d0405"],
    groundLine: "#ffb066",
    spike: "rock",
    spinner: "saw",
    ambient: "embers",
    ambientColor: "rgba(255,150,70,0.75)",
    accent: "#ff8a3d",
    deco: "lavarocks",
    orb: "eclipse",
  },
  space: {
    id: "space",
    name: "Orbital Drift",
    tag: "zero-g city",
    sky: ["#01010a", "#070420", "#140a3a", "#2a1060"],
    glow: "rgba(150,120,255,0.2)",
    far1: "#0b0a24",
    far2: "#151038",
    far3: "#221a52",
    glass: "void",
    ceiling: "#080722",
    trim: "#b18cff",
    ground: ["#1a1440", "#0d0a26", "#03020c"],
    groundLine: "#c9b6ff",
    spike: "crystal",
    spinner: "copter",
    ambient: "stars",
    ambientColor: "rgba(230,225,255,0.8)",
    accent: "#b18cff",
    deco: "planets",
    orb: "none",
  },
  neon: {
    id: "neon",
    name: "Neon District",
    tag: "synth & chrome",
    sky: ["#0a0418", "#20073a", "#4b0c5c", "#9b1e73"],
    glow: "rgba(255,90,220,0.24)",
    far1: "#1b0a34",
    far2: "#2c0f4c",
    far3: "#431a66",
    glass: "neon",
    ceiling: "#120626",
    trim: "#ff5ad6",
    ground: ["#3a0f43", "#20082b", "#08010f"],
    groundLine: "#ffa8ec",
    spike: "city",
    spinner: "saw",
    ambient: "sparks",
    ambientColor: "rgba(255,140,240,0.7)",
    accent: "#ff5ad6",
    deco: "billboards",
    orb: "moon",
  },
};

export const themeDef = (id: ThemeId): Theme => THEME_DEFS[id];
