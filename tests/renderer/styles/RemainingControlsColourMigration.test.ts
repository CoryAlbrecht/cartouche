/**
 * @file RemainingControlsColourMigration.test.ts
 * @module tests/renderer/styles/RemainingControlsColourMigration.test
 * @description Guardrail tests for the expanded scope of Ticket #318 (Spec #316): every focusable control in renderer TSX carries no inline colour (no colour literal, no inline theme token), so its colours live in workbench.css classes bound only to Tier 2 Component Tokens and the global Focus Indicator reaches it. Data-driven colours (user-chosen swatches, preference-driven log colours) are expressions, not literals, and stay inline.
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

/** A colour literal: hex, rgb()/rgba() or hsl()/hsla(). */
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

/** An inline theme token other than the UI sizing tokens (`--cartouche-ui-*`). */
const INLINE_THEME_TOKEN = /var\(--(?:cartouche-(?!ui-)|dockview-)/;

/** ARIA roles that make an element an interactive, focusable control. */
const INTERACTIVE_ROLE = /\brole=["'{]\s*["']?(?:button|tab|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|radio|switch|slider|link|treeitem|gridcell|spinbutton|combobox|textbox|searchbox|listbox)["']/;

/**
 * @function listTsx
 * @description Recursively lists every `.tsx` file under a directory.
 * @param {string} dir - Directory to walk.
 * @returns {string[]} Absolute file paths.
 */
function listTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsx(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

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
 * @description Decides whether a JSX opening tag renders a focusable control: a native form control or button, an element with a `tabIndex`, or an element with an interactive ARIA role.
 * @param {string} tag - Opening tag text.
 * @returns {boolean} True when the element is focusable.
 */
function isFocusableTag(tag: string): boolean {
  return /^<(input|select|textarea|button)\b/.test(tag) || /\btabIndex=/.test(tag) || INTERACTIVE_ROLE.test(tag);
}

/**
 * @function balancedFrom
 * @description Returns the text from an opening brace to its matching closing brace.
 * @param {string} text - Text to scan.
 * @param {number} open - Index of the opening brace.
 * @returns {string} The balanced block, or the rest of the text when unbalanced.
 */
function balancedFrom(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/**
 * @function inlineStyle
 * @description Returns the `style={…}` expression of a JSX opening tag with every module-level style constant it names (`style={X}` or `...X`) appended, so shared style objects are checked too.
 * @param {string} tag - Opening tag text.
 * @param {string} source - Whole TSX source, for resolving style constants.
 * @returns {string} The inline style text, or an empty string.
 */
function inlineStyle(tag: string, source: string): string {
  const start = tag.indexOf('style={');
  if (start < 0) return '';
  const style = balancedFrom(tag, start + 6);
  const resolved = [...style.matchAll(/(?:^\{|\.\.\.)\s*([A-Z][A-Z0-9_]*)\b/g)].map(([, name]) => {
    const decl = source.search(new RegExp(`const ${name}\\b[^=]*=\\s*\\{`));
    return decl < 0 ? '' : balancedFrom(source, source.indexOf('{', source.indexOf('=', decl)));
  });
  return [style, ...resolved].join('\n');
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
 * @function sectionCss
 * @description Returns the workbench.css text of the "Remaining renderer controls" section, without comments.
 * @returns {string} Section CSS.
 */
function sectionCss(): string {
  const start = WORKBENCH_CSS.indexOf('/* === Remaining renderer controls (Spec #316 / #318) === */');
  const end = WORKBENCH_CSS.indexOf('Focus Indicator & Invalid Focus Indicator');
  assert.ok(start >= 0, 'workbench.css has the Remaining renderer controls section');
  assert.ok(start < end, 'the section sits before the Focus Indicator section');
  return WORKBENCH_CSS.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('Remaining renderer focusable controls (Ticket #318, expanded scope)', () => {
  it('gives every focusable control in renderer TSX no inline colour literal or inline theme token', () => {
    const offenders: string[] = [];
    for (const file of listTsx(RENDERER_DIR)) {
      const rel = path.relative(RENDERER_DIR, file);
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of openingTags(source).filter(isFocusableTag)) {
        const style = inlineStyle(tag, source);
        if (COLOUR_LITERAL.test(style) || INLINE_THEME_TOKEN.test(style)) {
          offenders.push(`${rel}: ${tag.split('\n')[0].trim()} ${tag.match(/className=\S+/)?.[0] ?? ''}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('binds the new workbench.css section only to Tier 2 Component Tokens or UI sizing tokens, in rem', () => {
    const css = sectionCss();
    const tier2 = tier2Tokens();
    assert.match(css, /\{[^}]+\}/, 'the section has rules');
    assert.doesNotMatch(css, COLOUR_LITERAL, 'no colour literals');
    assert.doesNotMatch(css, /\boutline\s*:/, 'no outline overrides');
    assert.doesNotMatch(css, /\d(?:px|pt)\b/, 'no px/pt units');
    for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
      assert.ok(
        tier2.has(token) || token.startsWith('--cartouche-ui-'),
        `${token} is not a Tier 2 Component Token or a UI sizing token`
      );
    }
  });

  it('maps every new Tier 2 token in the #318 block to a Tier 1 primitive', () => {
    const start = THEME_CSS.indexOf('/* Remaining renderer controls (#318) */');
    assert.ok(start >= 0, 'theme-default.css has the Remaining renderer controls token block');
    const block = THEME_CSS.slice(start, THEME_CSS.indexOf('\n\n', start));
    const decls = [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)];
    assert.ok(decls.length > 0, 'the block declares tokens');
    for (const [, name, value] of decls) {
      assert.match(value.trim(), /^var\(--cartouche-theme-[a-z0-9-]+\)$/, `${name} maps to a Tier 1 primitive`);
    }
  });
});
