/**
 * @file LayerTreeDropTarget.test.ts
 * @module tests/renderer/widgets/LayerTreeDropTarget.test
 * @description Unit tests for LayerTreeWidget drop-target hit-zone resolution, covering 50/50 leaf splits, 50/50 expanded group splits, 1/3 collapsed/empty group splits, horizontal X-axis outdenting on trailing children, project root row targeting, and cycle rejection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectGroupItem, ProjectLayerItem } from '../../../src/shared/types';
import { resolveNodeDropTarget } from '../../../src/renderer/workbench/widgets/layerTreeDropTarget';

/**
 * Builds a sample layer tree matching project-4.cproj with an additional nested subgroup and empty group.
 *
 * @description Creates fixture tree data for drop-target resolution tests.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Fixture layer tree array.
 */
function createSampleTree(): Array<ProjectLayerItem | ProjectGroupItem> {
  return [
    {
      id: 'l-0',
      name: 'timeline_level_0',
      type: 'geopackage-vector',
      source: '/test/files/timeline_level_0.gpkg',
      visible: true
    },
    {
      id: 'group-water',
      name: 'Water',
      visible: true,
      expanded: true,
      children: [
        {
          id: 'l-centrelines',
          name: 'Centrelines',
          type: 'geojson',
          source: '/test/files/centrelines.geojson',
          visible: true
        },
        {
          id: 'l-lakes',
          name: 'Lakes',
          type: 'esri-shapefile',
          source: '/test/files/lakes.shp',
          visible: true
        },
        {
          id: 'l-coastlines',
          name: 'Coastlines',
          type: 'esri-shapefile',
          source: '/test/files/coastlines.shp',
          visible: true
        }
      ]
    },
    {
      id: 'group-empty',
      name: 'Empty Group',
      visible: true,
      expanded: true,
      children: []
    }
  ];
}

describe('resolveNodeDropTarget', () => {
  it('splits leaf Layer rows 50/50 vertically into before and after', () => {
    const tree = createSampleTree();

    // Top 50% of non-trailing child 'l-lakes' (indentLevel = 2) -> 'before'
    const topHalf = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'l-lakes',
      offsetY: 6,
      rowHeight: 24,
      offsetX: 48
    });
    assert.deepEqual(topHalf, {
      targetId: 'l-lakes',
      position: 'before',
      indentLevel: 2
    });

    // Bottom 50% of non-trailing child 'l-lakes' (indentLevel = 2) -> 'after' at same indentLevel regardless of offsetX
    const bottomHalf = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'l-lakes',
      offsetY: 18,
      rowHeight: 24,
      offsetX: 12
    });
    assert.deepEqual(bottomHalf, {
      targetId: 'l-lakes',
      position: 'after',
      indentLevel: 2
    });
  });

  it('splits expanded non-empty LayerGroup headers 50/50 into before and into', () => {
    const tree = createSampleTree();

    // Top 50% of expanded group 'group-water' -> 'before' at indentLevel 1
    const topHalf = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'group-water',
      offsetY: 5,
      rowHeight: 24,
      offsetX: 24
    });
    assert.deepEqual(topHalf, {
      targetId: 'group-water',
      position: 'before',
      indentLevel: 1
    });

    // Bottom 50% of expanded group 'group-water' -> 'into' at indentLevel 2
    const bottomHalf = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'group-water',
      offsetY: 16,
      rowHeight: 24,
      offsetX: 24
    });
    assert.deepEqual(bottomHalf, {
      targetId: 'group-water',
      position: 'into',
      indentLevel: 2
    });
  });

  it('splits collapsed or empty LayerGroup headers into thirds (before / into / after)', () => {
    const tree = createSampleTree();
    const waterGroup = tree[1] as ProjectGroupItem;
    waterGroup.expanded = false;

    // 1. Collapsed non-empty group 'group-water':
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-water',
        offsetY: 4,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-water', position: 'before', indentLevel: 1 }
    );
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-water',
        offsetY: 12,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-water', position: 'into', indentLevel: 2 }
    );
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-water',
        offsetY: 20,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-water', position: 'after', indentLevel: 1 }
    );

    // 2. Expanded empty group 'group-empty':
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-empty',
        offsetY: 4,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-empty', position: 'before', indentLevel: 1 }
    );
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-empty',
        offsetY: 12,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-empty', position: 'into', indentLevel: 2 }
    );
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'group-empty',
        offsetY: 20,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-empty', position: 'after', indentLevel: 1 }
    );
  });

  it('supports horizontal X-axis outdenting when hovering in the after zone of a trailing child', () => {
    const tree = createSampleTree();

    // 'l-coastlines' is the last child of 'group-water' (indentLevel = 2)
    // Cursor at offsetX = 48 -> desiredIndentLevel = Math.floor((48 - 6) / 18) = 2 -> stays inside 'group-water' after 'l-coastlines'
    const insideWaterAfterCoastlines = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'l-coastlines',
      offsetY: 18,
      rowHeight: 24,
      offsetX: 48
    });
    assert.deepEqual(insideWaterAfterCoastlines, {
      targetId: 'l-coastlines',
      position: 'after',
      indentLevel: 2
    });

    // Cursor moved left to offsetX = 24 -> desiredIndentLevel = Math.floor((24 - 6) / 18) = 1 -> outdents to 'after' 'group-water' at root level
    const outsideWaterAfterGroup = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-0'],
      hoveredNodeId: 'l-coastlines',
      offsetY: 18,
      rowHeight: 24,
      offsetX: 24
    });
    assert.deepEqual(outsideWaterAfterGroup, {
      targetId: 'group-water',
      position: 'after',
      indentLevel: 1
    });

    // Multi-level nested trailing child outdenting (level 3 -> level 2 -> level 1)
    const waterGroup = tree[1] as ProjectGroupItem;
    waterGroup.children.push({
      id: 'subgroup-deep',
      name: 'Deep Subgroup',
      visible: true,
      expanded: true,
      children: [
        {
          id: 'l-deep-last',
          name: 'Deep Last Layer',
          type: 'vector',
          source: '/test/deep.shp',
          visible: true
        }
      ]
    });

    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'l-deep-last',
        offsetY: 20,
        rowHeight: 24,
        offsetX: 65 // indent 3
      }),
      { targetId: 'l-deep-last', position: 'after', indentLevel: 3 }
    );

    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'l-deep-last',
        offsetY: 20,
        rowHeight: 24,
        offsetX: 45 // indent 2
      }),
      { targetId: 'subgroup-deep', position: 'after', indentLevel: 2 }
    );

    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-0'],
        hoveredNodeId: 'l-deep-last',
        offsetY: 20,
        rowHeight: 24,
        offsetX: 24 // indent 1
      }),
      { targetId: 'group-water', position: 'after', indentLevel: 1 }
    );
  });

  it('resolves project root row hover to targetId root with position into at indentLevel 1', () => {
    const tree = createSampleTree();

    const rootDrop = resolveNodeDropTarget({
      tree,
      draggedIds: ['l-coastlines'],
      hoveredNodeId: 'project',
      offsetY: 10,
      rowHeight: 24,
      offsetX: 20
    });
    assert.deepEqual(rootDrop, {
      targetId: 'root',
      position: 'into',
      indentLevel: 1
    });
  });

  it('rejects self-drops and drops onto descendants of a dragged group', () => {
    const tree = createSampleTree();

    // Self-drop on group-water
    assert.equal(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['group-water'],
        hoveredNodeId: 'group-water',
        offsetY: 4,
        rowHeight: 24,
        offsetX: 24
      }),
      null
    );

    // Drop dragged group onto its own descendant 'l-coastlines'
    assert.equal(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['group-water'],
        hoveredNodeId: 'l-coastlines',
        offsetY: 18,
        rowHeight: 24,
        offsetX: 24
      }),
      null
    );

    // Self-drop of trailing child 'l-coastlines' at its own indentLevel (2) is rejected (null),
    // whereas outdenting 'l-coastlines' to indentLevel 1 resolves to 'after' 'group-water'
    assert.equal(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-coastlines'],
        hoveredNodeId: 'l-coastlines',
        offsetY: 18,
        rowHeight: 24,
        offsetX: 48
      }),
      null
    );
    assert.deepEqual(
      resolveNodeDropTarget({
        tree,
        draggedIds: ['l-coastlines'],
        hoveredNodeId: 'l-coastlines',
        offsetY: 18,
        rowHeight: 24,
        offsetX: 24
      }),
      { targetId: 'group-water', position: 'after', indentLevel: 1 }
    );
  });
});

