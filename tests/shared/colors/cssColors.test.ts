/**
 * @file cssColors.test.ts
 * @module tests/shared/colors/cssColors.test
 * @description Unit tests verifying W3C CSS named color registry, hex normalization, validation, Euclidean distance downsampling, and preferences schema types.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link isValidCssColor}
 * @see {@link resolveColorToHex}
 * @see {@link resolveColorToRgb}
 * @see {@link findClosestAnsi16Color}
 * @see {@link CSS_COLOR_NAMES}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS_COLOR_NAMES,
  W3C_CSS_COLORS,
  W3C_CSS_COLOR_RGB,
  isValidCssColor,
  resolveColorToHex,
  resolveColorToRgb,
  findClosestAnsi16Color
} from '../../../src/shared/colors/cssColors';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences/index';

describe('Shared W3C CSS Color Subsystem & Contracts (Ticket #56)', () => {
  it('registers all 148 standard W3C CSS named colors', () => {
    assert.equal(CSS_COLOR_NAMES.length, 148, 'Must contain exactly 148 standard W3C CSS named colors');
    const uniqueNames = new Set(CSS_COLOR_NAMES);
    assert.equal(uniqueNames.size, 148, 'All 148 CSS color names must be distinct');

    // Verify key standard and modern CSS colors are present
    const sampleColors = [
      'aliceblue',
      'cornflowerblue',
      'darkorange',
      'magenta',
      'rebeccapurple',
      'salmon',
      'whitesmoke',
      'gray',
      'grey'
    ];
    for (const color of sampleColors) {
      assert.ok(uniqueNames.has(color), `Color '${color}' must exist in CSS_COLOR_NAMES`);
      assert.ok(color in W3C_CSS_COLORS, `Color '${color}' must exist in W3C_CSS_COLORS record`);
      assert.ok(color in W3C_CSS_COLOR_RGB, `Color '${color}' must exist in W3C_CSS_COLOR_RGB record`);
      const rgb = W3C_CSS_COLOR_RGB[color];
      assert.ok(typeof rgb.r === 'number' && rgb.r >= 0 && rgb.r <= 255);
      assert.ok(typeof rgb.g === 'number' && rgb.g >= 0 && rgb.g <= 255);
      assert.ok(typeof rgb.b === 'number' && rgb.b >= 0 && rgb.b <= 255);
    }
  });

  it('validates standard CSS color names case-insensitively and trimmed', () => {
    assert.equal(isValidCssColor('red'), true);
    assert.equal(isValidCssColor('  RED  '), true);
    assert.equal(isValidCssColor('DarkOrange'), true);
    assert.equal(isValidCssColor('cornflowerblue'), true);
    assert.equal(isValidCssColor('rebeccapurple'), true);
    assert.equal(isValidCssColor('salmon'), true);

    // Invalid named colors
    assert.equal(isValidCssColor('blurg'), false);
    assert.equal(isValidCssColor('notacolor'), false);
    assert.equal(isValidCssColor(''), false);
    assert.equal(isValidCssColor('   '), false);
    assert.equal(isValidCssColor(null), false);
    assert.equal(isValidCssColor(undefined), false);
  });

  it('validates 3-, 4-, 6-, and 8-digit HTML hex codes', () => {
    assert.equal(isValidCssColor('#f80'), true);
    assert.equal(isValidCssColor('#F80A'), true);
    assert.equal(isValidCssColor('#ff8800'), true);
    assert.equal(isValidCssColor('#FF8800AA'), true);

    // Invalid hex strings
    assert.equal(isValidCssColor('#'), false);
    assert.equal(isValidCssColor('#1'), false);
    assert.equal(isValidCssColor('#12'), false);
    assert.equal(isValidCssColor('#12345'), false);
    assert.equal(isValidCssColor('#1234567'), false);
    assert.equal(isValidCssColor('#xyz'), false);
    assert.equal(isValidCssColor('ff8800'), false, 'Hex must require leading #');
  });

  it('resolves named colors and hex strings to normalized 6-digit hex (#rrggbb)', () => {
    assert.equal(resolveColorToHex('red'), '#ff0000');
    assert.equal(resolveColorToHex('RED'), '#ff0000');
    assert.equal(resolveColorToHex('rebeccapurple'), '#663399');
    assert.equal(resolveColorToHex('cornflowerblue'), '#6495ed');
    assert.equal(resolveColorToHex('salmon'), '#fa8072');
    assert.equal(resolveColorToHex('darkorange'), '#ff8c00');

    // Hex strings
    assert.equal(resolveColorToHex('#f80'), '#ff8800');
    assert.equal(resolveColorToHex('#F80A'), '#ff8800');
    assert.equal(resolveColorToHex('#ff8800'), '#ff8800');
    assert.equal(resolveColorToHex('#FF8800AA'), '#ff8800');

    // Invalid colors return null
    assert.equal(resolveColorToHex('blurg'), null);
    assert.equal(resolveColorToHex('#xyz'), null);
  });

  it('resolves named colors and hex strings to RGB triplets { r, g, b }', () => {
    assert.deepEqual(resolveColorToRgb('red'), { r: 255, g: 0, b: 0 });
    assert.deepEqual(resolveColorToRgb('#00ff00'), { r: 0, g: 255, b: 0 });
    assert.deepEqual(resolveColorToRgb('#00f'), { r: 0, g: 0, b: 255 });
    assert.deepEqual(resolveColorToRgb('rebeccapurple'), { r: 102, g: 51, b: 153 });
    assert.deepEqual(resolveColorToRgb('cornflowerblue'), { r: 100, g: 149, b: 237 });

    assert.equal(resolveColorToRgb('blurg'), null);
  });

  it('calculates minimum Euclidean distance to map custom RGB colors to closest standard 16 ANSI color', () => {
    // Pure standard colors
    const blackMatch = findClosestAnsi16Color({ r: 0, g: 0, b: 0 });
    assert.equal(blackMatch.colorFnName, 'black');

    const whiteMatch = findClosestAnsi16Color({ r: 255, g: 255, b: 255 });
    assert.equal(whiteMatch.colorFnName, 'whiteBright');

    const darkRedMatch = findClosestAnsi16Color({ r: 139, g: 0, b: 0 }); // darkred
    assert.equal(darkRedMatch.colorFnName, 'red');

    const brightRedMatch = findClosestAnsi16Color({ r: 255, g: 0, b: 0 }); // red
    assert.equal(brightRedMatch.colorFnName, 'redBright');

    const navyMatch = findClosestAnsi16Color({ r: 0, g: 0, b: 128 }); // navy
    assert.equal(navyMatch.colorFnName, 'blue');

    const forestGreenMatch = findClosestAnsi16Color({ r: 34, g: 139, b: 34 }); // forestgreen
    assert.equal(forestGreenMatch.colorFnName, 'green');
  });

  it('ensures built-in preferences schema declares type: "string" for log severity colors with compound controls', () => {
    const levels = ['critical', 'error', 'warn', 'info', 'debug'];
    for (const lvl of levels) {
      const prefKey = `general.logging.colours.level.${lvl}`;
      const pref = BUILTIN_PREFERENCES[prefKey];
      assert.ok(pref, `Preference '${prefKey}' must exist`);
      assert.equal(pref.type, 'string', `Preference '${prefKey}' must have type: 'string'`);
      assert.deepEqual(pref.controls, ['text', 'colour'], `Preference '${prefKey}' controls must be ['text', 'colour']`);
    }
  });
});

