/**
 * @file colorConversions.ts
 * @module shared/colors/colorConversions
 * @description Zero-dependency mathematical color science and conversion engine supporting CSS Color 4 spaces, cylindrical models, and interpolation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link parseCssColor}
 * @see {@link formatCssColor}
 * @see {@link interpolateColor}
 */

import { W3C_CSS_COLORS } from './cssColors';

/**
 * Supported color format identifiers across Cartouche UI and color pickers.
 */
export type ColorFormat = 'RGB' | 'HSL' | 'LCH' | 'OKLCH' | 'LAB' | 'OKLAB' | 'HWB' | 'HEX';

/**
 * Standard sRGB color coordinates in range [0, 255] with optional alpha in range [0, 1].
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
  alpha?: number;
}

/**
 * Linear sRGB color coordinates in range [0, 1] with optional alpha in range [0, 1].
 */
export interface LinearRgbColor {
  r: number;
  g: number;
  b: number;
  alpha?: number;
}

/**
 * CIE XYZ color coordinates using standard D65 illuminant reference white.
 */
export interface XyzColor {
  x: number;
  y: number;
  z: number;
  alpha?: number;
}

/**
 * CIE L*a*b* color coordinates (L in [0, 100], a in [-160, 160], b in [-160, 160]).
 */
export interface LabColor {
  l: number;
  a: number;
  b: number;
  alpha?: number;
}

/**
 * CIE LCH color coordinates (L in [0, 100], C in [0, 230], H in [0, 360)).
 */
export interface LchColor {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/**
 * Oklab color coordinates (L in [0, 1], a in [-0.4, 0.4], b in [-0.4, 0.4]).
 */
export interface OklabColor {
  l: number;
  a: number;
  b: number;
  alpha?: number;
}

/**
 * Oklch color coordinates (L in [0, 1], C in [0, 0.4], H in [0, 360)).
 */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

/**
 * Cylindrical HSL color coordinates (H in [0, 360), S in [0, 100], L in [0, 100]).
 */
export interface HslColor {
  h: number;
  s: number;
  l: number;
  alpha?: number;
}

/**
 * Cylindrical HSV/HSB color coordinates (H in [0, 360), S in [0, 100], V in [0, 100]).
 */
export interface HsvColor {
  h: number;
  s: number;
  v: number;
  alpha?: number;
}

/**
 * Cylindrical HWB color coordinates (H in [0, 360), W in [0, 100], B in [0, 100]).
 */
export interface HwbColor {
  h: number;
  w: number;
  b: number;
  alpha?: number;
}

/**
 * Result of parsing a CSS color candidate string.
 */
export interface ParsedCssColor {
  srgb: RgbColor;
  format: ColorFormat;
  raw: string;
}

/**
 * D65 illuminant reference white coordinates for CIE 1931 2-degree observer.
 */
const D65 = {
  xn: 0.95047,
  yn: 1.0,
  zn: 1.08883
};

/**
 * Clamps a numeric coordinate between an inclusive minimum and maximum boundary.
 *
 * @param {number} val - Input number.
 * @param {number} min - Lower boundary.
 * @param {number} max - Upper boundary.
 * @returns {number} Clamped number.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Normalizes an angular hue in degrees to the half-open interval [0, 360).
 *
 * @param {number} hue - Input angular hue.
 * @returns {number} Normalized hue in [0, 360).
 */
export function normalizeHue(hue: number): number {
  let normalized = hue % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized === 360 ? 0 : normalized;
}

/**
 * Converts non-linear sRGB [0, 255] coordinates to linear sRGB [0, 1] using standard gamma transfer.
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @returns {LinearRgbColor} Linear sRGB color coordinates.
 */
export function srgbToLinearRgb(srgb: RgbColor): LinearRgbColor {
  const rNorm = clamp(srgb.r, 0, 255) / 255;
  const gNorm = clamp(srgb.g, 0, 255) / 255;
  const bNorm = clamp(srgb.b, 0, 255) / 255;

  const toLinear = (c: number): number => {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return {
    r: toLinear(rNorm),
    g: toLinear(gNorm),
    b: toLinear(bNorm),
    alpha: srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1
  };
}

/**
 * Converts linear sRGB [0, 1] coordinates to non-linear sRGB [0, 255] using inverse gamma transfer.
 *
 * @param {LinearRgbColor} linear - Linear sRGB color.
 * @returns {RgbColor} Standard non-linear sRGB color.
 */
export function linearRgbToSrgb(linear: LinearRgbColor): RgbColor {
  const toGamma = (c: number): number => {
    const clamped = clamp(c, 0, 1);
    const gamma = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(clamp(gamma, 0, 1) * 255);
  };

  return {
    r: toGamma(linear.r),
    g: toGamma(linear.g),
    b: toGamma(linear.b),
    alpha: linear.alpha !== undefined ? clamp(linear.alpha, 0, 1) : 1
  };
}

/**
 * Transforms linear sRGB coordinates to CIE 1931 XYZ using standard D65 illuminant matrix.
 *
 * @param {LinearRgbColor} linear - Linear sRGB coordinates.
 * @returns {XyzColor} CIE XYZ D65 color coordinates.
 */
export function linearRgbToXyzD65(linear: LinearRgbColor): XyzColor {
  const r = linear.r;
  const g = linear.g;
  const b = linear.b;

  return {
    x: 0.41239079926595934 * r + 0.357584339383878 * g + 0.1804807884018343 * b,
    y: 0.21263900587151027 * r + 0.715168678767756 * g + 0.07219231536073371 * b,
    z: 0.01933081871559182 * r + 0.11919477979462598 * g + 0.9505321522496607 * b,
    alpha: linear.alpha
  };
}

/**
 * Transforms CIE 1931 XYZ (D65) coordinates to linear sRGB coordinates using inverse matrix.
 *
 * @param {XyzColor} xyz - CIE XYZ D65 color.
 * @returns {LinearRgbColor} Linear sRGB coordinates.
 */
export function xyzD65ToLinearRgb(xyz: XyzColor): LinearRgbColor {
  const x = xyz.x;
  const y = xyz.y;
  const z = xyz.z;

  return {
    r: 3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    g: -0.96924363628088 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    b: 0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
    alpha: xyz.alpha
  };
}

/**
 * Transforms CIE XYZ coordinates (D65 illuminant) to CIE 1976 L*a*b*.
 *
 * @param {XyzColor} xyz - CIE XYZ D65 color.
 * @returns {LabColor} CIE LAB color.
 */
export function xyzD65ToLab(xyz: XyzColor): LabColor {
  const xr = xyz.x / D65.xn;
  const yr = xyz.y / D65.yn;
  const zr = xyz.z / D65.zn;

  const epsilon = 216 / 24389; // 0.008856
  const kappa = 24389 / 27; // 903.3

  const f = (t: number): number => {
    return t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116;
  };

  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
    alpha: xyz.alpha
  };
}

/**
 * Transforms CIE 1976 L*a*b* coordinates to CIE XYZ (D65 illuminant).
 *
 * @param {LabColor} lab - CIE LAB color.
 * @returns {XyzColor} CIE XYZ D65 color.
 */
export function labToXyzD65(lab: LabColor): XyzColor {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const xr = Math.pow(fx, 3) > epsilon ? Math.pow(fx, 3) : (116 * fx - 16) / kappa;
  const yr = lab.l > kappa * epsilon ? Math.pow((lab.l + 16) / 116, 3) : lab.l / kappa;
  const zr = Math.pow(fz, 3) > epsilon ? Math.pow(fz, 3) : (116 * fz - 16) / kappa;

  return {
    x: xr * D65.xn,
    y: yr * D65.yn,
    z: zr * D65.zn,
    alpha: lab.alpha
  };
}

/**
 * Converts CIE LAB coordinates to cylindrical CIE LCH (Lightness, Chroma, Hue).
 *
 * @param {LabColor} lab - CIE LAB color.
 * @returns {LchColor} CIE LCH color.
 */
export function labToLch(lab: LabColor): LchColor {
  const c = Math.hypot(lab.a, lab.b);
  const h = normalizeHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI);

  return {
    l: lab.l,
    c,
    h,
    alpha: lab.alpha
  };
}

/**
 * Converts cylindrical CIE LCH coordinates to CIE LAB.
 *
 * @param {LchColor} lch - CIE LCH color.
 * @returns {LabColor} CIE LAB color.
 */
export function lchToLab(lch: LchColor): LabColor {
  const rad = (lch.h * Math.PI) / 180;
  return {
    l: lch.l,
    a: lch.c * Math.cos(rad),
    b: lch.c * Math.sin(rad),
    alpha: lch.alpha
  };
}

/**
 * Transforms linear sRGB coordinates to Björn Ottosson's Oklab color space.
 *
 * @param {LinearRgbColor} linear - Linear sRGB coordinates.
 * @returns {OklabColor} Oklab color coordinates.
 */
export function linearRgbToOklab(linear: LinearRgbColor): OklabColor {
  const r = linear.r;
  const g = linear.g;
  const b = linear.b;

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: linear.alpha
  };
}

/**
 * Transforms Oklab color coordinates to linear sRGB coordinates.
 *
 * @param {OklabColor} oklab - Oklab color coordinates.
 * @returns {LinearRgbColor} Linear sRGB coordinates.
 */
export function oklabToLinearRgb(oklab: OklabColor): LinearRgbColor {
  const l_ = oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.l - 0.0894841775 * oklab.a - 1.291485548 * oklab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    alpha: oklab.alpha
  };
}

/**
 * Converts Oklab coordinates to cylindrical Oklch (Lightness, Chroma, Hue).
 *
 * @param {OklabColor} oklab - Oklab color coordinates.
 * @returns {OklchColor} Oklch color coordinates.
 */
export function oklabToOklch(oklab: OklabColor): OklchColor {
  const c = Math.hypot(oklab.a, oklab.b);
  const h = normalizeHue((Math.atan2(oklab.b, oklab.a) * 180) / Math.PI);

  return {
    l: oklab.l,
    c,
    h,
    alpha: oklab.alpha
  };
}

/**
 * Converts cylindrical Oklch coordinates to Oklab coordinates.
 *
 * @param {OklchColor} oklch - Oklch color coordinates.
 * @returns {OklabColor} Oklab color coordinates.
 */
export function oklchToOklab(oklch: OklchColor): OklabColor {
  const rad = (oklch.h * Math.PI) / 180;
  return {
    l: oklch.l,
    a: oklch.c * Math.cos(rad),
    b: oklch.c * Math.sin(rad),
    alpha: oklch.alpha
  };
}

/**
 * Converts sRGB coordinates to cylindrical HSL (Hue, Saturation, Lightness).
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @returns {HslColor} HSL color coordinates (H in [0, 360), S, L in [0, 100]).
 */
export function srgbToHsl(srgb: RgbColor): HslColor {
  const r = clamp(srgb.r, 0, 255) / 255;
  const g = clamp(srgb.g, 0, 255) / 255;
  const b = clamp(srgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return {
    h: normalizeHue(h),
    s: s * 100,
    l: l * 100,
    alpha: srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1
  };
}

/**
 * Converts cylindrical HSL coordinates to standard sRGB coordinates.
 *
 * @param {HslColor} hsl - HSL color coordinates.
 * @returns {RgbColor} Standard non-linear sRGB color.
 */
export function hslToSrgb(hsl: HslColor): RgbColor {
  const h = normalizeHue(hsl.h);
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
    alpha: hsl.alpha !== undefined ? clamp(hsl.alpha, 0, 1) : 1
  };
}

/**
 * Converts standard sRGB coordinates to HSV/HSB coordinates (Hue, Saturation, Value).
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @returns {HsvColor} HSV color coordinates (H in [0, 360), S, V in [0, 100]).
 */
export function srgbToHsv(srgb: RgbColor): HsvColor {
  const r = clamp(srgb.r, 0, 255) / 255;
  const g = clamp(srgb.g, 0, 255) / 255;
  const b = clamp(srgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return {
    h: normalizeHue(h),
    s: s * 100,
    v: v * 100,
    alpha: srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1
  };
}

/**
 * Converts HSV/HSB coordinates to standard non-linear sRGB coordinates.
 *
 * @param {HsvColor} hsv - HSV color coordinates.
 * @returns {RgbColor} Standard non-linear sRGB color.
 */
export function hsvToSrgb(hsv: HsvColor): RgbColor {
  const h = normalizeHue(hsv.h);
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
    alpha: hsv.alpha !== undefined ? clamp(hsv.alpha, 0, 1) : 1
  };
}

/**
 * Converts sRGB coordinates to HWB (Hue, Whiteness, Blackness) per CSS Color 4.
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @returns {HwbColor} HWB color coordinates.
 */
export function srgbToHwb(srgb: RgbColor): HwbColor {
  const r = clamp(srgb.r, 0, 255) / 255;
  const g = clamp(srgb.g, 0, 255) / 255;
  const b = clamp(srgb.b, 0, 255) / 255;

  const hsl = srgbToHsl(srgb);
  const w = Math.min(r, g, b) * 100;
  const bl = (1 - Math.max(r, g, b)) * 100;

  return {
    h: hsl.h,
    w,
    b: bl,
    alpha: srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1
  };
}

/**
 * Converts HWB coordinates to standard non-linear sRGB coordinates.
 *
 * @param {HwbColor} hwb - HWB color coordinates.
 * @returns {RgbColor} Standard non-linear sRGB color.
 */
export function hwbToSrgb(hwb: HwbColor): RgbColor {
  const h = normalizeHue(hwb.h);
  let w = clamp(hwb.w, 0, 100) / 100;
  let b = clamp(hwb.b, 0, 100) / 100;

  if (w + b >= 1) {
    const gray = Math.round((w / (w + b)) * 255);
    return {
      r: gray,
      g: gray,
      b: gray,
      alpha: hwb.alpha !== undefined ? clamp(hwb.alpha, 0, 1) : 1
    };
  }

  const baseRgb = hslToSrgb({ h, s: 100, l: 50 });
  const rNorm = (baseRgb.r / 255) * (1 - w - b) + w;
  const gNorm = (baseRgb.g / 255) * (1 - w - b) + w;
  const bNorm = (baseRgb.b / 255) * (1 - w - b) + w;

  return {
    r: Math.round(clamp(rNorm, 0, 1) * 255),
    g: Math.round(clamp(gNorm, 0, 1) * 255),
    b: Math.round(clamp(bNorm, 0, 1) * 255),
    alpha: hwb.alpha !== undefined ? clamp(hwb.alpha, 0, 1) : 1
  };
}

/**
 * Serializes standard sRGB coordinates to a normalized lowercase hexadecimal string.
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @param {boolean} [includeAlpha=true] - Whether to append 2-digit alpha channel.
 * @returns {string} Hexadecimal color string (#rrggbb or #rrggbbaa).
 */
export function srgbToHex(srgb: RgbColor, includeAlpha = true): string {
  const toHex = (c: number): string => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0');
  const base = `#${toHex(srgb.r)}${toHex(srgb.g)}${toHex(srgb.b)}`;

  if (!includeAlpha) {
    return base;
  }

  const a = srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1;
  const aHex = Math.round(a * 255).toString(16).padStart(2, '0');
  return `${base}${aHex}`;
}

/**
 * Parses a 3, 4, 6, or 8 digit hexadecimal color string into standard sRGB coordinates.
 *
 * @param {string} hex - Hexadecimal color candidate string.
 * @returns {RgbColor | null} Parsed sRGB color or null if invalid.
 */
export function hexToSrgb(hex: string): RgbColor | null {
  const trimmed = hex.trim();
  if (!trimmed.startsWith('#')) return null;
  const raw = trimmed.slice(1);

  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b, alpha: 1 };
  }

  if (/^[0-9a-fA-F]{4}$/.test(raw)) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    const alpha = parseInt(raw[3] + raw[3], 16) / 255;
    return { r, g, b, alpha };
  }

  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b, alpha: 1 };
  }

  if (/^[0-9a-fA-F]{8}$/.test(raw)) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const alpha = parseInt(raw.slice(6, 8), 16) / 255;
    return { r, g, b, alpha };
  }

  return null;
}

/**
 * Converts standard sRGB color coordinates to the specified target ColorFormat object or string.
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @param {ColorFormat} format - Target color model.
 * @returns {unknown} Formatted color structure or hex string.
 */
export function srgbToColorFormat(srgb: RgbColor, format: ColorFormat): unknown {
  switch (format) {
    case 'RGB':
      return { r: srgb.r, g: srgb.g, b: srgb.b, alpha: srgb.alpha ?? 1 };
    case 'HSL':
      return srgbToHsl(srgb);
    case 'HWB':
      return srgbToHwb(srgb);
    case 'LAB': {
      const lin = srgbToLinearRgb(srgb);
      const xyz = linearRgbToXyzD65(lin);
      return xyzD65ToLab(xyz);
    }
    case 'LCH': {
      const lin = srgbToLinearRgb(srgb);
      const xyz = linearRgbToXyzD65(lin);
      const lab = xyzD65ToLab(xyz);
      return labToLch(lab);
    }
    case 'OKLAB': {
      const lin = srgbToLinearRgb(srgb);
      return linearRgbToOklab(lin);
    }
    case 'OKLCH': {
      const lin = srgbToLinearRgb(srgb);
      const oklab = linearRgbToOklab(lin);
      return oklabToOklch(oklab);
    }
    case 'HEX':
      return srgbToHex(srgb);
  }
}

/**
 * Converts a representation in any supported ColorFormat back to standard sRGB coordinates.
 *
 * @param {unknown} color - Color representation in the specified format.
 * @param {ColorFormat} format - Source color format.
 * @returns {RgbColor} Standard non-linear sRGB color.
 */
export function colorFormatToSrgb(color: unknown, format: ColorFormat): RgbColor {
  if (format === 'HEX' && typeof color === 'string') {
    const parsed = hexToSrgb(color);
    return parsed ?? { r: 0, g: 0, b: 0, alpha: 1 };
  }

  const obj = color as Record<string, number>;
  const alpha = obj.alpha !== undefined ? clamp(obj.alpha, 0, 1) : 1;

  switch (format) {
    case 'RGB':
      return {
        r: Math.round(clamp(obj.r, 0, 255)),
        g: Math.round(clamp(obj.g, 0, 255)),
        b: Math.round(clamp(obj.b, 0, 255)),
        alpha
      };
    case 'HSL':
      return hslToSrgb({ h: obj.h, s: obj.s, l: obj.l, alpha });
    case 'HWB':
      return hwbToSrgb({ h: obj.h, w: obj.w, b: obj.b, alpha });
    case 'LAB': {
      const xyz = labToXyzD65({ l: obj.l, a: obj.a, b: obj.b, alpha });
      const lin = xyzD65ToLinearRgb(xyz);
      return linearRgbToSrgb(lin);
    }
    case 'LCH': {
      const lab = lchToLab({ l: obj.l, c: obj.c, h: obj.h, alpha });
      const xyz = labToXyzD65(lab);
      const lin = xyzD65ToLinearRgb(xyz);
      return linearRgbToSrgb(lin);
    }
    case 'OKLAB': {
      const lin = oklabToLinearRgb({ l: obj.l, a: obj.a, b: obj.b, alpha });
      return linearRgbToSrgb(lin);
    }
    case 'OKLCH': {
      const oklab = oklchToOklab({ l: obj.l, c: obj.c, h: obj.h, alpha });
      const lin = oklabToLinearRgb(oklab);
      return linearRgbToSrgb(lin);
    }
    case 'HEX':
      return hexToSrgb(String(color)) ?? { r: 0, g: 0, b: 0, alpha: 1 };
  }
}

/**
 * Formats standard sRGB coordinates into modern W3C CSS Color 4 string syntax.
 *
 * @param {RgbColor} srgb - Standard non-linear sRGB color.
 * @param {ColorFormat} format - Target CSS color format.
 * @returns {string} CSS color string.
 */
export function formatCssColor(srgb: RgbColor, format: ColorFormat): string {
  const alpha = srgb.alpha !== undefined ? clamp(srgb.alpha, 0, 1) : 1;
  const hasAlpha = alpha < 1;
  const alphaStr = hasAlpha ? ` / ${parseFloat(alpha.toFixed(4))}` : '';

  switch (format) {
    case 'RGB':
      return `rgb(${Math.round(clamp(srgb.r, 0, 255))} ${Math.round(clamp(srgb.g, 0, 255))} ${Math.round(clamp(srgb.b, 0, 255))}${alphaStr})`;
    case 'HSL': {
      const hsl = srgbToHsl(srgb);
      return `hsl(${parseFloat(hsl.h.toFixed(1))} ${parseFloat(hsl.s.toFixed(1))}% ${parseFloat(hsl.l.toFixed(1))}%${alphaStr})`;
    }
    case 'HWB': {
      const hwb = srgbToHwb(srgb);
      return `hwb(${parseFloat(hwb.h.toFixed(1))} ${parseFloat(hwb.w.toFixed(1))}% ${parseFloat(hwb.b.toFixed(1))}%${alphaStr})`;
    }
    case 'LAB': {
      const lab = srgbToColorFormat(srgb, 'LAB') as LabColor;
      return `lab(${parseFloat(lab.l.toFixed(2))} ${parseFloat(lab.a.toFixed(2))} ${parseFloat(lab.b.toFixed(2))}${alphaStr})`;
    }
    case 'LCH': {
      const lch = srgbToColorFormat(srgb, 'LCH') as LchColor;
      return `lch(${parseFloat(lch.l.toFixed(2))} ${parseFloat(lch.c.toFixed(2))} ${parseFloat(lch.h.toFixed(2))}${alphaStr})`;
    }
    case 'OKLAB': {
      const oklab = srgbToColorFormat(srgb, 'OKLAB') as OklabColor;
      return `oklab(${parseFloat(oklab.l.toFixed(4))} ${parseFloat(oklab.a.toFixed(4))} ${parseFloat(oklab.b.toFixed(4))}${alphaStr})`;
    }
    case 'OKLCH': {
      const oklch = srgbToColorFormat(srgb, 'OKLCH') as OklchColor;
      return `oklch(${parseFloat(oklch.l.toFixed(4))} ${parseFloat(oklch.c.toFixed(4))} ${parseFloat(oklch.h.toFixed(2))}${alphaStr})`;
    }
    case 'HEX':
      return srgbToHex(srgb, true);
  }
}

/**
 * Parses any valid CSS color string (Hex, RGB, HSL, HWB, LAB, LCH, OKLAB, OKLCH, or W3C named color).
 *
 * @param {string} input - CSS color string to parse.
 * @returns {ParsedCssColor | null} Parsed color structure or null if unrecognizable.
 */
export function parseCssColor(input: string): ParsedCssColor | null {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim().toLowerCase();

  // 1. Hex
  if (raw.startsWith('#')) {
    const srgb = hexToSrgb(raw);
    if (srgb) {
      return { srgb, format: 'HEX', raw };
    }
    return null;
  }

  // 2. Named color
  if (raw in W3C_CSS_COLORS) {
    const hex = W3C_CSS_COLORS[raw];
    const srgb = hexToSrgb(hex);
    if (srgb) {
      return { srgb, format: 'RGB', raw };
    }
  }

  // Helper to parse alpha component (/ 0.5 or , 0.5)
  const parseAlpha = (str?: string): number => {
    if (!str) return 1;
    const clean = str.trim().replace(/^[/,]\s*/, '');
    if (clean.endsWith('%')) {
      return clamp(parseFloat(clean) / 100, 0, 1);
    }
    return clamp(parseFloat(clean), 0, 1);
  };

  // 3. rgb(...) / rgba(...)
  const rgbMatch = raw.match(
    /^rgba?\(\s*([0-9.]+%?)[,\s]+([0-9.]+%?)[,\s]+([0-9.]+%?)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (rgbMatch) {
    const parseChan = (v: string): number => {
      if (v.endsWith('%')) return Math.round((parseFloat(v) / 100) * 255);
      return Math.round(parseFloat(v));
    };
    const srgb: RgbColor = {
      r: clamp(parseChan(rgbMatch[1]), 0, 255),
      g: clamp(parseChan(rgbMatch[2]), 0, 255),
      b: clamp(parseChan(rgbMatch[3]), 0, 255),
      alpha: rgbMatch[4] !== undefined ? parseAlpha(rgbMatch[4]) : 1
    };
    return { srgb, format: 'RGB', raw };
  }

  // 4. hsl(...) / hsla(...)
  const hslMatch = raw.match(
    /^hsla?\(\s*([0-9.]+(?:deg)?)[,\s]+([0-9.]+%?)[,\s]+([0-9.]+%?)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]);
    const l = parseFloat(hslMatch[3]);
    const alpha = hslMatch[4] !== undefined ? parseAlpha(hslMatch[4]) : 1;
    const srgb = hslToSrgb({ h, s, l, alpha });
    return { srgb, format: 'HSL', raw };
  }

  // 5. hwb(...)
  const hwbMatch = raw.match(
    /^hwb\(\s*([0-9.]+(?:deg)?)[,\s]+([0-9.]+%?)[,\s]+([0-9.]+%?)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (hwbMatch) {
    const h = parseFloat(hwbMatch[1]);
    const w = parseFloat(hwbMatch[2]);
    const b = parseFloat(hwbMatch[3]);
    const alpha = hwbMatch[4] !== undefined ? parseAlpha(hwbMatch[4]) : 1;
    const srgb = hwbToSrgb({ h, w, b, alpha });
    return { srgb, format: 'HWB', raw };
  }

  // 6. lab(...)
  const labMatch = raw.match(
    /^lab\(\s*([0-9.]+%?)[,\s]+([-0-9.]+)[,\s]+([-0-9.]+)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (labMatch) {
    const l = parseFloat(labMatch[1]);
    const a = parseFloat(labMatch[2]);
    const b = parseFloat(labMatch[3]);
    const alpha = labMatch[4] !== undefined ? parseAlpha(labMatch[4]) : 1;
    const srgb = colorFormatToSrgb({ l, a, b, alpha }, 'LAB');
    return { srgb, format: 'LAB', raw };
  }

  // 7. lch(...)
  const lchMatch = raw.match(
    /^lch\(\s*([0-9.]+%?)[,\s]+([0-9.]+)[,\s]+([0-9.]+(?:deg)?)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (lchMatch) {
    const l = parseFloat(lchMatch[1]);
    const c = parseFloat(lchMatch[2]);
    const h = parseFloat(lchMatch[3]);
    const alpha = lchMatch[4] !== undefined ? parseAlpha(lchMatch[4]) : 1;
    const srgb = colorFormatToSrgb({ l, c, h, alpha }, 'LCH');
    return { srgb, format: 'LCH', raw };
  }

  // 8. oklab(...)
  const oklabMatch = raw.match(
    /^oklab\(\s*([0-9.]+%?)[,\s]+([-0-9.]+)[,\s]+([-0-9.]+)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (oklabMatch) {
    let l = parseFloat(oklabMatch[1]);
    if (oklabMatch[1].endsWith('%')) l = l / 100;
    const a = parseFloat(oklabMatch[2]);
    const b = parseFloat(oklabMatch[3]);
    const alpha = oklabMatch[4] !== undefined ? parseAlpha(oklabMatch[4]) : 1;
    const srgb = colorFormatToSrgb({ l, a, b, alpha }, 'OKLAB');
    return { srgb, format: 'OKLAB', raw };
  }

  // 9. oklch(...)
  const oklchMatch = raw.match(
    /^oklch\(\s*([0-9.]+%?)[,\s]+([0-9.]+)[,\s]+([0-9.]+(?:deg)?)(?:[,\s/]+([0-9.]+%?))?\s*\)$/
  );
  if (oklchMatch) {
    let l = parseFloat(oklchMatch[1]);
    if (oklchMatch[1].endsWith('%')) l = l / 100;
    const c = parseFloat(oklchMatch[2]);
    const h = parseFloat(oklchMatch[3]);
    const alpha = oklchMatch[4] !== undefined ? parseAlpha(oklchMatch[4]) : 1;
    const srgb = colorFormatToSrgb({ l, c, h, alpha }, 'OKLCH');
    return { srgb, format: 'OKLCH', raw };
  }

  return null;
}

/**
 * Linearly interpolates between two colors and their alpha values.
 *
 * @param {RgbColor} color1 - Starting boundary color.
 * @param {RgbColor} color2 - Ending boundary color.
 * @param {number} factor - Interpolation progress in range [0, 1].
 * @param {'sRGB' | 'Oklab'} [space='sRGB'] - Interpolation color space ('sRGB' or 'Oklab').
 * @returns {RgbColor} Interpolated sRGB color.
 */
export function interpolateColor(
  color1: RgbColor,
  color2: RgbColor,
  factor: number,
  space: 'sRGB' | 'Oklab' = 'sRGB'
): RgbColor {
  const t = clamp(factor, 0, 1);
  const a1 = color1.alpha !== undefined ? clamp(color1.alpha, 0, 1) : 1;
  const a2 = color2.alpha !== undefined ? clamp(color2.alpha, 0, 1) : 1;
  const blendedAlpha = a1 + (a2 - a1) * t;

  if (space === 'Oklab') {
    const ok1 = linearRgbToOklab(srgbToLinearRgb(color1));
    const ok2 = linearRgbToOklab(srgbToLinearRgb(color2));

    const okBlended: OklabColor = {
      l: ok1.l + (ok2.l - ok1.l) * t,
      a: ok1.a + (ok2.a - ok1.a) * t,
      b: ok1.b + (ok2.b - ok1.b) * t,
      alpha: blendedAlpha
    };

    const linBlended = oklabToLinearRgb(okBlended);
    return linearRgbToSrgb(linBlended);
  }

  // Default linear sRGB interpolation
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * t),
    g: Math.round(color1.g + (color2.g - color1.g) * t),
    b: Math.round(color1.b + (color2.b - color1.b) * t),
    alpha: blendedAlpha
  };
}
