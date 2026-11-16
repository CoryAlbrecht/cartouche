/**
 * @file InlineFocusMigration.test.ts
 * @module tests/renderer/styles/InlineFocusMigration.test
 * @description Guardrail tests for Ticket #318 (Spec #316): focusable controls carry no inline `outline` or colour literals, their styling lives in workbench.css classes bound only to Tier 2 Component Tokens, and invalid state is expressed through `aria-invalid` / `.cartouche-focus-invalid` instead of `.preference-input-invalid` or inline danger colours.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
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

const ROOT = process.cwd();
const RENDERER_DIR = path.resolve(ROOT, 'src/renderer');
const THEME_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/themes/theme-default.css'), 'utf8');
const WORKBENCH_CSS = fs.readFileSync(path.resolve(RENDERER_DIR, 'styles/workbench.css'), 'utf8');

/**
 * Renderer sources whose focusable controls Ticket #318 migrates. `only`, when given, restricts the check to the opening tags it matches (LayerPropertiesDialog field-table cell editors, AttributeTableWidget cell editors).
 */
const MIGRATED_SOURCES: { file: string; only?: RegExp }[] = [
  { file: 'workbench/dialogs/LayerPropertiesDialog.tsx', only: /layer-field-cell-input/ },
  { file: 'workbench/widgets/AttributeTableWidget.tsx', only: /cell-editor-input/ },
  { file: 'workbench/dialogs/AddLayersDialog.tsx' },
  { file: 'components/common/TimeFilterControls.tsx' },
  { file: 'components/common/TimestampSpinner.tsx' },
  { file: 'workbench/widgets/LayerTreeWidget.tsx', only: /layer-tree-container/ },
  { file: 'components/common/ColorInput.tsx' },
];

/** A colour literal: hex, rgb()/rgba() or hsl()/hsla(). */
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

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
 * @description Decides whether a JSX opening tag renders a focusable control: a native form control or button, or any element with `tabIndex={0}`.
 * @param {string} tag - Opening tag text.
 * @returns {boolean} True when the element is focusable.
 */
function isFocusableTag(tag: string): boolean {
  return /^<(input|select|textarea|button)\b/.test(tag) || /tabIndex=\{\s*0\s*\}/.test(tag);
}

/**
 * @function inlineStyle
 * @description Returns the `style={{…}}` object text of a JSX opening tag, or an empty string.
 * @param {string} tag - Opening tag text.
 * @returns {string} The inline style object text.
 */
function inlineStyle(tag: string): string {
  const start = tag.indexOf('style={');
  if (start < 0) return '';
  let depth = 0;
  for (let i = start + 6; i < tag.length; i++) {
    if (tag[i] === '{') depth++;
    else if (tag[i] === '}' && --depth === 0) return tag.slice(start, i + 1);
  }
  return tag.slice(start);
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

/** Classes Ticket #318 introduces for the migrated controls. */
const MIGRATED_CLASSES = [
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
];

describe('Inline-styled focusable controls (Ticket #318)', () => {
  it('sets no inline outline anywhere in renderer TSX', () => {
    for (const file of listTsx(RENDERER_DIR)) {
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(!/\boutline\s*:\s*['"`]/.test(source), `${path.relative(ROOT, file)} sets an inline outline`);
    }
  });

  it('gives the migrated components\' focusable controls no inline colour literals or outline', () => {
    for (const { file: rel, only } of MIGRATED_SOURCES) {
      const source = fs.readFileSync(path.resolve(RENDERER_DIR, rel), 'utf8');
      const tags = openingTags(source).filter((tag) => isFocusableTag(tag) && (!only || only.test(tag)));
      assert.ok(tags.length > 0, `${rel} has focusable controls in scope`);
      for (const tag of tags) {
        const style = inlineStyle(tag);
        assert.doesNotMatch(style, COLOUR_LITERAL, `${rel}: ${tag.split('\n')[0]} has an inline colour literal`);
        assert.doesNotMatch(style, /\boutline\b/, `${rel}: ${tag.split('\n')[0]} has an inline outline`);
      }
    }
  });

  it('styles each migrated control from a workbench.css class bound only to Tier 2 Component Tokens (or UI sizing tokens), in rem', () => {
    const tier2 = tier2Tokens();
    for (const className of MIGRATED_CLASSES) {
      const bodies = ruleBodies(className);
      assert.ok(bodies.length > 0, `.${className} has a rule in workbench.css`);
      for (const body of bodies) {
        assert.doesNotMatch(body, COLOUR_LITERAL, `.${className} has a colour literal`);
        assert.doesNotMatch(body, /\boutline\s*:/, `.${className} sets an outline`);
        assert.doesNotMatch(body, /\d(?:px|pt)\b/, `.${className} uses px/pt units`);
        for (const [, token] of body.matchAll(/var\((--[a-z0-9-]+)/g)) {
          assert.ok(
            tier2.has(token) || token.startsWith('--cartouche-ui-'),
            `.${className} reads ${token}, which is not a Tier 2 Component Token or a UI sizing token`
          );
        }
      }
    }
  });
});

describe('Invalid state through aria-invalid and .cartouche-focus-invalid (Ticket #318)', () => {
  it('flags an invalid ColorInput with aria-invalid alone: no .preference-input-invalid, no inline danger colour', () => {
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

  it('leaves the error icon colour to the invalid tokens', () => {
    for (const body of ruleBodies('preference-input-error-icon')) {
      assert.equal(/(?:^|[;\s])color\s*:/.test(body), false, '.preference-input-error-icon sets no colour of its own');
    }
  });

  it('retires .preference-input-invalid from renderer TSX', () => {
    for (const file of listTsx(RENDERER_DIR)) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /preference-input-invalid/, path.relative(ROOT, file));
    }
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
