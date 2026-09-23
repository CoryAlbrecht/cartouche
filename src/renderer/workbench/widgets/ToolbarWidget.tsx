import React from "react";
import { Widget } from "./Widget";
import type { ToolbarId, ToolbarZone } from "@renderer/state/gisSignals";

export interface ToolbarWidgetProps {
  id: ToolbarId;
  zone?: ToolbarZone;
  children?: React.ReactNode;
}

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
      background="#ffffff"
      border={1}
      borderColor="#e2e8f0"
      location={zone}
      minWidth={isHorizontal ? "auto" : 28}
      minHeight={isHorizontal ? 28 : "auto"}
      style={{
        display: "inline-flex",
        flexDirection: isHorizontal ? "row" : "column",
        alignItems: "center",
        padding: isHorizontal ? "2px 4px" : "4px 2px",
        borderRadius: "3px",
        gap: "2px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        cursor: "default",
      }}
    >
      {/* Grabber Handle: U+28FF Braille Pattern Dots 12345678 (⣿) */}
      <span
        className="toolbar-grabber"
        title="Drag toolbar to reorder or move to another edge"
        draggable={true}
        onDragStart={handleDragStart}
        style={{
          cursor: "grab",
          userSelect: "none",
          color: "#94a3b8",
          fontSize: "11pt",
          lineHeight: 1,
          padding: isHorizontal ? "0 2px" : "2px 0",
          letterSpacing: "-1px",
        }}
      >
        ⣿
      </span>

      {/* Child Controls */}
      {children}

      {/* Divider: U+2502 Light Vertical Bar (│) */}
      <span
        className="toolbar-divider"
        style={{
          color: "#cbd5e1",
          fontSize: "11pt",
          lineHeight: 1,
          padding: isHorizontal ? "0 2px" : "2px 0",
          userSelect: "none",
        }}
      >
        │
      </span>
    </Widget>
  );
};
