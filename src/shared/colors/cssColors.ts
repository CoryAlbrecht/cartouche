/**
 * @file cssColors.ts
 * @module shared/colors/cssColors
 * @description W3C CSS named color registry, hex normalization, validation, and Euclidean distance ANSI 16-color downsampling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link isValidCssColor}
 * @see {@link resolveColorToHex}
 * @see {@link resolveColorToRgb}
 * @see {@link findClosestAnsi16Color}
 */

/**
 * @typedef {Object} RgbTriplet
 * @property {number} r - Red channel value (0-255).
 * @property {number} g - Green channel value (0-255).
 * @property {number} b - Blue channel value (0-255).
 */
export interface RgbTriplet {
  r: number;
  g: number;
  b: number;
}

/**
 * @typedef {('black'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'white'|'gray'|'blackBright'|'redBright'|'greenBright'|'yellowBright'|'blueBright'|'magentaBright'|'cyanBright'|'whiteBright')} ColoretteColorName
 */
export type ColoretteColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright';

/**
 * @typedef {Object} Ansi16ColorEntry
 * @property {string} name - Color identifier name.
 * @property {ColoretteColorName} colorFnName - Corresponding Colorette color method name.
 * @property {number} r - Standard Red channel coordinate.
 * @property {number} g - Standard Green channel coordinate.
 * @property {number} b - Standard Blue channel coordinate.
 */
export interface Ansi16ColorEntry {
  name: string;
  colorFnName: ColoretteColorName;
  r: number;
  g: number;
  b: number;
}

/**
 * @description Canonical record of all 148 standard W3C CSS named colors mapped to normalized 6-digit hex codes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @type {Record<string, string>}
 */
export const W3C_CSS_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32'
};

/**
 * @description Canonical record of all 148 standard W3C CSS named colors mapped to RGB triplets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @type {Record<string, RgbTriplet>}
 */
export const W3C_CSS_COLOR_RGB: Record<string, RgbTriplet> = Object.freeze(
  Object.fromEntries(
    Object.entries(W3C_CSS_COLORS).map(([name, hex]) => [
      name,
      {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
      }
    ])
  )
);

/**
 * @description Array of all 148 standard W3C CSS named color identifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @type {readonly string[]}
 */
export const CSS_COLOR_NAMES: readonly string[] = Object.keys(W3C_CSS_COLORS);

/**
 * @description Standard 16 ANSI terminal color definitions with RGB coordinates and Colorette function names.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @type {readonly Ansi16ColorEntry[]}
 */
export const ANSI_16_COLORS: readonly Ansi16ColorEntry[] = [
  { name: 'black', colorFnName: 'black', r: 0, g: 0, b: 0 },
  { name: 'red', colorFnName: 'red', r: 128, g: 0, b: 0 },
  { name: 'green', colorFnName: 'green', r: 0, g: 128, b: 0 },
  { name: 'yellow', colorFnName: 'yellow', r: 128, g: 128, b: 0 },
  { name: 'blue', colorFnName: 'blue', r: 0, g: 0, b: 128 },
  { name: 'magenta', colorFnName: 'magenta', r: 128, g: 0, b: 128 },
  { name: 'cyan', colorFnName: 'cyan', r: 0, g: 128, b: 128 },
  { name: 'white', colorFnName: 'white', r: 192, g: 192, b: 192 },
  { name: 'gray', colorFnName: 'gray', r: 128, g: 128, b: 128 },
  { name: 'redBright', colorFnName: 'redBright', r: 255, g: 0, b: 0 },
  { name: 'greenBright', colorFnName: 'greenBright', r: 0, g: 255, b: 0 },
  { name: 'yellowBright', colorFnName: 'yellowBright', r: 255, g: 255, b: 0 },
  { name: 'blueBright', colorFnName: 'blueBright', r: 0, g: 0, b: 255 },
  { name: 'magentaBright', colorFnName: 'magentaBright', r: 255, g: 0, b: 255 },
  { name: 'cyanBright', colorFnName: 'cyanBright', r: 0, g: 255, b: 255 },
  { name: 'whiteBright', colorFnName: 'whiteBright', r: 255, g: 255, b: 255 }
] as const;

/**
 * @description Resolves an arbitrary CSS named color or HTML hex string to a normalized lowercase 6-digit hex code (#rrggbb).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {unknown} color - Input color candidate string.
 * @returns {string | null} Normalized 6-digit hex string or null if invalid.
 */
export function resolveColorToHex(color: unknown): string | null {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed in W3C_CSS_COLORS) {
    return W3C_CSS_COLORS[trimmed];
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    // 3-digit or 4-digit hex: #rgb or #rgba -> #rrggbb (alpha ignored)
    if (/^[0-9a-f]{3,4}$/.test(hex)) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    // 6-digit hex: #rrggbb
    if (/^[0-9a-f]{6}$/.test(hex)) {
      return `#${hex}`;
    }
    // 8-digit hex: #rrggbbaa -> #rrggbb (alpha ignored)
    if (/^[0-9a-f]{8}$/.test(hex)) {
      return `#${hex.slice(0, 6)}`;
    }
  }

  return null;
}

/**
 * @description Validates whether an input represents a valid standard W3C CSS named color or HTML hex code.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {unknown} color - Input color candidate to test.
 * @returns {boolean} True if color is a valid named color or hex code.
 */
export function isValidCssColor(color: unknown): boolean {
  return resolveColorToHex(color) !== null;
}

/**
 * @description Parses an input color string into an RGB triplet { r, g, b }.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {unknown} color - Input color candidate string.
 * @returns {RgbTriplet | null} Parsed RGB triplet or null if invalid.
 */
export function resolveColorToRgb(color: unknown): RgbTriplet | null {
  const hex = resolveColorToHex(color);
  if (!hex) return null;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return { r, g, b };
}

/**
 * @description Calculates the closest matching standard 16 ANSI color via minimum Euclidean distance in RGB color space.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {RgbTriplet} rgb - Input RGB color triplet.
 * @returns {Ansi16ColorEntry} Closest standard 16 ANSI color entry.
 */
export function findClosestAnsi16Color(rgb: RgbTriplet): Ansi16ColorEntry {
  let closestEntry = ANSI_16_COLORS[0];
  let minDistanceSq = Infinity;

  for (const entry of ANSI_16_COLORS) {
    const dr = rgb.r - entry.r;
    const dg = rgb.g - entry.g;
    const db = rgb.b - entry.b;
    const distSq = dr * dr + dg * dg + db * db;

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestEntry = entry;
      if (distSq === 0) break;
    }
  }

  return closestEntry;
}

