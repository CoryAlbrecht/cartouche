/**
 * @file ToolbarScaling.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarScaling.test
 * @description Unit and component tests verifying ToolbarWidget scaling prop, CSS custom property inheritance, and container dimension adjustments.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ToolbarWidgetProps } from '../../../../src/renderer/workbench/widgets/ToolbarWidget';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const { ToolbarWidget } = jiti(
  '../../../../src/renderer/workbench/widgets/ToolbarWidget'
) as {
  ToolbarWidget: React.FC<ToolbarWidgetProps>;
};

describe('ToolbarWidget Scaling Prop & CSS Property Inheritance', () => {
  it('defaults --cartouche-ui-icon-scaling to 1.0 when scaling prop is omitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolbarWidget, { id: 'project', zone: 'top' }, 'TestControls')
    );

    assert.ok(
      html.includes('--cartouche-ui-icon-scaling:1') ||
        html.includes('--cartouche-ui-icon-scaling: 1'),
      'Toolbar wrapper must set --cartouche-ui-icon-scaling to 1 by default'
    );
  });

  it('sets custom --cartouche-ui-icon-scaling on wrapper when scaling prop is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'project', zone: 'top', scaling: 1.5 },
        'TestControls'
      )
    );

    assert.ok(
      html.includes('--cartouche-ui-icon-scaling:1.5') ||
        html.includes('--cartouche-ui-icon-scaling: 1.5'),
      'Toolbar wrapper must set custom scaling value (1.5) on wrapper style'
    );
  });

  it('falls back to 1.0 when scaling prop is invalid, non-finite, or <= 0', () => {
    const htmlZero = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'project', zone: 'top', scaling: 0 },
        'TestControls'
      )
    );
    assert.ok(
      htmlZero.includes('--cartouche-ui-icon-scaling:1') ||
        htmlZero.includes('--cartouche-ui-icon-scaling: 1'),
      'Zero scaling must fallback to 1.0'
    );

    const htmlNegative = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'project', zone: 'top', scaling: -2.5 },
        'TestControls'
      )
    );
    assert.ok(
      htmlNegative.includes('--cartouche-ui-icon-scaling:1') ||
        htmlNegative.includes('--cartouche-ui-icon-scaling: 1'),
      'Negative scaling must fallback to 1.0'
    );

    const htmlNan = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'project', zone: 'top', scaling: Number.NaN },
        'TestControls'
      )
    );
    assert.ok(
      htmlNan.includes('--cartouche-ui-icon-scaling:1') ||
        htmlNan.includes('--cartouche-ui-icon-scaling: 1'),
      'NaN scaling must fallback to 1.0'
    );
  });

  it('scales minHeight in horizontal top/bottom zones and minWidth in vertical left/right zones', () => {
    const htmlHorizontal = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'map_view', zone: 'top', scaling: 2.0 },
        'Horizontal'
      )
    );
    assert.ok(
      htmlHorizontal.includes(
        'min-height:calc(var(--cartouche-ui-icon-size, 24px) * var(--cartouche-ui-icon-scaling, 1.0) + 12px)'
      ),
      'Horizontal toolbar must calculate minHeight incorporating icon scaling'
    );

    const htmlVertical = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: 'map_view', zone: 'left', scaling: 2.0 },
        'Vertical'
      )
    );
    assert.ok(
      htmlVertical.includes(
        'min-width:calc(var(--cartouche-ui-icon-size, 24px) * var(--cartouche-ui-icon-scaling, 1.0) + 12px)'
      ),
      'Vertical toolbar must calculate minWidth incorporating icon scaling'
    );
  });
});
