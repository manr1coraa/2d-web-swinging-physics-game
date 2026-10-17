import type { ThemeId } from "./world";

export interface Theme {
  id: ThemeId;
  name: string;
  tag: string;
  /** sky gradient, top → bottom */
  sky: [string, string, string, string];
  glow: string;
  far1: string;
  far2: string;
  far3: string;
  /** soft canopy / overhang colour */
  ceiling: string;
  trim: string;
  /** rolling ground gradient, top → bottom */
  ground: [string, string, string];
  groundLine: string;
  ambient: "none" | "bubbles" | "snow" | "leaves" | "dust";
  ambientColor: string;
}

/** Eight quiet landscapes, all painted from the same soft, natural palette. */
export const THEME_DEFS: Record<ThemeId, Theme> = {
  city: {
    id: "city",
    name: "Mosslight Valley",
    tag: "soft morning · green hills",
    sky: ["#73aaa2", "#a6c9ac", "#d5d8aa", "#efe0b4"],
    glow: "rgba(248,226,166,0.22)",
    far1: "#aec8ae",
    far2: "#83a98e",
    far3: "#5d8977",
    ceiling: "#527b68",
    trim: "#e8d49a",
    ground: ["#eee4ca", "#dcd5b8", "#c6c8a7"],
    groundLine: "#f5ebd2",
    ambient: "none",
    ambientColor: "rgba(255,248,220,0.48)",
  },
  jungle: {
    id: "jungle",
    name: "Fernwood Canopy",
    tag: "quiet woods · fern paths",
    sky: ["#78b4a0", "#b3d1a3", "#e0dfa9", "#f0d59b"],
    glow: "rgba(239,222,160,0.19)",
    far1: "#b1c7a1",
    far2: "#779c75",
    far3: "#507b5d",
    ceiling: "#466f51",
    trim: "#c9d693",
    ground: ["#e7dfb9", "#cfd2a1", "#aeba89"],
    groundLine: "#ede6c8",
    ambient: "leaves",
    ambientColor: "rgba(218,230,172,0.36)",
  },
  underwater: {
    id: "underwater",
    name: "Tidal Cove",
    tag: "sea glass · drifting light",
    sky: ["#70aaa7", "#9fc9c1", "#c4d9c0", "#e9d9b2"],
    glow: "rgba(216,241,221,0.2)",
    far1: "#a9c9c0",
    far2: "#79aaa1",
    far3: "#548f87",
    ceiling: "#497d78",
    trim: "#d7e5bd",
    ground: ["#e4e5d2", "#bfd7cd", "#91b9b1"],
    groundLine: "#edf0d8",
    ambient: "bubbles",
    ambientColor: "rgba(239,250,220,0.42)",
  },
  desert: {
    id: "desert",
    name: "Amber Dunes",
    tag: "warm sandstone · slow wind",
    sky: ["#83b6ae", "#c6d1a5", "#efd39b", "#e7b77e"],
    glow: "rgba(251,216,158,0.22)",
    far1: "#d4c59a",
    far2: "#c5a879",
    far3: "#a9855f",
    ceiling: "#9f7958",
    trim: "#edcc8f",
    ground: ["#f0dfb9", "#e0c695", "#cba978"],
    groundLine: "#f4e4c1",
    ambient: "dust",
    ambientColor: "rgba(249,225,179,0.38)",
  },
  ice: {
    id: "ice",
    name: "Pine Snowfield",
    tag: "snow hush · blue pines",
    sky: ["#7babb2", "#b3d0cf", "#d9e1d1", "#f1e8d0"],
    glow: "rgba(229,243,234,0.25)",
    far1: "#c0d5d4",
    far2: "#8aafb2",
    far3: "#668c94",
    ceiling: "#577a83",
    trim: "#e5ead6",
    ground: ["#f1eee0", "#dce6de", "#b3c9cb"],
    groundLine: "#f7f3e7",
    ambient: "snow",
    ambientColor: "rgba(250,250,233,0.48)",
  },
  volcano: {
    id: "volcano",
    name: "Autumn Orchard",
    tag: "copper leaves · late afternoon",
    sky: ["#81aaa2", "#c6c39e", "#e7c18e", "#dba37b"],
    glow: "rgba(246,195,142,0.24)",
    far1: "#c9b393",
    far2: "#a78370",
    far3: "#79675e",
    ceiling: "#745d50",
    trim: "#e7c38e",
    ground: ["#eee0be", "#d8c39b", "#b8a37e"],
    groundLine: "#f4e6c4",
    ambient: "leaves",
    ambientColor: "rgba(220,154,94,0.34)",
  },
  space: {
    id: "space",
    name: "Cloudbreak Peaks",
    tag: "high paths · open sky",
    sky: ["#83b7ba", "#c1d5c5", "#eee1b8", "#f3dca9"],
    glow: "rgba(246,233,186,0.2)",
    far1: "#c4d5ce",
    far2: "#9dbdb7",
    far3: "#789d9b",
    ceiling: "#698d8b",
    trim: "#eadbb0",
    ground: ["#eee7d6", "#d5d6c6", "#afc3bd"],
    groundLine: "#f6efdd",
    ambient: "none",
    ambientColor: "rgba(255,249,225,0.42)",
  },
  neon: {
    id: "neon",
    name: "Seabreeze Coast",
    tag: "salt air · evening light",
    sky: ["#6f9fa2", "#a9c4b2", "#decba0", "#dfa980"],
    glow: "rgba(245,204,149,0.22)",
    far1: "#b7cbb8",
    far2: "#83a9a0",
    far3: "#5c8584",
    ceiling: "#4e7472",
    trim: "#e9d29e",
    ground: ["#eee1c9", "#d8d6bd", "#b3c9c1"],
    groundLine: "#f6ead3",
    ambient: "dust",
    ambientColor: "rgba(246,228,185,0.34)",
  },
};

export const themeDef = (id: ThemeId): Theme => THEME_DEFS[id];
