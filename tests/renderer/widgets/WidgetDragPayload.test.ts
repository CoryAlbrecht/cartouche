/**
 * @file WidgetDragPayload.test.ts
 * @module tests/renderer/widgets/WidgetDragPayload.test
 * @description Regression tests for Ticket #321: widget drop targets (BasicWidget, OverlapTabWidget) recognise widget drags only by Cartouche's widget and tab-extract MIME types, ignore foreign drags that carry only `text/plain` (such as LayerTreeWidget Tree Node Row drags), never read a widget id from `text/plain`, and clear a stale drop overlay when any drag ends.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link isWidgetDrag}
 * @see {@link readDraggedWidgetId}
 * @see {@link BasicWidget}
 * @see {@link OverlapTabWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRendererJiti } from '../rendererJiti';
import { installMockDom, teardownMockDom, textOf, type MockDom, type MockElement } from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const {
  isWidgetDrag,
  readDraggedWidgetId,
  WIDGET_DRAG_MIME,
  TAB_EXTRACT_DRAG_MIME,
} = jiti('@renderer/workbench/widgets/widgetDropTarget.ts');
const { BasicWidget } = jiti('@renderer/workbench/widgets/BasicWidget.tsx');
const { OverlapTabWidget } = jiti('@renderer/workbench/widgets/OverlapTabWidget.tsx');

/** Centre of the mock element rect (380×350 at 50,50), well clear of the edge zones. */
const CENTRE = { clientX: 240, clientY: 225 };

/**
 * @function fakeDataTransfer
 * @description Builds a DataTransfer stand-in. During dragover Chromium exposes `types` but masks data, so `masked` makes `getData` return ''.
 * @param {Record<string, string>} data - MIME type to payload map.
 * @param {boolean} [masked=false] - Whether getData returns '' (dragover) instead of the payload (drop).
 * @returns {{ types: string[], getData: (t: string) => string, dropEffect: string }} Fake transfer.
 */
function fakeDataTransfer(data: Record<string, string>, masked = false) {
  return {
    types: Object.keys(data),
    getData: (type: string) => (masked ? '' : data[type] ?? ''),
    dropEffect: 'none',
  };
}

/**
 * @function findByTestId
 * @description Depth-first search for a mock element by its data-testid attribute.
 * @param {MockElement} el - Search root.
 * @param {string} testId - data-testid to match.
 * @returns {MockElement | null} First match or null.
 */
function findByTestId(el: MockElement, testId: string): MockElement | null {
  if (el.attributes?.['data-testid'] === testId) return el;
  for (const child of el.childNodes ?? []) {
    if (child && child.nodeType === 1) {
      const hit = findByTestId(child, testId);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * @function findByClass
 * @description Depth-first search for the first mock element carrying a class.
 * @param {MockElement} el - Search root.
 * @param {string} className - Class to match.
 * @returns {MockElement | null} First match or null.
 */
function findByClass(el: MockElement, className: string): MockElement | null {
  if (typeof el.className === 'string' && el.className.split(/\s+/).includes(className)) return el;
  for (const child of el.childNodes ?? []) {
    if (child && child.nodeType === 1) {
      const hit = findByClass(child, className);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * @function dragEvent
 * @description Dispatches a bubbling mock drag event inside act() and reports whether preventDefault was called.
 * @param {MockElement} el - Event target.
 * @param {string} type - Event type (dragover, drop, ...).
 * @param {ReturnType<typeof fakeDataTransfer>} dataTransfer - Fake transfer.
 * @returns {Promise<boolean>} True when the event's default was prevented.
 */
async function dragEvent(el: MockElement, type: string, dataTransfer: ReturnType<typeof fakeDataTransfer>): Promise<boolean> {
  const event: any = {
    type,
    bubbles: true,
    defaultPrevented: false,
    dataTransfer,
    ...CENTRE,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  await act(async () => {
    el.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

const NODE_DRAG = { 'text/plain': 'tree-row-42' };

describe('Widget drag payload helpers (Ticket #321)', () => {
  it('recognises only the widget and tab-extract MIME types as widget drags', () => {
    assert.equal(isWidgetDrag([WIDGET_DRAG_MIME, 'text/plain']), true);
    assert.equal(isWidgetDrag([TAB_EXTRACT_DRAG_MIME, 'text/plain']), true);
    assert.equal(isWidgetDrag(['text/plain']), false, 'A text/plain-only drag (layer tree node, toolbar) is not a widget drag');
    assert.equal(isWidgetDrag(['Files']), false);
    assert.equal(isWidgetDrag([]), false);
  });

  it('reads the dragged widget id from the widget payload, then the tab-extract payload, never text/plain', () => {
    const widget = fakeDataTransfer({
      [WIDGET_DRAG_MIME]: JSON.stringify({ widgetId: 'console', panelId: 'p1' }),
      'text/plain': 'p1',
    });
    assert.equal(readDraggedWidgetId(widget), 'console');

    const panelOnly = fakeDataTransfer({ [WIDGET_DRAG_MIME]: JSON.stringify({ panelId: 'p1' }) });
    assert.equal(readDraggedWidgetId(panelOnly), 'p1');

    const tab = fakeDataTransfer({
      [TAB_EXTRACT_DRAG_MIME]: JSON.stringify({ containerId: 'g1', tabId: 'attribute-table' }),
      'text/plain': 'attribute-table',
    });
    assert.equal(readDraggedWidgetId(tab), 'attribute-table');

    assert.equal(readDraggedWidgetId(fakeDataTransfer(NODE_DRAG)), '', 'text/plain is never a widget id');
    assert.equal(readDraggedWidgetId(fakeDataTransfer({ [WIDGET_DRAG_MIME]: '{not json' })), '');
  });
});

describe('BasicWidget ignores non-widget drags (Ticket #321)', () => {
  let dom: MockDom | null = null;
  let bundled: Array<[string, string]> = [];

  beforeEach(async () => {
    dom = installMockDom();
    bundled = [];
    await act(async () => {
      dom!.root.render(
        React.createElement(
          BasicWidget,
          {
            name: 'layer-tree',
            displayName: 'Layers',
            overlappable: true,
            onOverlapBundle: (target: string, dragged: string) => bundled.push([target, dragged]),
          },
          React.createElement('div', { className: 'body-probe' }, 'tree')
        )
      );
    });
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('a text/plain-only drag over the widget shows no overlay and does not claim the drop', async () => {
    const probe = findByClass(dom!.container, 'body-probe')!;
    const prevented = await dragEvent(probe, 'dragover', fakeDataTransfer(NODE_DRAG, true));

    assert.equal(prevented, false, 'Widget must not preventDefault for a foreign drag');
    assert.equal(findByTestId(dom!.container, 'drop-overlay-center'), null, 'No "Group as Tabs" overlay');
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      assert.equal(findByTestId(dom!.container, `drop-indicator-${edge}`), null, `No ${edge} edge indicator`);
    }
  });

  it('a text/plain-only drop never bundles the widget with a non-widget id', async () => {
    const probe = findByClass(dom!.container, 'body-probe')!;
    await dragEvent(probe, 'dragover', fakeDataTransfer(NODE_DRAG, true));
    await dragEvent(probe, 'drop', fakeDataTransfer(NODE_DRAG));

    assert.deepEqual(bundled, []);
  });

  it('a widget drag still shows the overlay and bundles on drop', async () => {
    const payload = { [WIDGET_DRAG_MIME]: JSON.stringify({ widgetId: 'console', panelId: 'console', overlappable: true }) };
    const probe = findByClass(dom!.container, 'body-probe')!;

    const prevented = await dragEvent(probe, 'dragover', fakeDataTransfer(payload, true));
    assert.equal(prevented, true);
    assert.ok(findByTestId(dom!.container, 'drop-overlay-center'), 'Overlay shown for a real widget drag');

    await dragEvent(probe, 'drop', fakeDataTransfer(payload));
    assert.deepEqual(bundled, [['layer-tree', 'console']]);
    assert.equal(findByTestId(dom!.container, 'drop-overlay-center'), null);
  });

  it('still bundles when window-level drop listeners run before the widget handles the drop', async () => {
    const payload = { [WIDGET_DRAG_MIME]: JSON.stringify({ widgetId: 'console', overlappable: true }) };
    const probe = findByClass(dom!.container, 'body-probe')!;
    await dragEvent(probe, 'dragover', fakeDataTransfer(payload, true));

    // In the browser, window capture listeners fire (and their state updates flush) before React's drop handler.
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'drop', bubbles: true });
    });
    await dragEvent(probe, 'drop', fakeDataTransfer(payload));
    assert.deepEqual(bundled, [['layer-tree', 'console']], 'Drop cue must survive until the widget handles the drop');
  });

  it('clears a stale overlay when the drag ends elsewhere, without remounting', async () => {
    const payload = { [WIDGET_DRAG_MIME]: JSON.stringify({ widgetId: 'console', overlappable: true }) };
    const probe = findByClass(dom!.container, 'body-probe')!;
    await dragEvent(probe, 'dragover', fakeDataTransfer(payload, true));
    assert.ok(findByTestId(dom!.container, 'drop-overlay-center'));

    // A descendant handled the drop and stopped propagation; only the drag's end reaches the window.
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'dragend', bubbles: true });
    });
    assert.equal(findByTestId(dom!.container, 'drop-overlay-center'), null, 'Overlay cleared on dragend');
  });
});

describe('OverlapTabWidget ignores non-widget drags (Ticket #321)', () => {
  let dom: MockDom | null = null;

  beforeEach(async () => {
    dom = installMockDom();
    await act(async () => {
      dom!.root.render(
        React.createElement(OverlapTabWidget, {
          name: 'group-1',
          tabs: [
            {
              id: 'tab-1',
              title: 'First',
              render: () => React.createElement('div', { className: 'tab-probe' }, 'one'),
            },
            {
              id: 'tab-2',
              title: 'Second',
              render: () => React.createElement('div', {}, 'two'),
            },
          ],
          activeTabId: 'tab-1',
        })
      );
    });
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('a text/plain-only drag shows no tab-group overlay and adds no tab on drop', async () => {
    const probe = findByClass(dom!.container, 'tab-probe')!;
    await dragEvent(probe, 'dragover', fakeDataTransfer(NODE_DRAG, true));
    assert.equal(findByTestId(dom!.container, 'tab-drop-overlay-center'), null);

    await dragEvent(probe, 'drop', fakeDataTransfer(NODE_DRAG));
    assert.equal(findByTestId(dom!.container, 'tab-drop-overlay-center'), null);
    assert.ok(!textOf(dom!.container).includes('tree-row-42'), 'No tab created for the dragged Tree Node Row');
  });

  it('clears a stale tab-group overlay when the drag ends', async () => {
    const payload = { [WIDGET_DRAG_MIME]: JSON.stringify({ widgetId: 'console', overlappable: true }) };
    const probe = findByClass(dom!.container, 'tab-probe')!;
    await dragEvent(probe, 'dragover', fakeDataTransfer(payload, true));
    assert.ok(findByTestId(dom!.container, 'tab-drop-overlay-center'));

    await act(async () => {
      dom!.win.dispatchEvent({ type: 'dragend', bubbles: true });
    });
    assert.equal(findByTestId(dom!.container, 'tab-drop-overlay-center'), null);
  });
});
