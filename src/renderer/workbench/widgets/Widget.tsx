import React, { useRef, useEffect } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";

export interface WidgetContextMenuItem {
  label: string;
  action: () => void;
  icon?: string;
  checked?: boolean;
}

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
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClose?: () => void;
  onUndock?: () => void;
  customContextMenuItems?: WidgetContextMenuItem[];
}

export const Widget: React.FC<WidgetProps> = ({
  id,
  background = "#f3f3f3",
  location = "left",
  minWidth = 32,
  maxWidth = "auto",
  minHeight = 32,
  maxHeight = "auto",
  border = 0,
  borderColor = "#f3f3f3",
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
            fontSize: "11pt",
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
