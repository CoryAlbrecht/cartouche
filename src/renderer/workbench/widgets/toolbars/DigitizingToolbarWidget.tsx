/**
 * @file DigitizingToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/DigitizingToolbarWidget
 * @description Toolbar widget providing vector feature digitizing tools (Point, Line, Polygon), layer edit mode toggles, vertex editing, and spatial feature clipboard / deletion actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  mdiPencilOutline,
  mdiContentSaveOutline,
  mdiMapMarkerPlusOutline,
  mdiVectorPolyline,
  mdiVectorPolygon,
  mdiVectorPointSelect,
  mdiTrashCanOutline,
  mdiContentCut,
  mdiContentCopy,
  mdiContentPaste,
} from "@mdi/js";
import {
  type ToolbarZone,
  type GeometryKind,
  activeToolSignal,
  activeLayerIdSignal,
  activeLayerSignal,
  editableLayerIdsSignal,
  selectedFeatureIdsSignal,
  isProjectDirtySignal,
  toggleLayerEditingAction,
  saveActiveLayerAction,
  vertexEditorAction,
  deleteSelectedFeaturesAction,
  cutSelectedFeaturesAction,
  copySelectedFeaturesAction,
  pasteFeaturesAction,
} from "@renderer/state/gisSignals";
import { getActionFormattedKey } from "@renderer/state/actionSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} DigitizingToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface DigitizingToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @function isDigitizingToolbarDisabled
 * @description Evaluates whether digitizing toolbar tools should be disabled.
 * Tools are disabled whenever activeLayerId is null.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string | null} activeLayerId - Unique identifier of the active layer, or null.
 * @returns {boolean} True if tools should be disabled, false otherwise.
 */
export function isDigitizingToolbarDisabled(
  activeLayerId: string | null
): boolean {
  return activeLayerId === null;
}

/**
 * @function isLayerInEditMode
 * @description Evaluates whether a given spatial layer is currently active in edit mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string | null} layerId - Target layer identifier, or null.
 * @param {Set<string>} editableIds - Set of currently editable layer identifiers.
 * @returns {boolean} True if the layer is in edit mode, false otherwise.
 */
export function isLayerInEditMode(
  layerId: string | null,
  editableIds: Set<string>
): boolean {
  if (!layerId || !editableIds) return false;
  return editableIds.has(layerId);
}

/**
 * @function isDrawingToolEnabled
 * @description Evaluates whether a spatial drawing tool (Point, LineString, Polygon) is enabled based on layer geometry kind and edit state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {GeometryKind | undefined} geometryKind - Canonical geometry kind of the active layer.
 * @param {'Point' | 'LineString' | 'Polygon'} targetKind - Geometry kind required by the tool.
 * @param {boolean} inEditMode - Whether the active layer is currently in edit mode.
 * @returns {boolean} True if the drawing tool is enabled, false otherwise.
 */
export function isDrawingToolEnabled(
  geometryKind: GeometryKind | undefined,
  targetKind: "Point" | "LineString" | "Polygon",
  inEditMode: boolean
): boolean {
  if (!inEditMode) return false;
  if (geometryKind === "Raster") return false;
  return (
    geometryKind === targetKind ||
    geometryKind === "Unknown" ||
    !geometryKind
  );
}

/**
 * @function isVertexEditorEnabled
 * @description Evaluates whether the vertex editor tool is enabled based on layer edit mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} inEditMode - Whether the active layer is in edit mode.
 * @returns {boolean} True if vertex editor is enabled, false otherwise.
 */
export function isVertexEditorEnabled(inEditMode: boolean): boolean {
  return inEditMode;
}

/**
 * @function isSaveActiveLayerEnabled
 * @description Evaluates whether saving the active layer is enabled based on selection, edit mode, and modification state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string | null} layerId - Target layer identifier, or null.
 * @param {boolean} inEditMode - Whether the active layer is in edit mode.
 * @param {boolean} [isModified] - Optional flag indicating whether the layer or project has unsaved edits.
 * @returns {boolean} True if save active layer is enabled, false otherwise.
 */
export function isSaveActiveLayerEnabled(
  layerId: string | null,
  inEditMode: boolean,
  isModified?: boolean
): boolean {
  return layerId !== null && (inEditMode || Boolean(isModified));
}

/**
 * @function isDeleteSelectedFeaturesEnabled
 * @description Evaluates whether deleting selected features is enabled based on selection count.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {number} selectedCount - Count of currently selected spatial features.
 * @returns {boolean} True if delete is enabled, false otherwise.
 */
export function isDeleteSelectedFeaturesEnabled(selectedCount: number): boolean {
  return selectedCount > 0;
}

/**
 * @function isCutSelectedFeaturesEnabled
 * @description Evaluates whether cutting selected features to clipboard is enabled based on edit mode and selection count.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} inEditMode - Whether the active layer is in edit mode.
 * @param {number} selectedCount - Count of currently selected spatial features.
 * @returns {boolean} True if cut is enabled, false otherwise.
 */
export function isCutSelectedFeaturesEnabled(
  inEditMode: boolean,
  selectedCount: number
): boolean {
  return inEditMode && selectedCount > 0;
}

/**
 * @function isCopySelectedFeaturesEnabled
 * @description Evaluates whether copying selected features to clipboard is enabled based on selection count.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {number} selectedCount - Count of currently selected spatial features.
 * @returns {boolean} True if copy is enabled, false otherwise.
 */
export function isCopySelectedFeaturesEnabled(selectedCount: number): boolean {
  return selectedCount > 0;
}

/**
 * @function isPasteFeaturesEnabled
 * @description Evaluates whether pasting features into the active layer is enabled based on edit mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} inEditMode - Whether the active layer is in edit mode.
 * @returns {boolean} True if paste is enabled, false otherwise.
 */
export function isPasteFeaturesEnabled(inEditMode: boolean): boolean {
  return inEditMode;
}

/**
 * @function getButtonClass
 * @description Constructs consistent CSS class name string for toolbar buttons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} [isActive=false] - Whether the button represents the active tool.
 * @param {boolean} [isDisabled=false] - Whether the button is disabled.
 * @returns {string} Space-delimited CSS class string.
 */
export function getButtonClass(
  isActive = false,
  isDisabled = false
): string {
  const classes = ["toolbar-btn"];
  if (isActive) classes.push("active");
  if (isDisabled) classes.push("disabled");
  return classes.join(" ");
}

/**
 * @component DigitizingToolbarWidget
 * @description Renders spatial digitizing and vector editing buttons for toggling edit mode, saving active layer, drawing new features (Point, Line, Polygon), vertex editing, feature deletion, and clipboard operations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {DigitizingToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} DigitizingToolbarWidget instance.
 */
export const DigitizingToolbarWidget: React.FC<
  DigitizingToolbarWidgetProps
> = ({ zone = "top" }) => {
  useSignals();
  const { t } = useTranslation();

  const activeLayerId = activeLayerIdSignal.value;
  const activeLayer = activeLayerSignal.value;
  const editableIds = editableLayerIdsSignal.value;
  const isEditMode = isLayerInEditMode(activeLayerId, editableIds);
  const geometryKind = activeLayer?.geometryKind;
  const isRaster = geometryKind === "Raster";
  const selectedCount = selectedFeatureIdsSignal.value.size;

  const isToggleDisabled = activeLayerId === null || isRaster;
  const isSaveEnabled = isSaveActiveLayerEnabled(
    activeLayerId,
    isEditMode,
    isProjectDirtySignal.value
  );
  const isPointEnabled = isDrawingToolEnabled(geometryKind, "Point", isEditMode);
  const isLineEnabled = isDrawingToolEnabled(
    geometryKind,
    "LineString",
    isEditMode
  );
  const isPolygonEnabled = isDrawingToolEnabled(
    geometryKind,
    "Polygon",
    isEditMode
  );
  const isVertexEnabled = isVertexEditorEnabled(isEditMode);
  const isDeleteEnabled = isDeleteSelectedFeaturesEnabled(selectedCount);
  const isCutEnabled = isCutSelectedFeaturesEnabled(isEditMode, selectedCount);
  const isCopyEnabled = isCopySelectedFeaturesEnabled(selectedCount);
  const isPasteEnabled = isPasteFeaturesEnabled(isEditMode);

  // Formatted key combination titles
  const toggleKey = getActionFormattedKey("toggle_layer_editing", "Ctrl+E");
  const toggleLabel = t("toggle_layer_editing") || "Toggle Layer Editing";
  const toggleTitle = toggleKey ? `${toggleLabel} (${toggleKey})` : toggleLabel;

  const saveKey = getActionFormattedKey("save_active_layer", "Ctrl+S");
  const saveLabel = t("save_active_layer") || "Save Active Layer";
  const saveTitle = saveKey ? `${saveLabel} (${saveKey})` : saveLabel;

  const pointLabel = "Add Point Feature";
  const lineLabel = "Add Line Feature";
  const polygonLabel = "Add Polygon Feature";

  const vertexKey = getActionFormattedKey("vertex_editor", "V");
  const vertexLabel = t("vertex_editor") || "Vertex Editor";
  const vertexTitle = vertexKey ? `${vertexLabel} (${vertexKey})` : vertexLabel;

  const deleteKey = getActionFormattedKey("delete_selected_features", "Delete");
  const deleteLabel =
    t("delete_selected_features") || "Delete Selected Features";
  const deleteTitle = deleteKey ? `${deleteLabel} (${deleteKey})` : deleteLabel;

  const cutKey = getActionFormattedKey("cut_selected_features", "Ctrl+X");
  const cutLabel = t("cut_selected_features") || "Cut Selected Features";
  const cutTitle = cutKey ? `${cutLabel} (${cutKey})` : cutLabel;

  const copyKey = getActionFormattedKey("copy_selected_features", "Ctrl+C");
  const copyLabel = t("copy_selected_features") || "Copy Selected Features";
  const copyTitle = copyKey ? `${copyLabel} (${copyKey})` : copyLabel;

  const pasteKey = getActionFormattedKey("paste_features", "Ctrl+V");
  const pasteLabel = t("paste_features") || "Paste Features";
  const pasteTitle = pasteKey ? `${pasteLabel} (${pasteKey})` : pasteLabel;

  return (
    <ToolbarWidget id='digitizing' zone={zone}>
      <button
        type='button'
        id='toolbar-tool-toggle-layer-editing'
        className={getButtonClass(isEditMode, isToggleDisabled)}
        title={toggleTitle}
        aria-label={toggleLabel}
        disabled={isToggleDisabled}
        onClick={() => {
          if (!isToggleDisabled) {
            toggleLayerEditingAction();
          }
        }}>
        <Icon path={mdiPencilOutline} />
      </button>

      <button
        type='button'
        id='toolbar-tool-save-active-layer'
        className={getButtonClass(false, !isSaveEnabled)}
        title={saveTitle}
        aria-label={saveLabel}
        disabled={!isSaveEnabled}
        onClick={() => {
          if (isSaveEnabled) {
            saveActiveLayerAction();
          }
        }}>
        <Icon path={mdiContentSaveOutline} />
      </button>

      <button
        type='button'
        id='toolbar-tool-add-point'
        className={getButtonClass(activeToolSignal.value === "point", !isPointEnabled)}
        title={pointLabel}
        aria-label={pointLabel}
        disabled={!isPointEnabled}
        onClick={() => {
          if (isPointEnabled) {
            activeToolSignal.value = "point";
          }
        }}>
        <Icon path={mdiMapMarkerPlusOutline} />
      </button>

      <button
        type='button'
        id='toolbar-tool-add-line'
        className={getButtonClass(activeToolSignal.value === "line", !isLineEnabled)}
        title={lineLabel}
        aria-label={lineLabel}
        disabled={!isLineEnabled}
        onClick={() => {
          if (isLineEnabled) {
            activeToolSignal.value = "line";
          }
        }}>
        <Icon path={mdiVectorPolyline} />
      </button>

      <button
        type='button'
        id='toolbar-tool-add-polygon'
        className={getButtonClass(activeToolSignal.value === "polygon", !isPolygonEnabled)}
        title={polygonLabel}
        aria-label={polygonLabel}
        disabled={!isPolygonEnabled}
        onClick={() => {
          if (isPolygonEnabled) {
            activeToolSignal.value = "polygon";
          }
        }}>
        <Icon path={mdiVectorPolygon} />
      </button>

      <button
        type='button'
        id='toolbar-tool-vertex-editor'
        className={getButtonClass(activeToolSignal.value === "vertex_editor", !isVertexEnabled)}
        title={vertexTitle}
        aria-label={vertexLabel}
        disabled={!isVertexEnabled}
        onClick={() => {
          if (isVertexEnabled) {
            vertexEditorAction();
          }
        }}>
        <Icon path={mdiVectorPointSelect} />
      </button>

      <button
        type='button'
        id='toolbar-tool-delete-selected'
        className={getButtonClass(false, !isDeleteEnabled)}
        title={deleteTitle}
        aria-label={deleteLabel}
        disabled={!isDeleteEnabled}
        onClick={() => {
          if (isDeleteEnabled) {
            deleteSelectedFeaturesAction();
          }
        }}>
        <Icon path={mdiTrashCanOutline} />
      </button>

      <button
        type='button'
        id='toolbar-tool-cut-selected'
        className={getButtonClass(false, !isCutEnabled)}
        title={cutTitle}
        aria-label={cutLabel}
        disabled={!isCutEnabled}
        onClick={() => {
          if (isCutEnabled) {
            cutSelectedFeaturesAction();
          }
        }}>
        <Icon path={mdiContentCut} />
      </button>

      <button
        type='button'
        id='toolbar-tool-copy-selected'
        className={getButtonClass(false, !isCopyEnabled)}
        title={copyTitle}
        aria-label={copyLabel}
        disabled={!isCopyEnabled}
        onClick={() => {
          if (isCopyEnabled) {
            copySelectedFeaturesAction();
          }
        }}>
        <Icon path={mdiContentCopy} />
      </button>

      <button
        type='button'
        id='toolbar-tool-paste'
        className={getButtonClass(false, !isPasteEnabled)}
        title={pasteTitle}
        aria-label={pasteLabel}
        disabled={!isPasteEnabled}
        onClick={() => {
          if (isPasteEnabled) {
            pasteFeaturesAction();
          }
        }}>
        <Icon path={mdiContentPaste} />
      </button>
    </ToolbarWidget>
  );
};
