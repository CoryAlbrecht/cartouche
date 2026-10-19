/**
 * @file AddLayersDialogIcon.test.ts
 * @module tests/renderer/dialogs/AddLayersDialogIcon.test
 * @description Regression tests verifying that custom file: SVG icons in AddLayersDialog (title bar and Add Layers button) render as inline SVGs with white fill instead of black external img tags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @see {@link AddLayersDialog}
 * @see {@link Icon}
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

describe('AddLayersDialog and file: SVG Icon Color Rendering', () => {
  let originalDocument: typeof globalThis.document;
  let originalCreatePortal: any;
  const React = jiti('react');
  const ReactDOM = jiti('react-dom');
  const { renderToStaticMarkup } = jiti('react-dom/server');
  const { Icon } = jiti('../../../src/renderer/components/common/Icon.tsx');
  const { isAddLayersOpenSignal } = jiti('../../../src/renderer/state/gisSignals.ts');
  const { AddLayersDialog } = jiti('../../../src/renderer/workbench/dialogs/AddLayersDialog.tsx');

  beforeEach(() => {
    originalDocument = globalThis.document;
    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;
    isAddLayersOpenSignal.value = false;
  });

  afterEach(() => {
    isAddLayersOpenSignal.value = false;
    ReactDOM.createPortal = originalCreatePortal;
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  it('renders file:layers-plus-outline.svg as an inline <svg> respecting the color prop and defaulting to currentColor', () => {
    const defaultMarkup = renderToStaticMarkup(
      React.createElement(Icon, { name: 'file:layers-plus-outline.svg', size: 18 })
    );
    assert.match(defaultMarkup, /^<svg\b/, 'Expected file: SVG icon to render an inline <svg> element rather than <img> or <span>');
    assert.match(defaultMarkup, /\bfill="currentColor"/, 'Expected default fill on file: SVG icon to be currentColor');
    assert.match(defaultMarkup, /<path\s+d="m19\.1845 14\.4434/, 'Expected inline <svg> to contain the layers-plus-outline path data');

    const whiteMarkup = renderToStaticMarkup(
      React.createElement(Icon, { name: 'file:layers-plus-outline.svg', size: 16, color: '#ffffff' })
    );
    assert.match(whiteMarkup, /^<svg\b/, 'Expected file: SVG icon with color prop to render an inline <svg>');
    assert.match(whiteMarkup, /\bfill="#ffffff"/i, 'Expected explicit color="#ffffff" prop to set fill="#ffffff" on the <svg>');
  });

  it('renders white icons in both the AddLayersDialog title bar and the Add Layers footer button', () => {
    isAddLayersOpenSignal.value = true;
    const html = renderToStaticMarkup(React.createElement(AddLayersDialog));

    const headerMatch = html.match(
      /<div class="cartouche-dialog-title-container">(.*?)<span class="cartouche-dialog-title">Add Layers<\/span>/
    );
    assert.ok(headerMatch?.[1], 'Expected AddLayersDialog title bar container to be rendered');
    assert.match(
      headerMatch[1],
      /<svg[^>]*\bfill="#ffffff"/i,
      'Expected AddLayersDialog title bar icon to be an inline <svg> with white fill (#ffffff)'
    );

    const addBtnMatch = html.match(
      /<button[^>]*>((?:(?!<\/button>).)*?)<span>Add Layers<\/span><\/button>/
    );
    assert.ok(addBtnMatch?.[1], 'Expected AddLayersDialog "Add Layers" button to be rendered');
    assert.match(
      addBtnMatch[1],
      /<svg[^>]*\bfill="#ffffff"/i,
      'Expected "Add Layers" button icon to be an inline <svg> with white fill (#ffffff)'
    );
  });
});

