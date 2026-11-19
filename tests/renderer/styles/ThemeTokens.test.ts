/**
 * @file ThemeTokens.test.ts
 * @module tests/renderer/styles/ThemeTokens.test
 * @description Automated verification test suite for Cartouche Two-Tier CSS theme token architecture (Tier 1 Theme Primitives and Tier 2 Component Tokens), verifying token definition, syntax validity, referential integrity, and decoupling from structural workbench stylesheet (ADR 0027 / Spec #195); and (Spec #349) that workbench.css and the TypeScript sources read only defined tokens, workbench.css reads no Tier 1 primitive in a colour declaration, every Tier 2 token maps to another token, and every defined token is read; and (#361) that the TypeScript sources read no Tier 1 primitive except the listed font-family reads, and the colours moved out of renderer TSX render unchanged from workbench.css.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-07
 * @updated 2026-11-19
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  declarationsOf,
  definedTokens,
  parseRules,
  readTokens,
  resolveThemeTokens,
  rulesFor,
  selectorDeclaration,
  stripCssComments,
  THEME_CSS,
  TIER2_TOKENS_WITH_THEME_PREFIX,
  tier2Tokens,
  tokenMapping,
  tokenValue,
  tsSources,
  WORKBENCH_CSS,
} from "./cssRules";
import { stripSourceComments } from "../sourceText";

describe("Cartouche Two-Tier CSS Theme Token Architecture (ADR 0027 / Ticket #196)", () => {
  const rootDir = process.cwd();
  const defaultThemeCssPath = path.resolve(
    rootDir,
    "src/renderer/styles/themes/theme-default.css"
  );
  const themeCssPath = path.resolve(rootDir, "src/renderer/styles/theme.css");
  const indexHtmlPath = path.resolve(rootDir, "src/renderer/index.html");

  /**
   * @function assertDefined
   * @description Asserts that theme-default.css defines every token.
   * @param {string[]} tokens - Token names.
   * @param {string} kind - What the tokens are, for the failure message.
   */
  const assertDefined = (tokens: string[], kind: string): void => {
    for (const token of tokens) {
      assert.ok(
        tokenValue(token) !== undefined,
        `theme-default.css must define ${kind}: ${token}`
      );
    }
  };

  /**
   * @function assertMappings
   * @description Asserts that each theme-default.css token's whole value is `var(<base>)`.
   * @param {Record<string, string>} expected - Token name to the token it must map to.
   */
  const assertMappings = (expected: Record<string, string>): void => {
    for (const [token, base] of Object.entries(expected)) {
      assert.equal(tokenMapping(token), base, `${token} must be var(${base})`);
    }
  };

  /** Comment-free TypeScript sources under src/, for the token read guards. */
  const sources = tsSources().map(({ file, text }) => ({
    file,
    text: stripSourceComments(text),
  }));

  it("verifies that canonical default theme stylesheet exists and has non-zero size", () => {
    assert.ok(
      fs.existsSync(defaultThemeCssPath),
      "src/renderer/styles/themes/theme-default.css must exist"
    );
    const stats = fs.statSync(defaultThemeCssPath);
    assert.ok(
      stats.size > 500,
      `theme-default.css must be a non-empty stylesheet (size: ${stats.size} bytes)`
    );
  });

  it("defines all required Tier 1 Theme Primitives in theme-default.css", () => {
    const tier1Primitives = [
      // Primary & Brand Accents
      "--cartouche-theme-primary",
      "--cartouche-theme-primary-hover",
      "--cartouche-theme-primary-active",
      // Surfaces & Backgrounds
      "--cartouche-theme-bg",
      "--cartouche-theme-surface",
      "--cartouche-theme-surface-subtle",
      "--cartouche-theme-surface-widget",
      "--cartouche-theme-surface-alt",
      "--cartouche-theme-surface-hover",
      "--cartouche-theme-surface-active",
      // Borders & Dividers
      "--cartouche-theme-border",
      "--cartouche-theme-border-subtle",
      "--cartouche-theme-border-strong",
      "--cartouche-theme-border-widget",
      "--cartouche-theme-border-dark",
      // Foreground & Typography
      "--cartouche-theme-fg",
      "--cartouche-theme-fg-muted",
      "--cartouche-theme-fg-subtle",
      "--cartouche-theme-fg-secondary",
      "--cartouche-theme-fg-inverted",
      "--cartouche-theme-fg-primary",
      // Accents & Interaction
      "--cartouche-theme-accent-subtle",
      "--cartouche-theme-accent-focus",
      // Status Colors
      "--cartouche-theme-danger",
      "--cartouche-theme-danger-subtle",
      "--cartouche-theme-danger-focus",
      "--cartouche-theme-warning",
      "--cartouche-theme-warning-subtle",
      "--cartouche-theme-success",
      "--cartouche-theme-success-subtle",
      "--cartouche-theme-info",
      "--cartouche-theme-info-subtle",
      "--cartouche-theme-shadow",
      "--cartouche-theme-shadow-subtle",
      "--cartouche-theme-shadow-strong",
    ];

    assertDefined(tier1Primitives, "Tier 1 primitive");
  });

  it("defines all required Tier 2 Component Tokens mapped by UI subsystem in theme-default.css", () => {
    const tier2ComponentTokens = [
      // Menubar
      "--cartouche-menubar-bg",
      "--cartouche-menubar-fg",
      "--cartouche-menubar-hover",
      "--cartouche-menubar-border",
      // Status Bar
      "--cartouche-theme-status-bar-bg",
      "--cartouche-theme-status-bar-fg",
      // Tab Groups & Headers
      "--cartouche-theme-tab-active-bg",
      "--cartouche-theme-tab-inactive-bg",
      "--cartouche-theme-tab-active-fg",
      "--cartouche-theme-tab-inactive-fg",
      // Dialog Buttons
      "--cartouche-button-primary-bg",
      "--cartouche-button-primary-fg",
      "--cartouche-button-primary-border",
      // Widgets
      "--cartouche-widget-bg",
      "--cartouche-widget-border",
      "--cartouche-widget-header-bg",
      "--cartouche-widget-header-fg",
      "--cartouche-widget-header-border",
      "--cartouche-widget-content-bg",
      // Menus & Dropdowns
      "--cartouche-menu-bg",
      "--cartouche-menu-fg",
      "--cartouche-menu-border",
      "--cartouche-menu-item-hover-bg",
      "--cartouche-menu-item-hover-fg",
      "--cartouche-menu-separator",
      "--cartouche-menu-focus-color",
      // Toolbars
      "--cartouche-toolbar-fg",
      "--cartouche-toolbar-item-hover-bg",
      "--cartouche-toolbar-item-active-bg",
      // Dialogs
      "--cartouche-dialog-bg",
      "--cartouche-dialog-fg",
      "--cartouche-dialog-border",
      "--cartouche-dialog-header-bg",
      "--cartouche-dialog-header-fg",
      "--cartouche-dialog-header-border",
      "--cartouche-dialog-backdrop",
      // Tables
      "--cartouche-table-bg",
      "--cartouche-table-fg",
      "--cartouche-table-header-bg",
      "--cartouche-table-header-fg",
      "--cartouche-table-border",
      "--cartouche-table-row-hover-bg",
      "--cartouche-table-row-selected-bg",
      "--cartouche-table-row-alt-bg",
      "--cartouche-table-column-line",
      "--cartouche-table-row-line",
      "--cartouche-table-row-active-bg",
      "--cartouche-table-row-active-fg",
      "--cartouche-table-readonly-fg",
      "--cartouche-table-readonly-selected-bg",
      "--cartouche-table-readonly-selected-fg",
      // Inputs
      "--cartouche-input-bg",
      "--cartouche-input-fg",
      "--cartouche-input-border",
      // Disabled Controls
      "--cartouche-control-disabled-bg",
      "--cartouche-control-disabled-fg",
      "--cartouche-control-disabled-border",
      // Focus Indicator, Invalid Focus Indicator & control accent (Spec #316)
      "--cartouche-focus-color",
      "--cartouche-focus-ring",
      "--cartouche-focus-width",
      "--cartouche-focus-offset",
      "--cartouche-focus-on-primary-color",
      "--cartouche-focus-invalid-color",
      "--cartouche-focus-invalid-ring",
      "--cartouche-invalid-border",
      "--cartouche-invalid-fg",
      "--cartouche-control-accent",
      // Drop Targets
      "--cartouche-drop-target-bg",
      "--cartouche-drop-target-border",
    ];

    assertDefined(tier2ComponentTokens, "Tier 2 component token");
  });

  it("defines the status bar Tier 2 tokens and drops the unread border token (#351)", () => {
    assertDefined(
      [
        "--cartouche-theme-status-bar-bg",
        "--cartouche-theme-status-bar-fg",
        "--cartouche-statusbar-item-hover-bg",
        "--cartouche-statusbar-separator-bg",
      ],
      "status bar token"
    );
    // The status bar draws no border, so its border token is removed rather than read.
    assert.ok(
      !THEME_CSS.includes("--cartouche-theme-status-bar-border"),
      "theme-default.css must not define the unread --cartouche-theme-status-bar-border"
    );
  });

  /**
   * Colours the status bar rules rendered before #351, keyed by selector and property.
   */
  const statusBarRenderedColours: [string, string, string, RegExp][] = [
    [
      ".workbench-statusbar",
      "background-color",
      "#1b446c",
      /^var\(--cartouche-theme-status-bar-bg\)$/,
    ],
    [
      ".workbench-statusbar",
      "color",
      "#ffffff",
      /^var\(--cartouche-theme-status-bar-fg\)$/,
    ],
    [
      ".statusbar-item:hover",
      "background-color",
      "rgba(255, 255, 255, 0.2)",
      /^var\(--cartouche-statusbar-item-hover-bg\)$/,
    ],
    [
      ".statusbar-separator",
      "background-color",
      "#94a3b8",
      /^var\(--cartouche-statusbar-separator-bg\)$/,
    ],
  ];

  it("status bar rules read status bar tokens only and render the same colours (#351)", () => {
    for (const [
      selector,
      property,
      rendered,
      token,
    ] of statusBarRenderedColours) {
      const value = selectorDeclaration(selector, property);
      assert.ok(value, `${selector} must declare ${property}`);
      assert.match(value, token, `${selector} ${property} must read ${token}`);
      assert.equal(
        resolveThemeTokens(value),
        rendered,
        `${selector} ${property} must still render ${rendered}`
      );
    }
  });

  it("maps the menubar, status bar and Dialog title bar Hover to one Tier 1 overlay primitive, rendering the same colour (#349)", () => {
    assert.equal(
      tokenValue("--cartouche-theme-overlay-hover-on-primary"),
      "rgba(255, 255, 255, 0.2)"
    );
    for (const token of [
      "--cartouche-menubar-hover",
      "--cartouche-statusbar-item-hover-bg",
      "--cartouche-dialog-titlebar-button-hover-bg",
    ]) {
      assert.equal(
        tokenMapping(token),
        "--cartouche-theme-overlay-hover-on-primary",
        `${token} must map to the overlay primitive`
      );
    }
    assert.equal(
      tokenValue("--cartouche-theme-backdrop"),
      "rgba(0, 0, 0, 0.4)"
    );
    assert.equal(
      tokenMapping("--cartouche-dialog-backdrop"),
      "--cartouche-theme-backdrop"
    );
  });

  it("gives the Dialog close button Hover its own Dialog title bar token, not the menubar's (#349)", () => {
    const value = selectorDeclaration(
      ".cartouche-dialog-close-btn:hover",
      "background-color"
    );
    assert.equal(value, "var(--cartouche-dialog-titlebar-button-hover-bg)");
    assert.equal(resolveThemeTokens(value), "rgba(255, 255, 255, 0.2)");
  });

  /**
   * Tier 2 tokens whose value is not a `var()` mapping: a CSS keyword, which names
   * no colour a Theme would vary, and the non-colour Focus Indicator sizes.
   */
  const tier2TokensWithoutMapping: Record<string, string> = {
    "--dockview-sash-bg": "transparent",
    "--cartouche-focus-width": "0.125rem",
    "--cartouche-focus-offset": "0.125rem",
  };

  it("maps every Tier 2 token to another token with var(), except the listed keyword and sizes (#349)", () => {
    const literal = [...tier2Tokens()].filter(
      (token) =>
        tokenMapping(token) === undefined
        && tier2TokensWithoutMapping[token] !== tokenValue(token)
    );
    assert.deepEqual(
      literal,
      [],
      `Tier 2 tokens holding a literal value: ${literal.join(", ")}`
    );
  });

  it("defines the Dockview Tier 2 tokens (#352)", () => {
    const dockviewTokens: Record<string, string> = {
      "--dockview-group-bg": "--cartouche-theme-surface",
      "--dockview-group-border": "--cartouche-theme-border",
      "--dockview-tab-strip-bg": "--cartouche-theme-surface-widget",
      "--dockview-tab-divider": "--cartouche-theme-border-strong",
      "--dockview-tab-front-bg": "--cartouche-theme-surface",
      "--dockview-tab-front-fg": "--cartouche-theme-fg",
      "--dockview-tab-background-bg": "--cartouche-theme-surface-alt",
      "--dockview-tab-background-fg": "--cartouche-theme-fg-muted",
      "--dockview-tab-hover-bg": "--cartouche-theme-surface-active",
      "--dockview-tab-hover-fg": "--cartouche-theme-fg-primary",
      "--dockview-sash-hover-bg": "--cartouche-theme-primary",
    };
    assertMappings(dockviewTokens);
    // The sash at rest is the CSS keyword `transparent`, not a mapping (see
    // tier2TokensWithoutMapping above).
    assert.equal(tokenValue("--dockview-sash-bg"), "transparent");
  });

  it("reads every --dockview-* token in workbench.css and sets Dockview's --dv-* colours only from Tier 2 tokens (#352)", () => {
    const defined = [...definedTokens()].filter((t) =>
      t.startsWith("--dockview-")
    );
    assert.ok(
      defined.length > 0,
      "theme-default.css must define --dockview-* tokens"
    );
    const workbenchReads = readTokens(stripCssComments(WORKBENCH_CSS));
    const unread = defined.filter((t) => !workbenchReads.has(t));
    assert.deepEqual(
      unread,
      [],
      `Unread --dockview-* tokens: ${unread.join(", ")}`
    );

    const dvColourVars = [
      "--dv-group-view-background-color",
      "--dv-tabs-and-actions-container-background-color",
      "--dv-activegroup-visiblepanel-tab-background-color",
      "--dv-activegroup-hiddenpanel-tab-background-color",
      "--dv-inactivegroup-visiblepanel-tab-background-color",
      "--dv-inactivegroup-hiddenpanel-tab-background-color",
      "--dv-activegroup-visiblepanel-tab-color",
      "--dv-activegroup-hiddenpanel-tab-color",
      "--dv-inactivegroup-visiblepanel-tab-color",
      "--dv-inactivegroup-hiddenpanel-tab-color",
      "--dv-tab-divider-color",
      "--dv-separator-border",
      "--dv-sash-color",
      "--dv-active-sash-color",
      "--dv-drag-over-background-color",
      "--dv-drag-over-border-color",
      "--dv-drag-over-border",
    ];
    for (const dv of dvColourVars) {
      const value = tokenValue(dv, WORKBENCH_CSS);
      assert.ok(value, `workbench.css must set ${dv}`);
      const reads = [...readTokens(value)];
      assert.ok(reads.length > 0, `${dv} must read a token`);
      for (const token of reads) {
        assert.ok(
          !token.startsWith("--cartouche-theme-"),
          `${dv} must read a Tier 2 token, not ${token}`
        );
        assert.ok(tokenValue(token) !== undefined, `${token} must be defined`);
      }
    }
  });

  it("has no dead .dockview-tab rules in workbench.css (#352)", () => {
    assert.doesNotMatch(WORKBENCH_CSS, /\.dockview-tab\b/);
  });

  it("defines the LayerTreeWidget Tier 2 tokens (#356)", () => {
    const expected: Record<string, string> = {
      "--cartouche-layer-tree-bg": "--cartouche-theme-surface",
      "--cartouche-layer-tree-fg": "--cartouche-theme-fg-primary",
      "--cartouche-layer-tree-header-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-layer-tree-row-hover-bg": "--cartouche-theme-surface-alt",
      "--cartouche-layer-tree-row-selected-bg": "--cartouche-theme-info-subtle",
      "--cartouche-layer-tree-row-selected-fg": "--cartouche-theme-info",
      "--cartouche-layer-tree-project-border":
        "--cartouche-theme-border-subtle",
      "--cartouche-layer-tree-chevron-fg": "--cartouche-theme-fg-muted",
      "--cartouche-layer-tree-meta-fg": "--cartouche-theme-fg-muted",
      "--cartouche-layer-tree-empty-fg": "--cartouche-theme-fg-muted",
      "--cartouche-layer-tree-empty-title-fg": "--cartouche-theme-fg-primary",
      "--cartouche-layer-tree-drop-marker-bg": "--cartouche-theme-primary",
      "--cartouche-layer-tree-inline-input-border": "--cartouche-theme-primary",
    };
    assertMappings(expected);
  });

  it("reads only Tier 2 tokens in the LayerTreeWidget colour declarations (#356)", () => {
    const subsystem =
      /\.(layer-tree-|tree-node-|tree-chevron|tree-drop-marker|tree-inline-input|empty-layers-|layer-meta)/;
    const colourProperty =
      /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|box-shadow)$/;
    for (const rule of parseRules(WORKBENCH_CSS)) {
      if (!rule.selectors.some((s) => subsystem.test(s))) continue;
      for (const { property, value } of declarationsOf(rule.body)) {
        if (!colourProperty.test(property)) continue;
        assert.doesNotMatch(
          value,
          /--cartouche-theme-/,
          `${rule.selectors.join(", ")} { ${property} } must read a Tier 2 token, not ${value}`
        );
      }
    }
    // The Tree Node Row is the only rule that reads the row Hover and Selected tokens.
    assert.equal(
      selectorDeclaration(".tree-node-row:hover", "background-color"),
      "var(--cartouche-layer-tree-row-hover-bg)"
    );
    assert.equal(
      selectorDeclaration(".tree-node-row.selected", "background-color"),
      "var(--cartouche-layer-tree-row-selected-bg)"
    );
    assert.equal(
      selectorDeclaration(".tree-node-row.selected", "color"),
      "var(--cartouche-layer-tree-row-selected-fg)"
    );
  });

  it("defines the AttributeTableWidget frame, CRS Catalogue list box and console Tier 2 tokens (#357)", () => {
    // Each token maps to the Tier 1 primitive its rule read before #357, so no rendered colour changes.
    const expected: Record<string, string> = {
      "--cartouche-panel-toolbar-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-panel-toolbar-border": "--cartouche-theme-border",
      "--cartouche-panel-subtitle-fg": "--cartouche-theme-fg-muted",
      "--cartouche-panel-icon-button-fg": "--cartouche-theme-fg-muted",
      "--cartouche-panel-icon-button-hover-bg":
        "--cartouche-theme-surface-active",
      "--cartouche-panel-icon-button-hover-fg": "--cartouche-theme-fg-primary",
      "--cartouche-panel-empty-fg": "--cartouche-theme-fg-muted",
      "--cartouche-attribute-table-bg": "--cartouche-theme-surface",
      "--cartouche-attribute-table-header-bg":
        "--cartouche-theme-surface-subtle",
      "--cartouche-attribute-table-header-border": "--cartouche-theme-border",
      "--cartouche-attribute-table-footer-bg":
        "--cartouche-theme-surface-subtle",
      "--cartouche-attribute-table-footer-border": "--cartouche-theme-border",
      "--cartouche-attribute-table-muted-fg": "--cartouche-theme-fg-muted",
      "--cartouche-geometry-badge-bg": "--cartouche-theme-surface-alt",
      "--cartouche-geometry-badge-border": "--cartouche-theme-border-strong",
      "--cartouche-geometry-badge-fg": "--cartouche-theme-info",
      "--cartouche-crs-list-option-selected-bg":
        "--cartouche-theme-info-subtle",
      "--cartouche-crs-list-option-selected-fg": "--cartouche-theme-info",
      "--cartouche-console-bg": "--cartouche-theme-surface",
      "--cartouche-console-time-fg": "--cartouche-theme-fg-muted",
      "--cartouche-console-source-fg": "--cartouche-theme-primary",
      "--cartouche-console-message-fg": "--cartouche-theme-fg-primary",
      "--cartouche-console-empty-fg": "--cartouche-theme-fg-subtle",
      "--cartouche-console-level-info-bg": "--cartouche-theme-info-subtle",
      "--cartouche-console-level-info-fg": "--cartouche-theme-info",
      "--cartouche-console-level-success-bg":
        "--cartouche-theme-success-subtle",
      "--cartouche-console-level-success-fg": "--cartouche-theme-success",
      "--cartouche-console-level-warn-bg": "--cartouche-theme-warning-subtle",
      "--cartouche-console-level-warn-fg": "--cartouche-theme-warning",
      "--cartouche-console-level-error-bg": "--cartouche-theme-danger-subtle",
      "--cartouche-console-level-error-fg": "--cartouche-theme-danger",
    };
    assertMappings(expected);
  });

  it("reads no Tier 1 primitive in the AttributeTableWidget frame, CRS Catalogue list box or console colour rules (#357)", () => {
    const subsystemSelector =
      /(?<![\w-])\.(?:attribute-table-[\w-]+|panel-toolbar|panel-subtitle|icon-btn|geometry-badge|empty-filter-message|empty-panel-message|console-[\w-]+|log-[\w-]+|badge-(?:info|success|warn|error))(?![\w-])|\.project-prop-crs-[\w-]+(?::focus)?\s+option:checked/;
    const colourProperty =
      /^(?:color|background(?:-color)?|border(?:-[a-z]+)*|outline(?:-color)?|-webkit-text-fill-color|fill|stroke|box-shadow)$/;
    const offenders: string[] = [];
    let matchedRules = 0;
    for (const rule of parseRules(WORKBENCH_CSS)) {
      if (!rule.selectors.some((s) => subsystemSelector.test(s))) continue;
      matchedRules += 1;
      for (const { property, value } of declarationsOf(rule.body)) {
        if (
          colourProperty.test(property)
          && value.includes("--cartouche-theme-")
        )
          offenders.push(
            `${rule.selectors.join(", ")} { ${property}: ${value} }`
          );
      }
    }
    assert.ok(
      matchedRules >= 15,
      `expected the #357 rules, found ${matchedRules}`
    );
    assert.deepEqual(offenders, []);
  });

  it("defines the ToolbarWidget Tier 2 tokens (#354)", () => {
    const toolbarTokens = [
      "--cartouche-toolbar-grabber-fg",
      "--cartouche-toolbar-grabber-hover-fg",
      "--cartouche-toolbar-divider-fg",
      "--cartouche-toolbar-item-hover-border",
      "--cartouche-toolbar-item-toggled-on-bg",
      "--cartouche-toolbar-item-toggled-on-fg",
      "--cartouche-toolbar-item-toggled-on-border",
      "--cartouche-toolbar-drop-marker-bg",
    ];
    assertDefined(toolbarTokens, "toolbar token");
  });

  /**
   * Colours the ToolbarWidget, SplitToolButton and toolbar drop-marker rules
   * rendered before #354, keyed by selector and property.
   */
  const toolbarRenderedColours: [string, string, string][] = [
    [".toolbar-btn", "color", "#0f172a"],
    [".toolbar-btn:hover:not(:disabled)", "background-color", "#f1f5f9"],
    [".toolbar-btn:hover:not(:disabled)", "border-color", "#cbd5e1"],
    [".toolbar-btn.active", "background-color", "#f0f9ff"],
    [".toolbar-btn.active", "border-color", "#0284c7"],
    [".toolbar-btn.active", "color", "#0284c7"],
    [".toolbar-grabber", "color", "#94a3b8"],
    [".toolbar-grabber:hover", "color", "#0284c7 !important"],
    [".toolbar-divider", "color", "#94a3b8"],
    [".toolbar-drop-marker", "background-color", "#0284c7"],
  ];

  it("toolbar rules read Tier 2 toolbar tokens, not Tier 1 primitives, and render the same colours (#354)", () => {
    for (const [selector, property, rendered] of toolbarRenderedColours) {
      const value = selectorDeclaration(selector, property);
      assert.ok(value, `${selector} must declare ${property}`);
      assert.doesNotMatch(
        value,
        /--cartouche-theme-/,
        `${selector} ${property} must not read a Tier 1 primitive`
      );
      assert.match(
        value,
        /var\(--cartouche-toolbar-/,
        `${selector} ${property} must read a --cartouche-toolbar-* token`
      );
      assert.equal(
        resolveThemeTokens(value),
        rendered,
        `${selector} ${property} must still render ${rendered}`
      );
    }
  });

  it("reads --cartouche-toolbar-fg and -item-hover-bg in workbench.css (#354)", () => {
    for (const token of [
      "--cartouche-toolbar-fg",
      "--cartouche-toolbar-item-hover-bg",
    ]) {
      assert.ok(
        WORKBENCH_CSS.includes(`var(${token})`),
        `workbench.css must read ${token}`
      );
    }
  });

  it("defines the menubar title badge and status-bar separator Tier 2 tokens (#350)", () => {
    const expected: Record<string, string> = {
      "--cartouche-menubar-title-badge-bg": "--cartouche-theme-primary-hover",
      "--cartouche-statusbar-separator-bg": "--cartouche-theme-fg-subtle",
    };
    assertMappings(expected);
  });

  it("reads only --cartouche-* tokens in workbench.css that theme-default.css defines (#350)", () => {
    const defined = definedTokens();
    const undefinedReads = [
      ...readTokens(stripCssComments(WORKBENCH_CSS)),
    ].filter(
      (token) => token.startsWith("--cartouche-") && !defined.has(token)
    );
    assert.deepEqual(
      undefinedReads,
      [],
      `workbench.css reads tokens no Theme defines: ${undefinedReads.join(", ")}`
    );
  });

  it("reads only --cartouche-* and --dockview-* tokens in the TypeScript sources that theme-default.css defines (#349)", () => {
    const defined = definedTokens();
    const undefinedReads = sources.flatMap(({ file, text }) =>
      [...readTokens(text)]
        .filter(
          (token) =>
            /^--(?:cartouche|dockview)-/.test(token) && !defined.has(token)
        )
        .map((token) => `${file}: ${token}`)
    );
    assert.ok(sources.length > 100, "the TypeScript sources are scanned");
    assert.deepEqual(
      undefinedReads,
      [],
      `TypeScript sources read tokens no Theme defines:\n${undefinedReads.join("\n")}`
    );
  });

  /**
   * Properties whose values are not colours and may read a Tier 1 primitive: the
   * monospace font stack is a typography primitive (ADR 0013), not a colour.
   */
  const nonColourPropertiesReadingTier1 = ["font-family"];

  it("reads no --cartouche-theme-* Tier 1 primitive in any colour declaration of workbench.css (#360)", () => {
    const offenders: string[] = [];
    for (const rule of parseRules(WORKBENCH_CSS)) {
      const selector = rule.selectors.join(", ");
      for (const { property, value } of declarationsOf(rule.body)) {
        if (nonColourPropertiesReadingTier1.includes(property)) continue;
        for (const token of readTokens(value)) {
          if (
            token.startsWith("--cartouche-theme-")
            && !TIER2_TOKENS_WITH_THEME_PREFIX.includes(token)
          )
            offenders.push(`${selector} { ${property}: … ${token} }`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `workbench.css colour declarations read Tier 1 primitives:\n${offenders.join("\n")}`
    );
  });

  /**
   * Tier 1 primitive reads the TypeScript sources may keep, keyed by file, each
   * with its reason. Only typography reads remain: guard 2 excepts `font-family`
   * in workbench.css for the same reason.
   */
  const tsTier1ReadExceptions: Record<
    string,
    { token: string; reason: string }[]
  > = {
    "src/renderer/workbench/dialogs/ProjectCrsTab.tsx": [
      {
        token: "--cartouche-theme-font-family-mono",
        reason:
          "inline font-family of the WKT box: a typography primitive (ADR 0013), not a colour",
      },
    ],
    "src/renderer/workbench/panels/ConsolePanel.tsx": [
      {
        token: "--cartouche-theme-font-family-mono",
        reason:
          "inline font-family of the console log: a typography primitive (ADR 0013), not a colour",
      },
    ],
  };

  it("reads no --cartouche-theme-* Tier 1 primitive in the TypeScript sources, except the listed font-family reads (#361)", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      const allowed = (tsTier1ReadExceptions[file] ?? []).map((e) => e.token);
      for (const token of readTokens(text)) {
        if (
          token.startsWith("--cartouche-theme-")
          && !TIER2_TOKENS_WITH_THEME_PREFIX.includes(token)
          && !allowed.includes(token)
        )
          offenders.push(`${file}: ${token}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `TypeScript sources read Tier 1 primitives. Read a Tier 2 token from a workbench.css class instead (ADR 0027 § Token Scopes):\n${offenders.join("\n")}`
    );
    // Every exception is still needed, so the list never goes slack.
    for (const [file, exceptions] of Object.entries(tsTier1ReadExceptions)) {
      const text = sources.find((s) => s.file === file)?.text ?? "";
      for (const { token } of exceptions)
        assert.ok(
          readTokens(text).has(token),
          `${file} no longer reads ${token}: remove its exception`
        );
    }
  });

  it("defines the Tier 2 tokens for the colours moved out of renderer TSX, each mapped to the primitive the inline style read (#361)", () => {
    assertMappings({
      "--cartouche-picker-dialog-fg": "--cartouche-theme-fg",
      "--cartouche-picker-dialog-border": "--cartouche-theme-border",
      "--cartouche-picker-dialog-footer-bg": "--cartouche-theme-surface-alt",
      "--cartouche-picker-channel-label-fg": "--cartouche-theme-fg-muted",
      "--cartouche-drop-target-badge-fg": "--cartouche-theme-fg-inverted",
      "--cartouche-drop-target-badge-shadow": "--cartouche-theme-shadow",
      "--cartouche-overlap-tab-strip-bg": "--cartouche-theme-surface-active",
      "--cartouche-widget-title-fg": "--cartouche-theme-fg-primary",
      "--cartouche-detached-window-body-bg": "--cartouche-theme-bg",
      "--cartouche-detached-window-body-fg": "--cartouche-theme-fg",
      "--cartouche-timestamp-divider-fg": "--cartouche-theme-fg-muted",
      "--cartouche-time-filter-divider-bg": "--cartouche-theme-border",
      "--cartouche-time-filter-step-arrows-border": "--cartouche-theme-border",
      "--cartouche-time-filter-frame-caption-fg": "--cartouche-theme-fg-muted",
      "--cartouche-time-filter-frame-label-fg": "--cartouche-theme-fg-primary",
    });
  });

  /**
   * Each colour declaration moved out of renderer TSX by #361: selector,
   * property, the Tier 2 value its workbench.css rule declares, and the colour
   * the inline Tier 1 read rendered on `main`.
   */
  const movedFromTsx: [string, string, string, string][] = [
    // PickerDialogFrame
    [
      ".picker-dialog-box",
      "background-color",
      "var(--cartouche-dialog-bg)",
      "#ffffff",
    ],
    [
      ".picker-dialog-box",
      "color",
      "var(--cartouche-picker-dialog-fg)",
      "#000000",
    ],
    [
      ".picker-dialog-box",
      "box-shadow",
      "0 0.5rem 1.5rem var(--cartouche-dialog-shadow)",
      "0 0.5rem 1.5rem rgba(0, 0, 0, 0.24)",
    ],
    [
      ".picker-dialog-box",
      "border",
      "0.0625rem solid var(--cartouche-picker-dialog-border)",
      "0.0625rem solid #e2e8f0",
    ],
    [
      ".picker-dialog-footer",
      "background-color",
      "var(--cartouche-picker-dialog-footer-bg)",
      "#f1f5f9",
    ],
    [
      ".picker-dialog-footer",
      "border-top",
      "0.0625rem solid var(--cartouche-dialog-footer-border)",
      "0.0625rem solid #e2e8f0",
    ],
    // BasicWidget and OverlapTabWidget
    [
      ".widget-drop-overlay-badge",
      "color",
      "var(--cartouche-drop-target-badge-fg)",
      "#ffffff",
    ],
    [
      ".widget-drop-overlay-badge",
      "box-shadow",
      "0 0.125rem 0.25rem var(--cartouche-drop-target-badge-shadow)",
      "0 0.125rem 0.25rem rgba(0, 0, 0, 0.16)",
    ],
    [
      ".basic-widget-title",
      "color",
      "var(--cartouche-widget-title-fg)",
      "#0f172a",
    ],
    [
      ".overlap-tab-strip",
      "background-color",
      "var(--cartouche-overlap-tab-strip-bg)",
      "#e2e8f0",
    ],
    [
      ".overlap-tab-strip",
      "border-bottom",
      "0.0625rem solid var(--cartouche-overlap-tab-border)",
      "0.0625rem solid #cbd5e1",
    ],
    [
      ".overlap-tab-pane",
      "background-color",
      "var(--cartouche-widget-content-bg)",
      "#ffffff",
    ],
    // ColourPickerWidget
    ...[
      ".colour-picker-preview-box",
      ".colour-picker-surface",
      ".colour-picker-hue-strip",
      ".colour-picker-alpha-strip",
    ].map((selector): [string, string, string, string] => [
      selector,
      "border",
      "0.0625rem solid var(--cartouche-picker-control-border)",
      "0.0625rem solid #e2e8f0",
    ]),
    [
      ".colour-picker-channel-label",
      "color",
      "var(--cartouche-picker-channel-label-fg)",
      "#64748b",
    ],
    // TimestampSpinner, TimeFilterControls and TimeFilterWidget
    [
      ".timestamp-spinner-divider",
      "color",
      "var(--cartouche-timestamp-divider-fg)",
      "#64748b",
    ],
    [
      ".time-filter-divider",
      "background-color",
      "var(--cartouche-time-filter-divider-bg)",
      "#e2e8f0",
    ],
    [
      ".time-filter-step-arrows",
      "border-left",
      "0.0625rem solid var(--cartouche-time-filter-step-arrows-border)",
      "0.0625rem solid #e2e8f0",
    ],
    [
      ".time-filter-current-frame-caption",
      "color",
      "var(--cartouche-time-filter-frame-caption-fg)",
      "#64748b",
    ],
    [
      ".time-filter-current-frame-label",
      "color",
      "var(--cartouche-time-filter-frame-label-fg)",
      "#0f172a",
    ],
    // DetachedWindowPortal and LayerTreeWidget
    [
      ".detached-window-body",
      "background-color",
      "var(--cartouche-detached-window-body-bg)",
      "#ffffff",
    ],
    [
      ".detached-window-body",
      "color",
      "var(--cartouche-detached-window-body-fg)",
      "#000000",
    ],
    [
      ".layer-tree-viewport",
      "background-color",
      "var(--cartouche-layer-tree-bg)",
      "#ffffff",
    ],
  ];

  it("declares the colours moved out of renderer TSX in workbench.css classes, rendering the same colours (#361)", () => {
    for (const [selector, property, value, colour] of movedFromTsx) {
      const actual = selectorDeclaration(selector, property);
      assert.equal(actual, value, `${selector} ${property}`);
      assert.equal(
        resolveThemeTokens(value),
        colour,
        `${selector} ${property} must still render ${colour}`
      );
    }
  });

  it("reads every --cartouche-* and --dockview-* token theme-default.css defines, in theme-default.css, workbench.css or the TypeScript sources (#360)", () => {
    const defined = [...definedTokens()].filter((token) =>
      /^--(?:cartouche|dockview)-/.test(token)
    );
    assert.ok(defined.length > 100, "theme-default.css defines its tokens");
    const read = readTokens(
      [
        stripCssComments(THEME_CSS),
        stripCssComments(WORKBENCH_CSS),
        ...sources.map(({ text }) => text),
      ].join("\n")
    );
    const unread = defined.filter((token) => !read.has(token));
    assert.deepEqual(
      unread,
      [],
      `theme-default.css defines tokens nothing reads: ${unread.join(", ")}`
    );
  });

  it("removes the unread tokens and the rules that matched no element (#360)", () => {
    for (const token of [
      "--cartouche-theme-accent",
      "--cartouche-theme-accent-hover",
      "--cartouche-theme-danger-hover",
      "--cartouche-theme-border-dropdown",
      "--cartouche-theme-activity-bar-bg",
      "--cartouche-theme-side-bar-bg",
      "--cartouche-theme-editor-bg",
      "--cartouche-theme-panel-bg",
      "--cartouche-theme-tab-border",
      "--cartouche-theme-badge-bg",
      "--cartouche-theme-button-bg",
      "--cartouche-widget-content-fg",
      "--cartouche-cell-editor-fg",
      "--cartouche-toolbar-drag-handle-hover-fg",
    ]) {
      assert.doesNotMatch(
        THEME_CSS,
        new RegExp(`(?<![\\w-])${token}\\s*:`),
        `theme-default.css must not define the unread ${token}`
      );
    }
    // No component renders these classes, so their rules are removed.
    for (const dead of [
      ".toolbar-panel",
      ".toolbar-item",
      ".toolbar-drag-handle",
      ".toolbar-buttons-group",
      ".layer-tree-item",
    ]) {
      assert.ok(
        !WORKBENCH_CSS.includes(dead),
        `workbench.css must not style the unrendered ${dead}`
      );
    }
  });

  it("defines the window close button and undocked Widget shadow Tier 2 tokens, rendering the same colours (#360)", () => {
    const expected: Record<string, string> = {
      "--cartouche-menubar-window-close-hover-bg": "--cartouche-theme-danger",
      "--cartouche-menubar-window-close-hover-fg":
        "--cartouche-theme-fg-inverted",
      "--cartouche-widget-undocked-shadow": "--cartouche-theme-shadow-strong",
    };
    assertMappings(expected);
    const rendered: [string, string, string, string][] = [
      [".app-title-badge", "color", "var(--cartouche-menubar-fg)", "#ffffff"],
      [
        ".menu-dropdown-trigger",
        "color",
        "var(--cartouche-menubar-fg)",
        "#ffffff",
      ],
      [".win-btn", "color", "var(--cartouche-menubar-fg)", "#ffffff"],
      [
        ".win-btn.win-close:hover",
        "background-color",
        "var(--cartouche-menubar-window-close-hover-bg)",
        "#dc2626",
      ],
      [
        ".win-btn.win-close:hover",
        "color",
        "var(--cartouche-menubar-window-close-hover-fg)",
        "#ffffff",
      ],
      [
        ".cartouche-widget.is-undocked",
        "box-shadow",
        "0 8px 24px var(--cartouche-widget-undocked-shadow)",
        "0 8px 24px rgba(0, 0, 0, 0.24)",
      ],
      [
        ".layer-field-override-badge",
        "background-color",
        "var(--cartouche-field-type-overridden-bg)",
        "#f0fdf4",
      ],
      [
        ".layer-field-override-badge",
        "color",
        "var(--cartouche-field-type-overridden-fg)",
        "#16a34a",
      ],
    ];
    for (const [selector, property, value, colour] of rendered) {
      const actual = selectorDeclaration(selector, property);
      assert.equal(actual, value, `${selector} ${property}`);
      assert.equal(
        resolveThemeTokens(value),
        colour,
        `${selector} ${property} must still render ${colour}`
      );
    }
  });

  it("defines the PreferencesDialog Tier 2 tokens, each mapped to the primitive its rule read before (#358)", () => {
    const expected: Record<string, string> = {
      "--cartouche-preferences-border": "--cartouche-theme-border-strong",
      "--cartouche-preferences-shadow": "--cartouche-theme-shadow-strong",
      "--cartouche-preferences-title-fg": "--cartouche-theme-fg-primary",
      "--cartouche-preferences-title-icon-fg": "--cartouche-theme-primary",
      "--cartouche-preferences-close-fg": "--cartouche-theme-fg-muted",
      "--cartouche-preferences-close-hover-bg":
        "--cartouche-theme-surface-active",
      "--cartouche-preferences-close-hover-fg": "--cartouche-theme-fg-primary",
      "--cartouche-preferences-sidebar-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-preferences-sidebar-border": "--cartouche-theme-border",
      "--cartouche-preferences-sidebar-title-fg": "--cartouche-theme-fg-subtle",
      "--cartouche-preferences-tab-hover-bg": "--cartouche-theme-surface-alt",
      "--cartouche-preferences-tab-hover-fg": "--cartouche-theme-fg-primary",
      "--cartouche-preferences-tab-selected-fg": "--cartouche-theme-primary",
      "--cartouche-preferences-section-title-fg":
        "--cartouche-theme-fg-primary",
      "--cartouche-preferences-section-title-border":
        "--cartouche-theme-border",
      "--cartouche-preferences-empty-fg": "--cartouche-theme-fg-muted",
      "--cartouche-preferences-group-bg": "--cartouche-theme-surface",
      "--cartouche-preferences-group-border": "--cartouche-theme-border-strong",
      "--cartouche-preferences-group-legend-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-item-name-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-text-input-fg": "--cartouche-theme-fg-primary",
      "--cartouche-preferences-toggle-bg": "--cartouche-theme-surface",
      "--cartouche-preferences-toggle-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-toggle-border":
        "--cartouche-theme-border-strong",
      "--cartouche-preferences-toggle-toggled-on-bg":
        "--cartouche-theme-primary",
      "--cartouche-preferences-toggle-toggled-on-fg":
        "--cartouche-theme-fg-inverted",
      "--cartouche-preferences-toggle-toggled-on-border":
        "--cartouche-theme-primary",
      "--cartouche-preferences-switch-bg": "--cartouche-theme-border-strong",
      "--cartouche-preferences-switch-toggled-on-bg":
        "--cartouche-theme-primary",
      "--cartouche-preferences-switch-thumb-bg": "--cartouche-theme-surface",
      "--cartouche-preferences-switch-thumb-shadow": "--cartouche-theme-shadow",
      "--cartouche-preferences-button-group-border":
        "--cartouche-theme-border-strong",
      "--cartouche-preferences-button-group-item-bg":
        "--cartouche-theme-surface",
      "--cartouche-preferences-button-group-item-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-button-group-item-toggled-on-bg":
        "--cartouche-theme-primary",
      "--cartouche-preferences-button-group-item-toggled-on-fg":
        "--cartouche-theme-fg-inverted",
      "--cartouche-preferences-value-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-image-picker-bg": "--cartouche-theme-surface",
      "--cartouche-preferences-image-picker-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-image-picker-border":
        "--cartouche-theme-border-strong",
      "--cartouche-preferences-radio-label-fg": "--cartouche-theme-fg",
      "--cartouche-preferences-checkbox-label-fg":
        "--cartouche-theme-fg-primary",
      "--cartouche-preferences-unit-fg": "--cartouche-theme-fg-muted",
      "--cartouche-preferences-footer-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-preferences-footer-border": "--cartouche-theme-border",
      "--cartouche-preferences-shortcut-hint-fg": "--cartouche-theme-fg-subtle",
      "--cartouche-preferences-button-secondary-fg":
        "--cartouche-theme-fg-muted",
      "--cartouche-preferences-button-secondary-hover-bg":
        "--cartouche-theme-surface-alt",
      "--cartouche-preferences-button-secondary-hover-fg":
        "--cartouche-theme-fg-primary",
      "--cartouche-preferences-button-secondary-hover-border":
        "--cartouche-theme-fg-subtle",
      "--cartouche-preferences-button-primary-hover-bg":
        "--cartouche-theme-primary-hover",
      "--cartouche-preferences-resize-handle-fg": "--cartouche-theme-fg-subtle",
      "--cartouche-preferences-resize-handle-hover-fg":
        "--cartouche-theme-primary",
    };
    assertMappings(expected);
  });

  it("reads only defined Tier 2 tokens in the PreferencesDialog colour declarations (#358)", () => {
    const colourProperty =
      /^(color|background(-color)?|border(-[a-z]+)*|box-shadow|outline(-color)?|fill|stroke|accent-color|caret-color)$/;
    let colourDeclarations = 0;
    for (const rule of parseRules(WORKBENCH_CSS)) {
      if (!rule.selectors.some((s) => /\.preferences?-/.test(s))) continue;
      for (const { property, value } of declarationsOf(rule.body)) {
        if (!colourProperty.test(property)) continue;
        for (const token of readTokens(value)) {
          if (!token.startsWith("--cartouche-")) continue;
          colourDeclarations++;
          const where = `${rule.selectors.join(", ")} { ${property}: ${value} }`;
          assert.ok(
            !token.startsWith("--cartouche-theme-"),
            `${where} reads Tier 1 primitive ${token}`
          );
          assert.ok(
            tokenValue(token) !== undefined,
            `${where} reads undefined token ${token}`
          );
        }
      }
    }
    assert.ok(
      colourDeclarations > 60,
      `expected the PreferencesDialog colour declarations, found ${colourDeclarations}`
    );
  });

  it("defines the Dialog title bar and About ModalDialog Tier 2 tokens (#355)", () => {
    // Each Dialog token mapped to the Tier 1 primitive its rule read before #355,
    // so no rendered colour changes.
    const dialogTokenMappings: Record<string, string> = {
      "--cartouche-dialog-titlebar-bg": "--cartouche-theme-primary",
      "--cartouche-dialog-titlebar-fg": "--cartouche-theme-fg-inverted",
      "--cartouche-dialog-titlebar-button-hover-bg":
        "--cartouche-theme-overlay-hover-on-primary",
      "--cartouche-dialog-bg": "--cartouche-theme-surface",
      "--cartouche-dialog-fg": "--cartouche-theme-fg-primary",
      "--cartouche-dialog-border": "--cartouche-theme-border-strong",
      "--cartouche-dialog-shadow": "--cartouche-theme-shadow-strong",
      "--cartouche-dialog-header-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-dialog-header-fg": "--cartouche-theme-fg",
      "--cartouche-dialog-header-border": "--cartouche-theme-border",
      "--cartouche-dialog-subtitle-fg": "--cartouche-theme-fg-muted",
      "--cartouche-dialog-inset-bg": "--cartouche-theme-surface-alt",
      "--cartouche-dialog-footer-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-dialog-footer-border": "--cartouche-theme-border",
      "--cartouche-dialog-button-hover-bg": "--cartouche-theme-primary-hover",
    };
    assertMappings(dialogTokenMappings);
    for (const token of Object.keys(dialogTokenMappings)) {
      assert.ok(
        WORKBENCH_CSS.includes(`var(${token})`),
        `workbench.css must read ${token}`
      );
    }

    // No colour declaration in the Dialog title bar or About ModalDialog rules
    // reads a Tier 1 primitive or another subsystem's (menubar) tokens.
    const selectors = [
      ".cartouche-dialog-header",
      ".picker-dialog-header",
      ".cartouche-dialog-close-btn",
      ".cartouche-dialog-close-btn:hover",
      ".modal-dialog",
      ".modal-header",
      ".modal-subtitle",
      ".modal-body",
      ".modal-specs",
      ".modal-footer",
      ".modal-btn",
      ".modal-btn:hover",
    ];
    const colourProperty =
      /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|box-shadow|outline(-color)?)$/;
    for (const selector of selectors) {
      const rules = rulesFor(selector);
      assert.ok(
        rules.length > 0,
        `workbench.css must contain a ${selector} rule`
      );
      for (const rule of rules) {
        for (const { property, value } of declarationsOf(rule.body)) {
          if (!colourProperty.test(property)) continue;
          assert.ok(
            !/--cartouche-(theme|menubar)-/.test(value),
            `${selector} must read Dialog Tier 2 tokens, not: ${property}: ${value}`
          );
        }
      }
    }
  });

  it("defines the menu Tier 2 tokens (#353)", () => {
    // Each menu token maps to the Tier 1 primitive its rule read before #353, so no rendered colour changes.
    const menuTokens: Record<string, string> = {
      "--cartouche-menu-bg": "--cartouche-theme-surface",
      "--cartouche-menu-fg": "--cartouche-theme-fg-primary",
      "--cartouche-menu-border": "--cartouche-theme-border-strong",
      "--cartouche-menu-shadow": "--cartouche-theme-shadow",
      "--cartouche-menu-title-fg": "--cartouche-theme-fg-muted",
      "--cartouche-menu-item-hover-bg": "--cartouche-theme-primary",
      "--cartouche-menu-item-hover-fg": "--cartouche-theme-fg-inverted",
      "--cartouche-menu-item-disabled-fg": "--cartouche-theme-fg-subtle",
      "--cartouche-menu-check-fg": "--cartouche-theme-primary",
      "--cartouche-menu-check-hover-fg": "--cartouche-theme-fg-inverted",
      "--cartouche-menu-shortcut-fg": "--cartouche-theme-fg-muted",
      "--cartouche-menu-shortcut-hover-fg": "--cartouche-theme-border",
      "--cartouche-menu-separator": "--cartouche-theme-border",
    };
    assertMappings(menuTokens);
  });

  it("reads no Tier 1 primitive in any colour declaration of the menubar menu and PopupMenu rules (#353)", () => {
    const menuSelector =
      /\.(menu-dropdown(?!-trigger)|menu-submenu-dropdown|menu-item-check-slot|menu-shortcut-slot|menu-key-slot|toolbar-context-menu|context-menu-)/;
    const offenders: string[] = [];
    let menuRules = 0;
    for (const rule of parseRules(WORKBENCH_CSS)) {
      if (!rule.selectors.some((s) => menuSelector.test(s))) continue;
      menuRules++;
      for (const { property, value } of declarationsOf(rule.body)) {
        if (/var\(--cartouche-theme-/.test(value))
          offenders.push(
            `${rule.selectors.join(", ")} { ${property}: ${value} }`
          );
      }
    }
    assert.ok(menuRules >= 15, `expected the menu rules, found ${menuRules}`);
    assert.deepEqual(offenders, []);
  });

  it("defines the TimeFilterWidget, ColourButton, BasicWidget control and Workbench shell Tier 2 tokens (#359)", () => {
    // Each new token maps to the Tier 1 primitive its rule read before #359, so no rendered colour changes.
    const expectedMappings: Record<string, string> = {
      // Workbench shell
      "--cartouche-workbench-bg": "--cartouche-theme-surface",
      "--cartouche-workbench-fg": "--cartouche-theme-fg",
      "--cartouche-map-viewport-bg": "--cartouche-theme-surface",
      "--cartouche-detached-window-bg": "--cartouche-theme-surface",
      // BasicWidget controls
      "--cartouche-widget-control-hover-bg": "--cartouche-theme-surface-alt",
      "--cartouche-widget-control-hover-fg": "--cartouche-theme-fg-primary",
      "--cartouche-widget-menu-item-hover-bg": "--cartouche-theme-surface-alt",
      // TimeFilterWidget buttons and slider
      "--cartouche-time-filter-button-hover-bg":
        "--cartouche-theme-surface-alt",
      "--cartouche-time-filter-button-pressed-bg":
        "--cartouche-theme-surface-active",
      "--cartouche-time-filter-track-bg": "--cartouche-theme-border-strong",
      "--cartouche-time-filter-thumb-bg": "--cartouche-theme-primary",
      "--cartouche-time-filter-thumb-hover-bg":
        "--cartouche-theme-primary-hover",
      "--cartouche-time-filter-thumb-pressed-bg":
        "--cartouche-theme-primary-active",
      "--cartouche-time-filter-thumb-disabled-bg": "--cartouche-theme-fg-muted",
      // ColourButton
      "--cartouche-picker-button-bg": "--cartouche-theme-surface",
      "--cartouche-picker-button-border": "--cartouche-theme-border-strong",
      "--cartouche-picker-button-hover-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-picker-button-hover-border": "--cartouche-theme-fg-subtle",
      "--cartouche-picker-button-disabled-bg": "--cartouche-theme-surface-alt",
      "--cartouche-picker-swatch-checker-light":
        "--cartouche-theme-checker-light",
      "--cartouche-picker-swatch-checker-dark":
        "--cartouche-theme-checker-dark",
      "--cartouche-picker-swatch-outline": "--cartouche-theme-fg-subtle",
    };

    assertMappings(expectedMappings);
  });

  it("reads no Tier 1 primitive in the TimeFilterWidget, ColourButton, BasicWidget control and Workbench shell rules (#359)", () => {
    const subsystemSelector =
      /\.time-filter-btn|\.time-filter-slider|\.picker-button|\.widget-control-btn:hover|\.widget-menu-item:hover|\.workbench-container|\.workbench-main|\.dockview-wrapper|\.ol-viewport|\.detached-portal-container/;
    const offenders: string[] = [];
    let ruleCount = 0;
    for (const rule of parseRules(WORKBENCH_CSS)) {
      if (!rule.selectors.some((s) => subsystemSelector.test(s))) continue;
      ruleCount++;
      for (const { property, value } of declarationsOf(rule.body)) {
        if (value.includes("var(--cartouche-theme-"))
          offenders.push(
            `${rule.selectors.join(", ")} { ${property}: ${value} }`
          );
      }
    }
    assert.ok(ruleCount > 20, "the subsystem rules must be found");
    assert.deepEqual(offenders, []);
  });

  it("defines --cartouche-theme-fg-secondary as #475569, an AA-contrast text colour on surface-alt (Spec #322)", () => {
    assert.equal(tokenValue("--cartouche-theme-fg-secondary"), "#475569");
  });

  it("maps every TableWidget token to the base token the spec assigns it (Spec #322 / Ticket #323)", () => {
    const expected: Record<string, string> = {
      "--cartouche-table-border": "--cartouche-theme-border-dark",
      "--cartouche-table-column-line": "--cartouche-theme-border-strong",
      "--cartouche-table-row-line": "--cartouche-theme-border",
      "--cartouche-table-header-bg": "--cartouche-theme-surface-widget",
      "--cartouche-table-header-fg": "--cartouche-theme-fg",
      "--cartouche-table-bg": "--cartouche-theme-surface",
      "--cartouche-table-fg": "--cartouche-theme-fg",
      "--cartouche-table-row-alt-bg": "--cartouche-theme-surface-subtle",
      "--cartouche-table-row-selected-bg": "--cartouche-theme-info-subtle",
      "--cartouche-table-row-active-bg": "--cartouche-theme-info",
      "--cartouche-table-row-active-fg": "--cartouche-theme-fg",
      "--cartouche-table-readonly-fg": "--cartouche-theme-fg-muted",
      "--cartouche-table-readonly-selected-bg": "--cartouche-theme-surface-alt",
      "--cartouche-table-readonly-selected-fg":
        "--cartouche-theme-fg-secondary",
    };
    assertMappings(expected);
  });

  it("guarantees referential integrity of all var() references within theme-default.css", () => {
    const defined = definedTokens();
    const unresolved = [...readTokens(THEME_CSS)].filter(
      (token) => !defined.has(token)
    );

    assert.deepEqual(
      unresolved,
      [],
      `All var() references in theme-default.css must refer to defined tokens. Unresolved: ${unresolved.join(", ")}`
    );
  });

  it("ensures theme.css aliases theme-default.css for backward compatibility", () => {
    const content = fs.readFileSync(themeCssPath, "utf-8");
    assert.ok(
      content.includes('@import "./themes/theme-default.css";')
        || content.includes("@import './themes/theme-default.css';"),
      "theme.css must import ./themes/theme-default.css for backward compatibility"
    );
  });

  it("ensures third-party structural dockview stylesheet is imported in workbench.css", () => {
    assert.ok(
      WORKBENCH_CSS.includes("dockview-react/dist/styles/dockview.css"),
      "workbench.css must import dockview-react/dist/styles/dockview.css"
    );
  });

  it("ensures index.html links to cartouche-theme-stylesheet with canonical default theme", () => {
    const content = fs.readFileSync(indexHtmlPath, "utf-8");
    assert.ok(
      content.includes('id="cartouche-theme-stylesheet"'),
      'index.html must contain link with id="cartouche-theme-stylesheet"'
    );
    assert.ok(
      content.includes('href="./styles/themes/theme-default.css"'),
      "index.html must reference ./styles/themes/theme-default.css"
    );
  });

  it('verifies that @import "./theme.css" is removed from workbench.css (Ticket #198)', () => {
    assert.ok(
      !WORKBENCH_CSS.includes('@import "./theme.css"'),
      "workbench.css must not import ./theme.css"
    );
    assert.ok(
      !WORKBENCH_CSS.includes("@import './theme.css'"),
      "workbench.css must not import ./theme.css"
    );
  });

  it("asserts that 0 bare hex, rgb, or rgba color literals remain in workbench.css outside comments (Ticket #198)", () => {
    const content = WORKBENCH_CSS;
    // Strip multi-line comments preserving line counts
    const noComments = content.replace(/\/\*[\s\S]*?\*\//g, (m) =>
      m.replace(/[^\n]/g, " ")
    );
    const lines = noComments.split("\n");
    const origLines = content.split("\n");
    const bareColorRegex = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\))/g;

    const bareColorViolations: string[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(bareColorRegex);
      if (match) {
        bareColorViolations.push(
          `Line ${idx + 1}: ${origLines[idx].trim()} (matched: ${match.join(", ")})`
        );
      }
    });

    assert.deepEqual(
      bareColorViolations,
      [],
      `workbench.css must contain 0 bare color literals. Found ${bareColorViolations.length} violations:\n${bareColorViolations.join("\n")}`
    );
  });
});
