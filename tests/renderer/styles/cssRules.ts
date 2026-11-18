/**
 * @file cssRules.ts
 * @module tests/renderer/styles/cssRules
 * @description Shared CSS-rule helpers for the stylesheet guardrail tests: loads theme-default.css and workbench.css, splits a flat stylesheet into rules, splits selector lists, and reads declarations and custom property values; and works out the value an element gets for a property from its inline style and the class-based workbench.css rules, so component tests can check the colours of class-styled elements; and resolves token-bound declarations back to the literal colours they render.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see FocusIndicator.test.ts
 */

import fs from "node:fs";
import path from "node:path";

/** Text of the canonical default theme stylesheet. */
export const THEME_CSS = fs.readFileSync(
  path.resolve(process.cwd(), "src/renderer/styles/themes/theme-default.css"),
  "utf8"
);

/** Text of the structural workbench stylesheet. */
export const WORKBENCH_CSS = fs.readFileSync(
  path.resolve(process.cwd(), "src/renderer/styles/workbench.css"),
  "utf8"
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
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * @function parseRules
 * @description Splits a flat stylesheet (no at-rule blocks) into rules, ignoring comments and `@import` lines.
 * @param {string} css - Stylesheet text.
 * @returns {CssRule[]} Parsed rules.
 */
export function parseRules(css: string): CssRule[] {
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import[^;]*;/g, "");
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
export function declaration(
  body: string,
  property: string
): string | undefined {
  const match = body.match(
    new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`)
  );
  return match ? match[1].trim() : undefined;
}

/**
 * @function rulesFor
 * @description Finds every workbench.css rule whose selector list contains the given selector.
 * @param {string} selector - Exact selector text (whitespace-normalised).
 * @returns {CssRule[]} Matching rules.
 */
export function rulesFor(selector: string): CssRule[] {
  return parseRules(WORKBENCH_CSS).filter((r) =>
    r.selectors.includes(selector)
  );
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
 * @function resolveThemeTokens
 * @description Resolves every `var(--token)` in a CSS value through theme-default.css, repeatedly, until only literal values remain, so a test can compare a token-bound declaration with the colour it renders.
 * @param {string} value - CSS value.
 * @returns {string} The value with all theme tokens substituted; an undefined token becomes `<undefined --name>`.
 */
export function resolveThemeTokens(value: string): string {
  let out = value;
  for (let i = 0; i < 10 && /var\(--/.test(out); i++) {
    out = out.replace(
      /var\((--[a-z0-9-]+)\)/g,
      (_m, token: string) => tokenValue(token) ?? `<undefined ${token}>`
    );
  }
  return out;
}

/**
 * @function classDeclaration
 * @description Reads one declaration from the workbench.css rules whose selector list holds the single class selector.
 * @param {string} cls - Class name without the dot.
 * @param {string} property - Kebab-case property.
 * @returns {string | undefined} The first declared value, or undefined.
 */
export function classDeclaration(
  cls: string,
  property: string
): string | undefined {
  for (const rule of rulesFor(`.${cls}`)) {
    const value = declaration(rule.body, property);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * @function tier2Tokens
 * @description Collects the Tier 2 Component Tokens declared in theme-default.css (every custom property after the Tier 2 banner).
 * @returns {Set<string>} Tier 2 token names.
 */
export function tier2Tokens(): Set<string> {
  const tier2 = THEME_CSS.slice(THEME_CSS.indexOf("Tier 2: Component Tokens"));
  return new Set([...tier2.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

/**
 * @typedef {Object} StyledNode
 * @description The parts of a (mock) DOM element the cascade helpers read: its classes, its inline style (camelCase properties and custom properties) and its parent.
 * @property {string} className - Space-separated classes.
 * @property {Record<string, unknown>} style - Inline style.
 * @property {StyledNode | null} [parentNode] - Parent element, if any.
 */
export interface StyledNode {
  className: string;
  style: Record<string, unknown>;
  parentNode?: StyledNode | null;
}

/**
 * @function classesOf
 * @description Lists a node's classes.
 * @param {StyledNode | null | undefined} node - The node.
 * @returns {string[]} Its classes; empty when there is no node.
 */
function classesOf(node: StyledNode | null | undefined): string[] {
  return typeof node?.className === "string" ?
      node.className.split(/\s+/).filter(Boolean)
    : [];
}

/**
 * @function matchesCompound
 * @description Matches one compound selector made only of classes (e.g. `.a.b`) against a node.
 * @param {string} compound - Compound selector.
 * @param {StyledNode | null | undefined} node - The node.
 * @returns {boolean} True when the node carries every class.
 */
function matchesCompound(
  compound: string,
  node: StyledNode | null | undefined
): boolean {
  const classes = compound.split(".").slice(1);
  const own = classesOf(node);
  return classes.length > 0 && classes.every((cls) => own.includes(cls));
}

/**
 * @function matchesClassSelector
 * @description Matches a selector built only from class compounds joined by the child (`>`) and descendant (space) combinators against a node. Any other selector (element names, attributes, pseudo-classes) never matches, so only class-based rules take part in {@link cascadedValue}.
 * @param {string} selector - Whitespace-normalised selector.
 * @param {StyledNode} node - The node.
 * @returns {boolean} True when the selector matches the node.
 */
export function matchesClassSelector(
  selector: string,
  node: StyledNode
): boolean {
  if (
    !/^\.[\w-]+(?:\.[\w-]+)*(?:\s*>?\s*\.[\w-]+(?:\.[\w-]+)*)*$/.test(selector)
  )
    return false;
  const parts = selector.replace(/\s*>\s*/g, " > ").split(" ");
  /**
   * @function matchFrom
   * @description Matches the selector parts up to `index`, right to left, with `current` as the subject of the part at `index`.
   * @param {number} index - Index of the compound `current` must match.
   * @param {StyledNode | null | undefined} current - Candidate node.
   * @returns {boolean} True when the rest of the selector matches.
   */
  const matchFrom = (
    index: number,
    current: StyledNode | null | undefined
  ): boolean => {
    if (!matchesCompound(parts[index], current)) return false;
    if (index === 0) return true;
    if (parts[index - 1] === ">")
      return matchFrom(index - 2, current?.parentNode);
    for (
      let ancestor = current?.parentNode;
      ancestor;
      ancestor = ancestor.parentNode
    ) {
      if (matchFrom(index - 1, ancestor)) return true;
    }
    return false;
  };
  return matchFrom(parts.length - 1, node);
}

/**
 * @function customProperty
 * @description Reads a custom property set inline on a node, or inherited from an ancestor's inline style.
 * @param {StyledNode | null | undefined} node - The node.
 * @param {string} name - Custom property name.
 * @returns {string | undefined} Its value, or undefined when no node in the chain sets it.
 */
function customProperty(
  node: StyledNode | null | undefined,
  name: string
): string | undefined {
  for (let current = node; current; current = current.parentNode) {
    const value = current.style?.[name];
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

/**
 * @function resolveVars
 * @description Substitutes the `var()` references in a CSS value with the custom properties set inline on the node or its ancestors, using a reference's fallback when the property is not set. A reference to a property set nowhere and without a fallback (a theme token) is left as written, so tests can compare against `var(--cartouche-…)`.
 * @param {string} value - CSS value.
 * @param {StyledNode} node - The node the value applies to.
 * @returns {string} The value with the resolvable references substituted.
 */
function resolveVars(value: string, node: StyledNode): string {
  let out = "";
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf("var(", index);
    if (start < 0) return out + value.slice(index);
    out += value.slice(index, start);
    let depth = 0;
    let end = start + 3;
    for (; end < value.length; end++) {
      if (value[end] === "(") depth++;
      if (value[end] === ")" && --depth === 0) break;
    }
    const inner = value.slice(start + 4, end);
    const comma = inner.indexOf(",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const own = customProperty(node, name);
    if (own !== undefined) out += own;
    else if (comma >= 0)
      out += resolveVars(inner.slice(comma + 1).trim(), node);
    else out += value.slice(start, end + 1);
    index = end + 1;
  }
  return out;
}

/** The workbench.css rules, parsed once on the first {@link cascadedValue} call. */
let workbenchRules: CssRule[] | undefined;

/**
 * @function cascadedValue
 * @description Works out the value a node gets for one property from its inline style and the class-based rules of workbench.css: the inline style first, otherwise the matching rule with the most classes, the later rule winning a tie. `var()` references are resolved through {@link resolveVars}. Lets component tests check the colours a class-styled element is painted with.
 * @param {StyledNode} node - The node.
 * @param {string} property - Kebab-case property name, e.g. `background-color`.
 * @returns {string | undefined} The cascaded value, or undefined when neither the inline style nor a class rule sets it.
 */
export function cascadedValue(
  node: StyledNode,
  property: string
): string | undefined {
  const camel = property.replace(/-([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase()
  );
  const inline = node.style?.[camel];
  if (typeof inline === "string" && inline !== "")
    return resolveVars(inline, node);
  let best: { specificity: number; value: string } | undefined;
  workbenchRules ??= parseRules(WORKBENCH_CSS);
  for (const rule of workbenchRules) {
    const value = declaration(rule.body, property);
    if (value === undefined) continue;
    for (const selector of rule.selectors) {
      if (!matchesClassSelector(selector, node)) continue;
      const specificity = (selector.match(/\./g) ?? []).length;
      if (!best || specificity >= best.specificity)
        best = { specificity, value };
    }
  }
  return best && resolveVars(best.value, node);
}
