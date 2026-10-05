/**
 * @file ToolbarWidget.tsx
 * @module renderer/workbench/widgets/ToolbarWidget
 * @description Dockable toolbar widget subclass of Widget featuring MDI grabber drag handles and divider icons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link Widget}
 */

import React from "react";
import { Widget } from "./Widget";
import type { ToolbarId, ToolbarZone } from "@renderer/state/gisSignals";
import Icon from "@renderer/components/common/Icon";
import { mdiDrag, mdiDragHorizontal, mdiPowerOn, mdiMinus } from "@mdi/js";

/**
 * @typedef {Object} ToolbarWidgetProps
 * @property {ToolbarId} id - Toolbar identifier string ('basic' | 'digitizing' | 'snapping').
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
 * @description Individual toolbar container widget rendered inside outer panel zones with drag handles and orientation awareness.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {ToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Rendered toolbar widget element.
 */
export const ToolbarWidget: React.FC<ToolbarWidgetProps> = ({
  id,
  zone = "top",
  children,
}) => {
  const isHorizontal = zone === "top" || zone === "bottom";

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
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

  return (
    <Widget
      id={`toolbar-widget-${id}`}
      background='#ffffff'
      border={1}
      borderColor='#e2e8f0'
      location={zone}
      minWidth={isHorizontal ? "auto" : 36}
      minHeight={isHorizontal ? 36 : "auto"}
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
      {/* Grabber Handle: MDI Icon 'drag' (horizontal) / 'drag-horizontal' (vertical) with high contrast */}
      <span
        className='toolbar-grabber'
        title='Drag toolbar to reorder or move to another edge'
        draggable={true}
        onDragStart={handleDragStart}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          userSelect: "none",
          padding: isHorizontal ? "0 2px" : "2px 0",
        }}>
        <Icon path={isHorizontal ? mdiDrag : mdiDragHorizontal} size='24px' />
      </span>

      {/* Child Controls */}
      {children}

      {/* Divider: MDI Icon 'power-on' (horizontal) / 'minus' (vertical) */}
      <span
        className='toolbar-divider'
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#cbd5e1",
          padding: isHorizontal ? "0 2px" : "2px 0",
          userSelect: "none",
        }}>
        <Icon path={isHorizontal ? mdiPowerOn : mdiMinus} size='24px' />
      </span>
    </Widget>
  );
};
