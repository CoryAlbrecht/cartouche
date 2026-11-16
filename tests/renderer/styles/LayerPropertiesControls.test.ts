/**
 * @file LayerPropertiesControls.test.ts
 * @module tests/renderer/styles/LayerPropertiesControls.test
 * @description Guardrail tests for Ticket #318 (Spec #316, expanded scope): every focusable control in the Layer Properties Dialog (and its New Field child dialog) carries no inline style, its styling lives in workbench.css classes bound only to Tier 2 Component Tokens in rem, and the Layer ID input expresses its invalid state through `aria-invalid`.
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
const DIALOG_SOURCE = fs.readFileSync(path.resolve(RENDERER_DIR, 'workbench/dialogs/LayerPropertiesDialog.tsx'), 'utf8');
const THEME_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/themes/theme-default.css'), 'utf8');
const WORKBENCH_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/workbench.css'), 'utf8');

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
 * @description Decides whether a JSX opening tag renders a focusable control: a native form control or button, an element with `tabIndex`, or an interactive ARIA role.
 * @param {string} tag - Opening tag text.
 * @returns {boolean} True when the element is focusable.
 */
function isFocusableTag(tag: string): boolean {
  return (
    /^<(input|select|textarea|button)\b/.test(tag) ||
    /\btabIndex=/.test(tag) ||
    /\brole=['"](button|tab|checkbox|radio|switch|option|menuitem|link|slider|spinbutton)['"]/.test(tag)
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

/** Classes that style the Layer Properties Dialog's focusable controls. */
const CONTROL_CLASSES = [
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

describe('Layer Properties Dialog focusable controls (Ticket #318, expanded scope)', () => {
  const focusable = openingTags(DIALOG_SOURCE).filter(isFocusableTag);

  it('finds the dialog\'s focusable controls', () => {
    assert.ok(focusable.length >= 20, `expected the dialog's buttons, inputs and selects, found ${focusable.length}`);
  });

  it('gives every focusable control no inline style and no colour literal', () => {
    for (const tag of focusable) {
      const head = tag.split('\n').slice(0, 3).join(' ').trim();
      assert.doesNotMatch(tag, /\bstyle=\{/, `${head} still has an inline style`);
      assert.doesNotMatch(tag, COLOUR_LITERAL, `${head} has a colour literal`);
    }
  });

  it('gives every focusable control a class', () => {
    for (const tag of focusable) {
      if (/type=['"]checkbox['"]/.test(tag)) continue;
      assert.match(tag, /\bclassName=/, `${tag.split('\n')[0]} has no class`);
    }
  });

  it('styles the controls from workbench.css classes bound only to Tier 2 Component Tokens, in rem', () => {
    const tier2 = tier2Tokens();
    for (const className of CONTROL_CLASSES) {
      const bodies = ruleBodies(className);
      assert.ok(bodies.length > 0, `.${className} has a rule in workbench.css`);
      for (const body of bodies) {
        assert.doesNotMatch(body, COLOUR_LITERAL, `.${className} has a colour literal`);
        assert.doesNotMatch(body, /\boutline\s*:/, `.${className} sets an outline`);
        assert.doesNotMatch(body, /\d(?:px|pt)\b/, `.${className} uses px/pt units`);
        for (const [, token] of body.matchAll(/var\((--[a-z0-9-]+)/g)) {
          assert.ok(tier2.has(token), `.${className} reads ${token}, which is not a Tier 2 Component Token`);
        }
      }
    }
  });

  it('flags an invalid Layer ID through aria-invalid rather than an inline danger border', () => {
    const idInput = openingTags(DIALOG_SOURCE).find((tag) => /id=['"]layer-prop-id['"]/.test(tag));
    assert.ok(idInput, 'Layer ID input exists');
    assert.match(idInput, /aria-invalid=\{/);
  });
});
