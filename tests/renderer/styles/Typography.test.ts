/**
 * @file Typography.test.ts
 * @module tests/renderer/styles/Typography.test
 * @description Automated verification suite for Cartouche typography design tokens, statically bundled Noto WOFF2 font assets, @font-face declarations, unicode-range scoping, HTML preload links, and stylesheet monospace consistency (ADR 0013).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Cartouche Typography & Bundled Fonts Architecture (ADR 0013 / Spec #78)', () => {
  const rootDir = process.cwd();
  const assetsDir = path.resolve(rootDir, 'assets/fonts');
  const themeCssPath = path.resolve(rootDir, 'src/renderer/styles/theme.css');
  const workbenchCssPath = path.resolve(rootDir, 'src/renderer/styles/workbench.css');
  const indexHtmlPath = path.resolve(rootDir, 'src/renderer/index.html');

  it('ensures all statically bundled WOFF2 font assets exist and have non-zero size', () => {
    const requiredFonts = [
      'noto-sans/NotoSans-Regular.woff2',
      'noto-sans/NotoSans-Bold.woff2',
      'noto-sans/NotoSans-Italic.woff2',
      'noto-sans-mono/NotoSansMono-Regular.woff2',
      'noto-sans-mono/NotoSansMono-Bold.woff2',
      'noto-sans-math/NotoSansMath-Regular.woff2',
    ];

    for (const relativePath of requiredFonts) {
      const fullPath = path.join(assetsDir, relativePath);
      assert.ok(fs.existsSync(fullPath), `Font file must exist: ${relativePath}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 50000, `Font file ${relativePath} must be a valid non-empty WOFF2 asset (size: ${stats.size} bytes)`);
    }
  });

  it('declares local @font-face rules with font-display: swap in theme.css', () => {
    const themeCss = fs.readFileSync(themeCssPath, 'utf-8');

    assert.ok(themeCss.includes('@font-face'), 'theme.css must declare @font-face rules');
    assert.ok(themeCss.includes('font-family: "Noto Sans Math";'), 'Must declare Noto Sans Math font-family');
    assert.ok(themeCss.includes('font-family: "Noto Sans";'), 'Must declare Noto Sans font-family');
    assert.ok(themeCss.includes('font-family: "Noto Sans Mono";'), 'Must declare Noto Sans Mono font-family');

    // Count font-display: swap
    const swapMatches = themeCss.match(/font-display:\s*swap;/g);
    assert.ok(swapMatches && swapMatches.length >= 6, 'All bundled @font-face declarations must specify font-display: swap');
  });

  it('scopes Noto Sans Math via explicit mathematical unicode-range in theme.css', () => {
    const themeCss = fs.readFileSync(themeCssPath, 'utf-8');

    const expectedRange = 'unicode-range: U+0370-03FF, U+2100-214F, U+2200-22FF, U+2300-23FF, U+25A0-25FF, U+27C0-27EF, U+2980-2AFF, U+1D400-1D7FF;';
    assert.ok(
      themeCss.includes(expectedRange),
      'Noto Sans Math @font-face rule must be scoped with the canonical mathematical and Greek unicode-range'
    );
  });

  it('configures canonical --cartouche-theme-font-family with Noto Sans Math and Noto Sans cascade', () => {
    const themeCss = fs.readFileSync(themeCssPath, 'utf-8');

    assert.ok(
      themeCss.includes('--cartouche-theme-font-family:'),
      'Must define --cartouche-theme-font-family CSS custom property'
    );
    assert.ok(
      themeCss.includes('"Noto Sans Math", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont,'),
      '--cartouche-theme-font-family must begin with Noto Sans Math, Noto Sans, system-ui, and platform defaults'
    );
    assert.ok(
      themeCss.includes('"Segoe UI", Roboto, Helvetica, Arial, sans-serif;'),
      '--cartouche-theme-font-family must conclude with Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    );
  });

  it('configures canonical --cartouche-theme-font-family-mono with Noto Sans Mono and modern monospace fallbacks', () => {
    const themeCss = fs.readFileSync(themeCssPath, 'utf-8');

    assert.ok(
      themeCss.includes('--cartouche-theme-font-family-mono:'),
      'Must define --cartouche-theme-font-family-mono CSS custom property'
    );
    assert.ok(
      themeCss.includes('"Noto Sans Mono", ui-monospace, SFMono-Regular, "Cascadia Code",'),
      '--cartouche-theme-font-family-mono must begin with Noto Sans Mono, ui-monospace, and developer OS fallbacks'
    );
    assert.ok(
      themeCss.includes('"Source Code Pro", Menlo, Monaco, Consolas, "Liberation Mono",'),
      '--cartouche-theme-font-family-mono must include popular monospace fallback fonts'
    );
    assert.ok(
      themeCss.includes('"Courier New", monospace;'),
      '--cartouche-theme-font-family-mono must conclude with generic monospace'
    );
  });

  it('hardens Content Security Policy with font-src and preloads base fonts in index.html', () => {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

    // CSP directive
    assert.ok(
      indexHtml.includes("font-src 'self' data:;"),
      "index.html Content-Security-Policy must explicitly include font-src 'self' data:;"
    );

    // Preload tags
    assert.ok(
      indexHtml.includes('rel="preload" href="../../assets/fonts/noto-sans/NotoSans-Regular.woff2" as="font" type="font/woff2" crossorigin'),
      'index.html must preload NotoSans-Regular.woff2'
    );
    assert.ok(
      indexHtml.includes('rel="preload" href="../../assets/fonts/noto-sans-mono/NotoSansMono-Regular.woff2" as="font" type="font/woff2" crossorigin'),
      'index.html must preload NotoSansMono-Regular.woff2'
    );
  });

  it('ensures workbench.css uses var(--cartouche-theme-font-family-mono) and contains no unmapped raw monospace rules', () => {
    const workbenchCss = fs.readFileSync(workbenchCssPath, 'utf-8');

    // .cell-id and .console-panel
    assert.ok(
      workbenchCss.includes('.cell-id {\n  font-family: var(--cartouche-theme-font-family-mono);'),
      '.cell-id must use var(--cartouche-theme-font-family-mono)'
    );
    assert.ok(
      workbenchCss.includes('.console-panel {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  background-color: #ffffff;\n  font-family: var(--cartouche-theme-font-family-mono);'),
      '.console-panel must use var(--cartouche-theme-font-family-mono)'
    );

    // No raw font-family: monospace or Consolas
    assert.ok(!workbenchCss.includes('font-family: monospace;'), 'workbench.css must not contain raw font-family: monospace');
    assert.ok(!workbenchCss.includes('font-family: Consolas'), 'workbench.css must not contain raw font-family: Consolas');
  });
});

