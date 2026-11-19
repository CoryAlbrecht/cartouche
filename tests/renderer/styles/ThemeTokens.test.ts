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

  it("defines the PreferencesDialog Tier 2 tokens, each mapped to the primitive its rule read before (#358)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
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
    for (const [token, base] of Object.entries(expected)) {
      const match = content.match(
        new RegExp(`${token}:\\s*var\\((--[a-z0-9-]+)\\);`)
      );
      assert.equal(match?.[1], base, `${token} must be var(${base})`);
    }
  });

  it("reads only defined Tier 2 tokens in the PreferencesDialog colour declarations (#358)", () => {
    const theme = fs.readFileSync(defaultThemeCssPath, "utf-8");
    const css = fs
      .readFileSync(workbenchCssPath, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const colourProperty =
      /^(color|background(-color)?|border(-[a-z]+)*|box-shadow|outline(-color)?|fill|stroke|accent-color|caret-color)$/;
    let colourDeclarations = 0;
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\.preferences?-/.test(selector)) continue;
      for (const declaration of body.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon < 0) continue;
        const property = declaration.slice(0, colon).trim();
        if (!colourProperty.test(property)) continue;
        for (const [, token] of declaration.matchAll(
          /var\((--cartouche-[a-z0-9-]+)/g
        )) {
          colourDeclarations++;
          const where = `${selector.trim()} { ${declaration.trim()} }`;
          assert.ok(
            !token.startsWith("--cartouche-theme-"),
            `${where} reads Tier 1 primitive ${token}`
          );
          assert.ok(
            theme.includes(`${token}:`),
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
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
    const workbench = fs.readFileSync(workbenchCssPath, "utf-8");

    // Each Dialog token mapped to the Tier 1 primitive its rule read before #355,
    // so no rendered colour changes.
    const dialogTokenMappings: Record<string, string> = {
      "--cartouche-dialog-titlebar-bg": "var(--cartouche-theme-primary)",
      "--cartouche-dialog-titlebar-fg": "var(--cartouche-theme-fg-inverted)",
      "--cartouche-dialog-bg": "var(--cartouche-theme-surface)",
      "--cartouche-dialog-fg": "var(--cartouche-theme-fg-primary)",
      "--cartouche-dialog-border": "var(--cartouche-theme-border-strong)",
      "--cartouche-dialog-shadow": "var(--cartouche-theme-shadow-strong)",
      "--cartouche-dialog-header-bg": "var(--cartouche-theme-surface-subtle)",
      "--cartouche-dialog-header-fg": "var(--cartouche-theme-fg)",
      "--cartouche-dialog-header-border": "var(--cartouche-theme-border)",
      "--cartouche-dialog-subtitle-fg": "var(--cartouche-theme-fg-muted)",
      "--cartouche-dialog-inset-bg": "var(--cartouche-theme-surface-alt)",
      "--cartouche-dialog-footer-bg": "var(--cartouche-theme-surface-subtle)",
      "--cartouche-dialog-footer-border": "var(--cartouche-theme-border)",
      "--cartouche-dialog-button-hover-bg":
        "var(--cartouche-theme-primary-hover)",
    };
    for (const [token, value] of Object.entries(dialogTokenMappings)) {
      assert.ok(
        content.includes(`${token}: ${value};`),
        `theme-default.css must map ${token} to ${value}`
      );
      assert.ok(
        workbench.includes(`var(${token})`),
        `workbench.css must read ${token}`
      );
    }

    // No colour declaration in the Dialog title bar or About ModalDialog rules
    // reads a Tier 1 primitive or another subsystem's (menubar) tokens.
    // `.cartouche-dialog-close-btn:hover` is owned by #350.
    const selectors = [
      ".cartouche-dialog-header",
      ".picker-dialog-header",
      ".cartouche-dialog-close-btn",
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
      /^\s*(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|box-shadow|outline(-color)?)\s*:(.*)$/;
    for (const selector of selectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(
        workbench
      );
      assert.ok(match, `workbench.css must contain a ${selector} rule`);
      for (const line of match[1].split("\n")) {
        const decl = colourProperty.exec(line);
        if (!decl) continue;
        assert.ok(
          !/--cartouche-(theme|menubar)-/.test(decl[6]),
          `${selector} must read Dialog Tier 2 tokens, not: ${line.trim()}`
        );
      }
    }
  });

  it("defines the menu Tier 2 tokens (#353)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
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
    for (const [token, primitive] of Object.entries(menuTokens)) {
      assert.match(
        content,
        new RegExp(`${token}:\\s*var\\(${primitive}\\);`),
        `theme-default.css must define ${token} as var(${primitive})`
      );
    }
  });

  it("reads no Tier 1 primitive in any colour declaration of the menubar menu and PopupMenu rules (#353)", () => {
    const content = fs
      .readFileSync(workbenchCssPath, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const menuSelector =
      /\.(menu-dropdown(?!-trigger)|menu-submenu-dropdown|menu-item-check-slot|menu-shortcut-slot|menu-key-slot|toolbar-context-menu|context-menu-)/;
    const offenders: string[] = [];
    let menuRules = 0;
    for (const match of content.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim();
      if (!menuSelector.test(selector)) continue;
      menuRules++;
      for (const decl of match[2].split(";")) {
        if (/var\(--cartouche-theme-/.test(decl)) {
          offenders.push(`${selector} { ${decl.trim()} }`);
        }
      }
    }
    assert.ok(menuRules >= 15, `expected the menu rules, found ${menuRules}`);
    assert.deepEqual(offenders, []);
  });

  it("defines the TimeFilterWidget, ColourButton, BasicWidget control and Workbench shell Tier 2 tokens (#359)", () => {
    const content = fs.readFileSync(defaultThemeCssPath, "utf-8");
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

    for (const [token, primitive] of Object.entries(expectedMappings)) {
      const match = content.match(new RegExp(`${token}:\\s*([^;]+);`));
      assert.ok(match, `theme-default.css must define Tier 2 token ${token}`);
      assert.equal(
        match[1].trim(),
        `var(${primitive})`,
        `${token} must map to ${primitive}`
      );
    }
  });

  it("reads no Tier 1 primitive in the TimeFilterWidget, ColourButton, BasicWidget control and Workbench shell rules (#359)", () => {
    const css = fs
      .readFileSync(workbenchCssPath, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const subsystemSelector =
      /\.time-filter-btn|\.time-filter-slider|\.picker-button|\.widget-control-btn:hover|\.widget-menu-item:hover|\.workbench-container|\.workbench-main|\.dockview-wrapper|\.ol-viewport|\.detached-portal-container/;
    const offenders: string[] = [];
    let ruleCount = 0;
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!subsystemSelector.test(selector)) continue;
      ruleCount++;
      for (const declaration of body.split(";")) {
        if (declaration.includes("var(--cartouche-theme-")) {
          offenders.push(`${selector.trim()} { ${declaration.trim()} }`);
        }
      }
    }
    assert.ok(ruleCount > 20, "the subsystem rules must be found");
    assert.deepEqual(offenders, []);
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
