import type { DistrictId } from "./world";

export interface Theme {
  id: DistrictId;
  name: string;
  tag: string;
  /** sky gradient, top → bottom */
  sky: [string, string, string, string];
  /** warm light pooled near the horizon */
  glow: string;
  /** distant haze that swallows the far skyline */
  haze: string;
  /** three parallax silhouette layers, far → near */
  far: [string, string, string];
  /** three facade tones used by the buildings you actually land on */
  wall: [string, string, string];
  wallShade: string;
  wallEdge: string;
  /** roof deck + parapet cap */
  roof: string;
  roofLine: string;
  /** unlit and lit windows */
  window: string;
  windowLit: string;
  /** rooftop structures: chimneys, tanks, masts */
  prop: string;
  propDark: string;
  propMetal: string;
  /** awnings, banners, clotheslines */
  accent: string;
  accent2: string;
  /** the avenue far below */
  street: string;
  streetLine: string;
  ambient: "none" | "birds" | "dust" | "leaves" | "snow";
  ambientColor: string;
  /** the little spider-person keeps the same suit everywhere, but the
   * outline colour is picked up from the district so it always sits well */
  ink: string;
}

/**
 * Eight districts of the same hand-coloured city. Nothing here glows: the
 * palettes are paper-and-brick, chosen so the rooftops read clearly against
 * the sky at every height.
 */
export const THEME_DEFS: Record<DistrictId, Theme> = {
  harbour: {
    id: "harbour",
    name: "Old Harbour",
    tag: "first light · wet brick",
    sky: ["#7ba7b4", "#a8c6c6", "#d8d9b8", "#f0dcb4"],
    glow: "rgba(250,226,178,0.26)",
    haze: "rgba(198,214,213,0.62)",
    far: ["#a9c1c4", "#87a6ac", "#66898f"],
    wall: ["#8d7f78", "#a08a7c", "#7b7268"],
    wallShade: "rgba(46,58,60,0.30)",
    wallEdge: "#c3b3a4",
    roof: "#5f6b6a",
    roofLine: "#dcd3bd",
    window: "#4c5f63",
    windowLit: "#f4dda6",
    prop: "#7d6a5e",
    propDark: "#4f4741",
    propMetal: "#9aa3a1",
    accent: "#c2785f",
    accent2: "#8fa9a4",
    street: "#4e5a5c",
    streetLine: "#cfc6ad",
    ambient: "birds",
    ambientColor: "rgba(250,244,222,0.42)",
    ink: "#33413f",
  },
  brickline: {
    id: "brickline",
    name: "Brickline Quarter",
    tag: "morning · red brick lanes",
    sky: ["#7fa9ae", "#b2ccc0", "#e2dcb2", "#f3e0b8"],
    glow: "rgba(250,229,180,0.22)",
    haze: "rgba(206,214,203,0.58)",
    far: ["#b3bfb2", "#93a194", "#717f76"],
    wall: ["#a1705c", "#b07f65", "#8e6451"],
    wallShade: "rgba(60,42,36,0.28)",
    wallEdge: "#d8bda6",
    roof: "#6c5a52",
    roofLine: "#e7d8c0",
    window: "#5a4a45",
    windowLit: "#f6dfaa",
    prop: "#8a6a58",
    propDark: "#54403a",
    propMetal: "#a49a90",
    accent: "#cf9067",
    accent2: "#8fa37f",
    street: "#5b4f4a",
    streetLine: "#e2d3ba",
    ambient: "dust",
    ambientColor: "rgba(250,235,200,0.34)",
    ink: "#3f3330",
  },
  mosslight: {
    id: "mosslight",
    name: "Mosslight Row",
    tag: "soft green roofs · quiet streets",
    sky: ["#79ab9f", "#aecab2", "#dcdcae", "#eee0b6"],
    glow: "rgba(244,230,176,0.2)",
    haze: "rgba(198,214,198,0.6)",
    far: ["#aec8ae", "#88a98d", "#5f8874"],
    wall: ["#7f8a72", "#93a083", "#6f7a66"],
    wallShade: "rgba(44,58,46,0.28)",
    wallEdge: "#cdd4b8",
    roof: "#5d7360",
    roofLine: "#e4e2c2",
    window: "#4d5f4f",
    windowLit: "#f2e2a8",
    prop: "#6f7a62",
    propDark: "#464f41",
    propMetal: "#9fae9c",
    accent: "#b98b62",
    accent2: "#7f9c78",
    street: "#4f5c4f",
    streetLine: "#dcd8bb",
    ambient: "leaves",
    ambientColor: "rgba(214,226,170,0.36)",
    ink: "#37443a",
  },
  glassmarket: {
    id: "glassmarket",
    name: "Glassmarket",
    tag: "midday · pale glass towers",
    sky: ["#7fb0bd", "#b6d2d2", "#e0e2c6", "#f2e6c2"],
    glow: "rgba(252,240,200,0.24)",
    haze: "rgba(205,220,222,0.6)",
    far: ["#b6cdd0", "#93b1b7", "#6f8f97"],
    wall: ["#8b9aa2", "#9daeb4", "#7a8a93"],
    wallShade: "rgba(46,62,70,0.26)",
    wallEdge: "#d3dde0",
    roof: "#63767d",
    roofLine: "#e6e8d4",
    window: "#54666e",
    windowLit: "#eef3df",
    prop: "#77878d",
    propDark: "#4b585e",
    propMetal: "#b0bcbe",
    accent: "#a98b6d",
    accent2: "#7d9aa4",
    street: "#536269",
    streetLine: "#dfe3d4",
    ambient: "none",
    ambientColor: "rgba(246,248,230,0.34)",
    ink: "#33424a",
  },
  amberrow: {
    id: "amberrow",
    name: "Amber Row",
    tag: "late afternoon · sandstone",
    sky: ["#8ab1a6", "#c6cda4", "#efd6a0", "#e9b983"],
    glow: "rgba(252,214,156,0.28)",
    haze: "rgba(226,206,172,0.6)",
    far: ["#d6c49c", "#bda87d", "#9b8260"],
    wall: ["#c0a077", "#cbb085", "#ab8d68"],
    wallShade: "rgba(84,62,40,0.26)",
    wallEdge: "#eedcb8",
    roof: "#8b7154",
    roofLine: "#f0e0bc",
    window: "#6d5a45",
    windowLit: "#fbe3a4",
    prop: "#a3845f",
    propDark: "#6b5540",
    propMetal: "#c2b093",
    accent: "#c4795a",
    accent2: "#a99463",
    street: "#6d5b48",
    streetLine: "#ecdcbc",
    ambient: "dust",
    ambientColor: "rgba(250,224,176,0.36)",
    ink: "#4a3b2c",
  },
  pinewharf: {
    id: "pinewharf",
    name: "Pinewharf",
    tag: "winter hush · snow on the ledges",
    sky: ["#7fabb4", "#b3cdcd", "#dae0d4", "#f0e9d6"],
    glow: "rgba(232,244,238,0.26)",
    haze: "rgba(210,222,224,0.66)",
    far: ["#c2d4d5", "#93aeb3", "#6d8b93"],
    wall: ["#83918f", "#95a3a0", "#727f7e"],
    wallShade: "rgba(46,60,64,0.26)",
    wallEdge: "#dde3da",
    roof: "#6a7a7c",
    roofLine: "#f3f4ea",
    window: "#525f63",
    windowLit: "#f4e6b6",
    prop: "#77837f",
    propDark: "#4c5654",
    propMetal: "#aab6b4",
    accent: "#a9836d",
    accent2: "#8aa3a6",
    street: "#59666a",
    streetLine: "#e7ebe0",
    ambient: "snow",
    ambientColor: "rgba(250,250,238,0.5)",
    ink: "#35423f",
  },
  cloudbreak: {
    id: "cloudbreak",
    name: "Cloudbreak Heights",
    tag: "tall towers · open sky",
    sky: ["#83b3c0", "#b9cfc9", "#e4e0bb", "#f4e0ae"],
    glow: "rgba(248,234,186,0.24)",
    haze: "rgba(214,226,224,0.72)",
    far: ["#c6d6d2", "#9fbcb8", "#789a99"],
    wall: ["#93a0a4", "#a5b1b2", "#828f93"],
    wallShade: "rgba(52,66,72,0.24)",
    wallEdge: "#dfe5dc",
    roof: "#6b7c80",
    roofLine: "#eef0de",
    window: "#57676d",
    windowLit: "#f6ecc2",
    prop: "#7e8b8c",
    propDark: "#515c5e",
    propMetal: "#b6c0be",
    accent: "#b48a68",
    accent2: "#8ba3a8",
    street: "#5a676c",
    streetLine: "#e9ecdf",
    ambient: "birds",
    ambientColor: "rgba(252,248,226,0.4)",
    ink: "#37464a",
  },
  seabreeze: {
    id: "seabreeze",
    name: "Seabreeze Coast",
    tag: "evening by the water · salt air",
    sky: ["#7499a8", "#a4bcb6", "#dcc7a2", "#e0a982"],
    glow: "rgba(246,204,150,0.28)",
    haze: "rgba(214,204,186,0.62)",
    far: ["#b9c9bc", "#8fa9a3", "#67857f"],
    wall: ["#8b8579", "#9c9484", "#7a746a"],
    wallShade: "rgba(50,54,54,0.3)",
    wallEdge: "#d6cdb6",
    roof: "#616a68",
    roofLine: "#e9dfc4",
    window: "#4f5a5c",
    windowLit: "#f7dda4",
    prop: "#7c7466",
    propDark: "#4d4a42",
    propMetal: "#a2a49a",
    accent: "#c07a5e",
    accent2: "#89a29a",
    street: "#4f585a",
    streetLine: "#e3d8bd",
    ambient: "dust",
    ambientColor: "rgba(248,226,186,0.34)",
    ink: "#333d3d",
  },
};

export const themeDef = (id: DistrictId): Theme => THEME_DEFS[id];
