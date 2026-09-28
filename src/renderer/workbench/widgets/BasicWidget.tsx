import React, { useRef } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import { Widget, type WidgetProps } from "./Widget";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiWindowMinimize, mdiWindowRestore, mdiClose } from "@mdi/js";

export interface BasicWidgetProps extends Omit<WidgetProps, "children"> {
  name?: string;
  displayName?: string;
  children?: React.ReactNode;
}

export const BasicWidget: React.FC<BasicWidgetProps> = ({
  name = "basic-widget",
  displayName = "Basic",
  background = "#ffffff",
  borderColor = "#e2e8f0",
  location = "left",
  minWidth = 180,
  maxWidth = "auto",
  minHeight = 120,
  maxHeight = "auto",
  className = "",
  style = {},
  children,
  onClose,
  onUndock,
}) => {
  useSignals();
  const isBasicWidgetMinimizedSignal = useSignal<boolean>(false);
  const isMinimized = isBasicWidgetMinimizedSignal.value;
  const savedBoundsRef = useRef<{
    maxWidth: number | string;
    maxHeight: number | string;
  }>({ maxWidth, maxHeight });

  const toggleMinimize = () => {
    if (!isBasicWidgetMinimizedSignal.value) {
      savedBoundsRef.current = { maxWidth, maxHeight };
    }
    isBasicWidgetMinimizedSignal.value = !isBasicWidgetMinimizedSignal.value;
  };

  const activeMaxWidth =
    isMinimized ? "100%" : savedBoundsRef.current.maxWidth || maxWidth;
  const activeMaxHeight =
    isMinimized ? "30px" : savedBoundsRef.current.maxHeight || maxHeight;

  return (
    <Widget
      id={name}
      background={background}
      border={4}
      borderColor={borderColor}
      location={location}
      minWidth={minWidth}
      maxWidth={activeMaxWidth}
      minHeight={isMinimized ? 30 : minHeight}
      maxHeight={activeMaxHeight}
      className={`basic-widget ${name} ${isMinimized ? "is-minimized" : ""} ${className}`}
      onClose={onClose}
      onUndock={onUndock}
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        transition: "max-height 0.2s ease, min-height 0.2s ease",
        ...style,
      }}>
      {/* Header Row: Label + Minimize Toggle + Close Button */}
      <div
        className='basic-widget-header'
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#faf8fc",
          padding: "4px 8px",
          borderBottom: isMinimized ? "none" : "1px solid #e2e8f0",
          height: "26px",
          minHeight: "26px",
          userSelect: "none",
          cursor: "grab",
        }}>
        <span
          className='basic-widget-title'
          style={{
            fontWeight: 600,
            fontSize: "10.5pt",
            color: "#1e293b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
          {displayName}
        </span>

        <div
          className='basic-widget-controls'
          style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type='button'
            className='widget-control-btn'
            title={isMinimized ? "Restore" : "Minimize"}
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "#64748b",
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
            }}>
            <Icon
              path={isMinimized ? mdiWindowRestore : mdiWindowMinimize}
              size={14}
            />
          </button>

          {onClose && (
            <button
              type='button'
              className='widget-control-btn'
              title='Close'
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "#64748b",
                borderRadius: "2px",
                display: "flex",
                alignItems: "center",
              }}>
              <Icon path={mdiClose} size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content Body */}
      {!isMinimized && (
        <div
          className='basic-widget-body'
          style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {children}
        </div>
      )}
    </Widget>
  );
};
