/**
 * @file FocusIndicator.test.ts
 * @module tests/renderer/styles/FocusIndicator.test
 * @description Guardrail tests for the stylesheet side of the Theme-bound Focus Indicator and Invalid Focus Indicator (Spec #316, Tickets #317 / #318 / #319): the Tier 1 / Tier 2 focus, invalid-state and control-accent tokens in theme-default.css; the single global :focus-visible / aria-invalid rule set in workbench.css that replaces the scattered per-component focus styling; the map-canvas-only outline suppression; the invalid-state rules reading only the invalid tokens; and the workbench.css classes of the migrated focusable controls reading only Tier 2 Component Tokens, in rem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see FocusableControlStyling.test.ts
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

/**
 * @function suppressesOutline
 * @description Decides whether a declaration block hides the outline: `outline: none | 0`, `outline-style: none | hidden`, `outline-width: 0` or `outline-color: transparent`.
 * @param {string} body - Declaration block.
 * @returns {boolean} True when the block suppresses the outline.
 */
function suppressesOutline(body: string): boolean {
  return (
    /^(?:none|0)\b/.test(declaration(body, 'outline') ?? '') ||
    /^(?:none|hidden)\b/.test(declaration(body, 'outline-style') ?? '') ||
    /^0\b/.test(declaration(body, 'outline-width') ?? '') ||
    /^transparent\b/.test(declaration(body, 'outline-color') ?? '')
  );
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
    const offenders = parseRules(WORKBENCH_CSS)
      .filter((r) => suppressesOutline(r.body) && !r.selectors.every((s) => MAP_CANVAS_OPT_OUT.includes(s)))
      .map((r) => r.selectors.join(', '));
    assert.deepEqual(offenders, []);
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

describe('Invalid-state rules read only the invalid tokens (Ticket #319)', () => {
  it('binds every invalid-state and invalid-focus rule only to the invalid and shared focus tokens', () => {
    const invalidRules = parseRules(WORKBENCH_CSS).filter((r) => r.selectors.some((s) => /invalid/i.test(s)));
    assert.ok(invalidRules.length >= 4, 'the invalid-state and invalid-focus rules exist');
    for (const r of invalidRules) {
      const where = r.selectors.join(', ');
      assert.doesNotMatch(r.body, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i, `${where} has a colour literal`);
      assert.doesNotMatch(r.body, /!important/, `${where} uses !important`);
      for (const [, token] of r.body.matchAll(/var\((--[a-z0-9-]+)/g)) {
        assert.match(
          token,
          /^--cartouche-(?:focus-invalid-(?:color|ring)|invalid-(?:fg|border)|focus-(?:width|offset))$/,
          `${where} reads ${token}`
        );
      }
    }
  });

  it('keeps the invalid tokens out of every rule that is not an invalid-state rule', () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      if (r.selectors.some((s) => /invalid/i.test(s))) continue;
      assert.doesNotMatch(
        r.body,
        /var\(--cartouche-(?:focus-invalid-|invalid-)/,
        `${r.selectors.join(', ')} reads an invalid token without an invalid-state selector`
      );
    }
  });

  it('leaves the ColorInput error icon colour to the invalid tokens', () => {
    const rules = parseRules(WORKBENCH_CSS).filter((r) => r.selectors.some((s) => s.includes('.preference-input-error-icon')));
    assert.ok(rules.length > 0, '.preference-input-error-icon has a rule');
    for (const r of rules) {
      assert.equal(declaration(r.body, 'color'), undefined, '.preference-input-error-icon sets no colour of its own');
    }
  });
});

/**
 * @function tier2Tokens
 * @description Collects the Tier 2 Component Tokens declared in theme-default.css (every custom property after the Tier 2 banner).
 * @returns {Set<string>} Tier 2 token names.
 */
function tier2Tokens(): Set<string> {
  const tier2 = THEME_CSS.slice(THEME_CSS.indexOf('Tier 2: Component Tokens'));
  return new Set([...tier2.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/**
 * @function assertTokenBound
 * @description Asserts that a declaration block sets no outline and no px/pt length, and reads only Tier 2 Component Tokens, UI sizing tokens (`--cartouche-ui-*`) or font family primitives, so its colours come from the theme's Component Tokens.
 * @param {string} body - Declaration block.
 * @param {string} where - Rule label for assertion messages.
 * @param {Set<string>} tier2 - Tier 2 Component Token names.
 * @returns {void}
 */
function assertTokenBound(body: string, where: string, tier2: Set<string>): void {
  assert.doesNotMatch(body, /\boutline\s*:/, `${where} sets an outline`);
  assert.doesNotMatch(body, /\d(?:px|pt)\b/, `${where} uses px/pt units`);
  for (const [, token] of body.matchAll(/var\((--[a-z0-9-]+)/g)) {
    assert.ok(
      tier2.has(token) || token.startsWith('--cartouche-ui-') || token.startsWith('--cartouche-theme-font-family'),
      `${where} reads ${token}, which is not a Tier 2 Component Token, a UI sizing token or a font family`
    );
  }
}

/** The workbench.css classes that style the focusable controls migrated off inline styles (Ticket #318). */
const MIGRATED_CONTROL_CLASSES = [
  // Table cell editors, Add Layers Dialog, Time Filter controls, TimestampSpinner, LayerTreeWidget.
  'layer-field-cell-input',
  'cell-editor-input',
  'add-layers-btn',
  'add-layers-btn-primary',
  'add-layers-btn-secondary',
  'add-layers-btn-browse',
  'add-layers-chip-remove',
  'add-layers-chip-input',
  'add-layers-path-input',
  'time-filter-step-input',
  'time-filter-step-arrow',
  'time-filter-unit-select',
  'timestamp-spinner-segment',
  'layer-tree-container',
  // Styling editors: SimpleModeEditor, StyleEditor, DashPatternSelect.
  'styling-editor-field',
  'styling-editor-number',
  'styling-editor-angle',
  'styling-editor-dash-cell',
  'styling-editor-icon-btn',
  'styling-editor-format-select',
  'styling-editor-secondary-btn',
  'layer-prop-layer-opacity',
  'layer-prop-styling-raw-style',
  'dash-pattern-select-trigger',
  'dash-pattern-select-listbox',
  'dash-pattern-select-option',
  'dash-pattern-select-caret',
  // Layer Properties Dialog and its New Field dialog.
  'layer-properties-btn',
  'new-field-dialog-btn',
  'layer-prop-btn-primary',
  'layer-prop-btn-secondary',
  'layer-prop-input',
  'layer-prop-textarea',
  'layer-prop-time-field-select',
  'layer-prop-op-toggle',
  'layer-prop-toolbar-btn',
  'layer-field-type-select',
  'layer-field-reset-type-btn',
];

describe('Migrated focusable controls\' workbench.css classes (Ticket #318)', () => {
  it('styles each migrated control from a workbench.css class bound only to Tier 2 Component Tokens, in rem', () => {
    const tier2 = tier2Tokens();
    for (const className of MIGRATED_CONTROL_CLASSES) {
      const pattern = new RegExp(`\\.${className}(?![\\w-])`);
      const rules = parseRules(WORKBENCH_CSS).filter((r) => r.selectors.some((s) => pattern.test(s)));
      assert.ok(rules.length > 0, `.${className} has a rule in workbench.css`);
      for (const r of rules) assertTokenBound(r.body, `.${className}`, tier2);
    }
  });

  it('binds the Remaining renderer controls section only to Tier 2 Component Tokens, in rem', () => {
    const start = WORKBENCH_CSS.indexOf('/* === Remaining renderer controls (Spec #316 / #318) === */');
    const end = WORKBENCH_CSS.indexOf('Focus Indicator & Invalid Focus Indicator');
    assert.ok(start >= 0, 'workbench.css has the Remaining renderer controls section');
    assert.ok(start < end, 'the section sits before the Focus Indicator section');
    const rules = parseRules(WORKBENCH_CSS.slice(start, end));
    assert.ok(rules.length > 0, 'the section has rules');
    const tier2 = tier2Tokens();
    for (const r of rules) assertTokenBound(r.body, r.selectors.join(', '), tier2);
  });

  it('maps every Tier 2 token added for the migrated controls to a Tier 1 primitive', () => {
    const start = THEME_CSS.indexOf('/* Styling editor controls (#318) */');
    assert.ok(start >= 0, 'theme-default.css has the #318 token blocks');
    for (const header of ['/* Layer Properties Dialog controls (#318) */', '/* Remaining renderer controls (#318) */']) {
      assert.ok(THEME_CSS.indexOf(header) > start, `${header} follows the styling editor block`);
    }
    const blocks = THEME_CSS.slice(start, THEME_CSS.indexOf('}', start)).replace(/\/\*[\s\S]*?\*\//g, '');
    const decls = [...blocks.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)];
    assert.ok(decls.length >= 30, `the blocks declare the migrated controls' tokens, found ${decls.length}`);
    for (const [, name, value] of decls) {
      assert.match(value.trim(), /^var\(--cartouche-theme-[a-z0-9-]+\)$/, `${name} maps to a Tier 1 primitive`);
    }
  });
});
