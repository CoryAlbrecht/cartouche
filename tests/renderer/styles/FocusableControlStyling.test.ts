/**
 * @file FocusableControlStyling.test.ts
 * @module tests/renderer/styles/FocusableControlStyling.test
 * @description Guardrail tests for the renderer TSX side of the Theme-bound Focus Indicator and Invalid Focus Indicator (Spec #316, Tickets #318 / #319): no renderer TSX sets an inline outline, no focusable control carries an inline colour (colour literal or inline theme token), invalid state is never coloured inline and is expressed only through `aria-invalid` / `.cartouche-focus-invalid`, and the migrated controls carry the classes that the workbench.css guardrails in FocusIndicator.test.ts bind to Tier 2 Component Tokens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see FocusIndicator.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);
const React = jiti('react') as typeof import('react');
const { renderToStaticMarkup } = jiti('react-dom/server') as typeof import('react-dom/server');
const { ColorInput } = jiti('@renderer/components/common/ColorInput') as typeof import('@renderer/components/common/ColorInput');
const { TimestampSpinner } = jiti('@renderer/components/common/TimestampSpinner') as typeof import('@renderer/components/common/TimestampSpinner');

const RENDERER_DIR = path.resolve(process.cwd(), 'src/renderer');

/** A colour literal: hex, rgb()/rgba() or hsl()/hsla(). */
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

/** An inline theme token other than the UI sizing tokens (`--cartouche-ui-*`). */
const INLINE_THEME_TOKEN = /var\(--(?:cartouche-(?!ui-)|dockview-)/;

/** A token that carries invalid-state colour: the danger primitives and the invalid Component Tokens. */
const INVALID_COLOUR_TOKEN = /--cartouche-(?:theme-danger|invalid-|focus-invalid-)/;

/** An inline style property that paints colour. */
const COLOUR_PROPERTY = /\b(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|boxShadow|outline(?:Color)?|fill|stroke)\s*:/;

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

/** Every renderer TSX source, keyed by its path relative to `src/renderer`. */
const SOURCES = new Map(listTsx(RENDERER_DIR).map((file) => [path.relative(RENDERER_DIR, file), fs.readFileSync(file, 'utf8')]));

/**
 * @function source
 * @description Returns one renderer TSX source.
 * @param {string} rel - Path relative to `src/renderer`.
 * @returns {string} Source text.
 */
function source(rel: string): string {
  const text = SOURCES.get(rel);
  assert.ok(text !== undefined, `${rel} exists`);
  return text;
}

/**
 * @function openingTags
 * @description Extracts every JSX opening tag (from `<` to its closing `>` at brace depth 0) in a TSX source.
 * @param {string} text - TSX source text.
 * @returns {string[]} Opening tag texts.
 */
function openingTags(text: string): string[] {
  const tags: string[] = [];
  for (const match of text.matchAll(/<([a-zA-Z][\w.]*)[\s>]/g)) {
    let depth = 0;
    let end = match.index + 1;
    for (; end < text.length; end++) {
      const ch = text[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && text[end - 1] !== '=') break;
    }
    tags.push(text.slice(match.index, end + 1));
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
 * @function focusableTags
 * @description Returns the focusable control opening tags of one renderer TSX source.
 * @param {string} rel - Path relative to `src/renderer`.
 * @returns {string[]} Opening tag texts.
 */
function focusableTags(rel: string): string[] {
  return openingTags(source(rel)).filter(isFocusableTag);
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
 * @param {string} text - Whole TSX source, for resolving style constants.
 * @returns {string} The inline style text, or an empty string.
 */
function inlineStyle(tag: string, text: string): string {
  const start = tag.indexOf('style={');
  if (start < 0) return '';
  const style = balancedFrom(tag, start + 6);
  const resolved = [...style.matchAll(/(?:^\{|\.\.\.)\s*([A-Z][A-Z0-9_]*)\b/g)].map(([, name]) => {
    const decl = text.search(new RegExp(`const ${name}\\b[^=]*=\\s*\\{`));
    return decl < 0 ? '' : balancedFrom(text, text.indexOf('{', text.indexOf('=', decl)));
  });
  return [style, ...resolved].join('\n');
}

/**
 * @function head
 * @description Shortens an opening tag to its first line for assertion messages.
 * @param {string} tag - Opening tag text.
 * @returns {string} First line of the tag plus its class, if any.
 */
function head(tag: string): string {
  return `${tag.split('\n')[0].trim()} ${tag.match(/className=\S+/)?.[0] ?? ''}`.trim();
}

/** The styling editor sources: their focusable controls carry no inline style at all and one of {@link STYLING_EDITOR_CLASSES}. */
const STYLING_EDITOR_SOURCES = [
  'workbench/dialogs/SimpleModeEditor.tsx',
  'workbench/dialogs/StyleEditor.tsx',
  'workbench/dialogs/DashPatternSelect.tsx',
];

/** The classes that style the styling editors' focusable controls. */
const STYLING_EDITOR_CLASSES = [
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

const LAYER_PROPERTIES_DIALOG = 'workbench/dialogs/LayerPropertiesDialog.tsx';

describe('Inline focus and colour styling in renderer TSX (Spec #316)', () => {
  it('sets no inline outline anywhere in renderer TSX', () => {
    const offenders = [...SOURCES]
      .filter(([, text]) => /\boutline(?:Color|Style|Width|Offset)?\s*:/.test(text))
      .map(([rel]) => rel);
    assert.deepEqual(offenders, []);
  });

  it('paints no primary-coloured surface inline, so its Focus Indicator re-scope lives in workbench.css', () => {
    const offenders: string[] = [];
    for (const [rel, text] of SOURCES) {
      for (const tag of openingTags(text)) {
        if (/\bbackground(?:Color)?\s*:\s*['"]var\(--cartouche-(?:menubar-bg|theme-status-bar-bg)\b/.test(inlineStyle(tag, text))) {
          offenders.push(`${rel}: ${head(tag)}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('gives every focusable control no inline colour literal or inline theme token', () => {
    const offenders: string[] = [];
    for (const [rel, text] of SOURCES) {
      for (const tag of openingTags(text).filter(isFocusableTag)) {
        const style = inlineStyle(tag, text);
        if (COLOUR_LITERAL.test(style) || INLINE_THEME_TOKEN.test(style)) offenders.push(`${rel}: ${head(tag)}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('gives the styling editors\' and the Layer Properties Dialog\'s focusable controls no inline style at all', () => {
    for (const rel of [...STYLING_EDITOR_SOURCES, LAYER_PROPERTIES_DIALOG]) {
      const tags = focusableTags(rel);
      assert.ok(tags.length > 0, `${rel} has focusable controls in scope`);
      for (const tag of tags) {
        assert.doesNotMatch(tag, /\bstyle=\{/, `${rel}: ${head(tag)} still has an inline style`);
      }
    }
  });

  it('applies a styling editor class to every focusable control in the styling editors', () => {
    for (const rel of STYLING_EDITOR_SOURCES) {
      for (const tag of focusableTags(rel)) {
        assert.ok(
          STYLING_EDITOR_CLASSES.some((cls) => new RegExp(`${cls}(?![\\w-])`).test(tag)),
          `${rel}: ${head(tag)} carries none of the styling editor classes`
        );
      }
    }
  });

  it('gives every non-checkbox focusable control in the Layer Properties Dialog a class', () => {
    const tags = focusableTags(LAYER_PROPERTIES_DIALOG);
    assert.ok(tags.length >= 20, `expected the dialog's buttons, inputs and selects, found ${tags.length}`);
    for (const tag of tags) {
      if (/type=['"]checkbox['"]/.test(tag)) continue;
      assert.match(tag, /\bclassName=/, `${head(tag)} has no class`);
    }
  });
});

describe('Invalid state in renderer TSX (Spec #316)', () => {
  it('colours invalid state inline nowhere: no inline style reads a danger or invalid token, and no inline colour depends on validity', () => {
    const offenders: string[] = [];
    for (const [rel, text] of SOURCES) {
      for (const tag of openingTags(text)) {
        const style = inlineStyle(tag, text);
        if (!style) continue;
        const colours = COLOUR_LITERAL.test(style) || INLINE_THEME_TOKEN.test(style);
        if (
          INVALID_COLOUR_TOKEN.test(style) ||
          (colours && /invalid|isValid|\bvalid\b|error/i.test(style)) ||
          (/\baria-invalid=/.test(tag) && COLOUR_PROPERTY.test(style))
        ) {
          offenders.push(`${rel}: ${head(tag)}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('marks invalid state with no class of its own beyond .cartouche-focus-invalid', () => {
    const offenders: string[] = [];
    for (const [rel, text] of SOURCES) {
      if (text.includes('preference-input-invalid')) offenders.push(`${rel}: retired .preference-input-invalid`);
      for (const tag of openingTags(text)) {
        const start = tag.indexOf('className=');
        if (start < 0) continue;
        const value =
          tag[start + 10] === '{' ? balancedFrom(tag, start + 10) : tag.slice(start + 10).match(/^(['"]).*?\1/)?.[0] ?? '';
        for (const [cls] of value.matchAll(/[\w-]*invalid[\w-]*/gi)) {
          if (cls !== 'cartouche-focus-invalid' && /-/.test(cls)) offenders.push(`${rel}: .${cls}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('flags an invalid ColorInput with aria-invalid alone: no invalid class, no inline danger colour', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, { value: 'not-a-colour', ariaLabel: 'Line Colour', onChange: () => {} })
    );
    assert.match(html, /aria-invalid="true"/);
    assert.doesNotMatch(html, /preference-input-invalid/);
    assert.doesNotMatch(html, /color:var\(--cartouche-theme-danger\)/);
  });

  it('opts the ColorInput error icon into the Invalid Focus Indicator', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, { value: 'not-a-colour', ariaLabel: 'Line Colour', onChange: () => {} })
    );
    assert.match(html, /class="preference-input-error-icon cartouche-focus-invalid"/);
  });

  it('flags an invalid Layer ID through aria-invalid rather than an inline danger border', () => {
    const idInput = openingTags(source(LAYER_PROPERTIES_DIALOG)).find((tag) => /id=['"]layer-prop-id['"]/.test(tag));
    assert.ok(idInput, 'Layer ID input exists');
    assert.match(idInput, /aria-invalid=\{/);
  });
});

describe('TimestampSpinner segment classes (Ticket #318)', () => {
  it('renders each segment input with the segment class and the year segment with its wide modifier', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimestampSpinner, { value: Date.UTC(2024, 0, 2, 3, 4, 5), onChange: () => {} })
    );
    const segments = [...html.matchAll(/<input[^>]*data-segment="(\w+)"[^>]*>/g)];
    assert.equal(segments.length, 6);
    for (const [tag, seg] of segments) {
      assert.match(tag, /class="timestamp-spinner-segment[ "]/, `${seg} segment class`);
      assert.equal(/timestamp-spinner-segment-year/.test(tag), seg === 'year', `${seg} year modifier`);
    }
  });
});
