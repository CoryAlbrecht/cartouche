/**
 * @file CreateLayerDialogIcon.test.ts
 * @module tests/renderer/dialogs/CreateLayerDialogIcon.test
 * @description Unit and component tests verifying CreateLayerDialog title bar branding icon renders custom file:layers-plus-outline.svg.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link CreateLayerDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

describe('CreateLayerDialog Icon Rendering', () => {
  let originalDocument: typeof globalThis.document;
  let originalCreatePortal: any;
  const React = jiti('react');
  const ReactDOM = jiti('react-dom');
  const { renderToStaticMarkup } = jiti('react-dom/server');
  const { isCreateLayerOpenSignal } = jiti('../../../src/renderer/state/gisSignals.ts');
  const { CreateLayerDialog } = jiti('../../../src/renderer/workbench/dialogs/CreateLayerDialog.tsx');

  beforeEach(() => {
    originalDocument = globalThis.document;
    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;
    isCreateLayerOpenSignal.value = false;
  });

  afterEach(() => {
    isCreateLayerOpenSignal.value = false;
    ReactDOM.createPortal = originalCreatePortal;
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  it('renders custom file:layers-plus-outline.svg icon in CreateLayerDialog title bar', () => {
    isCreateLayerOpenSignal.value = true;
    const html = renderToStaticMarkup(React.createElement(CreateLayerDialog));

    const headerMatch = html.match(
      /<div class="cartouche-dialog-title-container">(.*?)<span class="cartouche-dialog-title">/
    );
    assert.ok(headerMatch?.[1], 'Expected CreateLayerDialog title bar container to be rendered');
    assert.match(
      headerMatch[1],
      /m19\.1845 14\.4434/,
      'Expected CreateLayerDialog title bar icon to contain layers-plus-outline SVG path data'
    );
  });
});
