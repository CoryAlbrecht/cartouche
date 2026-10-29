/**
 * @file ToolbarDropTarget.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarDropTarget.test
 * @description Unit tests for toolbar drop-target hit-zone resolution and index calculation (Ticket #110).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link resolveToolbarDropPosition}
 * @see {@link resolveContainerDropPosition}
 * @see {@link calculateToolbarTargetIndex}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveToolbarDropPosition,
  resolveContainerDropPosition,
  calculateToolbarTargetIndex
} from '../../../../src/renderer/workbench/widgets/toolbarDropTarget';
import type { ToolbarId } from '../../../../src/renderer/state/gisSignals';

describe('resolveToolbarDropPosition', () => {
  it('resolves horizontal top/bottom zones based on X offset', () => {
    // Width = 100px, Height = 32px. OffsetX < 50 => 'before', OffsetX >= 50 => 'after'
    assert.equal(
      resolveToolbarDropPosition('top', 20, 15, 100, 32),
      'before',
      'Offset in left half of horizontal toolbar should resolve to before'
    );
    assert.equal(
      resolveToolbarDropPosition('top', 80, 15, 100, 32),
      'after',
      'Offset in right half of horizontal toolbar should resolve to after'
    );
    assert.equal(
      resolveToolbarDropPosition('bottom', 49, 15, 100, 32),
      'before',
      'Offset just below midpoint should resolve to before'
    );
    assert.equal(
      resolveToolbarDropPosition('bottom', 50, 15, 100, 32),
      'after',
      'Offset at midpoint should resolve to after'
    );
  });

  it('resolves vertical left/right zones based on Y offset', () => {
    // Width = 36px, Height = 80px. OffsetY < 40 => 'before', OffsetY >= 40 => 'after'
    assert.equal(
      resolveToolbarDropPosition('left', 18, 15, 36, 80),
      'before',
      'Offset in top half of vertical toolbar should resolve to before'
    );
    assert.equal(
      resolveToolbarDropPosition('left', 18, 65, 36, 80),
      'after',
      'Offset in bottom half of vertical toolbar should resolve to after'
    );
    assert.equal(
      resolveToolbarDropPosition('right', 18, 39, 36, 80),
      'before',
      'Offset just above midpoint should resolve to before'
    );
    assert.equal(
      resolveToolbarDropPosition('right', 18, 40, 36, 80),
      'after',
      'Offset at midpoint should resolve to after'
    );
  });

  it('resolves horizontal outer 25% cross-axis bands to new-row-above and new-row-below', () => {
    // Width = 100px, Height = 40px. 25% = 10px, 75% = 30px
    assert.equal(
      resolveToolbarDropPosition('top', 50, 5, 100, 40),
      'new-row-above',
      'Hovering in top 25% of horizontal toolbar resolves to new-row-above'
    );
    assert.equal(
      resolveToolbarDropPosition('top', 50, 35, 100, 40),
      'new-row-below',
      'Hovering in bottom 25% of horizontal toolbar resolves to new-row-below'
    );
    assert.equal(
      resolveToolbarDropPosition('bottom', 20, 8, 100, 40),
      'new-row-above',
      'Hovering in top 25% of bottom zone toolbar resolves to new-row-above'
    );
    assert.equal(
      resolveToolbarDropPosition('bottom', 80, 32, 100, 40),
      'new-row-below',
      'Hovering in bottom 25% of bottom zone toolbar resolves to new-row-below'
    );
  });

  it('resolves vertical outer 25% cross-axis bands to new-row-before and new-row-after', () => {
    // Width = 40px, Height = 100px. 25% = 10px, 75% = 30px
    assert.equal(
      resolveToolbarDropPosition('left', 5, 50, 40, 100),
      'new-row-before',
      'Hovering in left 25% of vertical toolbar resolves to new-row-before'
    );
    assert.equal(
      resolveToolbarDropPosition('left', 35, 50, 40, 100),
      'new-row-after',
      'Hovering in right 25% of vertical toolbar resolves to new-row-after'
    );
    assert.equal(
      resolveToolbarDropPosition('right', 8, 20, 40, 100),
      'new-row-before',
      'Hovering in left 25% of right zone toolbar resolves to new-row-before'
    );
    assert.equal(
      resolveToolbarDropPosition('right', 32, 80, 40, 100),
      'new-row-after',
      'Hovering in right 25% of right zone toolbar resolves to new-row-after'
    );
  });
});

describe('resolveContainerDropPosition', () => {
  it('resolves container hit zones based on 25% threshold', () => {
    // Dimension = 100px. Offset < 25 => 'prepend-new-row', Offset >= 25 => 'append-new-row'
    assert.equal(
      resolveContainerDropPosition('top', 10, 100),
      'prepend-new-row',
      'Offset in first 25% of container resolves to prepend-new-row'
    );
    assert.equal(
      resolveContainerDropPosition('top', 50, 100),
      'append-new-row',
      'Offset in trailing 75% of container resolves to append-new-row'
    );
    assert.equal(
      resolveContainerDropPosition('left', 20, 100),
      'prepend-new-row',
      'Offset in first 25% of vertical container resolves to prepend-new-row'
    );
    assert.equal(
      resolveContainerDropPosition('left', 80, 100),
      'append-new-row',
      'Offset in trailing 75% of vertical container resolves to append-new-row'
    );
  });

  it('falls back to append-new-row if dimension is 0 or unmeasured', () => {
    assert.equal(resolveContainerDropPosition('top', 0, 0), 'append-new-row');
  });
});

describe('calculateToolbarTargetIndex', () => {
  const fullOrder: ToolbarId[] = ['project', 'map_view', 'selection', 'digitizing'];

  describe('reordering within the same zone', () => {
    it('returns current index if dragging over itself', () => {
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'map_view',
        hoveredId: 'map_view',
        currentZone: 'top',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 1);
    });

    it('reorders forward: moving earlier item before later item', () => {
      // Move 'project' (idx 0) before 'selection' (idx 2)
      // Result should be ['map_view', 'project', 'selection', 'digitizing']
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'project',
        hoveredId: 'selection',
        currentZone: 'top',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 1);
    });

    it('reorders forward: moving earlier item after later item', () => {
      // Move 'project' (idx 0) after 'selection' (idx 2)
      // Result should be ['map_view', 'selection', 'project', 'digitizing']
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'project',
        hoveredId: 'selection',
        currentZone: 'top',
        targetZone: 'top',
        position: 'after'
      });
      assert.equal(idx, 2);
    });

    it('reorders backward: moving later item before earlier item', () => {
      // Move 'digitizing' (idx 3) before 'map_view' (idx 1)
      // Result should be ['project', 'digitizing', 'map_view', 'selection']
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'digitizing',
        hoveredId: 'map_view',
        currentZone: 'top',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 1);
    });

    it('reorders backward: moving later item after earlier item', () => {
      // Move 'digitizing' (idx 3) after 'map_view' (idx 1)
      // Result should be ['project', 'map_view', 'digitizing', 'selection']
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'digitizing',
        hoveredId: 'map_view',
        currentZone: 'top',
        targetZone: 'top',
        position: 'after'
      });
      assert.equal(idx, 2);
    });

    it('moves item to first position (index 0) when dropped before first toolbar', () => {
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        visibleOrder: ['project', 'map_view', 'selection', 'digitizing'],
        draggedId: 'selection',
        hoveredId: 'project',
        currentZone: 'top',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 0);
    });

    it('moves item to index 0 even if first visible toolbar is preceded by hidden toolbars', () => {
      // Suppose 'project' is hidden, 'map_view' is the first visible toolbar
      const orderWithHidden: ToolbarId[] = ['project', 'map_view', 'selection', 'digitizing'];
      const visible: ToolbarId[] = ['map_view', 'selection', 'digitizing'];

      const idx = calculateToolbarTargetIndex({
        fullOrder: orderWithHidden,
        visibleOrder: visible,
        draggedId: 'selection',
        hoveredId: 'map_view',
        currentZone: 'top',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 0, 'Dropping before the first visible toolbar must yield index 0');
    });

    it('moves item to last position when dropped after last toolbar', () => {
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        visibleOrder: ['project', 'map_view', 'selection', 'digitizing'],
        draggedId: 'project',
        hoveredId: 'digitizing',
        currentZone: 'top',
        targetZone: 'top',
        position: 'after'
      });
      assert.equal(idx, 3);
    });
  });

  describe('relocating across different zones', () => {
    it('inserts before target in destination zone', () => {
      // Target zone has ['project', 'map_view', 'selection', 'digitizing']
      // Dragged item is 'snapping' from 'bottom'
      // Drop before 'map_view' (idx 1) -> target index 1
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'snapping',
        hoveredId: 'map_view',
        currentZone: 'bottom',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 1);
    });

    it('inserts after target in destination zone', () => {
      // Drop after 'map_view' (idx 1) -> target index 2
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        draggedId: 'snapping',
        hoveredId: 'map_view',
        currentZone: 'bottom',
        targetZone: 'top',
        position: 'after'
      });
      assert.equal(idx, 2);
    });

    it('inserts at start (index 0) of destination zone when dropping before first toolbar', () => {
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        visibleOrder: ['project', 'map_view', 'selection', 'digitizing'],
        draggedId: 'snapping',
        hoveredId: 'project',
        currentZone: 'bottom',
        targetZone: 'top',
        position: 'before'
      });
      assert.equal(idx, 0);
    });

    it('inserts at end of destination zone when dropping after last toolbar', () => {
      const idx = calculateToolbarTargetIndex({
        fullOrder,
        visibleOrder: ['project', 'map_view', 'selection', 'digitizing'],
        draggedId: 'snapping',
        hoveredId: 'digitizing',
        currentZone: 'bottom',
        targetZone: 'top',
        position: 'after'
      });
      assert.equal(idx, 4);
    });
  });
});
