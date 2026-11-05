/**
 * @file BasicWidget.tsx
 * @module renderer/workbench/widgets/BasicWidget
 * @description Standard subclass of Widget featuring a 2-control header bar (label, close button) and content body.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link Widget}
 */

import React, { useEffect, useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Widget, type WidgetProps } from "./Widget";
import Icon from "@renderer/components/common/Icon";
import { mdiClose } from "@mdi/js";
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
import { resolveWidgetDropZone, type WidgetDropZone } from "./widgetDropTarget";
import {
  getWidgetDockItem,
  createOverlapContainer,
} from "../../state/widgetDockSignals";

import type { IDockviewPanelProps } from "dockview-react";

/**
 * Helper to parse pixel values from number or CSS string representations.
 * @function parsePxValue
 * @description Parses pixel numbers from CSS length strings or numeric representations.
 * @param {number | string | undefined} val - Raw pixel or CSS value.
 * @param {number} defaultVal - Default fallback value if parsing fails.
 * @returns {number} Parsed numeric pixel value.
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
 * @property {string | React.ReactNode} [icon] - Optional MDI SVG path string or custom icon node rendered to the left of the title at 50% ui.icon.size.
 * @property {boolean} [overlappable=false] - Whether this widget can be grouped into an OverlapTabWidget container.
 * @property {React.ReactNode} [children] - Content rendered inside body.
 * @property {DockviewApi} [containerApi] - Optional parent Dockview container API instance.
 * @property {DockviewPanelApi} [panelApi] - Optional Dockview panel API instance.
 * @property {(targetId: string, draggedId: string) => void} [onOverlapBundle] - Callback fired when an overlappable widget is dropped onto this widget to create a tab group.
 */
export interface BasicWidgetProps
  extends Omit<WidgetProps, "children">, Partial<IDockviewPanelProps> {
  name?: string;
  displayName?: string;
  icon?: string | React.ReactNode;
  readonly overlappable?: boolean;
  children?: React.ReactNode;
  containerApi?: DockviewApi;
  panelApi?: DockviewPanelApi;
  onOverlapBundle?: (targetId: string, draggedId: string) => void;
}

/**
 * @component BasicWidget
 * @description Subclasses Widget to provide a panel container with a 2-control title header bar and close control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {BasicWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Basic widget panel element.
 */
export const BasicWidget: React.FC<BasicWidgetProps> = (props) => {
  const {
    name = "basic-widget",
    displayName = "Basic",
    icon,
    overlappable = false,
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
  const iconSize = prefsUiIconSize.value ?? 24;
  const headerIconSize = Math.round(iconSize * 0.8);

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
    }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", panelId);
      e.dataTransfer.setData(
        "application/x-cartouche-widget",
        JSON.stringify({
          widgetId: name,
          panelId,
          overlappable: !!overlappable,
        })
      );
    }
  };

  const handleHeaderDragEnd = () => {
    LocalSelectionTransfer.getInstance().clearData(PanelTransfer.prototype);
  };

  const [activeDropZone, setActiveDropZone] = useState<WidgetDropZone>("none");

  const handleWidgetDragOver = (e: React.DragEvent) => {
    const isWidgetDrag =
      e.dataTransfer.types.includes("application/x-cartouche-widget") ||
      e.dataTransfer.types.includes("application/x-cartouche-tab-extract") ||
      e.dataTransfer.types.includes("text/plain");

    if (!isWidgetDrag) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let draggedOverlappable = false;
    let draggedWidgetId: string | undefined;

    try {
      const raw = e.dataTransfer.getData("application/x-cartouche-widget");
      if (raw) {
        const parsed = JSON.parse(raw);
        draggedOverlappable = !!parsed.overlappable;
        draggedWidgetId = parsed.widgetId;
      }
    } catch {
      // Data may be masked during dragover
    }

    const zone = resolveWidgetDropZone({
      rect,
      clientX: e.clientX,
      clientY: e.clientY,
      targetOverlappable: !!overlappable,
      draggedOverlappable: draggedOverlappable || !!overlappable,
      isTargetOverlapContainer: false,
      draggedWidgetId,
      targetWidgetId: name,
    });

    if (zone !== "none") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setActiveDropZone(zone);
    } else if (activeDropZone !== "none") {
      setActiveDropZone("none");
    }
  };

  const handleWidgetDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setActiveDropZone("none");
    }
  };

  const handleWidgetDrop = async (e: React.DragEvent) => {
    const zone = activeDropZone;
    setActiveDropZone("none");

    let draggedId = "";

    try {
      const widgetData = e.dataTransfer.getData("application/x-cartouche-widget");
      if (widgetData) {
        const parsed = JSON.parse(widgetData);
        draggedId = parsed.widgetId || parsed.panelId;
      }
    } catch {
      // fallback
    }

    if (!draggedId) {
      draggedId = e.dataTransfer.getData("text/plain");
    }

    if (!draggedId || draggedId === name) return;

    if (zone === "center-overlap") {
      e.preventDefault();
      e.stopPropagation();
      if (props.onOverlapBundle) {
        props.onOverlapBundle(name, draggedId);
      } else {
        const match = getWidgetDockItem(name);
        const dockId = match ? match.dock : "left";
        await createOverlapContainer(dockId, name, draggedId);
      }
    }
  };

  const canClose = !!(onClose || effectivePanelApi);

  // Dynamic minimum width floor calculation: border + padding + button controls + header icon + title margin + buffer + 4rem
  const borderPx = 2 * parsePxValue(border, 1);
  const paddingPx = 2 * parsePxValue(padding, 4);

  const buttonCount = canClose ? 1 : 0;
  const buttonPaddingPx = 4; // 2px left + 2px right per control button
  const buttonGapPx = 0;
  const headerPaddingPx = 16; // 8px left + 8px right inner header padding
  const titleMarginPx = 8; // 8px right margin on the title span
  const safetyBufferPx = 16; // Extra buffer to prevent cutoff from panel borders or scrollbars
  const headerIcon50Px = Math.round(iconSize * 0.5);
  const headerIconSpacingPx = icon ? headerIcon50Px + 6 : 0; // Icon width + 6px right margin
  const buttonControlsWidth =
    buttonCount * (headerIconSize + buttonPaddingPx)
    + buttonGapPx
    + headerPaddingPx
    + headerIconSpacingPx
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
      maxWidth={maxWidth}
      minHeight={minHeight}
      maxHeight={maxHeight}
      className={`basic-widget ${name} ${overlappable ? "is-overlappable" : ""} ${className}`}
      onClose={canClose ? handleClose : undefined}
      onUndock={onUndock}
      containerApi={effectiveContainerApi}
      panelApi={effectivePanelApi}
      onDragOver={handleWidgetDragOver}
      onDragLeave={handleWidgetDragLeave}
      onDrop={handleWidgetDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
        ...style,
      }}>
      {/* Drop Target Visual Cues */}
      {activeDropZone === "center-overlap" && (
        <div
          className='widget-drop-overlay is-center-overlap'
          data-testid='drop-overlay-center'
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            border: "2px dashed #2563eb",
            zIndex: 50,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <div
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 600,
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            }}>
            Group as Tabs
          </div>
        </div>
      )}
      {activeDropZone === "edge-top" && (
        <div
          className='widget-drop-indicator is-edge-top'
          data-testid='drop-indicator-top'
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: "#2563eb",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      {activeDropZone === "edge-bottom" && (
        <div
          className='widget-drop-indicator is-edge-bottom'
          data-testid='drop-indicator-bottom'
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: "#2563eb",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      {activeDropZone === "edge-left" && (
        <div
          className='widget-drop-indicator is-edge-left'
          data-testid='drop-indicator-left'
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "3px",
            backgroundColor: "#2563eb",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      {activeDropZone === "edge-right" && (
        <div
          className='widget-drop-indicator is-edge-right'
          data-testid='drop-indicator-right'
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "3px",
            backgroundColor: "#2563eb",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Header Row: Label + Close Button */}
      <div
        className='basic-widget-header'
        data-overlappable={overlappable}
        draggable={!!effectivePanelApi}
        onDragStart={handleHeaderDragStart}
        onDragEnd={handleHeaderDragEnd}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#faf8fc",
          padding: "4px 8px",
          borderBottom: "1px solid #e2e8f0",
          minHeight:
            "max(1.625em, calc(var(--cartouche-ui-icon-size, 24px) * 0.8 + 8px))",
          userSelect: "none",
          cursor: effectivePanelApi ? "grab" : "default",
        }}>
        <div
          className='widget-header-title-box'
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
            marginRight: "8px",
            overflow: "hidden",
          }}>
          {icon && (
            <span
              className='basic-widget-icon'
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginRight: "6px",
              }}>
              {typeof icon === "string" ? (
                <Icon
                  path={icon}
                  size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
                />
              ) : (
                icon
              )}
            </span>
          )}
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
            }}>
            {displayName}
          </span>
        </div>

        <div
          className='basic-widget-controls'
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}>
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
              <Icon
                path={mdiClose}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
              />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content Body */}
      <div
        className='basic-widget-body'
        style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {children}
      </div>
    </Widget>
  );
};
