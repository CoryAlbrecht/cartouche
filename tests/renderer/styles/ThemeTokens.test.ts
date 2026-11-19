/**
 * @file ThemeTokens.test.ts
 * @module tests/renderer/styles/ThemeTokens.test
 * @description Automated verification test suite for Cartouche Two-Tier CSS theme token architecture (Tier 1 Theme Primitives and Tier 2 Component Tokens), verifying token definition, syntax validity, referential integrity, and decoupling from structural workbench stylesheet (ADR 0027 / Spec #195).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-07
 * @updated 2026-11-18
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { declaration, resolveThemeTokens, rulesFor } from "./cssRules";

describe("Cartouche Two-Tier CSS Theme Token Architecture (ADR 0027 / Ticket #196)", () => {
  const rootDir = process.cwd();
  const defaultThemeCssPath = path.resolve(
    rootDir,
    "src/renderer/styles/themes/theme-default.css"
  );
  const themeCssPath = path.resolve(rootDir, "src/renderer/styles/theme.css");
  const workbenchCssPath = path.resolve(
    rootDir,
    "src/renderer/styles/workbench.css"
  );
  const indexHtmlPath = path.resolve(rootDir, "src/renderer/index.html");

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
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");

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
      "--cartouche-theme-border-dropdown",
      // Foreground & Typography
      "--cartouche-theme-fg",
      "--cartouche-theme-fg-muted",
      "--cartouche-theme-fg-subtle",
      "--cartouche-theme-fg-secondary",
      "--cartouche-theme-fg-inverted",
      "--cartouche-theme-fg-primary",
      // Accents & Interaction
      "--cartouche-theme-accent",
      "--cartouche-theme-accent-hover",
      "--cartouche-theme-accent-subtle",
      "--cartouche-theme-accent-focus",
      // Status Colors
      "--cartouche-theme-danger",
      "--cartouche-theme-danger-hover",
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

    for (const token of tier1Primitives) {
      assert.ok(
        content.includes(`${token}:`),
        `theme-default.css must define Tier 1 primitive: ${token}`
      );
    }
  });

  it("defines all required Tier 2 Component Tokens mapped by UI subsystem in theme-default.css", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");

    const tier2ComponentTokens = [
      // Menubar
      "--cartouche-menubar-bg",
      "--cartouche-menubar-fg",
      "--cartouche-menubar-hover",
      "--cartouche-menubar-border",
      // Status Bar
      "--cartouche-theme-status-bar-bg",
      "--cartouche-theme-status-bar-fg",
      "--cartouche-theme-status-bar-border",
      // Activity Bar
      "--cartouche-theme-activity-bar-bg",
      "--cartouche-theme-activity-bar-fg",
      "--cartouche-theme-activity-bar-inactive-fg",
      "--cartouche-theme-activity-bar-active-border",
      // Side Bar & Panels
      "--cartouche-theme-side-bar-bg",
      "--cartouche-theme-side-bar-fg",
      "--cartouche-theme-side-bar-border",
      "--cartouche-theme-editor-bg",
      "--cartouche-theme-panel-bg",
      "--cartouche-theme-panel-border",
      // Tab Groups & Headers
      "--cartouche-theme-tab-active-bg",
      "--cartouche-theme-tab-inactive-bg",
      "--cartouche-theme-tab-active-fg",
      "--cartouche-theme-tab-inactive-fg",
      "--cartouche-theme-tab-border",
      // Buttons & Badges
      "--cartouche-theme-badge-bg",
      "--cartouche-theme-badge-fg",
      "--cartouche-theme-button-bg",
      "--cartouche-theme-button-fg",
      "--cartouche-theme-button-hover-bg",
      // Dialog Buttons
      "--cartouche-button-primary-bg",
      "--cartouche-button-primary-fg",
      "--cartouche-button-primary-border",
      // Dockview Theme Overrides
      "--dockview-theme-background-color",
      "--dockview-theme-foreground-color",
      "--dockview-theme-border-color",
      "--dockview-theme-separator-color",
      "--dockview-theme-splitter-color",
      "--dockview-theme-active-border-color",
      // Widgets
      "--cartouche-widget-bg",
      "--cartouche-widget-border",
      "--cartouche-widget-header-bg",
      "--cartouche-widget-header-fg",
      "--cartouche-widget-header-border",
      "--cartouche-widget-content-bg",
      "--cartouche-widget-content-fg",
      // Menus & Dropdowns
      "--cartouche-menu-bg",
      "--cartouche-menu-fg",
      "--cartouche-menu-border",
      "--cartouche-menu-item-hover-bg",
      "--cartouche-menu-item-hover-fg",
      "--cartouche-menu-separator",
      "--cartouche-menu-focus-color",
      // Toolbars
      "--cartouche-toolbar-bg",
      "--cartouche-toolbar-fg",
      "--cartouche-toolbar-border",
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

    for (const token of tier2ComponentTokens) {
      assert.ok(
        content.includes(`${token}:`),
        `theme-default.css must define Tier 2 component token: ${token}`
      );
    }
  });

  it("defines the toolbar Tier 2 tokens (#354)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
    const toolbarTokens = [
      "--cartouche-toolbar-container-bg",
      "--cartouche-toolbar-container-border",
      "--cartouche-toolbar-shadow",
      "--cartouche-toolbar-grabber-fg",
      "--cartouche-toolbar-drag-handle-hover-fg",
      "--cartouche-toolbar-grabber-hover-fg",
      "--cartouche-toolbar-divider-fg",
      "--cartouche-toolbar-item-hover-border",
      "--cartouche-toolbar-item-toggled-on-bg",
      "--cartouche-toolbar-item-toggled-on-fg",
      "--cartouche-toolbar-item-toggled-on-border",
      "--cartouche-toolbar-drop-marker-bg",
    ];
    for (const token of toolbarTokens) {
      assert.ok(
        content.includes(`${token}:`),
        `theme-default.css must define toolbar token: ${token}`
      );
    }
  });

  /**
   * Colours the toolbar container, ToolbarWidget, SplitToolButton and toolbar
   * drop-marker rules rendered before #354, keyed by selector and property.
   */
  const toolbarRenderedColours: [string, string, string][] = [
    [".toolbar-panel", "background-color", "#f8fafc"],
    [".toolbar-panel-top", "border-bottom", "1px solid #e2e8f0"],
    [".toolbar-panel-bottom", "border-top", "1px solid #e2e8f0"],
    [".toolbar-panel-left", "border-right", "1px solid #e2e8f0"],
    [".toolbar-panel-right", "border-left", "1px solid #e2e8f0"],
    [".toolbar-item", "background-color", "#ffffff"],
    [".toolbar-item", "border", "1px solid #cbd5e1"],
    [".toolbar-item", "box-shadow", "0 1px 2px rgba(0, 0, 0, 0.06)"],
    [".toolbar-drag-handle", "color", "#94a3b8"],
    [".toolbar-drag-handle:hover", "color", "#64748b"],
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
      const value = rulesFor(selector)
        .map((rule) => declaration(rule.body, property))
        .find((v) => v !== undefined);
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

  it("reads --cartouche-toolbar-bg, -fg, -border and -item-hover-bg in workbench.css (#354)", () => {
    const content = fs.readFileSync(workbenchCssPath, "utf-8");
    for (const token of [
      "--cartouche-toolbar-bg",
      "--cartouche-toolbar-fg",
      "--cartouche-toolbar-border",
      "--cartouche-toolbar-item-hover-bg",
    ]) {
      assert.ok(
        content.includes(`var(${token})`),
        `workbench.css must read ${token}`
      );
    }
  });

  it("defines --cartouche-theme-fg-secondary as #475569, an AA-contrast text colour on surface-alt (Spec #322)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
    assert.match(content, /--cartouche-theme-fg-secondary:\s*#475569;/);
  });

  it("maps every TableWidget token to the base token the spec assigns it (Spec #322 / Ticket #323)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
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
    for (const [token, base] of Object.entries(expected)) {
      const match = content.match(
        new RegExp(`${token}:\\s*var\\((--[a-z0-9-]+)\\);`)
      );
      assert.equal(match?.[1], base, `${token} must be var(${base})`);
    }
  });

  it("guarantees referential integrity of all var() references within theme-default.css", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");

    // Extract all defined CSS custom property names
    const definedProps = new Set<string>();
    const propRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
    let match: RegExpExecArray | null;
    while ((match = propRegex.exec(content)) !== null) {
      definedProps.add(match[1]);
    }

    // Extract all var(--name) usages
    const varUsageRegex = /var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*[^)]+)?\)/g;
    const unresolved: string[] = [];
    while ((match = varUsageRegex.exec(content)) !== null) {
      const referencedToken = match[1];
      if (!definedProps.has(referencedToken)) {
        unresolved.push(referencedToken);
      }
    }

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
    const content = fs.readFileSync(workbenchCssPath, "utf-8");
    assert.ok(
      content.includes("dockview-react/dist/styles/dockview.css"),
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
    const content = fs.readFileSync(workbenchCssPath, "utf-8");
    assert.ok(
      !content.includes('@import "./theme.css"'),
      "workbench.css must not import ./theme.css"
    );
    assert.ok(
      !content.includes("@import './theme.css'"),
      "workbench.css must not import ./theme.css"
    );
  });

  it("asserts that 0 bare hex, rgb, or rgba color literals remain in workbench.css outside comments (Ticket #198)", () => {
    const content = fs.readFileSync(workbenchCssPath, "utf-8");
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
