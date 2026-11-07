/**
 * @file ThemeTokens.test.ts
 * @module tests/renderer/styles/ThemeTokens.test
 * @description Automated verification test suite for Cartouche Two-Tier CSS theme token architecture (Tier 1 Theme Primitives and Tier 2 Component Tokens), verifying token definition, syntax validity, referential integrity, and decoupling from structural workbench stylesheet (ADR 0027 / Spec #195).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-07
 * @updated 2026-11-07
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Cartouche Two-Tier CSS Theme Token Architecture (ADR 0027 / Ticket #196)', () => {
  const rootDir = process.cwd();
  const defaultThemeCssPath = path.resolve(
    rootDir,
    'src/renderer/styles/themes/theme-default.css'
  );
  const themeCssPath = path.resolve(rootDir, 'src/renderer/styles/theme.css');
  const workbenchCssPath = path.resolve(
    rootDir,
    'src/renderer/styles/workbench.css'
  );
  const indexHtmlPath = path.resolve(rootDir, 'src/renderer/index.html');

  it('verifies that canonical default theme stylesheet exists and has non-zero size', () => {
    assert.ok(
      fs.existsSync(defaultThemeCssPath),
      'src/renderer/styles/themes/theme-default.css must exist'
    );
    const stats = fs.statSync(defaultThemeCssPath);
    assert.ok(
      stats.size > 500,
      `theme-default.css must be a non-empty stylesheet (size: ${stats.size} bytes)`
    );
  });

  it('defines all required Tier 1 Theme Primitives in theme-default.css', () => {
    const content = fs.readFileSync(defaultThemeCssPath, 'utf-8');

    const tier1Primitives = [
      // Primary & Brand Accents
      '--cartouche-theme-primary',
      '--cartouche-theme-primary-hover',
      '--cartouche-theme-primary-active',
      // Surfaces & Backgrounds
      '--cartouche-theme-bg',
      '--cartouche-theme-surface',
      '--cartouche-theme-surface-subtle',
      '--cartouche-theme-surface-widget',
      '--cartouche-theme-surface-alt',
      '--cartouche-theme-surface-hover',
      '--cartouche-theme-surface-active',
      // Borders & Dividers
      '--cartouche-theme-border',
      '--cartouche-theme-border-subtle',
      '--cartouche-theme-border-strong',
      '--cartouche-theme-border-widget',
      '--cartouche-theme-border-dark',
      '--cartouche-theme-border-dropdown',
      // Foreground & Typography
      '--cartouche-theme-fg',
      '--cartouche-theme-fg-muted',
      '--cartouche-theme-fg-subtle',
      '--cartouche-theme-fg-inverted',
      '--cartouche-theme-fg-primary',
      // Accents & Interaction
      '--cartouche-theme-accent',
      '--cartouche-theme-accent-hover',
      '--cartouche-theme-accent-subtle',
      '--cartouche-theme-accent-focus',
      // Status Colors
      '--cartouche-theme-danger',
      '--cartouche-theme-danger-hover',
      '--cartouche-theme-danger-subtle',
      '--cartouche-theme-warning',
      '--cartouche-theme-warning-subtle',
      '--cartouche-theme-success',
      '--cartouche-theme-success-subtle',
      '--cartouche-theme-info',
      '--cartouche-theme-info-subtle',
    ];

    for (const token of tier1Primitives) {
      assert.ok(
        content.includes(`${token}:`),
        `theme-default.css must define Tier 1 primitive: ${token}`
      );
    }
  });

  it('defines all required Tier 2 Component Tokens mapped by UI subsystem in theme-default.css', () => {
    const content = fs.readFileSync(defaultThemeCssPath, 'utf-8');

    const tier2ComponentTokens = [
      // Menubar
      '--cartouche-menubar-bg',
      '--cartouche-menubar-fg',
      '--cartouche-menubar-hover',
      '--cartouche-menubar-border',
      // Status Bar
      '--cartouche-theme-status-bar-bg',
      '--cartouche-theme-status-bar-fg',
      '--cartouche-theme-status-bar-border',
      // Activity Bar
      '--cartouche-theme-activity-bar-bg',
      '--cartouche-theme-activity-bar-fg',
      '--cartouche-theme-activity-bar-inactive-fg',
      '--cartouche-theme-activity-bar-active-border',
      // Side Bar & Panels
      '--cartouche-theme-side-bar-bg',
      '--cartouche-theme-side-bar-fg',
      '--cartouche-theme-side-bar-border',
      '--cartouche-theme-editor-bg',
      '--cartouche-theme-panel-bg',
      '--cartouche-theme-panel-border',
      // Tab Groups & Headers
      '--cartouche-theme-tab-active-bg',
      '--cartouche-theme-tab-inactive-bg',
      '--cartouche-theme-tab-active-fg',
      '--cartouche-theme-tab-inactive-fg',
      '--cartouche-theme-tab-border',
      // Buttons & Badges
      '--cartouche-theme-badge-bg',
      '--cartouche-theme-badge-fg',
      '--cartouche-theme-button-bg',
      '--cartouche-theme-button-fg',
      '--cartouche-theme-button-hover-bg',
      // Dockview Theme Overrides
      '--dockview-theme-background-color',
      '--dockview-theme-foreground-color',
      '--dockview-theme-border-color',
      '--dockview-theme-separator-color',
      '--dockview-theme-splitter-color',
      '--dockview-theme-active-border-color',
      // Widgets
      '--cartouche-widget-bg',
      '--cartouche-widget-border',
      '--cartouche-widget-header-bg',
      '--cartouche-widget-header-fg',
      '--cartouche-widget-header-border',
      '--cartouche-widget-content-bg',
      '--cartouche-widget-content-fg',
      // Menus & Dropdowns
      '--cartouche-menu-bg',
      '--cartouche-menu-fg',
      '--cartouche-menu-border',
      '--cartouche-menu-item-hover-bg',
      '--cartouche-menu-item-hover-fg',
      '--cartouche-menu-separator',
      // Toolbars
      '--cartouche-toolbar-bg',
      '--cartouche-toolbar-fg',
      '--cartouche-toolbar-border',
      '--cartouche-toolbar-item-hover-bg',
      '--cartouche-toolbar-item-active-bg',
      // Dialogs
      '--cartouche-dialog-bg',
      '--cartouche-dialog-fg',
      '--cartouche-dialog-border',
      '--cartouche-dialog-header-bg',
      '--cartouche-dialog-header-fg',
      '--cartouche-dialog-header-border',
      '--cartouche-dialog-backdrop',
      // Tables
      '--cartouche-table-bg',
      '--cartouche-table-fg',
      '--cartouche-table-header-bg',
      '--cartouche-table-header-fg',
      '--cartouche-table-border',
      '--cartouche-table-row-hover-bg',
      '--cartouche-table-row-selected-bg',
      '--cartouche-table-row-alt-bg',
      // Inputs
      '--cartouche-input-bg',
      '--cartouche-input-fg',
      '--cartouche-input-border',
      '--cartouche-input-focus-border',
      '--cartouche-input-focus-ring',
      // Drop Targets
      '--cartouche-drop-target-bg',
      '--cartouche-drop-target-border',
    ];

    for (const token of tier2ComponentTokens) {
      assert.ok(
        content.includes(`${token}:`),
        `theme-default.css must define Tier 2 component token: ${token}`
      );
    }
  });

  it('guarantees referential integrity of all var() references within theme-default.css', () => {
    const content = fs.readFileSync(defaultThemeCssPath, 'utf-8');

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
      `All var() references in theme-default.css must refer to defined tokens. Unresolved: ${unresolved.join(', ')}`
    );
  });

  it('ensures theme.css aliases theme-default.css for backward compatibility', () => {
    const content = fs.readFileSync(themeCssPath, 'utf-8');
    assert.ok(
      content.includes('@import "./themes/theme-default.css";') ||
        content.includes("@import './themes/theme-default.css';"),
      'theme.css must import ./themes/theme-default.css for backward compatibility'
    );
  });

  it('ensures third-party structural dockview stylesheet is imported in workbench.css', () => {
    const content = fs.readFileSync(workbenchCssPath, 'utf-8');
    assert.ok(
      content.includes('dockview-react/dist/styles/dockview.css'),
      'workbench.css must import dockview-react/dist/styles/dockview.css'
    );
  });

  it('ensures index.html links to cartouche-theme-stylesheet with canonical default theme', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf-8');
    assert.ok(
      content.includes('id="cartouche-theme-stylesheet"'),
      'index.html must contain link with id="cartouche-theme-stylesheet"'
    );
    assert.ok(
      content.includes('href="./styles/themes/theme-default.css"'),
      'index.html must reference ./styles/themes/theme-default.css'
    );
  });
});
