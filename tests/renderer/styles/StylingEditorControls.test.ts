/**
 * @file StylingEditorControls.test.ts
 * @module tests/renderer/styles/StylingEditorControls.test
 * @description Guardrail tests for the expanded scope of Ticket #318 (Spec #316) in the styling editors: the focusable controls of SimpleModeEditor, StyleEditor and DashPatternSelect carry no inline `style={{…}}` (and so no inline colour literals), and the workbench.css classes that now style them are bound only to Tier 2 Component Tokens, in rem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RENDERER_DIR = path.resolve(ROOT, 'src/renderer');
const THEME_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/themes/theme-default.css'), 'utf8');
const WORKBENCH_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/workbench.css'), 'utf8');

/** The styling editor sources whose focusable controls this guardrail covers. */
const SOURCES = [
  'workbench/dialogs/SimpleModeEditor.tsx',
  'workbench/dialogs/StyleEditor.tsx',
  'workbench/dialogs/DashPatternSelect.tsx',
];

/** The workbench.css classes that style those controls. */
const CLASSES = [
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
];

/** A colour literal: hex, rgb()/rgba() or hsl()/hsla(). */
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

/**
 * @function openingTags
 * @description Extracts every JSX opening tag (from `<` to its closing `>` at brace depth 0) in a TSX source.
 * @param {string} source - TSX source text.
 * @returns {string[]} Opening tag texts.
 */
function openingTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/<([a-zA-Z][\w.]*)[\s>]/g)) {
    let depth = 0;
    let end = match.index + 1;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    tags.push(source.slice(match.index, end + 1));
  }
  return tags;
}

/**
 * @function isFocusableTag
 * @description Decides whether a JSX opening tag renders a focusable or interactive control: a native form control or button, an element with a `tabIndex`, or an element carrying an interactive ARIA role.
 * @param {string} tag - Opening tag text.
 * @returns {boolean} True when the element is in scope.
 */
function isFocusableTag(tag: string): boolean {
  return (
    /^<(input|select|textarea|button)\b/.test(tag) ||
    /\btabIndex=/.test(tag) ||
    /\brole=['"{](?:button|option|listbox|checkbox|radio|tab|menuitem|slider|spinbutton|switch)/.test(tag)
  );
}

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
 * @function ruleBodies
 * @description Returns the declaration blocks of every workbench.css rule whose selector list mentions the class.
 * @param {string} className - Class name without the leading dot.
 * @returns {string[]} Declaration blocks.
 */
function ruleBodies(className: string): string[] {
  const stripped = WORKBENCH_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => new RegExp(`\\.${className}(?![\\w-])`).test(m[1]))
    .map((m) => m[2]);
}

describe('Styling editor controls (Ticket #318, expanded scope)', () => {
  it('gives every focusable control in the styling editors no inline style, and so no inline colour literal', () => {
    for (const rel of SOURCES) {
      const tags = openingTags(fs.readFileSync(path.resolve(RENDERER_DIR, rel), 'utf8')).filter(isFocusableTag);
      assert.ok(tags.length > 0, `${rel} has focusable controls in scope`);
      for (const tag of tags) {
        assert.doesNotMatch(tag, /\bstyle=\{/, `${rel}: ${tag.split('\n')[0]} still has an inline style`);
        assert.doesNotMatch(tag, COLOUR_LITERAL, `${rel}: ${tag.split('\n')[0]} has a colour literal`);
      }
    }
  });

  it('applies a styling editor class to every focusable control', () => {
    for (const rel of SOURCES) {
      const tags = openingTags(fs.readFileSync(path.resolve(RENDERER_DIR, rel), 'utf8')).filter(isFocusableTag);
      for (const tag of tags) {
        assert.ok(
          CLASSES.some((cls) => new RegExp(`${cls}(?![\\w-])`).test(tag)),
          `${rel}: ${tag.split('\n')[0]} carries none of the styling editor classes`
        );
      }
    }
  });

  it('binds each styling editor class only to Tier 2 Component Tokens (or UI sizing / font family tokens), with no colour literal, outline or px/pt unit', () => {
    const tier2 = tier2Tokens();
    for (const className of CLASSES) {
      const bodies = ruleBodies(className);
      assert.ok(bodies.length > 0, `.${className} has a rule in workbench.css`);
      for (const body of bodies) {
        assert.doesNotMatch(body, COLOUR_LITERAL, `.${className} has a colour literal`);
        assert.doesNotMatch(body, /\boutline\s*:/, `.${className} sets an outline`);
        assert.doesNotMatch(body, /\d(?:px|pt)\b/, `.${className} uses px/pt units`);
        for (const [, token] of body.matchAll(/var\((--[a-z0-9-]+)/g)) {
          assert.ok(
            tier2.has(token) || token.startsWith('--cartouche-ui-') || token.startsWith('--cartouche-theme-font-family'),
            `.${className} reads ${token}, which is not a Tier 2 Component Token, a UI sizing token or a font family`
          );
        }
      }
    }
  });

  it('maps the new styling editor tokens to Tier 1 primitives', () => {
    const block = THEME_CSS.slice(THEME_CSS.indexOf('/* Styling editor controls (#318) */'));
    assert.ok(THEME_CSS.includes('/* Styling editor controls (#318) */'), 'theme-default.css has the styling editor token block');
    const decls = [...block.slice(0, block.indexOf('\n\n')).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)];
    assert.ok(decls.length > 0, 'the block declares tokens');
    for (const [, name, value] of decls) {
      assert.match(value.trim(), /^var\(--cartouche-theme-[a-z0-9-]+\)$/, `${name} maps to a Tier 1 primitive`);
    }
  });
});
