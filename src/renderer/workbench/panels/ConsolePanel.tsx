/**
 * @file ConsolePanel.tsx
 * @module renderer/workbench/panels/ConsolePanel
 * @description Dockview panel component displaying system event logs, execution warnings, and error messages.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "../widgets/BasicWidget";
import { consoleLogsSignal, addConsoleLog } from "@renderer/state/gisSignals";
import type { IDockviewPanelProps } from "dockview-react";

/**
 * @component ConsolePanel
 * @description Renders output logs list panel inside Dockview layout.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @param {Partial<IDockviewPanelProps>} props - Dockview panel properties.
 * @returns {React.ReactElement} ConsolePanel element.
 */
export const ConsolePanel: React.FC<Partial<IDockviewPanelProps>> = (props) => {
  useSignals();
  const logs = consoleLogsSignal.value;

  const handleClear = () => {
    consoleLogsSignal.value = [];
  };

  const handleTestLog = () => {
    addConsoleLog(
      "info",
      `Spatial index recomputed for current extent at ${new Date().toLocaleTimeString()}`,
      "SpatialIndex"
    );
  };

  return (
    <BasicWidget
      name='console-widget'
      displayName={`Console (${logs.length})`}
      minHeight={120}
      {...props}>
      <div
        className='console-panel'
        style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          className='panel-toolbar'
          style={{
            padding: "4px 8px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <span
            className='panel-subtitle'
            style={{ fontSize: "0.8333rem", color: "#475569" }}>
            Output & Execution Logs ({logs.length})
          </span>
          <div
            className='panel-toolbar-actions'
            style={{ display: "flex", gap: "4px" }}>
            <button
              className='small-action-btn'
              onClick={handleTestLog}
              style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
              + Run Task
            </button>
            <button
              className='small-action-btn'
              onClick={handleClear}
              style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
              Clear
            </button>
          </div>
        </div>

        <div
          className='console-log-list'
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px",
            fontFamily: "monospace",
            fontSize: "0.8333rem",
          }}>
          {logs.length === 0 ?
            <div className='console-empty' style={{ color: "#94a3b8" }}>
              No console output recorded.
            </div>
          : logs.map((log) => (
              <div
                key={log.id}
                className={`console-entry level-${log.level}`}
                style={{ margin: "2px 0", display: "flex", gap: "8px" }}>
                <span className='log-time' style={{ color: "#64748b" }}>
                  {log.timestamp}
                </span>
                {log.source && (
                  <span
                    className='log-source'
                    style={{ color: "#1b446c", fontWeight: 600 }}>
                    [{log.source}]
                  </span>
                )}
                <span className={`log-badge badge-${log.level}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className='log-message' style={{ color: "#0f172a" }}>
                  {log.message}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </BasicWidget>
  );
};

ConsolePanel.displayName = "ConsolePanel";
