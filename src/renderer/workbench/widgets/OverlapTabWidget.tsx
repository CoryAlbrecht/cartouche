/**
 * @file OverlapTabWidget.tsx
 * @module renderer/workbench/widgets/OverlapTabWidget
 * @description Tabbed container subclass of BasicWidget hosting multiple tool widgets, managing tab selection, drag-and-drop tab extraction, and single-child auto-dissolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see docs/adr/0025-flex-proportional-docking-and-overlap-tab-widgets.md (ADR 0025)
 */

import React, { useState, useEffect, useMemo } from "react";
import { BasicWidget, type BasicWidgetProps } from "./BasicWidget";
import { logging } from "../../../shared/logging";

/**
 * Known human-friendly titles for Cartouche built-in dockable panels.
 * @type {Record<string, string>}
 */
const DEFAULT_TAB_TITLES: Record<string, string> = {
  "layer-tree": "Layers",
  "attribute-table": "Attributes",
  "console": "Console",
};

/**
 * @typedef {Object} OverlapTabItem
 * @description Item specification for a child tab within OverlapTabWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @property {string} id - Unique identifier of the child widget.
 * @property {string} title - Label rendered on the tab strip button.
 * @property {(panelProps: any) => React.ReactNode} render - Render callback yielding the child widget.
 * @property {boolean} [isOverlapContainer] - Flag indicating if this item is an overlap container.
 * @property {() => void} [onClose] - Optional child close callback.
 */
export interface OverlapTabItem {
  id: string;
  title: string;
  render: (panelProps: any) => React.ReactNode;
  isOverlapContainer?: boolean;
  onClose?: () => void;
}

/**
 * @typedef {Object} OverlapTabWidgetProps
 * @extends Partial<BasicWidgetProps>
 * @description Properties passed to OverlapTabWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @property {OverlapTabItem[]} [tabs] - Explicit list of child tab definitions.
 * @property {string} [activeTabId] - Initial or controlled active tab identifier.
 * @property {(tabId: string) => void} [onTabChange] - Callback invoked when active tab changes.
 * @property {(tabId: string) => void} [onTabExtract] - Callback invoked when a tab is dragged out to extract.
 * @property {(tabId: string) => void} [onTabClose] - Callback invoked when an individual child tab is closed.
 * @property {() => void} [onGroupClose] - Callback invoked when outer master close button is clicked.
 * @property {(remainingChildId: string) => void} [onDissolve] - Callback invoked when children drop to 1 and container dissolves.
 */
export interface OverlapTabWidgetProps extends Partial<BasicWidgetProps> {
  tabs?: OverlapTabItem[];
  activeTabId?: string;
  resolveComponent?: (widgetId: string) => React.ComponentType<any> | undefined;
  onTabChange?: (tabId: string) => void;
  onTabExtract?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onGroupClose?: () => void;
  onDissolve?: (remainingChildId: string) => void;
}

/**
 * @component OverlapTabWidget
 * @description Subclass of BasicWidget providing a tabbed container for grouping overlappable tool widgets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {OverlapTabWidgetProps} props - Component properties.
 * @returns {React.ReactElement | null} Rendered tabbed container element or null when empty.
 */
export const OverlapTabWidget: React.FC<OverlapTabWidgetProps> = (props) => {
  const {
    name = "overlap-tab-widget",
    tabs: explicitTabs,
    activeTabId: controlledActiveTabId,
    onTabChange,
    onTabExtract,
    onTabClose,
    onGroupClose,
    onDissolve,
    onClose,
    ...restBasicWidgetProps
  } = props;

  // Resolve initial tabs from explicit props or Dockview params.tabChildren
  const initialTabs = useMemo<OverlapTabItem[]>(() => {
    if (explicitTabs && explicitTabs.length > 0) {
      // Prohibit recursive nesting: filter out any nested OverlapTabWidget items
      return explicitTabs.filter((t) => {
        if (
          t.id.startsWith("overlap-")
          || t.isOverlapContainer
          || t.id === "overlap-tab-widget"
        ) {
          logging.warn(
            `Prohibited recursive nesting: rejected child "${t.id}"`,
            { scope: "OverlapTabWidget" }
          );
          return false;
        }
        return true;
      });
    }

    const paramChildren: string[] = (props as any).params?.tabChildren || [];
    return paramChildren
      .filter(
        (id) => !id.startsWith("overlap-") && id !== "overlap-tab-widget"
      )
      .map((id) => ({
        id,
        title: DEFAULT_TAB_TITLES[id] || id,
        render: (renderProps) => {
          const resolve =
            props.resolveComponent || (props as any).params?.resolveComponent;
          const Component = resolve ? resolve(id) : undefined;
          if (Component) {
            return <Component {...(props as any)} {...renderProps} />;
          }
          return (
            <div className='unknown-widget-tab' style={{ padding: "16px" }}>
              Widget {id}
            </div>
          );
        },
      }));
  }, [explicitTabs, (props as any).params?.tabChildren]);

  const [tabs, setTabs] = useState<OverlapTabItem[]>(initialTabs);
  useEffect(() => {
    setTabs(initialTabs);
  }, [initialTabs]);

  const [activeTabId, setActiveTabId] = useState<string>(
    controlledActiveTabId || (initialTabs[0]?.id ?? "")
  );

  useEffect(() => {
    if (controlledActiveTabId) {
      setActiveTabId(controlledActiveTabId);
    } else if (!tabs.some((t) => t.id === activeTabId) && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
    }
  }, [controlledActiveTabId, tabs, activeTabId]);

  // Single-child auto-dissolution lifecycle
  useEffect(() => {
    if (tabs.length === 1) {
      const solitaryChildId = tabs[0].id;
      if (onDissolve) {
        onDissolve(solitaryChildId);
      }
    }
  }, [tabs, onDissolve]);

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const handleCloseTab = (tabId: string) => {
    if (onTabClose) {
      onTabClose(tabId);
    }
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId && nextTabs.length > 0) {
      const nextActive = nextTabs[0].id;
      setActiveTabId(nextActive);
      if (onTabChange) {
        onTabChange(nextActive);
      }
    }
  };

  const handleMasterClose = () => {
    if (onGroupClose) {
      onGroupClose();
    }
    if (onClose) {
      onClose();
    } else if (props.panelApi || (props as any).api) {
      (props.panelApi || (props as any).api).close();
    }
    setTabs([]);
  };

  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabId);
      e.dataTransfer.setData(
        "application/x-cartouche-tab-extract",
        JSON.stringify({
          containerId: name,
          tabId,
        })
      );
    }
    if (onTabExtract) {
      onTabExtract(tabId);
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  // Solitary child auto-dissolution: unwraps and renders single child directly
  if (tabs.length === 1) {
    return (
      <div className='overlap-tab-dissolved' style={{ height: "100%", width: "100%" }}>
        {tabs[0].render({
          onClose: () => handleCloseTab(tabs[0].id),
          panelApi: props.panelApi || (props as any).api,
          containerApi: props.containerApi,
        })}
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <BasicWidget
      name={name}
      displayName='Tab Group'
      overlappable={false}
      onClose={handleMasterClose}
      className={`overlap-tab-widget ${restBasicWidgetProps.className || ""}`}
      {...restBasicWidgetProps}>
      <div
        className='overlap-tab-container'
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
          overflow: "hidden",
        }}>
        {/* Tab Strip */}
        <div
          className='overlap-tab-strip'
          role='tablist'
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#e2e8f0",
            borderBottom: "1px solid #cbd5e1",
            overflowX: "auto",
            flexShrink: 0,
            minHeight: "28px",
            padding: "2px 4px 0 4px",
            gap: "2px",
            userSelect: "none",
          }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                role='tab'
                aria-selected={isActive}
                tabIndex={0}
                className={`overlap-tab-item ${isActive ? "is-active" : ""}`}
                draggable={true}
                onDragStart={(e) => handleTabDragStart(e, tab.id)}
                onClick={() => handleSelectTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleSelectTab(tab.id);
                  }
                }}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0f172a" : "#475569",
                  backgroundColor: isActive ? "#ffffff" : "#f1f5f9",
                  borderTopLeftRadius: "4px",
                  borderTopRightRadius: "4px",
                  border: "1px solid #cbd5e1",
                  borderBottom: isActive ? "1px solid #ffffff" : "1px solid #cbd5e1",
                  marginBottom: isActive ? "-1px" : "0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}>
                <span className='overlap-tab-title'>{tab.title}</span>
              </div>
            );
          })}
        </div>

        {/* Tab Pane Body */}
        <div
          className='overlap-tab-pane'
          role='tabpanel'
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            backgroundColor: "#ffffff",
          }}>
          {activeTab &&
            activeTab.render({
              onClose: () => handleCloseTab(activeTab.id),
              panelApi: props.panelApi || (props as any).api,
              containerApi: props.containerApi,
            })}
        </div>
      </div>
    </BasicWidget>
  );
};
