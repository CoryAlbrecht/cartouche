/**
 * @file LayerPropertiesDialogIcon.test.ts
 * @module tests/renderer/dialogs/LayerPropertiesDialogIcon.test
 * @description Unit and component tests verifying LayerPropertiesDialog title bar branding icon renders custom file:layers-cog-outline.svg.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);

describe('LayerPropertiesDialog Icon Rendering', () => {
  let originalDocument: typeof globalThis.document;
  let originalCreatePortal: any;
  const React = jiti('react');
  const ReactDOM = jiti('react-dom');
  const { renderToStaticMarkup } = jiti('react-dom/server');
  const { activeLayerPropertiesIdSignal } = jiti('../../../src/renderer/state/layerPropertiesSignals.ts');
  const { LayerPropertiesDialog } = jiti('../../../src/renderer/workbench/dialogs/LayerPropertiesDialog.tsx');

  beforeEach(() => {
    originalDocument = globalThis.document;
    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;
    activeLayerPropertiesIdSignal.value = null;
  });

  afterEach(() => {
    activeLayerPropertiesIdSignal.value = null;
    ReactDOM.createPortal = originalCreatePortal;
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  it('renders custom file:layers-cog-outline.svg icon in LayerPropertiesDialog title bar', () => {
    activeLayerPropertiesIdSignal.value = 'layer-1';
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    const headerMatch = html.match(
      /<div class="cartouche-dialog-title-container">(.*?)<span class="cartouche-dialog-title">/
    );
    assert.ok(headerMatch?.[1], 'Expected LayerPropertiesDialog title bar container to be rendered');
    assert.match(
      headerMatch[1],
      /m12 16-9-7/,
      'Expected LayerPropertiesDialog title bar icon to contain layers-cog-outline SVG path data'
    );
  });
});
