/**
 * @file ToolbarChromeContrast.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarChromeContrast.test
 * @description Unit and stylesheet tests for low-contrast idle toolbar grabbers and tail divider icons (Ticket #112).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import createJiti from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ToolbarZone, ToolbarId } from '../../../../src/renderer/state/gisSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { ToolbarWidget } = jiti(
  '../../../../src/renderer/workbench/widgets/ToolbarWidget'
) as {
  ToolbarWidget: React.FC<{
    id: ToolbarId;
    zone?: ToolbarZone;
    children?: React.ReactNode;
  }>;
};

describe('ToolbarChromeContrast (Ticket #112)', () => {
  const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
  const workbenchCss = fs.readFileSync(workbenchCssPath, 'utf8');

  it('renders toolbar grabber and tail divider with designated CSS class names', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolbarWidget, { id: 'project', zone: 'top' }, 'TestControls')
    );

    assert.ok(html.includes('class="toolbar-grabber"'), 'Toolbar must render .toolbar-grabber');
    assert.ok(html.includes('class="toolbar-divider"'), 'Toolbar must render .toolbar-divider');
    assert.ok(!html.includes('color:#cbd5e1'), 'Toolbar divider must not have hardcoded inline color');
  });

  it('declares .toolbar-grabber in workbench.css with idle opacity 0.22 and muted gray', () => {
    const grabberMatch = workbenchCss.match(/\.toolbar-grabber\s*\{([^}]+)\}/);
    assert.ok(grabberMatch, 'workbench.css must define .toolbar-grabber');
    const grabberRules = grabberMatch[1];
    assert.ok(grabberRules.includes('opacity: 0.22'), '.toolbar-grabber must specify opacity: 0.22');
    assert.ok(grabberRules.includes('color: #94a3b8'), '.toolbar-grabber must specify color: #94a3b8');
    assert.ok(grabberRules.includes('transition:'), '.toolbar-grabber must specify transition for smooth hover');
  });

  it('declares .toolbar-grabber:hover in workbench.css with full opacity and dark blue highlight', () => {
    const grabberHoverMatch = workbenchCss.match(/\.toolbar-grabber:hover\s*\{([^}]+)\}/);
    assert.ok(grabberHoverMatch, 'workbench.css must define .toolbar-grabber:hover');
    const grabberHoverRules = grabberHoverMatch[1];
    assert.ok(grabberHoverRules.includes('opacity: 1 !important'), '.toolbar-grabber:hover must specify opacity: 1 !important');
    assert.ok(grabberHoverRules.includes('color: #0037b9 !important'), '.toolbar-grabber:hover must specify #0037b9');
  });

  it('declares .toolbar-divider in workbench.css with idle opacity 0.22 and non-interactive pointer-events', () => {
    const dividerMatch = workbenchCss.match(/\.toolbar-divider\s*\{([^}]+)\}/);
    assert.ok(dividerMatch, 'workbench.css must define .toolbar-divider');
    const dividerRules = dividerMatch[1];
    assert.ok(dividerRules.includes('opacity: 0.22'), '.toolbar-divider must specify opacity: 0.22');
    assert.ok(dividerRules.includes('color: #94a3b8'), '.toolbar-divider must specify color: #94a3b8');
    assert.ok(dividerRules.includes('pointer-events: none'), '.toolbar-divider must specify pointer-events: none');
  });

  it('ensures idle grabbers and dividers have lower contrast than disabled toolbar buttons', () => {
    const disabledButtonMatch = workbenchCss.match(/\.toolbar-btn:disabled\s*\{([^}]+)\}/);
    assert.ok(disabledButtonMatch, 'workbench.css must define .toolbar-btn:disabled');
    const disabledButtonRules = disabledButtonMatch[1];
    const opacityMatch = disabledButtonRules.match(/opacity:\s*([0-9.]+)/);
    assert.ok(opacityMatch, '.toolbar-btn:disabled must specify an opacity');
    const disabledOpacity = parseFloat(opacityMatch[1]);

    const grabberMatch = workbenchCss.match(/\.toolbar-grabber\s*\{([^}]+)\}/);
    assert.ok(grabberMatch);
    const grabberOpacityMatch = grabberMatch[1].match(/opacity:\s*([0-9.]+)/);
    assert.ok(grabberOpacityMatch);
    const grabberOpacity = parseFloat(grabberOpacityMatch[1]);

    assert.ok(
      grabberOpacity < disabledOpacity,
      `Idle grabber opacity (${grabberOpacity}) must be strictly lower contrast than disabled buttons (${disabledOpacity})`
    );
  });
});

