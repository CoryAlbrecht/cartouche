/**
 * @file ToolbarReorder.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarReorder.test
 * @description Component and interaction tests for ToolbarWidget and ToolbarContainerWidget drag-and-drop reordering, insertion indicators, and zone relocation (Ticket #110).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link ToolbarContainerWidget}
 * @see {@link moveToolbar}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  toolbarOrderSignal,
  toolbarLocationsSignal,
  visibleToolbarsSignal,
  activeDraggedToolbarSignal,
  type ToolbarZone,
  type ToolbarId
} from '../../../../src/renderer/state/gisSignals';

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

const { ToolbarContainerWidget } = jiti(
  '../../../../src/renderer/workbench/widgets/ToolbarContainerWidget'
) as {
  ToolbarContainerWidget: React.FC<{
    zone: ToolbarZone;
    children?: React.ReactNode;
  }>;
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

describe('Toolbar Drag-and-Drop Reordering Interaction', () => {
  beforeEach(() => {
    activeDraggedToolbarSignal.value = null;
    visibleToolbarsSignal.value = {
      project: true,
      map_view: true,
      selection: true,
      digitizing: true,
      snapping: true
    };
    toolbarLocationsSignal.value = {
      project: 'top',
      map_view: 'top',
      selection: 'top',
      digitizing: 'top',
      snapping: 'bottom'
    };
    toolbarOrderSignal.value = {
      top: ['project', 'map_view', 'selection', 'digitizing'],
      bottom: ['snapping'],
      left: [],
      right: []
    };
  });

  it('renders toolbar widget with grabber handle and drag attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolbarWidget, { id: 'project', zone: 'top' }, 'Controls')
    );

    assert.ok(html.includes('class="toolbar-grabber"'));
    assert.ok(html.includes('draggable="true"'));
    assert.ok(html.includes('title="Drag toolbar to reorder or move to another edge"'));
  });

  it('renders container without monolithic full-zone overlay when toolbars are present', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ToolbarContainerWidget,
        { zone: 'top' },
        React.createElement(ToolbarWidget, { id: 'project', zone: 'top' })
      )
    );

    assert.ok(!html.includes('is-drag-over'));
    assert.ok(html.includes('toolbar-container-top'));
  });

  it('renders empty zone drop target when zone has no toolbars', () => {
    const html = renderToStaticMarkup(
      React.createElement(ToolbarContainerWidget, { zone: 'left' })
    );

    assert.ok(html.includes('toolbar-container-widget-drop-target'));
    assert.ok(html.includes('zone-left'));
  });

  it('manages activeDraggedToolbarSignal on grabber dragStart and dragEnd', () => {
    const widget = renderComponentInstance(ToolbarWidget, { id: 'project', zone: 'top' });
    const widgetInner = widget.props.children[0] as React.ReactElement<any>;
    const grabber = widgetInner.props.children[0] as React.ReactElement<any>;

    assert.equal(activeDraggedToolbarSignal.value, null);

    let stopped = false;
    const data: Record<string, string> = {};
    grabber.props.onDragStart({
      stopPropagation: () => {
        stopped = true;
      },
      currentTarget: {
        closest: () => ({
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
        })
      },
      clientX: 10,
      clientY: 10,
      dataTransfer: {
        setData: (k: string, v: string) => {
          data[k] = v;
        },
        setDragImage: () => {}
      }
    });

    assert.equal(stopped, true);
    assert.equal(data['text/plain'], 'project');
    assert.equal(activeDraggedToolbarSignal.value, 'project');

    grabber.props.onDragEnd();
    assert.equal(activeDraggedToolbarSignal.value, null);
  });

  it('reorders toolbar before target on drop in horizontal zone', () => {
    activeDraggedToolbarSignal.value = 'digitizing';

    const targetWidget = renderComponentInstance(ToolbarWidget, { id: 'map_view', zone: 'top' });

    // Simulate dragover on leading half (offsetX = 20 < width = 100 / 2 => before)
    targetWidget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 20,
      clientY: 10
    });

    // Simulate drop
    targetWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 20,
      clientY: 10,
      dataTransfer: {
        getData: () => 'digitizing'
      }
    });

    // 'digitizing' should now be immediately before 'map_view'
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'digitizing',
      'map_view',
      'selection'
    ]);
  });

  it('reorders toolbar after target on drop in horizontal zone', () => {
    activeDraggedToolbarSignal.value = 'project';

    const targetWidget = renderComponentInstance(ToolbarWidget, { id: 'selection', zone: 'top' });

    // Simulate dragover on trailing half (offsetX = 80 >= width = 100 / 2 => after)
    targetWidget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 80,
      clientY: 10
    });

    // Simulate drop
    targetWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 80,
      clientY: 10,
      dataTransfer: {
        getData: () => 'project'
      }
    });

    // 'project' should now be after 'selection'
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'map_view',
      'selection',
      'project',
      'digitizing'
    ]);
  });

  it('reorders toolbar before the first toolbar to become index 0', () => {
    activeDraggedToolbarSignal.value = 'selection';

    const firstWidget = renderComponentInstance(ToolbarWidget, { id: 'project', zone: 'top' });

    firstWidget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 10,
      clientY: 10
    });

    firstWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 10,
      clientY: 10,
      dataTransfer: {
        getData: () => 'selection'
      }
    });

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'selection',
      'project',
      'map_view',
      'digitizing'
    ]);
  });

  it('dropping toolbar onto itself is a safe no-op and does not append to end of zone', () => {
    activeDraggedToolbarSignal.value = 'project';

    const sameWidget = renderComponentInstance(ToolbarWidget, { id: 'project', zone: 'top' });

    let stopped = false;
    sameWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {
        stopped = true;
      },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 50,
      clientY: 10,
      dataTransfer: {
        getData: () => 'project'
      }
    });

    assert.equal(stopped, true, 'Drop on self must stop event propagation to container');
    assert.deepEqual(
      toolbarOrderSignal.value.top,
      ['project', 'map_view', 'selection', 'digitizing'],
      'Order must remain completely unchanged when dropped on self'
    );
    assert.equal(activeDraggedToolbarSignal.value, null);
  });

  it('reorders toolbar correctly in vertical zones (left/right) based on Y offset', () => {
    toolbarLocationsSignal.value = {
      project: 'left',
      map_view: 'left',
      selection: 'left',
      digitizing: 'left',
      snapping: 'left'
    };
    toolbarOrderSignal.value = {
      top: [],
      bottom: [],
      left: ['project', 'map_view', 'selection', 'digitizing', 'snapping'],
      right: []
    };

    activeDraggedToolbarSignal.value = 'digitizing';

    // Hover over 'map_view' in vertical zone: height = 80px, Y = 20px (< 40px => before)
    const targetWidget = renderComponentInstance(ToolbarWidget, { id: 'map_view', zone: 'left' });

    targetWidget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 36, height: 80 })
      },
      clientX: 18,
      clientY: 20
    });

    targetWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 36, height: 80 })
      },
      clientX: 18,
      clientY: 20,
      dataTransfer: {
        getData: () => 'digitizing'
      }
    });

    assert.deepEqual(toolbarOrderSignal.value.left, [
      'project',
      'digitizing',
      'map_view',
      'selection',
      'snapping'
    ]);
  });

  it('relocates toolbar across zones before target in destination zone', () => {
    activeDraggedToolbarSignal.value = 'snapping'; // from bottom

    const targetWidget = renderComponentInstance(ToolbarWidget, { id: 'map_view', zone: 'top' });

    targetWidget.props.onDragOver({
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 20,
      clientY: 10
    });

    targetWidget.props.onDrop({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 32 })
      },
      clientX: 20,
      clientY: 10,
      dataTransfer: {
        getData: () => 'snapping'
      }
    });

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'snapping',
      'map_view',
      'selection',
      'digitizing'
    ]);
    assert.deepEqual(toolbarOrderSignal.value.bottom, []);
    assert.equal(toolbarLocationsSignal.value.snapping, 'top');
  });

  it('container drops onto trailing space append to the zone', () => {
    activeDraggedToolbarSignal.value = 'snapping';

    const container = renderComponentInstance(ToolbarContainerWidget, {
      zone: 'top',
      children: [React.createElement(ToolbarWidget, { key: 'project', id: 'project', zone: 'top' })]
    });

    container.props.onDrop({
      preventDefault: () => {},
      dataTransfer: {
        getData: () => 'snapping'
      }
    });

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'map_view',
      'selection',
      'digitizing',
      'snapping'
    ]);
    assert.deepEqual(toolbarOrderSignal.value.bottom, []);
  });
});
