/**
 * @file BasicWidget.tsx
 * @module renderer/workbench/widgets/BasicWidget
 * @description Standard subclass of Widget featuring a 3-control header bar (label, minimize toggle, close button) and collapsable content body.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link Widget}
 */

import React, { useRef, useEffect } from "react";
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
import {
  prefsUiBaseFontSize,
  prefsUiIconSize,
} from "@renderer/state/preferencesSignals";

import type { IDockviewPanelProps } from "dockview-react";

/**
 * Helper to parse pixel values from number or CSS string representations.
 */
function parsePxValue(
  val: number | string | undefined,
  defaultVal: number
): number {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === "number") return val;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
}

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
 * @updated 2026-10-01
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
    minWidth,
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
  const baseFontSizePt = prefsUiBaseFontSize.value ?? 12;
  const iconSize = prefsUiIconSize.value ?? 14;

  /**
   * @signal isBasicWidgetMinimizedSignal
   * @description Reactive signal tracking minimize toggle state of BasicWidget container.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-22
   * @updated 2026-10-01
   * @since 0.1.0-dev
   * @type {Signal<boolean>}
   */
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
    isMinimized ? "1.875em" : savedBoundsRef.current.maxHeight || maxHeight;

  const canClose = !!(onClose || effectivePanelApi);

  // Dynamic minimum width floor calculation: border + padding + button controls + title margin + buffer + 4rem
  const borderPx = 2 * parsePxValue(border, 1);
  const paddingPx = 2 * parsePxValue(padding, 4);

  const buttonCount = canClose ? 2 : 1;
  const buttonPaddingPx = 4; // 2px left + 2px right per control button
  const buttonGapPx = buttonCount > 1 ? 4 : 0;
  const headerPaddingPx = 16; // 8px left + 8px right inner header padding
  const titleMarginPx = 8; // 8px right margin on the title span
  const safetyBufferPx = 16; // Extra buffer to prevent cutoff from panel borders or scrollbars
  const buttonControlsWidth =
    buttonCount * (iconSize + buttonPaddingPx)
    + buttonGapPx
    + headerPaddingPx
    + titleMarginPx
    + safetyBufferPx;

  // 4rem in pixels (base font size in pt converted to px where 1pt = 4/3 px)
  const baseFontSizePx = baseFontSizePt * (4 / 3);
  const fourRemPx = 4 * baseFontSizePx;

  const computedMinWidthFloor =
    borderPx + paddingPx + buttonControlsWidth + fourRemPx;
  const requestedMinWidth = parsePxValue(minWidth, 32);
  const effectiveMinWidth = Math.max(
    requestedMinWidth,
    Math.ceil(computedMinWidthFloor)
  );

  useEffect(() => {
    if (effectivePanelApi) {
      // DockviewPanelApi's setConstraints doesn't dynamically update the panel's minimum width due to a limitation in dockview-core.
      // We must apply the constraints directly to the parent DockviewGroupPanel's API instead.
      const groupApi = (effectivePanelApi as any).group?.api;
      if (groupApi && typeof groupApi.setConstraints === "function") {
        groupApi.setConstraints({ minimumWidth: effectiveMinWidth });
      }
    }
  }, [effectivePanelApi, effectiveMinWidth]);

  return (
    <Widget
      id={name}
      background={background}
      border={border}
      borderColor={borderColor}
      padding={padding}
      location={location}
      minWidth={effectiveMinWidth}
      maxWidth={activeMaxWidth}
      minHeight={isMinimized ? "1.875em" : minHeight}
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
          height: "1.625em",
          minHeight: "1.625em",
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
            flex: 1,
            minWidth: 0,
            marginRight: "8px",
          }}>
          {displayName}
        </span>

        <div
          className='basic-widget-controls'
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}>
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
              size={`${iconSize}px`}
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
              <Icon path={mdiClose} size={`${iconSize}px`} />
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
