/**
 * @file AddLayersDialog.tsx
 * @module renderer/workbench/dialogs/AddLayersDialog
 * @description Non-modal, resizable Add Layers dialog component for selecting, browsing, and attaching Vector, Raster, or Database spatial data sources to the project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-11-19
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
} from "@renderer/state/gisSignals";
import { logging } from "@shared/logging";
import { Dialog } from "./Dialog";
import { ModalDialog } from "./ModalDialog";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { addLayersOneByOne, type LayerLoadFailure } from "./addLayersBatch";

/**
 * @typedef {Object} PendingLoadWarning
 * @description The load warning currently shown, and the callback that lets the batch continue once the user acknowledges it.
 * @property {LayerLoadFailure} failure - The file that failed and why.
 * @property {() => void} acknowledge - Resolves the batch's wait for this warning.
 */
interface PendingLoadWarning {
  failure: LayerLoadFailure;
  acknowledge: () => void;
}

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
 * @updated 2026-11-19
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
  const loadWarningSignal = useSignal<PendingLoadWarning | null>(null);
  const isAddingSignal = useSignal<boolean>(false);
  const { t } = useTranslation();

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  /**
   * @description Clears the vector file chips, typed path text and single path input.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-19
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @returns {void}
   */
  const resetInputs = (): void => {
    vectorFilesSignal.value = [];
    vectorInputTextSignal.value = "";
    filePathSignal.value = "";
  };

  /**
   * @description Dismisses the current load warning and lets the batch continue with the next file.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-19
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @returns {void}
   */
  const acknowledgeLoadWarning = (): void => {
    const pending = loadWarningSignal.value;
    loadWarningSignal.value = null;
    pending?.acknowledge();
  };

  // Reset input fields whenever the dialog is opened to prevent residual chips
  React.useEffect(() => {
    if (isOpen) {
      resetInputs();
    } else {
      // Never leave a batch waiting on a warning the closed dialog can no longer show.
      acknowledgeLoadWarning();
    }
  }, [isOpen]);

  const activeTab = activeTabSignal.value;
  const filePath = filePathSignal.value;
  const vectorFiles = vectorFilesSignal.value;
  const vectorInputText = vectorInputTextSignal.value;

  /**
   * @description Clears pending vector files, file path input, and draft state before closing Add Layers dialog.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleCancel = React.useCallback(() => {
    resetInputs();
    closeAddLayersDialog();
  }, []);

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
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const handleBrowse = async (): Promise<void> => {
    if (activeTab === "vector") {
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
          }
        } catch (err: any) {
          logging.error("Failed to browse vector files", err, {
            scope: "AddLayersDialog",
          });
        }
      }
    } else {
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
          logging.error("Failed to browse data source file", err, {
            scope: "AddLayersDialog",
            sourceType: activeTab,
          });
        }
      }
    }
  };

  /**
   * @description Shows the load warning for one failed file and resolves once the user acknowledges it.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-19
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @param {LayerLoadFailure} failure - The file that failed and why.
   * @returns {Promise<void>} Resolves when the warning is dismissed, or at once if the dialog has been closed.
   */
  const showLoadWarning = (failure: LayerLoadFailure): Promise<void> =>
    new Promise<void>((resolve) => {
      if (!isAddLayersOpenSignal.value) {
        resolve();
        return;
      }
      loadWarningSignal.value = { failure, acknowledge: resolve };
    });

  /**
   * @description Adds the chosen vector files as layers one at a time, warning about each file that
   * can't be loaded and waiting for acknowledgement before the next, then closes the dialog however
   * many files loaded.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-01
   * @updated 2026-11-19
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const handleAdd = async (): Promise<void> => {
    if (isAddingSignal.value) return;
    addTypedPaths();
    if (activeTab === "vector") {
      const files = vectorFilesSignal.value;
      if (files.length === 0) {
        logging.warn("No vector files selected to add", {
          scope: "AddLayersDialog",
        });
        return;
      }

      isAddingSignal.value = true;
      try {
        const api = window.electronAPI;
        const result = await addLayersOneByOne(files, {
          pathExists: api?.pathExists,
          addLayer: async (params) => {
            if (!api?.addLayers) {
              throw new Error(
                t("add_layers_reason_unavailable")
                  || "Adding layers is not available."
              );
            }
            await api.addLayers([params]);
          },
          warn: showLoadWarning,
          isCancelled: () => !isAddLayersOpenSignal.value,
        });
        for (const failure of result.failed) {
          logging.warn("Layer could not be added", {
            scope: "AddLayersDialog",
            filePath: failure.filePath,
            reason: failure.reason,
            message: failure.message,
          });
        }
      } finally {
        isAddingSignal.value = false;
        resetInputs();
        closeAddLayersDialog();
      }
    } else {
      resetInputs();
      closeAddLayersDialog();
    }
  };

  const loadWarning = loadWarningSignal.value;
  const loadWarningFileName =
    loadWarning ?
      loadWarning.failure.filePath.split(/[/\\]/).pop()
      || loadWarning.failure.filePath
    : "";

  return (
    <Dialog
      name='addLayersWindow'
      title='Add Layers'
      icon={
        <Icon
          name='file:layers-plus-outline.svg'
          size='calc(var(--cartouche-ui-icon-size, 24px) * 0.75)'
        />
      }
      isOpen={isOpen}
      onClose={closeAddLayersDialog}
      onCancel={handleCancel}
      defaultWidth={620}
      defaultHeight={460}
      footer={
        <>
          <button
            type='button'
            className='add-layers-btn add-layers-btn-secondary'
            onClick={() => closeAddLayersDialog()}>
            Cancel
          </button>
          <button
            type='button'
            className='add-layers-btn add-layers-btn-primary'
            onClick={handleAdd}>
            <Icon
              name='file:layers-plus-outline.svg'
              size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)'
            />
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
        }}>
        {/* Source Type Selector Tabs */}
        <div
          className='add-layers-source-tabs'
          style={{ display: "flex", flexShrink: 0 }}>
          {sourceTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                className={`add-layers-source-tab${isActive ? " selected" : ""}`}
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
                  userSelect: "none",
                  transition: "color 0.15s ease",
                }}>
                <Icon
                  path={tab.icon}
                  size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)'
                />
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
              className='dialog-field-label'
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "6px",
              }}>
              Vector Layer Files
            </label>
            <div
              style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              {activeTab === "vector" ?
                <div
                  className='add-layers-chip-box'
                  style={{
                    flex: 1,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    minHeight: "38px",
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
                        className='add-layers-chip'
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px 2px 10px",
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
                          className='add-layers-chip-remove'>
                          <Icon
                            path={mdiClose}
                            size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
                          />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    ref={inputRef}
                    type='text'
                    className='add-layers-chip-input'
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
                  />
                </div>
              : <input
                  type='text'
                  value={filePath}
                  onChange={(e) => {
                    filePathSignal.value = e.target.value;
                  }}
                  placeholder={`Select ${activeTab} data file (GeoTIFF, GeoPackage...)`}
                  className='add-layers-path-input'
                />
              }
              <button
                type='button'
                className='add-layers-btn add-layers-btn-browse'
                onClick={handleBrowse}>
                <Icon
                  path={mdiFolderOpenOutline}
                  size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)'
                />
                <span>Browse...</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ModalDialog
        title={t("add_layers_load_failed_title") || "Layer Not Added"}
        isOpen={loadWarning !== null}
        onClose={acknowledgeLoadWarning}
        buttons={[
          {
            label: t("dialog_ok") || "OK",
            primary: true,
            onClick: acknowledgeLoadWarning,
          },
        ]}>
        {loadWarning && (
          <div className='add-layers-load-warning'>
            <p title={loadWarning.failure.filePath}>
              {t("add_layers_load_failed_file", { file: loadWarningFileName })
                || `${loadWarningFileName} could not be added as a layer.`}
            </p>
            <p>
              {loadWarning.failure.reason === "missing" ?
                t("add_layers_reason_missing") || "The file does not exist."
              : loadWarning.failure.message
                || t("add_layers_reason_unknown")
                || "The file could not be read."
              }
            </p>
          </div>
        )}
      </ModalDialog>
    </Dialog>
  );
};
