/**
 * @file ToolbarContainerWidget.tsx
 * @module renderer/workbench/widgets/ToolbarContainerWidget
 * @description Outer panel edge container widget managing masonry layout and drag-and-drop relocation for toolbars across 4 outer zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { Widget } from "./Widget";
import {
  visibleToolbarsSignal,
  toggleToolbar,
  moveToolbar,
  type ToolbarId,
  type ToolbarZone,
} from "@renderer/state/gisSignals";
import { useSignals, useSignal } from "@preact/signals-react/runtime";

/**
 * @typedef {Object} ToolbarContainerWidgetProps
 * @property {ToolbarZone} zone - Outer panel dock zone identifier ('top' | 'bottom' | 'left' | 'right').
 * @property {React.ReactNode} [children] - Child toolbar widgets docked inside this container zone.
 */
export interface ToolbarContainerWidgetProps {
  zone: ToolbarZone;
  children?: React.ReactNode;
}

/**
 * @component ToolbarContainerWidget
 * @description Outer 4-edge panel container hosting docked ToolbarWidget items and handling dragover drop targets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {ToolbarContainerWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Toolbar container zone element.
 */
export const ToolbarContainerWidget: React.FC<ToolbarContainerWidgetProps> = ({
  zone,
  children,
}) => {
  useSignals();
  /**
   * @signal isToolbarZoneDragOverSignal
   * @description Reactive signal tracking dragover state when hovering toolbar widgets over container zone.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-22
   * @updated 2026-10-01
   * @since 0.1.0-dev
   * @type {Signal<boolean>}
   */
  const isToolbarZoneDragOverSignal = useSignal<boolean>(false);
  const isDragOver = isToolbarZoneDragOverSignal.value;

  const isHorizontal = zone === "top" || zone === "bottom";
  const visibleToolbars = visibleToolbarsSignal.value;
  const hasChildren = React.Children.count(children) > 0;

  const toolbarLabels: Record<ToolbarId, string> = {
    basic: "Basic Toolbar",
    layer: "Layer Toolbar",
    digitizing: "Digitizing Toolbar",
    snapping: "Snapping Toolbar",
  };

  const contextMenuItems = (Object.keys(toolbarLabels) as ToolbarId[]).map(
    (id) => ({
      label: toolbarLabels[id],
      checked: visibleToolbars[id],
      action: () => toggleToolbar(id),
    })
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    isToolbarZoneDragOverSignal.value = true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isToolbarZoneDragOverSignal.value) {
      isToolbarZoneDragOverSignal.value = true;
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear dragOver if mouse leaves the container element completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      isToolbarZoneDragOverSignal.value = false;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    isToolbarZoneDragOverSignal.value = false;
    const toolbarId = e.dataTransfer.getData("text/plain") as ToolbarId;
    if (toolbarId && visibleToolbars[toolbarId] !== undefined) {
      moveToolbar(toolbarId, zone);
    }
  };

  const activeBackground = isDragOver ? "#e0f2fe" : "#f8fafc";
  const activeBorderColor = isDragOver ? "#0284c7" : "#f8fafc";

  // Fast transition on drag-enter (0.05s), slow smooth transition on drag-leave (0.7s)
  const currentTransition =
    isDragOver ? "all 0.0s ease-in" : "all 0.7s ease-out";

  // Auto-collapse drop target if no visible children in zone; expands on drag over
  if (!hasChildren) {
    return (
      <div
        className={`toolbar-container-widget-drop-target zone-${zone} ${isDragOver ? "is-drag-over" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          minWidth:
            isHorizontal ? "100%"
            : isDragOver ? "36px"
            : "1px",
          minHeight:
            isHorizontal ?
              isDragOver ? "36px"
              : "1px"
            : "100%",
          backgroundColor: activeBackground,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: activeBorderColor,
          transition: currentTransition,
          boxSizing: "border-box",
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}></div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: isHorizontal ? "100%" : "auto",
        height: isHorizontal ? "auto" : "100%",
        display: "flex",
      }}>
      <Widget
        id={`toolbar-container-${zone}`}
        background={activeBackground}
        border={1}
        borderColor={activeBorderColor}
        location={zone}
        minWidth={isHorizontal ? "100%" : 32}
        minHeight={isHorizontal ? 32 : "100%"}
        customContextMenuItems={contextMenuItems}
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          flexWrap: "wrap",
          alignItems: "flex-start",
          alignContent: "flex-start",
          gap: "4px",
          padding: "2px 4px",
          userSelect: "none",
          width: "100%",
          height: "100%",
          transition: currentTransition,
        }}>
        {children}
      </Widget>
    </div>
  );
};
