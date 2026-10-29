/**
 * @file ToolbarWidget.tsx
 * @module renderer/workbench/widgets/ToolbarWidget
 * @description Dockable toolbar widget subclass of Widget featuring MDI grabber drag handles, divider icons, and drag-and-drop reordering indicators.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link Widget}
 * @see {@link resolveToolbarDropPosition}
 * @see {@link moveToolbar}
 */

import React from "react";
import { Widget } from "./Widget";
import {
  type ToolbarId,
  type ToolbarZone,
  activeDraggedToolbarSignal,
  moveToolbar,
} from "@renderer/state/gisSignals";
import { useSignal, useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import { mdiDrag, mdiDragHorizontal, mdiPowerOn, mdiMinus } from "@mdi/js";
import {
  resolveToolbarDropPosition,
  type ToolbarDropPosition,
} from "./toolbarDropTarget";

/**
 * @typedef {Object} ToolbarWidgetProps
 * @property {ToolbarId} id - Toolbar identifier string ('project' | 'map_view' | 'selection' | 'digitizing' | 'snapping').
 * @property {ToolbarZone} [zone='top'] - Active dock zone placement ('top' | 'bottom' | 'left' | 'right').
 * @property {React.ReactNode} [children] - Toolbar action buttons and controls.
 */
export interface ToolbarWidgetProps {
  id: ToolbarId;
  zone?: ToolbarZone;
  children?: React.ReactNode;
}

/**
 * @component ToolbarWidget
 * @description Individual toolbar container widget rendered inside outer panel zones with drag handles, drop target indicators, and orientation awareness.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {ToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Rendered toolbar widget element.
 */
export const ToolbarWidget: React.FC<ToolbarWidgetProps> = ({
  id,
  zone = "top",
  children,
}) => {
  useSignals();
  const isHorizontal = zone === "top" || zone === "bottom";

  /**
   * @signal dropPositionSignal
   * @description Reactive signal tracking relative drop placement indicator ('before' or 'after') during toolbar dragover.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-28
   * @updated 2026-10-28
   * @since 0.1.0-dev
   * @type {Signal<ToolbarDropPosition | null>}
   */
  const dropPositionSignal = useSignal<ToolbarDropPosition | null>(null);
  const dropPosition = dropPositionSignal.value;

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    activeDraggedToolbarSignal.value = id;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";

    // Use the entire ToolbarWidget container as the drag preview image
    const targetEl = e.currentTarget as HTMLElement;
    const widgetElement = targetEl.closest(".cartouche-widget") as HTMLElement;
    if (widgetElement) {
      const rect = widgetElement.getBoundingClientRect();
      const offsetX = Math.max(0, e.clientX - rect.left);
      const offsetY = Math.max(0, e.clientY - rect.top);
      e.dataTransfer.setDragImage(widgetElement, offsetX, offsetY);
    }
  };

  const handleDragEnd = () => {
    activeDraggedToolbarSignal.value = null;
    dropPositionSignal.value = null;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    const draggedId = activeDraggedToolbarSignal.value;
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    const draggedId = activeDraggedToolbarSignal.value;
    if (!draggedId) return;
    e.preventDefault();
    e.stopPropagation();

    if (draggedId === id) {
      if (dropPositionSignal.value !== null) {
        dropPositionSignal.value = null;
      }
      return;
    }

    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = resolveToolbarDropPosition(
      zone,
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height
    );
    if (dropPositionSignal.value !== pos) {
      dropPositionSignal.value = pos;
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      dropPositionSignal.value = null;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const draggedId =
      activeDraggedToolbarSignal.value ||
      (e.dataTransfer.getData("text/plain") as ToolbarId);
    if (!draggedId) return;

    // Prevent default and stop bubbling to outer containers regardless of target
    e.preventDefault();
    e.stopPropagation();

    // Dropping on self is a no-op
    if (draggedId === id) {
      dropPositionSignal.value = null;
      activeDraggedToolbarSignal.value = null;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const pos =
      dropPositionSignal.value ||
      resolveToolbarDropPosition(
        zone,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height
      );

    moveToolbar(draggedId, zone, {
      hoveredId: id,
      position: pos,
    });
    dropPositionSignal.value = null;
    activeDraggedToolbarSignal.value = null;
  };

  return (
    <div
      className={`toolbar-widget-wrapper ${dropPosition ? `toolbar-drop-target toolbar-drop-${dropPosition}` : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "inline-flex",
        position: "relative",
      }}>
      <Widget
        id={`toolbar-widget-${id}`}
        background='#ffffff'
        border={1}
        borderColor='#e2e8f0'
        location={zone}
        minWidth={isHorizontal ? "auto" : "calc(var(--cartouche-ui-icon-size, 24px) + 12px)"}
        minHeight={isHorizontal ? "calc(var(--cartouche-ui-icon-size, 24px) + 12px)" : "auto"}
        style={{
          display: "inline-flex",
          flexDirection: isHorizontal ? "row" : "column",
          alignItems: "center",
          padding: isHorizontal ? "2px 4px" : "4px 2px",
          borderRadius: "3px",
          gap: "2px",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          cursor: "default",
        }}>
        {/* Grabber Handle: MDI Icon 'drag' (horizontal) / 'drag-horizontal' (vertical) with low contrast */}
        <span
          className='toolbar-grabber'
          title='Drag toolbar to reorder or move to another edge'
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "grab",
            userSelect: "none",
            padding: isHorizontal ? "0 2px" : "2px 0",
          }}>
          <Icon path={isHorizontal ? mdiDrag : mdiDragHorizontal} />
        </span>

        {/* Child Controls */}
        {children}

        {/* Divider: MDI Icon 'power-on' (horizontal) / 'minus' (vertical) with low contrast */}
        <span
          className='toolbar-divider'
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isHorizontal ? "0 2px" : "2px 0",
            userSelect: "none",
          }}>
          <Icon path={isHorizontal ? mdiPowerOn : mdiMinus} />
        </span>
      </Widget>

      {/* Drop Insertion Marker */}
      {dropPosition && (
        <span
          className={`toolbar-drop-marker ${isHorizontal ? "horizontal" : "vertical"} ${dropPosition}`}
        />
      )}
    </div>
  );
};
