/**
 * @file ToolbarMultiRowBands.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarMultiRowBands.test
 * @description Unit tests for discrete Toolbar Row bands, empty row collapse, and multi-row drop markers (Ticket #116, ADR 0020).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ToolbarPanel}
 * @see {@link ToolbarContainerWidget}
 * @see {@link ToolbarWidget}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  visibleToolbarsSignal,
  activeDraggedToolbarSignal,
  type ToolbarZone
} from '../../../../src/renderer/state/gisSignals';
import type { ToolbarWidgetProps } from '../../../../src/renderer/workbench/widgets/ToolbarWidget';
import type { ToolbarContainerWidgetProps } from '../../../../src/renderer/workbench/widgets/ToolbarContainerWidget';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { ToolbarPanel } = jiti(
  '../../../../src/renderer/workbench/widgets/toolbars/ToolbarPanel'
) as {
  ToolbarPanel: React.FC<{ zone: ToolbarZone }>;
};

const { ToolbarWidget } = jiti(
  '../../../../src/renderer/workbench/widgets/ToolbarWidget'
) as {
  ToolbarWidget: React.FC<ToolbarWidgetProps>;
};

const { ToolbarContainerWidget } = jiti(
  '../../../../src/renderer/workbench/widgets/ToolbarContainerWidget'
) as {
  ToolbarContainerWidget: React.FC<ToolbarContainerWidgetProps>;
};

/**
 * @function renderComponentInstance
 * @description Executes a functional component inside a valid React render context to capture its rendered element and handlers.
 * @param {React.FC<P>} Component - Target React functional component.
 * @param {P} props - Component properties.
 * @returns {React.ReactElement<any>} Rendered element instance with active props and handlers.
 */
function renderComponentInstance<P>(Component: React.FC<P>, props: P): React.ReactElement<any> {
  let instance: React.ReactElement<any> | null = null;
  function Probe() {
    instance = (Component as any)(props);
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return instance!;
}

describe('Toolbar Multi-Row Bands and Drop Markers (Ticket #116)', () => {
  beforeEach(() => {
    activeDraggedToolbarSignal.value = null;
    visibleToolbarsSignal.value = {
      project: true,
      map_view: true,
      selection: true,
      digitizing: true,
      snapping: false
    };
    toolbarLocationsSignal.value = {
      project: 'top',
      map_view: 'top',
      selection: 'top',
      digitizing: 'top',
      snapping: 'top'
    };
    toolbarRowsSignal.value = {
      project: 0,
      map_view: 0,
      selection: 0,
      digitizing: 0,
      snapping: 0
    };
    toolbarOrdersSignal.value = {
      project: 0,
      map_view: 1,
      selection: 2,
      digitizing: 3,
      snapping: -1
    };
  });

  it('ToolbarPanel groups active visible toolbars by row coordinate and renders discrete Toolbar Row elements', () => {
    // Put project & map_view in row 0; selection & digitizing in row 1
    toolbarRowsSignal.value = {
      project: 0,
      map_view: 0,
      selection: 1,
      digitizing: 1,
      snapping: 0
    };

    const html = renderToStaticMarkup(React.createElement(ToolbarPanel, { zone: 'top' }));

    assert.ok(html.includes('toolbar-row-0'), 'Must render row 0 container');
    assert.ok(html.includes('toolbar-row-1'), 'Must render row 1 container');

    // Row 0 must appear before Row 1 in DOM
    const row0Index = html.indexOf('toolbar-row-0');
    const row1Index = html.indexOf('toolbar-row-1');
    assert.ok(row0Index !== -1 && row1Index !== -1 && row0Index < row1Index, 'Row 0 must precede Row 1');

    // Project and map_view must be in row 0; selection and digitizing in row 1
    const projectIndex = html.indexOf('toolbar-widget-project');
    const mapViewIndex = html.indexOf('toolbar-widget-map_view');
    const selectionIndex = html.indexOf('toolbar-widget-selection');
    const digitizingIndex = html.indexOf('toolbar-widget-digitizing');

    assert.ok(projectIndex < row1Index, 'Project toolbar must be in row 0');
    assert.ok(mapViewIndex < row1Index, 'Map View toolbar must be in row 0');
    assert.ok(selectionIndex > row1Index, 'Selection toolbar must be in row 1');
    assert.ok(digitizingIndex > row1Index, 'Digitizing toolbar must be in row 1');
  });

  it('toolbars within each row are rendered in ascending order by order coordinate', () => {
    // Invert orders within row 0: map_view (0) before project (1)
    toolbarOrdersSignal.value = {
      project: 1,
      map_view: 0,
      selection: 2,
      digitizing: 3,
      snapping: -1
    };

    const html = renderToStaticMarkup(React.createElement(ToolbarPanel, { zone: 'top' }));
    const projectIndex = html.indexOf('toolbar-widget-project');
    const mapViewIndex = html.indexOf('toolbar-widget-map_view');

    assert.ok(mapViewIndex < projectIndex, 'map_view (order 0) must render before project (order 1)');
  });

  it('empty rows collapse completely without rendering empty container space', () => {
    // Set digitizing in row 2, and hide project, map_view, selection
    visibleToolbarsSignal.value = {
      project: false,
      map_view: false,
      selection: false,
      digitizing: true,
      snapping: false
    };
    toolbarRowsSignal.value = {
      project: 0,
      map_view: 0,
      selection: 1,
      digitizing: 2,
      snapping: 0
    };

    const html = renderToStaticMarkup(React.createElement(ToolbarPanel, { zone: 'top' }));

    // Rows 0 and 1 have no visible toolbars and must not be rendered
    assert.ok(!html.includes('toolbar-row-0'), 'Empty row 0 must collapse completely');
    assert.ok(!html.includes('toolbar-row-1'), 'Empty row 1 must collapse completely');
    assert.ok(html.includes('toolbar-row-2'), 'Row 2 with visible digitizing toolbar must render');
  });

  it('renders auto-collapsed drop target when all toolbars in the zone are hidden', () => {
    visibleToolbarsSignal.value = {
      project: false,
      map_view: false,
      selection: false,
      digitizing: false,
      snapping: false
    };

    const html = renderToStaticMarkup(React.createElement(ToolbarPanel, { zone: 'top' }));

    assert.ok(!html.includes('toolbar-row'), 'No toolbar rows should render');
    assert.ok(html.includes('toolbar-container-widget-drop-target'), 'Auto-collapsed empty drop target must render');
  });

  it('dragging into a horizontal new-row threshold renders full-length new-row marker and static wrapper', () => {
    // When dropPosition is new-row-above
    const htmlAbove = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'top',
        dropPosition: 'new-row-above'
      })
    );

    assert.ok(htmlAbove.includes('toolbar-drop-new-row-above'), 'Must have new-row-above class');
    assert.ok(htmlAbove.includes('position:static'), 'Wrapper must have static position to span row width');
    assert.ok(htmlAbove.includes('toolbar-drop-marker horizontal new-row-above'), 'Must render horizontal new-row-above marker');

    // When dropPosition is new-row-below
    const htmlBelow = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'top',
        dropPosition: 'new-row-below'
      })
    );

    assert.ok(htmlBelow.includes('toolbar-drop-new-row-below'), 'Must have new-row-below class');
    assert.ok(htmlBelow.includes('position:static'), 'Wrapper must have static position to span row width');
    assert.ok(htmlBelow.includes('toolbar-drop-marker horizontal new-row-below'), 'Must render horizontal new-row-below marker');
  });

  it('dragging into vertical new-row thresholds renders vertical new-row-before and new-row-after markers', () => {
    // When dropPosition is new-row-before in vertical zone
    const htmlBefore = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'left',
        dropPosition: 'new-row-before'
      })
    );

    assert.ok(htmlBefore.includes('toolbar-drop-new-row-before'));
    assert.ok(htmlBefore.includes('position:static'));
    assert.ok(htmlBefore.includes('toolbar-drop-marker vertical new-row-before'));

    // When dropPosition is new-row-after in vertical zone
    const htmlAfter = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'left',
        dropPosition: 'new-row-after'
      })
    );

    assert.ok(htmlAfter.includes('toolbar-drop-new-row-after'));
    assert.ok(htmlAfter.includes('position:static'));
    assert.ok(htmlAfter.includes('toolbar-drop-marker vertical new-row-after'));
  });

  it('intra-row dragging continues to render discrete before/after markers with relative positioning', () => {
    // When dropPosition is before
    const htmlBefore = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'top',
        dropPosition: 'before'
      })
    );

    assert.ok(htmlBefore.includes('toolbar-drop-before'), 'Must have toolbar-drop-before class');
    assert.ok(htmlBefore.includes('position:relative'), 'Wrapper must maintain relative positioning for local marker');
    assert.ok(htmlBefore.includes('toolbar-drop-marker horizontal before'), 'Must render discrete horizontal before marker');

    // When dropPosition is after
    const htmlAfter = renderToStaticMarkup(
      React.createElement(ToolbarWidget, {
        id: 'project',
        zone: 'top',
        dropPosition: 'after'
      })
    );

    assert.ok(htmlAfter.includes('toolbar-drop-after'), 'Must have toolbar-drop-after class');
    assert.ok(htmlAfter.includes('position:relative'), 'Wrapper must maintain relative positioning for local marker');
    assert.ok(htmlAfter.includes('toolbar-drop-marker horizontal after'), 'Must render discrete horizontal after marker');
  });

  it('container boundary dragover renders container drop markers (prepend-new-row / append-new-row)', () => {
    // When isDragOver is true with prepend-new-row
    const htmlPrepend = renderToStaticMarkup(
      React.createElement(
        ToolbarContainerWidget,
        {
          zone: 'top',
          isDragOver: true,
          dropPosition: 'prepend-new-row'
        },
        React.createElement('div', { key: 'row-0', className: 'toolbar-row' })
      )
    );

    assert.ok(
      htmlPrepend.includes('toolbar-drop-marker container-drop horizontal prepend-new-row'),
      'Must render prepend-new-row container marker'
    );

    // When isDragOver is true with append-new-row
    const htmlAppend = renderToStaticMarkup(
      React.createElement(
        ToolbarContainerWidget,
        {
          zone: 'top',
          isDragOver: true,
          dropPosition: 'append-new-row'
        },
        React.createElement('div', { key: 'row-0', className: 'toolbar-row' })
      )
    );

    assert.ok(
      htmlAppend.includes('toolbar-drop-marker container-drop horizontal append-new-row'),
      'Must render append-new-row container marker'
    );
  });

  it('dragging and dropping on toolbar top 25% edge moves toolbar to new-row-above', () => {
    activeDraggedToolbarSignal.value = 'digitizing';

    const widget = renderComponentInstance(ToolbarWidget, { id: 'project', zone: 'top' });

    // Drag over top 25% edge (y = 5 of height 40)
    widget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: 'none' },
      clientX: 50,
      clientY: 5,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 })
      }
    });

    // Drop
    widget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: {
        getData: () => 'digitizing'
      },
      clientX: 50,
      clientY: 5,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 })
      }
    });

    // digitizing should now be in row 0, project in row 1
    assert.equal(toolbarRowsSignal.value.digitizing, 0);
    assert.equal(toolbarRowsSignal.value.project, 1);
  });

  it('dragging and dropping on container trailing space appends a new row', () => {
    activeDraggedToolbarSignal.value = 'digitizing';

    const container = renderComponentInstance(ToolbarContainerWidget, {
      zone: 'top',
      children: [React.createElement('div', { key: 'row-0', className: 'toolbar-row' })]
    });

    container.props.onDrop({
      preventDefault: () => {},
      dataTransfer: {
        getData: () => 'digitizing'
      },
      clientY: 80,
      clientX: 50,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 })
      }
    });

    // digitizing appended to new row (row 1)
    assert.equal(toolbarRowsSignal.value.digitizing, 1);
  });
});
