/**
 * @file Widget.tsx
 * @module renderer/workbench/widgets/Widget
 * @description Base abstraction component for all non-map workbench UI containers, supporting resizing, custom context menus, and docking bounds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 */

import React, { useRef, useEffect } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import type { DockviewPanelApi, DockviewApi } from "dockview-core";

/**
 * @typedef {Object} WidgetContextMenuItem
 * @property {string} label - Context menu item display title.
 * @property {() => void} action - Callback executed on clicking menu item.
 * @property {string} [icon] - Optional MDI icon path.
 * @property {boolean} [checked] - True if checkmark icon is displayed.
 */
export interface WidgetContextMenuItem {
  label: string;
  action: () => void;
  icon?: string;
  checked?: boolean;
}

/**
 * @typedef {Object} WidgetProps
 * @property {string} [id] - Unique container DOM element ID.
 * @property {string} [background='#f3f3f3'] - Background color hex or CSS string.
 * @property {'top' | 'bottom' | 'left' | 'right'} [location='left'] - Outer panel dock zone.
 * @property {number | string} [minWidth=32] - Minimum width constraint in pixels or CSS.
 * @property {number | string} [maxWidth='auto'] - Maximum width constraint in pixels or CSS.
 * @property {number | string} [minHeight=32] - Minimum height constraint in pixels or CSS.
 * @property {number | string} [maxHeight='auto'] - Maximum height constraint in pixels or CSS.
 * @property {number | string} [border=0] - Border width in pixels or CSS string.
 * @property {string} [borderColor='#f3f3f3'] - Border color hex or CSS string.
 * @property {number | string} [padding=0] - Inner padding in pixels or CSS string.
 * @property {string} [className] - Optional custom CSS class string.
 * @property {React.CSSProperties} [style] - Inline CSS style overrides.
 * @property {React.ReactNode} [children] - Child elements rendered inside widget.
 * @property {() => void} [onClose] - Callback when widget is closed.
 * @property {() => void} [onUndock] - Callback when widget is undocked.
 * @property {WidgetContextMenuItem[]} [customContextMenuItems] - Optional array of context menu items.
 * @property {DockviewApi} [containerApi] - Optional parent Dockview container API instance.
 * @property {DockviewPanelApi} [panelApi] - Optional Dockview panel API instance.
 */
export interface WidgetProps {
  id?: string;
  background?: string;
  location?: "top" | "bottom" | "left" | "right";
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  border?: number | string;
  borderColor?: string;
  padding?: number | string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClose?: () => void;
  onUndock?: () => void;
  customContextMenuItems?: WidgetContextMenuItem[];
  containerApi?: DockviewApi;
  panelApi?: DockviewPanelApi;
}

/**
 * @component Widget
 * @description Base container widget establishing standardized drag handles, context menus, and responsive size observation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {WidgetProps} props - Component properties.
 * @returns {React.ReactElement} Base widget container element.
 */
export const Widget: React.FC<WidgetProps> = ({
  id,
  background = "#f3f3f3",
  location = "left",
  minWidth = 32,
  maxWidth = "auto",
  minHeight = 32,
  maxHeight = "auto",
  border = 0,
  borderColor = background,
  padding = 0,
  className = "",
  style = {},
  children,
  onClose,
  onUndock,
  customContextMenuItems = [],
}) => {
  useSignals();
  const widgetContextMenuPositionSignal = useSignal<{
    x: number;
    y: number;
  } | null>(null);
  const isWidgetUndockedSignal = useSignal<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetDimensionsSignal = useSignal<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const contextMenuPos = widgetContextMenuPositionSignal.value;
  const isUndocked = isWidgetUndockedSignal.value;
  const dimensions = widgetDimensionsSignal.value;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        widgetDimensionsSignal.value = {
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        };
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    widgetContextMenuPositionSignal.value = { x: e.clientX, y: e.clientY };
  };

  const closeContextMenu = () => {
    widgetContextMenuPositionSignal.value = null;
  };

  useEffect(() => {
    if (!contextMenuPos) return;
    const handleOutsideClick = () => closeContextMenu();
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [contextMenuPos]);

  const defaultMenu: WidgetContextMenuItem[] = [
    ...(onClose ? [{ label: "Close", action: () => onClose() }] : []),
    ...(onUndock ?
      [
        {
          label: "Undock to Floating Window",
          action: () => {
            isWidgetUndockedSignal.value = true;
            onUndock();
          },
        },
      ]
    : []),
  ];

  const menuItems =
    customContextMenuItems.length > 0 ? customContextMenuItems : defaultMenu;

  return (
    <div
      ref={containerRef}
      id={id}
      data-location={location}
      data-current-width={dimensions.width}
      data-current-height={dimensions.height}
      className={`cartouche-widget ${className} ${isUndocked ? "is-undocked" : ""}`}
      onContextMenu={handleContextMenu}
      style={{
        backgroundColor: background,
        borderWidth: typeof border === "number" ? `${border}px` : border,
        borderStyle: border ? "solid" : "none",
        borderColor: borderColor,
        padding: typeof padding === "number" ? `${padding}px` : padding,
        minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth,
        maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        ...style,
      }}>
      {children}

      {/* Floating Widget Context Menu */}
      {contextMenuPos && (
        <div
          className='widget-context-menu'
          style={{
            position: "fixed",
            top: contextMenuPos.y,
            left: contextMenuPos.x,
            zIndex: 9999,
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            padding: "4px 0",
            fontSize: "0.9167rem",
            color: "#0f172a",
            minWidth: "140px",
          }}>
          {menuItems.map((item, idx) => (
            <div
              key={idx}
              className='widget-menu-item'
              onClick={(e) => {
                e.stopPropagation();
                item.action();
                closeContextMenu();
              }}
              style={{
                padding: "6px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                userSelect: "none",
              }}>
              <span>{item.label}</span>
              {item.checked && (
                <span style={{ marginLeft: "8px", color: "#1b446c" }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
