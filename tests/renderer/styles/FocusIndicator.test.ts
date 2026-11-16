/**
 * @file FocusIndicator.test.ts
 * @module tests/renderer/styles/FocusIndicator.test
 * @description Guardrail tests for the Theme-bound Focus Indicator and Invalid Focus Indicator (Spec #316 / Ticket #317): the Tier 1 / Tier 2 focus, invalid-state and control-accent tokens in theme-default.css, and the single global :focus-visible / aria-invalid rule set in workbench.css that replaces the scattered per-component focus styling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const THEME_CSS = fs.readFileSync(
  path.resolve(process.cwd(), 'src/renderer/styles/themes/theme-default.css'),
  'utf8'
);
const WORKBENCH_CSS = fs.readFileSync(
  path.resolve(process.cwd(), 'src/renderer/styles/workbench.css'),
  'utf8'
);

/**
 * @typedef {Object} CssRule
 * @property {string[]} selectors - Comma-separated selectors of the rule, trimmed.
 * @property {string} body - Declaration block between the braces.
 */
interface CssRule {
  selectors: string[];
  body: string;
}

/**
 * @function parseRules
 * @description Splits a flat stylesheet (no at-rule blocks) into rules, ignoring comments and `@import` lines.
 * @param {string} css - Stylesheet text.
 * @returns {CssRule[]} Parsed rules.
 */
function parseRules(css: string): CssRule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '');
  const rules: CssRule[] = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({
      selectors: splitSelectors(match[1]),
      body: match[2],
    });
  }
  return rules;
}

/**
 * @function splitSelectors
 * @description Splits a selector list on top-level commas, keeping commas inside `:is()` / `:not()` together.
 * @param {string} list - Selector list text.
 * @returns {string[]} Normalised selectors.
 */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * @function declaration
 * @description Reads one property's value from a declaration block.
 * @param {string} body - Declaration block.
 * @param {string} property - Property name.
 * @returns {string | undefined} The trimmed value, or undefined when absent.
 */
function declaration(body: string, property: string): string | undefined {
  const match = body.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`));
  return match ? match[1].trim() : undefined;
}

/**
 * @function rulesFor
 * @description Finds every workbench.css rule whose selector list contains the given selector.
 * @param {string} selector - Exact selector text (whitespace-normalised).
 * @returns {CssRule[]} Matching rules.
 */
function rulesFor(selector: string): CssRule[] {
  return parseRules(WORKBENCH_CSS).filter((r) => r.selectors.includes(selector));
}

/**
 * @function tokenValue
 * @description Reads a custom property's value from theme-default.css.
 * @param {string} token - Custom property name.
 * @returns {string | undefined} The trimmed value, or undefined when not defined.
 */
function tokenValue(token: string): string | undefined {
  const match = THEME_CSS.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : undefined;
}

/** Non-text `<input>` types that take the outline ring rather than the border-and-halo indicator. */
const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image'];

/** The text-entry selector list used by the global rules. */
const TEXT_ENTRY = `:is(input:not(${NON_TEXT_INPUT_TYPES.map((t) => `[type="${t}"]`).join(', ')}), select, textarea)`;

/** Selectors allowed to suppress the Focus Indicator: the map canvas only. */
const MAP_CANVAS_OPT_OUT = ['.ol-viewport:focus-visible', '.ol-viewport canvas:focus-visible'];

describe('Focus Indicator tokens in theme-default.css (Ticket #317)', () => {
  it('defines the Tier 1 danger-focus primitive', () => {
    assert.equal(tokenValue('--cartouche-theme-danger-focus'), 'rgba(220, 38, 38, 0.25)');
  });

  it('maps every Tier 2 focus, invalid and control-accent token as the spec lays out', () => {
    const expected: Record<string, string> = {
      '--cartouche-focus-color': 'var(--cartouche-theme-primary)',
      '--cartouche-focus-ring': 'var(--cartouche-theme-accent-focus)',
      '--cartouche-focus-width': '0.125rem',
      '--cartouche-focus-invalid-color': 'var(--cartouche-theme-danger)',
      '--cartouche-focus-invalid-ring': 'var(--cartouche-theme-danger-focus)',
      '--cartouche-invalid-border': 'var(--cartouche-theme-danger)',
      '--cartouche-invalid-fg': 'var(--cartouche-theme-danger)',
      '--cartouche-control-accent': 'var(--cartouche-theme-primary)',
    };
    for (const [token, value] of Object.entries(expected)) {
      assert.equal(tokenValue(token), value, `${token} maps to ${value}`);
    }
  });

  it('sizes the shared focus offset in rem', () => {
    assert.match(tokenValue('--cartouche-focus-offset') ?? '', /^\d*\.?\d+rem$/);
  });

  it('removes the unused input-focus tokens', () => {
    assert.equal(tokenValue('--cartouche-input-focus-border'), undefined);
    assert.equal(tokenValue('--cartouche-input-focus-ring'), undefined);
  });
});

describe('Global Focus Indicator rules in workbench.css (Ticket #317)', () => {
  it('gives text-entry controls a focus-colour border and a focus-ring halo', () => {
    const [rule] = rulesFor(`${TEXT_ENTRY}:focus-visible`);
    assert.ok(rule, 'text-entry :focus-visible rule exists');
    assert.equal(declaration(rule.body, 'border-color'), 'var(--cartouche-focus-color)');
    assert.equal(
      declaration(rule.body, 'box-shadow'),
      '0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-ring)'
    );
  });

  it('gives every other focusable element an outline ring', () => {
    const [rule] = rulesFor(':focus-visible');
    assert.ok(rule, 'global :focus-visible rule exists');
    assert.equal(
      declaration(rule.body, 'outline'),
      'var(--cartouche-focus-width) solid var(--cartouche-focus-color)'
    );
    assert.equal(declaration(rule.body, 'outline-offset'), 'var(--cartouche-focus-offset)');
  });

  it('applies the control accent globally', () => {
    const [rule] = rulesFor(':root');
    assert.ok(rule, ':root rule exists');
    assert.equal(declaration(rule.body, 'accent-color'), 'var(--cartouche-control-accent)');
    for (const r of parseRules(WORKBENCH_CSS)) {
      const accent = declaration(r.body, 'accent-color');
      if (accent !== undefined) {
        assert.equal(accent, 'var(--cartouche-control-accent)', `${r.selectors.join(', ')} accent-color`);
      }
    }
  });

  it('opts the map canvas out of the Focus Indicator', () => {
    const rules = parseRules(WORKBENCH_CSS).filter((r) =>
      MAP_CANVAS_OPT_OUT.every((s) => r.selectors.includes(s))
    );
    assert.equal(rules.length, 1, 'one map-canvas opt-out rule');
    assert.equal(declaration(rules[0].body, 'outline'), 'none');
  });

  it('draws an inset ring on the LayerTreeWidget container and the AttributeTableWidget body', () => {
    for (const selector of ['.layer-tree-container:focus-visible', '.table-scroll-wrapper:focus-visible']) {
      const [rule] = rulesFor(selector);
      assert.ok(rule, `${selector} rule exists`);
      assert.equal(declaration(rule.body, 'outline-offset'), 'calc(var(--cartouche-focus-width) * -1)');
    }
  });

  it('suppresses outlines nowhere outside the map-canvas allow-list', () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      const outline = declaration(r.body, 'outline');
      if (outline === 'none' || outline === '0') {
        assert.ok(
          r.selectors.every((s) => MAP_CANVAS_OPT_OUT.includes(s)),
          `outline: ${outline} on ${r.selectors.join(', ')}`
        );
      }
    }
  });

  it('keeps no per-component focus rules', () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      for (const s of r.selectors) {
        assert.doesNotMatch(s, /\.(preference-|picker-button|time-filter-)[^ ]*:focus/, `per-component focus rule ${s}`);
      }
    }
  });

  it('binds every :focus-visible rule only to the focus tokens and never uses bare :focus', () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      const focusSelectors = r.selectors.filter((s) => s.includes(':focus'));
      if (focusSelectors.length === 0) continue;
      // Selection colouring of a focused list box is not a focus indicator (Spec #316, Out of Scope).
      if (focusSelectors.every((s) => s.endsWith(':focus option:checked'))) continue;
      for (const s of focusSelectors) {
        assert.match(s, /:focus-visible/, `${s} uses :focus-visible`);
      }
      assert.doesNotMatch(r.body, /#[0-9a-f]{3,8}\b|rgba?\(/i, `${r.selectors.join(', ')} has a colour literal`);
      assert.doesNotMatch(r.body, /!important/, `${r.selectors.join(', ')} uses !important`);
      const invalid = r.selectors.some((s) => s.includes('aria-invalid') || s.includes('.cartouche-focus-invalid'));
      for (const [, token] of r.body.matchAll(/var\((--[a-z-]+)/g)) {
        const allowed = invalid
          ? /^--cartouche-focus-(invalid-color|invalid-ring|width|offset)$/
          : /^--cartouche-focus-(color|ring|width|offset)$/;
        assert.match(token, allowed, `${r.selectors.join(', ')} reads ${token}`);
      }
    }
  });
});

describe('Invalid Focus Indicator rules in workbench.css (Ticket #317)', () => {
  it('styles unfocused invalid controls from the invalid tokens', () => {
    const [fg] = rulesFor('[aria-invalid="true"]');
    assert.ok(fg, '[aria-invalid="true"] rule exists');
    assert.ok(fg.selectors.includes('.cartouche-focus-invalid'), '.cartouche-focus-invalid shares the invalid colour');
    assert.equal(declaration(fg.body, 'color'), 'var(--cartouche-invalid-fg)');
    const [border] = rulesFor(`${TEXT_ENTRY}[aria-invalid="true"]`);
    assert.ok(border, 'text-entry invalid border rule exists');
    assert.equal(declaration(border.body, 'border-color'), 'var(--cartouche-invalid-border)');
    for (const r of [fg, border]) {
      assert.doesNotMatch(r.body, /!important/);
    }
  });

  it('gives invalid text-entry controls the danger border and halo under :focus-visible', () => {
    const [rule] = rulesFor(`${TEXT_ENTRY}[aria-invalid="true"]:focus-visible`);
    assert.ok(rule, 'invalid text-entry :focus-visible rule exists');
    assert.equal(declaration(rule.body, 'border-color'), 'var(--cartouche-focus-invalid-color)');
    assert.equal(
      declaration(rule.body, 'box-shadow'),
      '0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-invalid-ring)'
    );
  });

  it('gives other invalid elements and .cartouche-focus-invalid a danger outline ring', () => {
    const [rule] = rulesFor('.cartouche-focus-invalid:focus-visible');
    assert.ok(rule, '.cartouche-focus-invalid:focus-visible rule exists');
    assert.ok(rule.selectors.includes('[aria-invalid="true"]:focus-visible'));
    assert.equal(
      declaration(rule.body, 'outline'),
      'var(--cartouche-focus-width) solid var(--cartouche-focus-invalid-color)'
    );
  });

  it('drops the !important .preference-input-invalid rule', () => {
    assert.equal(rulesFor('.preference-input-invalid').length, 0);
  });
});
