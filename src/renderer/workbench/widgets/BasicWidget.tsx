/**
 * @file BasicWidget.tsx
 * @module renderer/workbench/widgets/BasicWidget
 * @description Standard subclass of Widget featuring a 3-control header bar (label, minimize toggle, close button) and collapsable content body.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @see {@link Widget}
 */

import React, { useRef } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import { Widget, type WidgetProps } from "./Widget";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiWindowMinimize, mdiWindowRestore, mdiClose } from "@mdi/js";
import {
  PanelTransfer,
  LocalSelectionTransfer,
  type DockviewApi,
  type DockviewPanelApi,
} from "dockview-core";

import type { IDockviewPanelProps } from "dockview-react";

/**
 * @typedef {Object} BasicWidgetProps
 * @extends WidgetProps
 * @property {string} [name='basic-widget'] - Widget identifier string.
 * @property {string} [displayName='Basic'] - Title label text rendered in header.
 * @property {React.ReactNode} [children] - Content rendered inside body.
 * @property {DockviewApi} [containerApi] - Optional parent Dockview container API instance.
 * @property {DockviewPanelApi} [panelApi] - Optional Dockview panel API instance.
 */
export interface BasicWidgetProps
  extends Omit<WidgetProps, "children">, Partial<IDockviewPanelProps> {
  name?: string;
  displayName?: string;
  children?: React.ReactNode;
  containerApi?: DockviewApi;
  panelApi?: DockviewPanelApi;
}

/**
 * @component BasicWidget
 * @description Subclasses Widget to provide a collapsable panel container with a title header bar and minimize/close controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {BasicWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Basic widget panel element.
 */
export const BasicWidget: React.FC<BasicWidgetProps> = (props) => {
  const {
    name = "basic-widget",
    displayName = "Basic",
    background = "#f3f3f3",
    borderColor = background,
    border = 1,
    padding = 4,
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
  } = props;

  const effectivePanelApi = props.panelApi || props.api;
  const effectiveContainerApi = props.containerApi;

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

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (effectivePanelApi) {
      effectivePanelApi.close();
    }
  };

  const handleHeaderDragStart = (e: React.DragEvent) => {
    if (!effectivePanelApi) return;
    const viewId =
      effectiveContainerApi?.id
      || (effectivePanelApi.group as any)?.model?.accessor?.id
      || "";
    const groupId = effectivePanelApi.group?.id || "";
    const panelId = effectivePanelApi.id;

    if (groupId && panelId) {
      LocalSelectionTransfer.getInstance().setData(
        [new PanelTransfer(viewId, groupId, panelId)],
        PanelTransfer.prototype
      );
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", panelId);
      }
    }
  };

  const handleHeaderDragEnd = () => {
    LocalSelectionTransfer.getInstance().clearData(PanelTransfer.prototype);
  };

  const activeMaxWidth =
    isMinimized ? "100%" : savedBoundsRef.current.maxWidth || maxWidth;
  const activeMaxHeight =
    isMinimized ? "30px" : savedBoundsRef.current.maxHeight || maxHeight;

  const canClose = !!(onClose || effectivePanelApi);

  return (
    <Widget
      id={name}
      background={background}
      border={border}
      borderColor={borderColor}
      padding={padding}
      location={location}
      minWidth={minWidth}
      maxWidth={activeMaxWidth}
      minHeight={isMinimized ? 30 : minHeight}
      maxHeight={activeMaxHeight}
      className={`basic-widget ${name} ${isMinimized ? "is-minimized" : ""} ${className}`}
      onClose={canClose ? handleClose : undefined}
      onUndock={onUndock}
      containerApi={effectiveContainerApi}
      panelApi={effectivePanelApi}
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
        draggable={!!effectivePanelApi}
        onDragStart={handleHeaderDragStart}
        onDragEnd={handleHeaderDragEnd}
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
          cursor: effectivePanelApi ? "grab" : "default",
        }}>
        <span
          className='basic-widget-title'
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
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
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
              size='14px'
            />
          </button>

          {canClose && (
            <button
              type='button'
              className='widget-control-btn'
              title='Close'
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
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
              <Icon path={mdiClose} size='14px' />
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
