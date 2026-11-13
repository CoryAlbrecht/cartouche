/**
 * @file TabbedDialogShell.tsx
 * @module renderer/workbench/dialogs/TabbedDialogShell
 * @description Reusable sidebar-tabbed dialog body shared by LayerPropertiesDialog and ProjectPropertiesDialog: a left column of tab buttons (icon plus label) and a scrollable content area for the active tab's pane. The shell is presentational only; the caller owns the active tab id and the pane content.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link ProjectPropertiesDialog}
 */

import React from "react";
import Icon from "@renderer/components/common/Icon";

/**
 * @typedef {Object} TabbedDialogTabDef
 * @description One sidebar tab of a {@link TabbedDialogShell}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @template TId - String literal union of tab identifiers.
 * @property {TId} id - Tab identifier reported through `onTabChange`.
 * @property {string} label - Already-translated label text.
 * @property {string} icon - MDI SVG path (or `file:` custom icon reference) rendered beside the label.
 */
export interface TabbedDialogTabDef<TId extends string = string> {
  id: TId;
  label: string;
  icon: string;
}

/**
 * @typedef {Object} TabbedDialogShellProps
 * @description Properties of {@link TabbedDialogShell}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @template TId - String literal union of tab identifiers.
 * @property {ReadonlyArray<TabbedDialogTabDef<TId>>} tabs - Sidebar tabs in display order.
 * @property {TId} activeTabId - Identifier of the tab currently shown.
 * @property {(id: TId) => void} onTabChange - Called with the id of a clicked tab.
 * @property {string} [classPrefix='tabbed-dialog'] - Prefix for the generated CSS class names (`<prefix>-container`, `<prefix>-sidebar`, `<prefix>-tab-btn`, `<prefix>-content`).
 * @property {React.ReactNode} children - Content rendered in the right-hand pane area for the active tab.
 */
export interface TabbedDialogShellProps<TId extends string = string> {
  tabs: ReadonlyArray<TabbedDialogTabDef<TId>>;
  activeTabId: TId;
  onTabChange: (id: TId) => void;
  classPrefix?: string;
  children?: React.ReactNode;
}

/**
 * @component TabbedDialogShell
 * @description Renders the sidebar-tab layout used by property dialogs: a fixed-width left column of tab buttons and a flexible, vertically scrolling content column. Clicking a tab reports its id; the caller decides which pane to render as children.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @template TId - String literal union of tab identifiers.
 * @param {TabbedDialogShellProps<TId>} props - Component properties.
 * @returns {JSX.Element} The two-column tabbed body.
 */
export function TabbedDialogShell<TId extends string = string>(
  props: TabbedDialogShellProps<TId>
): React.ReactElement {
  const { tabs, activeTabId, onTabChange, children } = props;
  const prefix = props.classPrefix ?? "tabbed-dialog";

  return (
    <div
      className={`${prefix}-container`}
      style={{
        display: "flex",
        flex: 1,
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        color: "#000000",
      }}>
      {/* Left Sidebar Tabs */}
      <div
        className={`${prefix}-sidebar`}
        style={{
          width: "13rem",
          borderRight: "1px solid #cbd5e1",
          backgroundColor: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "8px",
          flexShrink: 0,
        }}>
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              type='button'
              data-tab-id={tab.id}
              className={`${prefix}-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.75rem",
                border: "none",
                borderRadius: "4px",
                backgroundColor: isActive ? "#e2e8f0" : "transparent",
                color: isActive ? "#0f172a" : "#475569",
                fontWeight: isActive ? 600 : 400,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}>
              <Icon path={tab.icon} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Tab Content */}
      <div
        className={`${prefix}-content`}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflowY: "auto",
          padding: "1rem 1.25rem",
          gap: "1rem",
          minHeight: 0,
        }}>
        {children}
      </div>
    </div>
  );
}

export default TabbedDialogShell;
