/**
 * @file FocusIndicator.test.ts
 * @module tests/renderer/styles/FocusIndicator.test
 * @description Guardrail tests for the stylesheet side of the Theme-bound Focus Indicator and Invalid Focus Indicator (Spec #316, Tickets #317 / #318 / #319): the Tier 1 / Tier 2 focus, invalid-state and control-accent tokens in theme-default.css; the single global :focus-visible / aria-invalid rule set in workbench.css that replaces the scattered per-component focus styling; the map-canvas-only outline suppression; the invalid-state rules reading only the invalid tokens; and the workbench.css classes of the migrated focusable controls reading only Tier 2 Component Tokens, in rem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see FocusableControlStyling.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WORKBENCH_CSS,
  THEME_CSS,
  parseRules,
  declaration,
  rulesFor,
  tokenValue,
  tier2Tokens,
} from "./cssRules";

/**
 * @function suppressesOutline
 * @description Decides whether a declaration block hides the outline: `outline: none | 0`, `outline-style: none | hidden`, `outline-width: 0` or `outline-color: transparent`.
 * @param {string} body - Declaration block.
 * @returns {boolean} True when the block suppresses the outline.
 */
function suppressesOutline(body: string): boolean {
  return (
    /^(?:none|0)\b/.test(declaration(body, "outline") ?? "")
    || /^(?:none|hidden)\b/.test(declaration(body, "outline-style") ?? "")
    || /^0\b/.test(declaration(body, "outline-width") ?? "")
    || /^transparent\b/.test(declaration(body, "outline-color") ?? "")
  );
}

/** Non-text `<input>` types that take the outline ring rather than the border-and-halo indicator. */
const NON_TEXT_INPUT_TYPES = [
  "checkbox",
  "radio",
  "range",
  "color",
  "button",
  "submit",
  "reset",
  "file",
  "image",
];

/** Custom dropdown triggers, matched by semantic role rather than element (ADR 0027 Focus Indicator addendum §2, Ticket #344). */
const DROPDOWN_ROLES = ['[aria-haspopup="listbox"]', '[role="combobox"]'];

/** Dropdowns, native or custom, while focused by any means or open (Ticket #344): their text-entry indicator does not wait for :focus-visible. */
const DROPDOWN_FOCUSED = `:is(select, ${DROPDOWN_ROLES.join(", ")}):is(:focus, :open, [aria-expanded="true"])`;

/** The invalid variant of {@link DROPDOWN_FOCUSED}. */
const DROPDOWN_FOCUSED_INVALID = `:is(select, ${DROPDOWN_ROLES.join(", ")})[aria-invalid="true"]:is(:focus, :open, [aria-expanded="true"])`;

/** The text-entry and dropdown selector list used by the global rules. */
const TEXT_ENTRY = `:is(input:not(${NON_TEXT_INPUT_TYPES.map((t) => `[type="${t}"]`).join(", ")}), select, textarea, ${DROPDOWN_ROLES.join(", ")})`;

/** Selectors allowed to suppress the Focus Indicator: the map canvas only. */
const MAP_CANVAS_OPT_OUT = [
  ".ol-viewport:focus-visible",
  ".ol-viewport canvas:focus-visible",
];

describe("Focus Indicator tokens in theme-default.css (Ticket #317)", () => {
  it("defines the Tier 1 danger-focus primitive", () => {
    assert.equal(
      tokenValue("--cartouche-theme-danger-focus"),
      "rgba(220, 38, 38, 0.25)"
    );
  });

  it("maps every Tier 2 focus, invalid and control-accent token as the spec lays out", () => {
    const expected: Record<string, string> = {
      "--cartouche-focus-color": "var(--cartouche-theme-primary)",
      "--cartouche-focus-ring": "var(--cartouche-theme-accent-focus)",
      "--cartouche-focus-width": "0.125rem",
      "--cartouche-focus-invalid-color": "var(--cartouche-theme-danger)",
      "--cartouche-focus-invalid-ring": "var(--cartouche-theme-danger-focus)",
      "--cartouche-invalid-border": "var(--cartouche-theme-danger)",
      "--cartouche-invalid-fg": "var(--cartouche-theme-danger)",
      "--cartouche-control-accent": "var(--cartouche-theme-primary)",
    };
    for (const [token, value] of Object.entries(expected)) {
      assert.equal(tokenValue(token), value, `${token} maps to ${value}`);
    }
  });

  it("sizes the shared focus offset in rem", () => {
    assert.match(
      tokenValue("--cartouche-focus-offset") ?? "",
      /^\d*\.?\d+rem$/
    );
  });

  it("removes the unused input-focus tokens", () => {
    assert.equal(tokenValue("--cartouche-input-focus-border"), undefined);
    assert.equal(tokenValue("--cartouche-input-focus-ring"), undefined);
  });
});

describe("Global Focus Indicator rules in workbench.css (Ticket #317)", () => {
  it("gives text-entry controls a focus-colour border and a focus-ring halo", () => {
    const [rule] = rulesFor(`${TEXT_ENTRY}:focus-visible`);
    assert.ok(rule, "text-entry :focus-visible rule exists");
    assert.equal(
      declaration(rule.body, "border-color"),
      "var(--cartouche-focus-color)"
    );
    assert.equal(
      declaration(rule.body, "box-shadow"),
      "0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-ring)"
    );
  });

  it("gives every other focusable element an outline ring", () => {
    const [rule] = rulesFor(":focus-visible");
    assert.ok(rule, "global :focus-visible rule exists");
    assert.equal(
      declaration(rule.body, "outline"),
      "var(--cartouche-focus-width) solid var(--cartouche-focus-color)"
    );
    assert.equal(
      declaration(rule.body, "outline-offset"),
      "var(--cartouche-focus-offset)"
    );
  });

  it("applies the control accent globally", () => {
    const [rule] = rulesFor(":root");
    assert.ok(rule, ":root rule exists");
    assert.equal(
      declaration(rule.body, "accent-color"),
      "var(--cartouche-control-accent)"
    );
    for (const r of parseRules(WORKBENCH_CSS)) {
      const accent = declaration(r.body, "accent-color");
      if (accent !== undefined) {
        assert.equal(
          accent,
          "var(--cartouche-control-accent)",
          `${r.selectors.join(", ")} accent-color`
        );
      }
    }
  });

  it("opts the map canvas out of the Focus Indicator", () => {
    const rules = parseRules(WORKBENCH_CSS).filter((r) =>
      MAP_CANVAS_OPT_OUT.every((s) => r.selectors.includes(s))
    );
    assert.equal(rules.length, 1, "one map-canvas opt-out rule");
    assert.equal(declaration(rules[0].body, "outline"), "none");
  });

  it("shows the dropdown Focus Indicator on mouse focus and while the list is open, in the same rule as text entry (Ticket #344)", () => {
    const [rule] = rulesFor(DROPDOWN_FOCUSED);
    assert.ok(rule, "dropdown focused/open rule exists");
    assert.ok(
      rule.selectors.includes(`${TEXT_ENTRY}:focus-visible`),
      "it shares the text-entry rule, so the two cannot drift apart"
    );
    const [invalid] = rulesFor(DROPDOWN_FOCUSED_INVALID);
    assert.ok(invalid, "invalid dropdown focused/open rule exists");
    assert.ok(
      invalid.selectors.includes(
        `${TEXT_ENTRY}[aria-invalid="true"]:focus-visible`
      ),
      "it shares the invalid text-entry rule"
    );
  });

  it("gives an open dropdown list the same Focus Indicator as its trigger, from the focus tokens only (Ticket #344)", () => {
    const [rule] = rulesFor("select:open::picker(select)");
    assert.ok(rule, "open list rule exists");
    assert.equal(
      declaration(rule.body, "border-color"),
      "var(--cartouche-focus-color)"
    );
    assert.equal(
      declaration(rule.body, "box-shadow"),
      "0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-ring)"
    );
    const [invalid] = rulesFor(
      'select[aria-invalid="true"]:open::picker(select)'
    );
    assert.ok(invalid, "invalid open list rule exists");
    assert.equal(
      declaration(invalid.body, "border-color"),
      "var(--cartouche-focus-invalid-color)"
    );
    assert.equal(
      declaration(invalid.body, "box-shadow"),
      "0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-invalid-ring)"
    );
  });

  it("gives custom dropdown triggers the text-entry Focus Indicator by role, so no custom dropdown falls back to the outline ring (Ticket #344)", () => {
    for (const role of DROPDOWN_ROLES) {
      assert.ok(TEXT_ENTRY.includes(role), `${role} is in the text-entry list`);
    }
    for (const suffix of [
      ":focus-visible",
      '[aria-invalid="true"]',
      '[aria-invalid="true"]:focus-visible',
    ]) {
      assert.ok(
        rulesFor(`${TEXT_ENTRY}${suffix}`).length > 0,
        `text-entry ${suffix} rule covers the dropdown roles`
      );
    }
  });

  it("draws an inset ring on the LayerTreeWidget container, the AttributeTableWidget body, dropdown options and Dockview tabs", () => {
    for (const selector of [
      ".layer-tree-container:focus-visible",
      ".table-scroll-wrapper:focus-visible",
      "option:focus-visible",
      ".dv-tab:focus-visible",
    ]) {
      const [rule] = rulesFor(selector);
      assert.ok(rule, `${selector} rule exists`);
      assert.equal(
        declaration(rule.body, "outline-offset"),
        "calc(var(--cartouche-focus-width) * -1)"
      );
    }
  });

  it("suppresses outlines nowhere outside the map-canvas allow-list", () => {
    const offenders = parseRules(WORKBENCH_CSS)
      .filter(
        (r) =>
          suppressesOutline(r.body)
          && !r.selectors.every((s) => MAP_CANVAS_OPT_OUT.includes(s))
      )
      .map((r) => r.selectors.join(", "));
    assert.deepEqual(offenders, []);
  });

  it("keeps no per-component focus rules", () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      for (const s of r.selectors) {
        assert.doesNotMatch(
          s,
          /\.(preference-|picker-button|time-filter-)[^ ]*:focus/,
          `per-component focus rule ${s}`
        );
      }
    }
  });

  it("binds every :focus-visible rule only to the focus tokens and never uses bare :focus", () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      const focusSelectors = r.selectors.filter((s) => s.includes(":focus"));
      if (focusSelectors.length === 0) continue;
      // Selection colouring of a focused list box is not a focus indicator (Spec #316, Out of Scope).
      if (focusSelectors.every((s) => s.endsWith(":focus option:checked")))
        continue;
      for (const s of focusSelectors) {
        // A dropdown shows the indicator on any focus and while open, as a text field does (Ticket #344).
        if (s === DROPDOWN_FOCUSED || s === DROPDOWN_FOCUSED_INVALID) continue;
        assert.match(s, /:focus-visible/, `${s} uses :focus-visible`);
      }
      assert.doesNotMatch(
        r.body,
        /#[0-9a-f]{3,8}\b|rgba?\(/i,
        `${r.selectors.join(", ")} has a colour literal`
      );
      assert.doesNotMatch(
        r.body,
        /!important/,
        `${r.selectors.join(", ")} uses !important`
      );
      const invalid = r.selectors.some(
        (s) =>
          s.includes("aria-invalid") || s.includes(".cartouche-focus-invalid")
      );
      for (const [, token] of r.body.matchAll(/var\((--[a-z-]+)/g)) {
        const allowed =
          invalid ?
            /^--cartouche-focus-(invalid-color|invalid-ring|width|offset)$/
          : /^--cartouche-focus-(color|ring|width|offset)$/;
        assert.match(
          token,
          allowed,
          `${r.selectors.join(", ")} reads ${token}`
        );
      }
    }
  });
});

describe("Invalid Focus Indicator rules in workbench.css (Ticket #317)", () => {
  it("styles unfocused invalid controls from the invalid tokens", () => {
    const [fg] = rulesFor('[aria-invalid="true"]');
    assert.ok(fg, '[aria-invalid="true"] rule exists');
    assert.ok(
      fg.selectors.includes(".cartouche-focus-invalid"),
      ".cartouche-focus-invalid shares the invalid colour"
    );
    assert.equal(declaration(fg.body, "color"), "var(--cartouche-invalid-fg)");
    const [border] = rulesFor(`${TEXT_ENTRY}[aria-invalid="true"]`);
    assert.ok(border, "text-entry invalid border rule exists");
    assert.equal(
      declaration(border.body, "border-color"),
      "var(--cartouche-invalid-border)"
    );
    for (const r of [fg, border]) {
      assert.doesNotMatch(r.body, /!important/);
    }
  });

  it("gives invalid text-entry controls the danger border and halo under :focus-visible", () => {
    const [rule] = rulesFor(`${TEXT_ENTRY}[aria-invalid="true"]:focus-visible`);
    assert.ok(rule, "invalid text-entry :focus-visible rule exists");
    assert.equal(
      declaration(rule.body, "border-color"),
      "var(--cartouche-focus-invalid-color)"
    );
    assert.equal(
      declaration(rule.body, "box-shadow"),
      "0 0 0 var(--cartouche-focus-width) var(--cartouche-focus-invalid-ring)"
    );
  });

  it("gives other invalid elements and .cartouche-focus-invalid a danger outline ring", () => {
    const [rule] = rulesFor(".cartouche-focus-invalid:focus-visible");
    assert.ok(rule, ".cartouche-focus-invalid:focus-visible rule exists");
    assert.ok(rule.selectors.includes('[aria-invalid="true"]:focus-visible'));
    assert.equal(
      declaration(rule.body, "outline"),
      "var(--cartouche-focus-width) solid var(--cartouche-focus-invalid-color)"
    );
  });

  it("drops the !important .preference-input-invalid rule", () => {
    assert.equal(rulesFor(".preference-input-invalid").length, 0);
  });
});

describe("Invalid-state rules read only the invalid tokens (Ticket #319)", () => {
  it("binds every invalid-state and invalid-focus rule only to the invalid and shared focus tokens", () => {
    const invalidRules = parseRules(WORKBENCH_CSS).filter((r) =>
      r.selectors.some((s) => /invalid/i.test(s))
    );
    assert.ok(
      invalidRules.length >= 4,
      "the invalid-state and invalid-focus rules exist"
    );
    for (const r of invalidRules) {
      const where = r.selectors.join(", ");
      assert.doesNotMatch(
        r.body,
        /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i,
        `${where} has a colour literal`
      );
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

  it("keeps the invalid tokens out of every rule that is not an invalid-state rule", () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      if (r.selectors.some((s) => /invalid/i.test(s))) continue;
      assert.doesNotMatch(
        r.body,
        /var\(--cartouche-(?:focus-invalid-|invalid-)/,
        `${r.selectors.join(", ")} reads an invalid token without an invalid-state selector`
      );
    }
  });

  it("leaves the ColorInput error icon colour to the invalid tokens", () => {
    const rules = parseRules(WORKBENCH_CSS).filter((r) =>
      r.selectors.some((s) => s.includes(".preference-input-error-icon"))
    );
    assert.ok(rules.length > 0, ".preference-input-error-icon has a rule");
    for (const r of rules) {
      assert.equal(
        declaration(r.body, "color"),
        undefined,
        ".preference-input-error-icon sets no colour of its own"
      );
    }
  });
});

/**
 * Custom properties a component sets inline to pass a data colour (the user's
 * colour or gradient) into its workbench.css rule, which a Theme cannot change.
 */
const INLINE_DATA_COLOUR_PROPERTIES = new Set([
  "--colour-picker-alpha-colour",
  "--gradient-picker-stops",
]);

/**
 * @function assertTokenBound
 * @description Asserts that a declaration block sets no outline and no px/pt length, and reads only Tier 2 Component Tokens, UI sizing tokens (`--cartouche-ui-*`) or the listed inline data colour properties, so its UI colours come from the theme's Component Tokens.
 * @param {string} body - Declaration block.
 * @param {string} where - Rule label for assertion messages.
 * @param {Set<string>} tier2 - Tier 2 Component Token names.
 * @returns {void}
 */
function assertTokenBound(
  body: string,
  where: string,
  tier2: Set<string>
): void {
  assert.doesNotMatch(body, /\boutline\s*:/, `${where} sets an outline`);
  assert.doesNotMatch(body, /\d(?:px|pt)\b/, `${where} uses px/pt units`);
  for (const [, token] of body.matchAll(/var\((--[a-z0-9-]+)/g)) {
    assert.ok(
      tier2.has(token)
        || token.startsWith("--cartouche-ui-")
        || INLINE_DATA_COLOUR_PROPERTIES.has(token),
      `${where} reads ${token}, which is not a Tier 2 Component Token or a UI sizing token`
    );
  }
}

/** The Tier 2 Component Tokens added for the migrated focusable controls (Ticket #318). */
const MIGRATED_CONTROL_TOKENS = [
  "--cartouche-input-icon-fg",
  "--cartouche-input-placeholder-fg",
  "--cartouche-input-readonly-bg",
  "--cartouche-code-input-font-family",
  "--cartouche-control-disabled-bg",
  "--cartouche-control-disabled-fg",
  "--cartouche-control-disabled-border",
  "--cartouche-cell-editor-bg",
  "--cartouche-cell-editor-border",
  "--cartouche-button-primary-bg",
  "--cartouche-button-primary-fg",
  "--cartouche-button-primary-border",
  "--cartouche-button-secondary-bg",
  "--cartouche-button-secondary-alt-bg",
  "--cartouche-button-secondary-fg",
  "--cartouche-button-secondary-border",
  "--cartouche-button-toggle-active-bg",
  "--cartouche-button-toggle-active-fg",
  "--cartouche-button-toggle-active-border",
  "--cartouche-field-type-fg",
  "--cartouche-field-type-overridden-fg",
  "--cartouche-field-type-overridden-bg",
  "--cartouche-field-type-overridden-border",
  "--cartouche-listbox-option-hover-bg",
  "--cartouche-listbox-option-selected-bg",
  "--cartouche-listbox-shadow",
  "--cartouche-listbox-shadow-subtle",
  "--cartouche-chip-remove-fg",
  "--cartouche-timestamp-segment-active-bg",
  "--cartouche-sidebar-tab-fg",
  "--cartouche-sidebar-tab-active-bg",
  "--cartouche-sidebar-tab-active-fg",
  "--cartouche-overlap-tab-border",
  "--cartouche-widget-control-fg",
  "--cartouche-picker-control-border",
  "--cartouche-gradient-stop-bg",
  "--cartouche-gradient-stop-border",
  "--cartouche-gradient-stop-active-border",
  "--cartouche-gradient-stop-active-ring",
];

/** The workbench.css classes that style the focusable controls migrated off inline styles (Ticket #318). */
const MIGRATED_CONTROL_CLASSES = [
  // Table cell editors, Add Layers Dialog, Time Filter controls, TimestampSpinner, LayerTreeWidget.
  "cell-editor-input",
  "add-layers-btn",
  "add-layers-btn-primary",
  "add-layers-btn-secondary",
  "add-layers-btn-browse",
  "add-layers-chip-remove",
  "add-layers-chip-input",
  "add-layers-path-input",
  "time-filter-step-input",
  "time-filter-step-arrow",
  // The shared Select (Ticket #344).
  "cartouche-select",
  "cartouche-select-trigger",
  "cartouche-select-value",
  "cartouche-select-caret",
  "cartouche-select-option-label",
  "timestamp-spinner-segment",
  "layer-tree-container",
  // Styling editors: SimpleModeEditor, StyleEditor, DashPatternSelect.
  "styling-editor-field",
  "styling-editor-number",
  "styling-editor-angle",
  "styling-editor-icon-btn",
  "styling-editor-secondary-btn",
  "layer-prop-layer-opacity",
  "layer-prop-styling-raw-style",
  "dash-pattern-select",
  // Layer Properties Dialog and its New Field dialog.
  "layer-properties-btn",
  "new-field-dialog-btn",
  "layer-prop-btn-primary",
  "layer-prop-btn-secondary",
  "layer-prop-input",
  "layer-prop-textarea",
  "layer-prop-time-field-select",
  "layer-prop-op-toggle",
  "layer-prop-toolbar-btn",
  "layer-field-type-select",
  "layer-field-reset-type-btn",
];

describe("Migrated focusable controls' workbench.css classes (Ticket #318)", () => {
  it("styles each migrated control from a workbench.css class bound only to Tier 2 Component Tokens, in rem", () => {
    const tier2 = tier2Tokens();
    for (const className of MIGRATED_CONTROL_CLASSES) {
      const pattern = new RegExp(`\\.${className}(?![\\w-])`);
      const rules = parseRules(WORKBENCH_CSS).filter((r) =>
        r.selectors.some((s) => pattern.test(s))
      );
      assert.ok(rules.length > 0, `.${className} has a rule in workbench.css`);
      for (const r of rules) assertTokenBound(r.body, `.${className}`, tier2);
    }
  });

  it("binds the Remaining renderer controls section only to Tier 2 Component Tokens, in rem", () => {
    const start = WORKBENCH_CSS.indexOf(
      "/* === Remaining renderer controls (Spec #316 / #318) === */"
    );
    const end = WORKBENCH_CSS.indexOf(
      "Focus Indicator & Invalid Focus Indicator"
    );
    assert.ok(
      start >= 0,
      "workbench.css has the Remaining renderer controls section"
    );
    assert.ok(
      start < end,
      "the section sits before the Focus Indicator section"
    );
    const rules = parseRules(WORKBENCH_CSS.slice(start, end));
    assert.ok(rules.length > 0, "the section has rules");
    const tier2 = tier2Tokens();
    for (const r of rules)
      assertTokenBound(r.body, r.selectors.join(", "), tier2);
  });

  it("maps every Tier 2 token added for the migrated controls to a Tier 1 primitive", () => {
    for (const token of MIGRATED_CONTROL_TOKENS) {
      assert.match(
        tokenValue(token) ?? "",
        /^var\(--cartouche-theme-[a-z0-9-]+\)$/,
        `${token} maps to a Tier 1 primitive`
      );
    }
  });

  it("groups the Tier 2 tokens by subsystem, with no ticket-labelled blocks", () => {
    assert.doesNotMatch(
      THEME_CSS,
      /\/\*[^*]*\(#\d+\)[^*]*\*\//,
      "theme-default.css has a ticket-labelled comment"
    );
  });
});

/** Every primary-coloured surface that hosts focusable controls: the menubar, the status bar and the dialog header bars. */
const PRIMARY_SURFACES = [
  ".workbench-menubar",
  ".workbench-statusbar",
  ".cartouche-dialog-header",
  ".picker-dialog-header",
];

/** Background tokens that paint a primary-coloured surface. */
const PRIMARY_SURFACE_BG =
  /^var\(--cartouche-(?:menubar-bg|theme-status-bar-bg|dialog-titlebar-bg)\)$/;

/**
 * @function rescopesFocusColour
 * @description Finds the rule that re-scopes `--cartouche-focus-color` on a selector.
 * @param {string} selector - Exact selector text.
 * @returns {string | undefined} The re-scoped value, or undefined when the selector does not re-scope it.
 */
function rescopesFocusColour(selector: string): string | undefined {
  return rulesFor(selector)
    .map((r) => declaration(r.body, "--cartouche-focus-color"))
    .find((v) => v !== undefined);
}

describe("Focus Indicator on primary-coloured surfaces (Spec #316)", () => {
  it("maps the on-primary focus colour to the inverted foreground", () => {
    assert.equal(
      tokenValue("--cartouche-focus-on-primary-color"),
      "var(--cartouche-theme-fg-inverted)"
    );
  });

  it("paints the primary-coloured surfaces from workbench.css classes", () => {
    const surfaces = parseRules(WORKBENCH_CSS)
      .filter((r) =>
        PRIMARY_SURFACE_BG.test(
          declaration(r.body, "background-color")
            ?? declaration(r.body, "background")
            ?? ""
        )
      )
      .flatMap((r) => r.selectors)
      .filter((s) => !/:|\.(?:active|is-)/.test(s));
    assert.deepEqual(
      [...new Set(surfaces)].sort(),
      [...PRIMARY_SURFACES].sort()
    );
  });

  it("re-scopes the focus colour to the on-primary colour on every primary-coloured surface", () => {
    for (const selector of PRIMARY_SURFACES) {
      assert.equal(
        rescopesFocusColour(selector),
        "var(--cartouche-focus-on-primary-color)",
        `${selector} re-scopes the focus colour`
      );
    }
  });

  it("restores the surface focus colour inside the menubar dropdowns", () => {
    assert.equal(
      tokenValue("--cartouche-menu-focus-color"),
      "var(--cartouche-theme-primary)"
    );
    assert.equal(
      rescopesFocusColour(".menu-dropdown"),
      "var(--cartouche-menu-focus-color)"
    );
  });
});

describe("Dockview tab Focus Indicator (Spec #316)", () => {
  it("removes Dockview's own focused-tab outline pseudo-element without !important", () => {
    const rules = parseRules(WORKBENCH_CSS).filter(
      (r) =>
        r.selectors.includes(".dv-tab:focus-visible::after")
        && r.selectors.includes(".dv-tab:has(:focus-visible)::after")
    );
    assert.equal(rules.length, 1, "one Dockview focused-tab override");
    assert.equal(declaration(rules[0].body, "content"), "none");
    assert.doesNotMatch(rules[0].body, /!important/);
  });
});

describe("Transitions leave the Focus Indicator alone (Spec #316)", () => {
  it("never transitions all properties or the outline", () => {
    for (const r of parseRules(WORKBENCH_CSS)) {
      for (const property of ["transition", "transition-property"]) {
        const value = declaration(r.body, property);
        if (value === undefined) continue;
        assert.doesNotMatch(
          value,
          /(?:^|,|\s)(?:all|outline[\w-]*)\b/,
          `${r.selectors.join(", ")} ${property}: ${value}`
        );
      }
    }
  });
});

describe("Dialog button colours (Spec #316)", () => {
  it("maps the primary button tokens to the same primitives as the theme button tokens", () => {
    assert.equal(
      tokenValue("--cartouche-button-primary-bg"),
      "var(--cartouche-theme-primary)"
    );
    assert.equal(
      tokenValue("--cartouche-button-primary-fg"),
      "var(--cartouche-theme-fg-inverted)"
    );
    assert.equal(
      tokenValue("--cartouche-button-primary-border"),
      "var(--cartouche-theme-primary)"
    );
  });

  it("colours every primary dialog button from the primary button tokens", () => {
    for (const selector of [
      ".add-layers-btn-primary",
      ".layer-prop-btn-primary",
      ".layer-properties-btn.ok",
      ".dialog-btn-primary",
    ]) {
      const rules = rulesFor(selector);
      assert.ok(rules.length > 0, `${selector} has a rule`);
      const body = rules.map((r) => r.body).join(";");
      assert.equal(
        declaration(body, "background-color"),
        "var(--cartouche-button-primary-bg)",
        `${selector} background`
      );
      assert.equal(
        declaration(body, "color"),
        "var(--cartouche-button-primary-fg)",
        `${selector} colour`
      );
      assert.doesNotMatch(
        body,
        /--cartouche-theme-button-/,
        `${selector} reads a theme button token`
      );
    }
  });

  it("colours the four secondary button families from one shared rule", () => {
    const families = [
      ".add-layers-btn-secondary",
      ".styling-editor-secondary-btn",
      ".layer-prop-btn-secondary",
      ".dialog-btn-secondary",
    ];
    const colouring = parseRules(WORKBENCH_CSS).filter(
      (r) =>
        r.selectors.some((s) => families.includes(s))
        && [
          "color",
          "background-color",
          "background",
          "border",
          "border-color",
        ].some((p) => declaration(r.body, p) !== undefined)
    );
    assert.equal(
      colouring.length,
      1,
      `one colour rule, found ${colouring.map((r) => r.selectors.join(", ")).join(" | ")}`
    );
    const [rule] = colouring;
    for (const family of families)
      assert.ok(
        rule.selectors.includes(family),
        `${family} shares the colour rule`
      );
    assert.equal(
      declaration(rule.body, "background-color"),
      "var(--cartouche-button-secondary-bg)"
    );
    assert.equal(
      declaration(rule.body, "color"),
      "var(--cartouche-button-secondary-fg)"
    );
    assert.equal(
      declaration(rule.body, "border"),
      "0.0625rem solid var(--cartouche-button-secondary-border)"
    );
  });
});

describe("Disabled control tokens (Spec #316)", () => {
  it("keeps one disabled vocabulary", () => {
    for (const token of [
      "--cartouche-input-disabled-bg",
      "--cartouche-button-disabled-bg",
      "--cartouche-button-disabled-fg",
    ]) {
      assert.equal(tokenValue(token), undefined, `${token} is retired`);
      assert.doesNotMatch(
        WORKBENCH_CSS,
        new RegExp(`${token}\\b`),
        `workbench.css reads ${token}`
      );
    }
    assert.equal(
      tokenValue("--cartouche-control-disabled-bg"),
      "var(--cartouche-theme-surface-alt)"
    );
    assert.equal(
      tokenValue("--cartouche-control-disabled-fg"),
      "var(--cartouche-theme-fg-subtle)"
    );
    assert.equal(
      tokenValue("--cartouche-control-disabled-border"),
      "var(--cartouche-theme-border)"
    );
  });
});
