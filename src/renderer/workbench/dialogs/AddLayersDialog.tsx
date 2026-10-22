/**
 * @file AddLayersDialog.tsx
 * @module renderer/workbench/dialogs/AddLayersDialog
 * @description Non-modal, resizable Add Layers dialog component for selecting, browsing, and attaching Vector, Raster, or Database spatial data sources to the project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link isAddLayersOpenSignal}
 * @see {@link openAddLayersDialog}
 * @see {@link closeAddLayersDialog}
 */

import React from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";

import {
  mdiVectorPolygon,
  mdiImageOutline,
  mdiDatabaseOutline,
  mdiFolderOpenOutline,
  mdiClose,
} from "@mdi/js";
import {
  isAddLayersOpenSignal,
  closeAddLayersDialog,
  addConsoleLog,
} from "@renderer/state/gisSignals";
import { Dialog } from "./Dialog";
import { ModalDialog } from "./ModalDialog";
import type { AddLayerParams } from "@shared/types";

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
 * @component AddLayersDialog
 * @description Renders a non-modal, resizable dialog window allowing users to browse and attach Vector, Raster, or Database spatial layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Add Layers dialog window element or null if closed.
 */
export const AddLayersDialog: React.FC = () => {
  useSignals();
  const isOpen = isAddLayersOpenSignal.value;
  const activeTabSignal = useSignal<SourceType>("vector");
  const filePathSignal = useSignal<string>("");
  const vectorFilesSignal = useSignal<string[]>([]);
  const vectorInputTextSignal = useSignal<string>("");
  const invalidFilesSignal = useSignal<string[]>([]);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Reset input fields whenever the dialog is opened to prevent residual chips
  React.useEffect(() => {
    if (isOpen) {
      vectorFilesSignal.value = [];
      vectorInputTextSignal.value = "";
      filePathSignal.value = "";
      invalidFilesSignal.value = [];
    }
  }, [isOpen]);

  const activeTab = activeTabSignal.value;
  const filePath = filePathSignal.value;
  const vectorFiles = vectorFilesSignal.value;
  const vectorInputText = vectorInputTextSignal.value;

  if (!isOpen) return null;

  /**
   * @description Parses and appends any pending typed text in the vector path input box as file path chips.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-02
   * @updated 2026-10-02
   * @since 0.1.0-dev
   * @returns {void}
   */
  const addTypedPaths = (): void => {
    const text = vectorInputTextSignal.value.trim();
    if (!text) return;
    const parsedPaths = text
      .split(/[,;\n]+/)
      .map((p) => p.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    const current = vectorFilesSignal.value;
    const newPaths = parsedPaths.filter((p) => !current.includes(p));
    if (newPaths.length > 0) {
      vectorFilesSignal.value = [...current, ...newPaths];
    }
    vectorInputTextSignal.value = "";
  };

  /**
   * @description Handles browsing local filesystem for spatial dataset files using native system multi-select dialog.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-01
   * @updated 2026-10-12
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const handleBrowse = async (): Promise<void> => {
    if (activeTab === "vector") {
      addConsoleLog("info", "Browsing for Vector data files...", "Layers");
      if (window.electronAPI?.openFiles) {
        try {
          const selected = await window.electronAPI.openFiles({
            title: "Select Vector Data Files",
            category: "vector",
            multiSelections: true,
          });
          if (selected && selected.length > 0) {
            const current = vectorFilesSignal.value;
            const merged = Array.from(new Set([...current, ...selected]));
            vectorFilesSignal.value = merged;
            addConsoleLog(
              "info",
              `Selected ${selected.length} vector file(s)`,
              "Layers"
            );
          }
        } catch (err: any) {
          addConsoleLog("error", `Failed to browse vector files: ${err?.message || err}`, "Layers");
        }
      }
    } else {
      addConsoleLog(
        "info",
        `Browsing for ${activeTab} data source...`,
        "Layers"
      );
      if (window.electronAPI?.openFiles) {
        try {
          const selected = await window.electronAPI.openFiles({
            title: `Select ${activeTab.toUpperCase()} Data File`,
            category: activeTab === "raster" ? "raster" : undefined,
            multiSelections: false,
          });
          if (selected && selected.length > 0) {
            filePathSignal.value = selected[0];
          }
        } catch (err: any) {
          addConsoleLog("error", `Failed to browse ${activeTab} file: ${err?.message || err}`, "Layers");
        }
      }
    }
  };

  /**
   * @description Confirms and attaches the selected layer dataset to the project state.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-01
   * @updated 2026-10-15
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const handleAdd = async (): Promise<void> => {
    addTypedPaths();
    if (activeTab === "vector") {
      const files = vectorFilesSignal.value;
      if (files.length === 0 && !filePath.trim()) {
        addConsoleLog("warn", "No vector files selected to add.", "Layers");
        return;
      }
      
      const validFiles: string[] = [];
      const invalidFiles: string[] = [];
      
      for (const file of files) {
        const exists = await window.electronAPI?.pathExists?.(file);
        if (exists) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file);
        }
      }
      
      if (invalidFiles.length > 0) {
        invalidFilesSignal.value = invalidFiles;
      }
      
      if (validFiles.length > 0) {
        const layersToAdd: AddLayerParams[] = validFiles.map(file => ({
          sourceType: "vector",
          filePath: file
        }));
        await window.electronAPI?.addLayers?.(layersToAdd);
        addConsoleLog("info", `Added ${validFiles.length} vector layer(s)`, "Layers");
      }
      
      if (invalidFiles.length === 0) {
        vectorFilesSignal.value = [];
        vectorInputTextSignal.value = "";
        filePathSignal.value = "";
        invalidFilesSignal.value = [];
        closeAddLayersDialog();
      }
    } else {
      const name =
        filePath ?
          filePath.split(/[/\\]/).pop() || "New Layer"
        : `New ${activeTab.toUpperCase()} Layer`;
      addConsoleLog("info", `Adding ${activeTab} layer: "${name}"`, "Layers");
      vectorFilesSignal.value = [];
      vectorInputTextSignal.value = "";
      filePathSignal.value = "";
      invalidFilesSignal.value = [];
      closeAddLayersDialog();
    }
  };

  return (
    <Dialog
      name='addLayersWindow'
      title='Add Layers'
      icon={<Icon name="file:layers-plus-outline.svg" size="calc(var(--cartouche-ui-icon-size, 24px) * 0.75)" color="#ffffff" />}
      isOpen={isOpen}
      onClose={closeAddLayersDialog}
      defaultWidth={620}
      defaultHeight={460}
      footer={
        <>
          <button
            type='button'
            onClick={() => closeAddLayersDialog()}
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
            <Icon name="file:layers-plus-outline.svg" size="calc(var(--cartouche-ui-icon-size, 24px) * 0.67)" color="#ffffff" />
            <span>Add Layers</span>
          </button>
        </>
      }>
      <div
        className='add-layer-dialog-container'
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          height: "100%",
          backgroundColor: "#ffffff",
        }}>
        {/* Source Type Selector Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #cbd5e1",
            backgroundColor: "#f8fafc",
            flexShrink: 0,
          }}>
          {sourceTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  activeTabSignal.value = tab.id;
                }}
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
                  borderBottom:
                    isActive ? "2px solid #1b446c" : "2px solid transparent",
                  backgroundColor: isActive ? "#ffffff" : "transparent",
                  userSelect: "none",
                  transition: "color 0.15s ease",
                }}>
                <Icon path={tab.icon} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)' />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content Body Form */}
        <div
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            overflow: "auto",
          }}>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "#334155",
                marginBottom: "6px",
              }}>
              Vector Layer Files
            </label>
            <div
              style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              {activeTab === "vector" ?
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    minHeight: "38px",
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box",
                    cursor: "text",
                  }}
                  onClick={() => inputRef.current?.focus()}>
                  {vectorFiles.map((pathItem) => {
                    const baseName = pathItem.split(/[/\\]/).pop() || pathItem;
                    return (
                      <span
                        key={pathItem}
                        title={pathItem}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px 2px 10px",
                          backgroundColor: "#e2e8f0",
                          color: "#1e293b",
                          borderRadius: "12px",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          maxWidth: "220px",
                          userSelect: "none",
                        }}>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                          {baseName}
                        </span>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            vectorFilesSignal.value =
                              vectorFilesSignal.value.filter(
                                (p) => p !== pathItem
                              );
                          }}
                          title='Remove file'
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "none",
                            border: "none",
                            padding: 0,
                            margin: 0,
                            cursor: "pointer",
                            color: "#64748b",
                            borderRadius: "50%",
                            width: "calc(var(--cartouche-ui-icon-size, 24px) * 0.5 + 2px)",
                            height: "calc(var(--cartouche-ui-icon-size, 24px) * 0.5 + 2px)",
                            minWidth: "calc(var(--cartouche-ui-icon-size, 24px) * 0.5 + 2px)",
                            minHeight: "calc(var(--cartouche-ui-icon-size, 24px) * 0.5 + 2px)",
                            lineHeight: 1,
                          }}>
                          <Icon path={mdiClose} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)' />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    ref={inputRef}
                    type='text'
                    value={vectorInputText}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(",") || val.includes(";")) {
                        vectorInputTextSignal.value = val;
                        addTypedPaths();
                      } else {
                        vectorInputTextSignal.value = val;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTypedPaths();
                      } else if (
                        e.key === "Backspace"
                        && vectorInputTextSignal.value === ""
                        && vectorFilesSignal.value.length > 0
                      ) {
                        vectorFilesSignal.value = vectorFilesSignal.value.slice(
                          0,
                          -1
                        );
                      }
                    }}
                    onBlur={addTypedPaths}
                    placeholder={
                      vectorFiles.length === 0 ?
                        "Select or paste vector file path(s)..."
                      : ""
                    }
                    style={{
                      flex: 1,
                      minWidth: "120px",
                      border: "none",
                      outline: "none",
                      fontSize: "0.875rem",
                      backgroundColor: "transparent",
                      padding: "2px 4px",
                    }}
                  />
                </div>
              : <input
                  type='text'
                  value={filePath}
                  onChange={(e) => {
                    filePathSignal.value = e.target.value;
                  }}
                  placeholder={`Select ${activeTab} data file (GeoTIFF, GeoPackage...)`}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
              }
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
                  height: "38px",
                }}>
                <Icon path={mdiFolderOpenOutline} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)' />
                <span>Browse...</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ModalDialog
        title="Missing Files"
        isOpen={invalidFilesSignal.value.length > 0}
        onClose={() => {
          invalidFilesSignal.value = [];
          closeAddLayersDialog();
        }}
        buttons={[
          {
            label: "OK",
            primary: true,
            onClick: () => {
              invalidFilesSignal.value = [];
              closeAddLayersDialog();
            }
          }
        ]}
      >
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {`The following files could not be found and will be skipped:\n\n${invalidFilesSignal.value.join("\n")}`}
        </p>
      </ModalDialog>
    </Dialog>
  );
};
