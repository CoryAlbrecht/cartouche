/**
 * @file colorConversions.test.ts
 * @module tests/shared/colors/colorConversions.test
 * @description Unit tests verifying zero-dependency CSS Color 4 engine conversions, wide-gamut and cylindrical models, CSS parsing/formatting, and interpolation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link colorConversions}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  srgbToLinearRgb,
  linearRgbToSrgb,
  linearRgbToXyzD65,
  xyzD65ToLinearRgb,
  xyzD65ToLab,
  labToXyzD65,
  labToLch,
  lchToLab,
  linearRgbToOklab,
  oklabToLinearRgb,
  oklabToOklch,
  oklchToOklab,
  srgbToHsl,
  hslToSrgb,
  srgbToHsv,
  hsvToSrgb,
  srgbToHwb,
  hwbToSrgb,
  srgbToHex,
  hexToSrgb,
  srgbToColorFormat,
  colorFormatToSrgb,
  parseCssColor,
  formatCssColor,
  interpolateColor,
  clamp,
  normalizeHue
} from '../../../src/shared/colors/colorConversions';

/**
 * Asserts that two numbers are approximately equal within a specified epsilon tolerance.
 *
 * @param {number} actual - Evaluated actual value.
 * @param {number} expected - Expected benchmark target value.
 * @param {number} [epsilon=0.005] - Maximum permitted absolute discrepancy.
 * @param {string} [message] - Failure explanation context.
 */
function assertApprox(actual: number, expected: number, epsilon = 0.005, message = ''): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= epsilon,
    `${message} Expected ${actual} to be approximately ${expected} (diff: ${diff}, tolerance: ${epsilon})`
  );
}

describe('Zero-Dependency CSS Color 4 Engine (Ticket #204)', () => {
  describe('Helper Utilities', () => {
    it('clamps values correctly', () => {
      assert.equal(clamp(-10, 0, 100), 0);
      assert.equal(clamp(50, 0, 100), 50);
      assert.equal(clamp(150, 0, 100), 100);
    });

    it('normalizes hue within [0, 360)', () => {
      assert.equal(normalizeHue(0), 0);
      assert.equal(normalizeHue(360), 0);
      assert.equal(normalizeHue(720), 0);
      assert.equal(normalizeHue(-90), 270);
      assert.equal(normalizeHue(450), 90);
    });
  });

  describe('sRGB <-> Linear sRGB Conversions', () => {
    it('converts boundary black and white', () => {
      const blackLinear = srgbToLinearRgb({ r: 0, g: 0, b: 0, alpha: 1 });
      assert.equal(blackLinear.r, 0);
      assert.equal(blackLinear.g, 0);
      assert.equal(blackLinear.b, 0);
      assert.equal(blackLinear.alpha, 1);

      const blackSrgb = linearRgbToSrgb(blackLinear);
      assert.equal(blackSrgb.r, 0);
      assert.equal(blackSrgb.g, 0);
      assert.equal(blackSrgb.b, 0);

      const whiteLinear = srgbToLinearRgb({ r: 255, g: 255, b: 255, alpha: 1 });
      assertApprox(whiteLinear.r, 1.0, 0.0001);
      assertApprox(whiteLinear.g, 1.0, 0.0001);
      assertApprox(whiteLinear.b, 1.0, 0.0001);

      const whiteSrgb = linearRgbToSrgb(whiteLinear);
      assert.equal(whiteSrgb.r, 255);
      assert.equal(whiteSrgb.g, 255);
      assert.equal(whiteSrgb.b, 255);
    });

    it('converts mid-range values with roundtrip fidelity', () => {
      const original = { r: 128, g: 64, b: 200, alpha: 0.85 };
      const linear = srgbToLinearRgb(original);
      const restored = linearRgbToSrgb(linear);

      assert.equal(restored.r, original.r);
      assert.equal(restored.g, original.g);
      assert.equal(restored.b, original.b);
      assertApprox(restored.alpha ?? 1, 0.85, 0.001);
    });
  });

  describe('Linear sRGB <-> CIE XYZ D65 Conversions', () => {
    it('converts D65 reference white correctly', () => {
      const whiteLinear = { r: 1, g: 1, b: 1, alpha: 1 };
      const xyz = linearRgbToXyzD65(whiteLinear);

      // Standard D65 white point: X=0.95047, Y=1.00000, Z=1.08883
      assertApprox(xyz.x, 0.95047, 0.001, 'D65 White X');
      assertApprox(xyz.y, 1.00000, 0.001, 'D65 White Y');
      assertApprox(xyz.z, 1.08883, 0.001, 'D65 White Z');

      const restored = xyzD65ToLinearRgb(xyz);
      assertApprox(restored.r, 1, 0.001);
      assertApprox(restored.g, 1, 0.001);
      assertApprox(restored.b, 1, 0.001);
    });

    it('roundtrips arbitrary linear colors through XYZ D65', () => {
      const linear = { r: 0.25, g: 0.5, b: 0.75, alpha: 0.5 };
      const xyz = linearRgbToXyzD65(linear);
      const restored = xyzD65ToLinearRgb(xyz);

      assertApprox(restored.r, linear.r, 0.001);
      assertApprox(restored.g, linear.g, 0.001);
      assertApprox(restored.b, linear.b, 0.001);
      assert.equal(restored.alpha, 0.5);
    });
  });

  describe('CIE XYZ D65 <-> CIE LAB <-> CIE LCH Conversions', () => {
    it('converts white to LAB (L*=100, a*=0, b*=0)', () => {
      const whiteXyz = { x: 0.95047, y: 1.0, z: 1.08883, alpha: 1 };
      const lab = xyzD65ToLab(whiteXyz);

      assertApprox(lab.l, 100, 0.01);
      assertApprox(lab.a, 0, 0.01);
      assertApprox(lab.b, 0, 0.01);

      const restoredXyz = labToXyzD65(lab);
      assertApprox(restoredXyz.x, whiteXyz.x, 0.001);
      assertApprox(restoredXyz.y, whiteXyz.y, 0.001);
      assertApprox(restoredXyz.z, whiteXyz.z, 0.001);
    });

    it('roundtrips LAB to LCH and back', () => {
      const lab = { l: 50, a: 25, b: -35, alpha: 0.9 };
      const lch = labToLch(lab);

      assertApprox(lch.l, 50, 0.001);
      assertApprox(lch.c, Math.sqrt(25 * 25 + 35 * 35), 0.001);

      const restoredLab = lchToLab(lch);
      assertApprox(restoredLab.l, lab.l, 0.001);
      assertApprox(restoredLab.a, lab.a, 0.001);
      assertApprox(restoredLab.b, lab.b, 0.001);
      assert.equal(restoredLab.alpha, 0.9);
    });
  });

  describe('Linear sRGB <-> Oklab <-> Oklch Conversions', () => {
    it('matches Björn Ottosson reference values for pure colors in Oklab', () => {
      // Pure Red (1, 0, 0)
      const redLin = { r: 1, g: 0, b: 0, alpha: 1 };
      const redOklab = linearRgbToOklab(redLin);
      assertApprox(redOklab.l, 0.6279, 0.005, 'Red L');
      assertApprox(redOklab.a, 0.2249, 0.005, 'Red a');
      assertApprox(redOklab.b, 0.1258, 0.005, 'Red b');

      const restoredRed = oklabToLinearRgb(redOklab);
      assertApprox(restoredRed.r, 1, 0.001);
      assertApprox(restoredRed.g, 0, 0.001);
      assertApprox(restoredRed.b, 0, 0.001);

      // Pure Green (0, 1, 0)
      const greenLin = { r: 0, g: 1, b: 0, alpha: 1 };
      const greenOklab = linearRgbToOklab(greenLin);
      assertApprox(greenOklab.l, 0.8664, 0.005, 'Green L');
      assertApprox(greenOklab.a, -0.2339, 0.005, 'Green a');
      assertApprox(greenOklab.b, 0.1795, 0.005, 'Green b');

      // Pure Blue (0, 0, 1)
      const blueLin = { r: 0, g: 0, b: 1, alpha: 1 };
      const blueOklab = linearRgbToOklab(blueLin);
      assertApprox(blueOklab.l, 0.4500, 0.005, 'Blue L');
      assertApprox(blueOklab.a, -0.0325, 0.005, 'Blue a');
      assertApprox(blueOklab.b, -0.3115, 0.005, 'Blue b');
    });

    it('roundtrips Oklab to Oklch and back', () => {
      const oklab = { l: 0.7, a: 0.12, b: -0.15, alpha: 0.75 };
      const oklch = oklabToOklch(oklab);

      assertApprox(oklch.l, 0.7, 0.0001);
      assertApprox(oklch.c, Math.hypot(0.12, -0.15), 0.0001);

      const restored = oklchToOklab(oklch);
      assertApprox(restored.l, oklab.l, 0.0001);
      assertApprox(restored.a, oklab.a, 0.0001);
      assertApprox(restored.b, oklab.b, 0.0001);
      assert.equal(restored.alpha, 0.75);
    });
  });

  describe('sRGB <-> Cylindrical Models (HSL, HSV, HWB)', () => {
    it('roundtrips sRGB through HSL', () => {
      const red = { r: 255, g: 0, b: 0, alpha: 1 };
      const redHsl = srgbToHsl(red);
      assertApprox(redHsl.h, 0, 0.01);
      assertApprox(redHsl.s, 100, 0.01);
      assertApprox(redHsl.l, 50, 0.01);

      const green = { r: 0, g: 255, b: 0, alpha: 1 };
      const greenHsl = srgbToHsl(green);
      assertApprox(greenHsl.h, 120, 0.01);
      assertApprox(greenHsl.s, 100, 0.01);
      assertApprox(greenHsl.l, 50, 0.01);

      const cyan = { r: 0, g: 255, b: 255, alpha: 0.6 };
      const cyanHsl = srgbToHsl(cyan);
      assertApprox(cyanHsl.h, 180, 0.01);
      assertApprox(cyanHsl.s, 100, 0.01);
      assertApprox(cyanHsl.l, 50, 0.01);

      const restored = hslToSrgb(cyanHsl);
      assert.equal(restored.r, 0);
      assert.equal(restored.g, 255);
      assert.equal(restored.b, 255);
      assertApprox(restored.alpha ?? 1, 0.6, 0.001);
    });

    it('roundtrips sRGB through HSV', () => {
      const purple = { r: 128, g: 0, b: 128, alpha: 1 };
      const hsv = srgbToHsv(purple);
      assertApprox(hsv.h, 300, 0.01);
      assertApprox(hsv.s, 100, 0.01);
      assertApprox(hsv.v, 50.196, 0.05);

      const restored = hsvToSrgb(hsv);
      assert.equal(restored.r, 128);
      assert.equal(restored.g, 0);
      assert.equal(restored.b, 128);
    });

    it('roundtrips sRGB through HWB', () => {
      const red = { r: 255, g: 0, b: 0, alpha: 0.5 };
      const redHwb = srgbToHwb(red);
      assertApprox(redHwb.h, 0, 0.01);
      assertApprox(redHwb.w, 0, 0.01);
      assertApprox(redHwb.b, 0, 0.01);

      const restored = hwbToSrgb(redHwb);
      assert.equal(restored.r, 255);
      assert.equal(restored.g, 0);
      assert.equal(restored.b, 0);
      assertApprox(restored.alpha ?? 1, 0.5, 0.001);

      // Gray test (W+B >= 100%)
      const gray = { r: 128, g: 128, b: 128, alpha: 1 };
      const grayHwb = srgbToHwb(gray);
      const restoredGray = hwbToSrgb(grayHwb);
      assert.equal(restoredGray.r, 128);
      assert.equal(restoredGray.g, 128);
      assert.equal(restoredGray.b, 128);
    });
  });

  describe('Hex Formats (3, 4, 6, 8 digits)', () => {
    it('parses 3, 4, 6, and 8 digit hex codes', () => {
      assert.deepEqual(hexToSrgb('#f00'), { r: 255, g: 0, b: 0, alpha: 1 });
      assert.deepEqual(hexToSrgb('#0f08'), { r: 0, g: 255, b: 0, alpha: 8 / 15 });
      assert.deepEqual(hexToSrgb('#0000ff'), { r: 0, g: 0, b: 255, alpha: 1 });
      assert.deepEqual(hexToSrgb('#00ff00ff'), { r: 0, g: 255, b: 0, alpha: 1 });
      assert.deepEqual(hexToSrgb('#12345680'), { r: 0x12, g: 0x34, b: 0x56, alpha: 128 / 255 });
    });

    it('serializes sRGB to hex format', () => {
      assert.equal(srgbToHex({ r: 255, g: 0, b: 0, alpha: 1 }), '#ff0000ff');
      assert.equal(srgbToHex({ r: 0, g: 255, b: 0, alpha: 1 }, false), '#00ff00');
      assert.equal(srgbToHex({ r: 0, g: 0, b: 255, alpha: 0.5 }), '#0000ff80');
    });
  });

  describe('Unified Format Conversion (srgbToColorFormat & colorFormatToSrgb)', () => {
    it('converts across all 8 supported formats', () => {
      const srgb = { r: 0, g: 255, b: 0, alpha: 1 };

      const rgb = srgbToColorFormat(srgb, 'RGB');
      assert.deepEqual(rgb, { r: 0, g: 255, b: 0, alpha: 1 });
      assert.deepEqual(colorFormatToSrgb(rgb, 'RGB'), srgb);

      const hsl = srgbToColorFormat(srgb, 'HSL');
      assert.deepEqual(colorFormatToSrgb(hsl, 'HSL'), srgb);

      const hwb = srgbToColorFormat(srgb, 'HWB');
      assert.deepEqual(colorFormatToSrgb(hwb, 'HWB'), srgb);

      const lab = srgbToColorFormat(srgb, 'LAB');
      assert.deepEqual(colorFormatToSrgb(lab, 'LAB'), srgb);

      const lch = srgbToColorFormat(srgb, 'LCH');
      assert.deepEqual(colorFormatToSrgb(lch, 'LCH'), srgb);

      const oklab = srgbToColorFormat(srgb, 'OKLAB');
      assert.deepEqual(colorFormatToSrgb(oklab, 'OKLAB'), srgb);

      const oklch = srgbToColorFormat(srgb, 'OKLCH');
      assert.deepEqual(colorFormatToSrgb(oklch, 'OKLCH'), srgb);

      const hex = srgbToColorFormat(srgb, 'HEX');
      assert.deepEqual(colorFormatToSrgb(hex, 'HEX'), srgb);
    });
  });

  describe('CSS Color 4 String Parsing and Formatting', () => {
    it('formats canonical modern CSS syntax for all 8 formats', () => {
      const srgb = { r: 255, g: 128, b: 0, alpha: 0.8 };

      assert.equal(formatCssColor(srgb, 'RGB'), 'rgb(255 128 0 / 0.8)');
      assert.equal(formatCssColor(srgb, 'HEX'), '#ff8000cc');
      assert.ok(formatCssColor(srgb, 'HSL').startsWith('hsl('));
      assert.ok(formatCssColor(srgb, 'HWB').startsWith('hwb('));
      assert.ok(formatCssColor(srgb, 'LAB').startsWith('lab('));
      assert.ok(formatCssColor(srgb, 'LCH').startsWith('lch('));
      assert.ok(formatCssColor(srgb, 'OKLAB').startsWith('oklab('));
      assert.ok(formatCssColor(srgb, 'OKLCH').startsWith('oklch('));

      // Test opaque format (no / alpha)
      const opaque = { r: 0, g: 255, b: 0, alpha: 1 };
      assert.equal(formatCssColor(opaque, 'RGB'), 'rgb(0 255 0)');
      assert.equal(formatCssColor(opaque, 'HEX'), '#00ff00ff');
    });

    it('parses diverse CSS color string formats', () => {
      // Hex
      const hexParsed = parseCssColor('#00ff00ff');
      assert.ok(hexParsed);
      assert.equal(hexParsed?.srgb.r, 0);
      assert.equal(hexParsed?.srgb.g, 255);
      assert.equal(hexParsed?.srgb.b, 0);
      assert.equal(hexParsed?.srgb.alpha, 1);
      assert.equal(hexParsed?.format, 'HEX');

      // Named color
      const namedParsed = parseCssColor('rebeccapurple');
      assert.ok(namedParsed);
      assert.equal(namedParsed?.srgb.r, 102);
      assert.equal(namedParsed?.srgb.g, 51);
      assert.equal(namedParsed?.srgb.b, 153);

      // Modern RGB
      const rgbModern = parseCssColor('rgb(255 100 50 / 0.75)');
      assert.ok(rgbModern);
      assert.equal(rgbModern?.srgb.r, 255);
      assert.equal(rgbModern?.srgb.g, 100);
      assert.equal(rgbModern?.srgb.b, 50);
      assertApprox(rgbModern?.srgb.alpha ?? 1, 0.75, 0.01);
      assert.equal(rgbModern?.format, 'RGB');

      // Legacy RGB
      const rgbLegacy = parseCssColor('rgba(255, 100, 50, 0.5)');
      assert.ok(rgbLegacy);
      assert.equal(rgbLegacy?.srgb.r, 255);
      assert.equal(rgbLegacy?.srgb.alpha, 0.5);

      // HSL
      const hslModern = parseCssColor('hsl(120 100% 50% / 0.9)');
      assert.ok(hslModern);
      assert.equal(hslModern?.srgb.r, 0);
      assert.equal(hslModern?.srgb.g, 255);
      assert.equal(hslModern?.srgb.b, 0);
      assertApprox(hslModern?.srgb.alpha ?? 1, 0.9, 0.01);
      assert.equal(hslModern?.format, 'HSL');

      // Oklch
      const oklch = parseCssColor('oklch(0.6279 0.2577 29.23 / 0.5)');
      assert.ok(oklch);
      assert.equal(oklch?.format, 'OKLCH');
      assertApprox(oklch?.srgb.alpha ?? 1, 0.5, 0.01);

      // Invalid returns null
      assert.equal(parseCssColor('not-a-color'), null);
      assert.equal(parseCssColor(''), null);
    });
  });

  describe('Linear Color Interpolation', () => {
    it('interpolates colors and alpha smoothly', () => {
      const c1 = { r: 0, g: 0, b: 0, alpha: 1 };
      const c2 = { r: 255, g: 255, b: 255, alpha: 0 };

      const start = interpolateColor(c1, c2, 0);
      assert.equal(start.r, 0);
      assert.equal(start.g, 0);
      assert.equal(start.b, 0);
      assert.equal(start.alpha, 1);

      const end = interpolateColor(c1, c2, 1);
      assert.equal(end.r, 255);
      assert.equal(end.g, 255);
      assert.equal(end.b, 255);
      assert.equal(end.alpha, 0);

      const mid = interpolateColor(c1, c2, 0.5);
      assert.equal(mid.r, 128);
      assert.equal(mid.g, 128);
      assert.equal(mid.b, 128);
      assertApprox(mid.alpha ?? 1, 0.5, 0.01);
    });

    it('interpolates in Oklab color space', () => {
      const c1 = { r: 255, g: 0, b: 0, alpha: 1 }; // Red
      const c2 = { r: 0, g: 255, b: 0, alpha: 1 }; // Green
      const mid = interpolateColor(c1, c2, 0.5, 'Oklab');

      // Interpolating in Oklab avoids the dark muddy brownish middle of naive sRGB
      assert.ok(mid.r > 100);
      assert.ok(mid.g > 100);
      assert.equal(mid.alpha, 1);
    });
  });
});
