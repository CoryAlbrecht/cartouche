/**
 * @file cssRules.ts
 * @module tests/renderer/styles/cssRules
 * @description Shared CSS-rule helpers for the stylesheet guardrail tests: loads theme-default.css and workbench.css, splits a flat stylesheet into rules, splits selector lists, and reads declarations and custom property values.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see FocusIndicator.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';

/** Text of the canonical default theme stylesheet. */
export const THEME_CSS = fs.readFileSync(
  path.resolve(process.cwd(), 'src/renderer/styles/themes/theme-default.css'),
  'utf8'
);

/** Text of the structural workbench stylesheet. */
export const WORKBENCH_CSS = fs.readFileSync(
  path.resolve(process.cwd(), 'src/renderer/styles/workbench.css'),
  'utf8'
);

/**
 * @typedef {Object} CssRule
 * @property {string[]} selectors - Comma-separated selectors of the rule, trimmed.
 * @property {string} body - Declaration block between the braces.
 */
export interface CssRule {
  selectors: string[];
  body: string;
}

/**
 * @function splitSelectors
 * @description Splits a selector list on top-level commas, keeping commas inside `:is()` / `:not()` together.
 * @param {string} list - Selector list text.
 * @returns {string[]} Normalised selectors.
 */
export function splitSelectors(list: string): string[] {
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
 * @function parseRules
 * @description Splits a flat stylesheet (no at-rule blocks) into rules, ignoring comments and `@import` lines.
 * @param {string} css - Stylesheet text.
 * @returns {CssRule[]} Parsed rules.
 */
export function parseRules(css: string): CssRule[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '');
  const rules: CssRule[] = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selectors: splitSelectors(match[1]), body: match[2] });
  }
  return rules;
}

/**
 * @function declaration
 * @description Reads one property's value from a declaration block.
 * @param {string} body - Declaration block.
 * @param {string} property - Property name.
 * @returns {string | undefined} The trimmed value, or undefined when absent.
 */
export function declaration(body: string, property: string): string | undefined {
  const match = body.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`));
  return match ? match[1].trim() : undefined;
}

/**
 * @function rulesFor
 * @description Finds every workbench.css rule whose selector list contains the given selector.
 * @param {string} selector - Exact selector text (whitespace-normalised).
 * @returns {CssRule[]} Matching rules.
 */
export function rulesFor(selector: string): CssRule[] {
  return parseRules(WORKBENCH_CSS).filter((r) => r.selectors.includes(selector));
}

/**
 * @function tokenValue
 * @description Reads a custom property's value from theme-default.css.
 * @param {string} token - Custom property name.
 * @returns {string | undefined} The trimmed value, or undefined when not defined.
 */
export function tokenValue(token: string): string | undefined {
  const match = THEME_CSS.match(new RegExp(`${token}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : undefined;
}

/**
 * @function tier2Tokens
 * @description Collects the Tier 2 Component Tokens declared in theme-default.css (every custom property after the Tier 2 banner).
 * @returns {Set<string>} Tier 2 token names.
 */
export function tier2Tokens(): Set<string> {
  const tier2 = THEME_CSS.slice(THEME_CSS.indexOf('Tier 2: Component Tokens'));
  return new Set([...tier2.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}
