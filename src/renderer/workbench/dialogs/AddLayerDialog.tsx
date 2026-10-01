/**
 * @file AddLayerDialog.tsx
 * @module renderer/workbench/dialogs/AddLayerDialog
 * @description Add Layer modal dialog component for selecting, browsing, and attaching Vector, Raster, or Database spatial data sources to the active project state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link isAddLayerOpenSignal}
 * @see {@link openAddLayerDialog}
 * @see {@link closeAddLayerDialog}
 */

import React, { useEffect, useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiClose,
  mdiVectorPolygon,
  mdiImageOutline,
  mdiDatabaseOutline,
  mdiFolderOpenOutline,
  mdiPlus,
} from "@mdi/js";
import {
  isAddLayerOpenSignal,
  closeAddLayerDialog,
  addConsoleLog,
} from "@renderer/state/gisSignals";

/**
 * @typedef {'vector' | 'raster' | 'database'} SourceType
 * @description Identifier for spatial data layer source formats.
 */
type SourceType = "vector" | "raster" | "database";

/**
 * @typedef {Object} SourceTab
 * @property {SourceType} id - Unique identifier for the source tab.
 * @property {string} label - Display label text rendered on tab.
 * @property {string} icon - MDI SVG icon path string.
 */
interface SourceTab {
  id: SourceType;
  label: string;
  icon: string;
}

/**
 * @description Tab descriptors for vector, raster, and database spatial data input types.
 */
const sourceTabs: SourceTab[] = [
  { id: "vector", label: "Vector Layer", icon: mdiVectorPolygon },
  { id: "raster", label: "Raster Layer", icon: mdiImageOutline },
  { id: "database", label: "Database / Service", icon: mdiDatabaseOutline },
];

/**
 * @component AddLayerDialog
 * @description Renders a modal dialog allowing users to browse and attach Vector, Raster, or Database spatial layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Add Layer dialog modal element or null if closed.
 */
export const AddLayerDialog: React.FC = () => {
  useSignals();
  const isOpen = isAddLayerOpenSignal.value;
  const [activeTab, setActiveTab] = useState<SourceType>("vector");
  const [filePath, setFilePath] = useState<string>("");
  const [layerName, setLayerName] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAddLayerDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * @description Handles browsing local filesystem for spatial dataset files.
   * @returns {void}
   */
  const handleBrowse = (): void => {
    addConsoleLog("info", `Browsing for ${activeTab} data source...`, "Layers");
  };

  /**
   * @description Confirms and attaches the selected layer dataset to the project state.
   * @returns {void}
   */
  const handleAdd = (): void => {
    const name =
      layerName.trim() ||
      (filePath ? filePath.split("/").pop() || "New Layer" : `New ${activeTab.toUpperCase()} Layer`);
    addConsoleLog("info", `Adding ${activeTab} layer: "${name}"`, "Layers");
    closeAddLayerDialog();
  };

  return (
    <div
      className='cartouche-modal-overlay'
      onClick={() => closeAddLayerDialog()}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <div
        className='cartouche-modal-container'
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "6px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
          width: "560px",
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
          fontSize: "12pt",
          color: "#000000",
        }}>
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#1b446c",
            color: "#ffffff",
            padding: "10px 16px",
            fontWeight: 600,
            fontSize: "1rem",
            userSelect: "none",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon path={mdiPlus} size='18px' />
            <span>Add Layer</span>
          </div>
          <button
            type='button'
            onClick={() => closeAddLayerDialog()}
            title='Close (Esc)'
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              borderRadius: "3px",
              opacity: 0.85,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}>
            <Icon path={mdiClose} size='18px' />
          </button>
        </div>

        {/* Source Type Selector Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #cbd5e1",
            backgroundColor: "#f8fafc",
          }}>
          {sourceTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#1b446c" : "#64748b",
                  borderBottom: isActive ? "2px solid #1b446c" : "2px solid transparent",
                  backgroundColor: isActive ? "#ffffff" : "transparent",
                  userSelect: "none",
                  transition: "color 0.15s ease",
                }}>
                <Icon path={tab.icon} size='16px' />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "#334155",
                marginBottom: "6px",
              }}>
              Source Path / File Dataset
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type='text'
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={`Select ${activeTab} data file (GeoJSON, GeoPackage, Shapefile, GeoTIFF...)`}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
              <button
                type='button'
                onClick={handleBrowse}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "#334155",
                }}>
                <Icon path={mdiFolderOpenOutline} size='16px' />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "#334155",
                marginBottom: "6px",
              }}>
              Layer Display Name (Optional)
            </label>
            <input
              type='text'
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              placeholder='Defaults to file dataset name'
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "0.875rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Action Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "12px 20px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #cbd5e1",
          }}>
          <button
            type='button'
            onClick={() => closeAddLayerDialog()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            Cancel
          </button>
          <button
            type='button'
            onClick={handleAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              backgroundColor: "#1b446c",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#ffffff",
            }}>
            <Icon path={mdiPlus} size='16px' />
            <span>Add Layer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
