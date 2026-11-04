/**
 * @file LayerPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/LayerPropertiesDialog
 * @description Modeless dialog window inspecting layer metadata, provider driver descriptors, attribute field schemas, and configuring source parameters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link ModalDialog}
 * @see {@link activeLayerPropertiesIdSignal}
 */

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiInformationOutline,
  mdiTuneVariant,
  mdiTable,
  mdiClockOutline,
  mdiLayersOutline,
  mdiPencilOutline,
  mdiTablePlus,
  mdiTrashCanOutline,
  mdiCalculator,
  mdiPaletteOutline,
  mdiCodeTags,
  mdiUndo,
} from "@mdi/js";
import { actionsMapSignal } from "@renderer/state/actionSignals";
import {
  activeLayerPropertiesIdSignal,
  activeLayerPropertiesTabSignal,
  layerDetailedInfoSignal,
  isLayerPropertiesLoadingSignal,
  layerPropertiesDraftSignal,
  closeLayerPropertiesDialog,
  cancelLayerPropertiesEdits,
  updateLayerPropertiesDraft,
  switchLayerPropertiesStyleFormat,
  applyLayerPropertiesEdits,
  commitAndCloseLayerPropertiesDialog,
  findLayerInTree,
  isDiscardFieldChangesModalOpenSignal,
  discardUnappliedFieldChanges,
  POPULAR_CRS_OPTIONS,
  type LayerPropertiesTabId,
} from "@renderer/state/layerPropertiesSignals";
import {
  projectLayersSignal,
  projectTreeSignal,
} from "@renderer/state/projectSignals";
import {
  type InferredFieldType,
  type LayerFieldInfo,
  CANONICAL_INFERRED_FIELD_TYPES,
} from "@shared/types";
import {
  convertStyleFormat,
  validateStyleContent,
} from "@shared/styles/flatStyleConverter";
import {
  generateDefaultVectorStyleJson,
  createDefaultCartoucheLayerStyleJson,
} from "@shared/styles/defaultLayerStyles";
import { t } from "@renderer/state/i18nSignals";
import {
  preferencesMapSignal,
  updatePreference,
} from "@renderer/state/preferencesSignals";
import {
  editableLayerIdsSignal,
  toggleLayerEditingAction,
  isLayerInEditMode,
} from "@renderer/state/gisSignals";
import { Dialog } from "./Dialog";
import { ModalDialog } from "./ModalDialog";
import { StylePreviewCanvas } from "./StylePreviewCanvas";
import { SimpleModeEditor } from "./SimpleModeEditor";



/**
 * @typedef {Object} StyleTextHistoryEntry
 * @description Snapshot of style text content and cursor selection range for undo/redo operations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @property {string} content - Style text content snapshot.
 * @property {number} selectionStart - Cursor or selection start index.
 * @property {number} selectionEnd - Cursor or selection end index.
 */
export interface StyleTextHistoryEntry {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Maximum snapshot history stack depth for the raw style text editor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @type {number}
 */
export const MAX_RAW_STYLE_HISTORY_SIZE = 100;

/**
 * Default validation debounce delay in milliseconds waiting for typing inactivity before executing live validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @type {number}
 */
export const DEFAULT_RAW_STYLE_VALIDATION_DEBOUNCE_MS = 350;

/**
 * @typedef {Object} UseRawStyleTextEditorHistoryOptions
 * @description Configuration options for useRawStyleTextEditorHistory hook.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @property {string} content - Active draft style content text.
 * @property {number} [debounceMs=350] - Validation debounce delay in milliseconds.
 * @property {(newContent: string) => void} onUpdateContent - Callback synchronizing draft style content.
 * @property {(newContent: string) => Promise<void>} onValidateAndSync - Callback executing asynchronous validation and visual symbolizer sync.
 */
export interface UseRawStyleTextEditorHistoryOptions {
  content: string;
  debounceMs?: number;
  onUpdateContent: (newContent: string) => void;
  onValidateAndSync: (newContent: string) => Promise<void>;
}

/**
 * @typedef {Object} UseRawStyleTextEditorHistoryResult
 * @description Return object containing refs, event handlers, and undo/redo operations for the raw style text editor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @property {React.RefObject<HTMLTextAreaElement | null>} textareaRef - Ref attached to raw style textarea.
 * @property {React.RefObject<{ start: number; end: number } | null>} selectionRef - Ref tracking cursor selection offsets.
 * @property {React.RefObject<StyleTextHistoryEntry[]>} historyStackRef - In-memory undo/redo history snapshots.
 * @property {React.RefObject<number>} historyIndexRef - Pointer to current position in history stack.
 * @property {(e: React.ChangeEvent<HTMLTextAreaElement>) => void} handleRawStyleChange - Controlled change event handler preserving cursor.
 * @property {(e: React.KeyboardEvent<HTMLTextAreaElement>) => void} handleRawStyleKeyDown - Keyboard handler intercepting undo/redo action shortcuts.
 * @property {() => void} handleRawStyleBlur - Blur handler immediately flushing pending validation.
 * @property {() => boolean} undo - Programmatic undo operation restoring previous edit and cursor position.
 * @property {() => boolean} redo - Programmatic redo operation reapplying undone edit and cursor position.
 * @property {(newBaseContent: string) => void} resetHistory - Resets history stack with new baseline content.
 */
export interface UseRawStyleTextEditorHistoryResult {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  selectionRef: React.RefObject<{ start: number; end: number } | null>;
  historyStackRef: React.RefObject<StyleTextHistoryEntry[]>;
  historyIndexRef: React.RefObject<number>;
  handleRawStyleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleRawStyleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleRawStyleBlur: () => void;
  undo: () => boolean;
  redo: () => boolean;
  resetHistory: (newBaseContent: string) => void;
}

/**
 * Custom React hook managing raw style multiline textarea undo/redo history and cursor position preservation.
 *
 * @function useRawStyleTextEditorHistory
 * @description Manages in-memory undo/redo snapshot history for raw style text editing, traps configured Action Registry shortcuts, and preserves active cursor/selection offsets across live updates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {UseRawStyleTextEditorHistoryOptions} options - Configuration and change dispatch callbacks.
 * @returns {UseRawStyleTextEditorHistoryResult} Hook state refs, undo/redo controls, and input event handlers.
 */
export function useRawStyleTextEditorHistory({
  content,
  debounceMs = DEFAULT_RAW_STYLE_VALIDATION_DEBOUNCE_MS,
  onUpdateContent,
  onValidateAndSync,
}: UseRawStyleTextEditorHistoryOptions): UseRawStyleTextEditorHistoryResult {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const historyStackRef = useRef<StyleTextHistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInternalEditRef = useRef<boolean>(false);
  const lastSyncedContentRef = useRef<string>(content);

  const resetHistory = useCallback((newBaseContent: string) => {
    historyStackRef.current = [
      {
        content: newBaseContent,
        selectionStart: 0,
        selectionEnd: 0,
      },
    ];
    historyIndexRef.current = 0;
    selectionRef.current = null;
    lastSyncedContentRef.current = newBaseContent;
  }, []);

  // Initialize or synchronize external content updates (e.g. initial layer load)
  if (historyStackRef.current.length === 0) {
    resetHistory(content || "");
  } else if (!isInternalEditRef.current && content !== lastSyncedContentRef.current) {
    lastSyncedContentRef.current = content;
    // If the baseline was empty and now non-empty content arrived from async layer load:
    if (
      historyStackRef.current.length === 1 &&
      historyStackRef.current[0].content === "" &&
      content
    ) {
      historyStackRef.current = [
        {
          content: content,
          selectionStart: 0,
          selectionEnd: 0,
        },
      ];
      historyIndexRef.current = 0;
    }
  }

  // Cleanup pending debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (textareaRef.current && selectionRef.current) {
      const { start, end } = selectionRef.current;
      if (typeof textareaRef.current.setSelectionRange === "function") {
        textareaRef.current.setSelectionRange(start, end);
      }
      selectionRef.current = null;
    }
  }, [content]);

  // Helper scheduling debounced validation
  const scheduleValidation = useCallback(
    (contentToValidate: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (debounceMs <= 0) {
        void onValidateAndSync(contentToValidate);
      } else {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          void onValidateAndSync(contentToValidate);
        }, debounceMs);
      }
    },
    [debounceMs, onValidateAndSync]
  );

  const undo = useCallback((): boolean => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const targetEntry = historyStackRef.current[historyIndexRef.current];
      selectionRef.current = {
        start: targetEntry.selectionStart,
        end: targetEntry.selectionEnd,
      };
      isInternalEditRef.current = true;
      lastSyncedContentRef.current = targetEntry.content;
      onUpdateContent(targetEntry.content);
      isInternalEditRef.current = false;
      scheduleValidation(targetEntry.content);
      return true;
    }
    return false;
  }, [onUpdateContent, scheduleValidation]);

  const redo = useCallback((): boolean => {
    if (historyIndexRef.current < historyStackRef.current.length - 1) {
      historyIndexRef.current += 1;
      const targetEntry = historyStackRef.current[historyIndexRef.current];
      selectionRef.current = {
        start: targetEntry.selectionStart,
        end: targetEntry.selectionEnd,
      };
      isInternalEditRef.current = true;
      lastSyncedContentRef.current = targetEntry.content;
      onUpdateContent(targetEntry.content);
      isInternalEditRef.current = false;
      scheduleValidation(targetEntry.content);
      return true;
    }
    return false;
  }, [onUpdateContent, scheduleValidation]);

  const handleRawStyleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      const target = e.target;
      const selStart = target.selectionStart ?? newContent.length;
      const selEnd = target.selectionEnd ?? newContent.length;

      selectionRef.current = { start: selStart, end: selEnd };

      if (historyStackRef.current.length === 0) {
        resetHistory(content || "");
      }

      const newHistory = historyStackRef.current.slice(
        0,
        historyIndexRef.current + 1
      );
      newHistory.push({
        content: newContent,
        selectionStart: selStart,
        selectionEnd: selEnd,
      });
      if (newHistory.length > MAX_RAW_STYLE_HISTORY_SIZE) {
        newHistory.shift();
      }
      historyStackRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;

      isInternalEditRef.current = true;
      lastSyncedContentRef.current = newContent;
      onUpdateContent(newContent);
      isInternalEditRef.current = false;

      scheduleValidation(newContent);
    },
    [content, onUpdateContent, resetHistory, scheduleValidation]
  );

  const handleRawStyleBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      void onValidateAndSync(lastSyncedContentRef.current);
    }
  }, [onValidateAndSync]);

  const handleRawStyleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const meta = e.metaKey;

      const undoActionDef = actionsMapSignal.value.get("undo_action");
      const redoActionDef = actionsMapSignal.value.get("redo_action");

      const undoKey = undoActionDef?.keyCombination ?? { key: "z", ctrl: true };
      const redoKey = redoActionDef?.keyCombination ?? { key: "y", ctrl: true };

      const isUndoMatch =
        key === undoKey.key.toLowerCase() &&
        !!undoKey.ctrl === ctrl &&
        !!undoKey.alt === alt &&
        !!undoKey.shift === shift &&
        !!undoKey.meta === meta;

      const isRedoMatch =
        (key === redoKey.key.toLowerCase() &&
          !!redoKey.ctrl === ctrl &&
          !!redoKey.alt === alt &&
          !!redoKey.shift === shift &&
          !!redoKey.meta === meta) ||
        ((ctrl || meta) && shift && key === "z");

      if (!isUndoMatch && !isRedoMatch) {
        return;
      }

      if (typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      if (typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }

      if (isUndoMatch) {
        undo();
      } else if (isRedoMatch) {
        redo();
      }
    },
    [undo, redo]
  );

  return {
    textareaRef,
    selectionRef,
    historyStackRef,
    historyIndexRef,
    handleRawStyleChange,
    handleRawStyleKeyDown,
    handleRawStyleBlur,
    undo,
    redo,
    resetHistory,
  };
}

/**
 * @typedef {Object} SidebarTabDef
 * @property {LayerPropertiesTabId} id - Tab identifier.
 * @property {string} labelKey - i18n translation key.
 * @property {string} icon - MDI SVG icon path.
 */
interface SidebarTabDef {
  id: LayerPropertiesTabId;
  labelKey: string;
  icon: string;
}

const SIDEBAR_TABS: SidebarTabDef[] = [
  {
    id: "information",
    labelKey: "layer_properties_tab_information",
    icon: mdiInformationOutline,
  },
  {
    id: "source",
    labelKey: "layer_properties_tab_source",
    icon: mdiTuneVariant,
  },
  {
    id: "styling",
    labelKey: "layer_properties_tab_styling",
    icon: mdiPaletteOutline,
  },
  { id: "fields", labelKey: "layer_properties_tab_fields", icon: mdiTable },
  {
    id: "time_filter",
    labelKey: "layer_properties_tab_time_filter",
    icon: mdiClockOutline,
  },
];

/**
 * Common secondary button style for Styling Tab file management and reset actions.
 */
const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  padding: "0.3125rem 0.75rem",
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "0.25rem",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
  color: "#334155",
};

/**
 * @function resolveFieldIndex
 * @description Resolves the stable 0-based field index, anchoring physical GDAL slots and incrementing virtual fields.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field metadata.
 * @param {LayerFieldInfo[]} allFields - Full fields collection.
 * @param {number} fallbackIndex - Array index fallback.
 * @returns {number} Resolved 0-based integer index.
 */
export function resolveFieldIndex(
  field: LayerFieldInfo,
  allFields: LayerFieldInfo[],
  fallbackIndex: number
): number {
  if (typeof field.index === "number") {
    return field.index;
  }
  const physicalFields = allFields.filter((f) => !f.isVirtual);
  const physicalCount = physicalFields.length;
  if (!field.isVirtual) {
    const physIdx = physicalFields.indexOf(field);
    return physIdx >= 0 ? physIdx : fallbackIndex;
  }
  const virtualFields = allFields.filter((f) => f.isVirtual);
  const virtIdx = virtualFields.indexOf(field);
  return physicalCount + (virtIdx >= 0 ? virtIdx : 0);
}

/**
 * @typedef {'width' | 'precision' | 'comment'} EditableFieldColumn
 * @description Editable attribute schema column identifiers on the Fields tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 */
export type EditableFieldColumn = "width" | "precision" | "comment";

/**
 * @function resolveFieldColumnStringValue
 * @description Extracts the string representation of an editable column value for inline input initialization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field metadata.
 * @param {EditableFieldColumn} column - Target column to evaluate.
 * @returns {string} String representation of cell value.
 */
export function resolveFieldColumnStringValue(
  field: LayerFieldInfo,
  column: EditableFieldColumn
): string {
  if (column === "comment") {
    return field.comment || "";
  }
  const val = field[column];
  return val !== undefined && val > 0 ? String(val) : "";
}

/**
 * @function isFieldColumnEditable
 * @description Evaluates whether an attribute schema column is editable for the specified field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field info.
 * @param {EditableFieldColumn} column - Target column to evaluate.
 * @returns {boolean} True if the column is editable for this field type.
 */
export function isFieldColumnEditable(
  field: LayerFieldInfo,
  column: EditableFieldColumn
): boolean {
  const effectiveType =
    field.inferredType ??
    (field.mappedType === "number" ? "real"
    : field.mappedType === "boolean" ? "boolean"
    : "string");

  switch (column) {
    case "width":
      return (
        effectiveType === "string" ||
        effectiveType === "integer" ||
        effectiveType === "real"
      );
    case "precision":
      return effectiveType === "real";
    case "comment":
      return true;
    default:
      return false;
  }
}

/**
 * @function getEditableColumnsForField
 * @description Returns the sequence of editable columns available for a given field type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field info.
 * @returns {EditableFieldColumn[]} Ordered array of editable column names.
 */
export function getEditableColumnsForField(
  field: LayerFieldInfo
): EditableFieldColumn[] {
  const columns: EditableFieldColumn[] = [];
  if (isFieldColumnEditable(field, "width")) {
    columns.push("width");
  }
  if (isFieldColumnEditable(field, "precision")) {
    columns.push("precision");
  }
  if (isFieldColumnEditable(field, "comment")) {
    columns.push("comment");
  }
  return columns;
}

/**
 * @component LayerPropertiesDialog
 * @description Modeless detached child window component rendering comprehensive GIS layer metadata, vector fields, and source configuration controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @returns {JSX.Element | null} The rendered modeless dialog or null if closed.
 */
export const LayerPropertiesDialog: React.FC = () => {
  useSignals();

  const activeId = activeLayerPropertiesIdSignal.value;
  const activeTab = activeLayerPropertiesTabSignal.value;
  const info = layerDetailedInfoSignal.value;
  const isLoading = isLayerPropertiesLoadingSignal.value;
  const draft = layerPropertiesDraftSignal.value;

  const currentProjectLayer = activeId ? projectLayersSignal.value.find((l) => l.id === activeId) : undefined;
  const currentTreeLayer = activeId ? findLayerInTree(projectTreeSignal.value, activeId) : undefined;
  const layerFields: LayerFieldInfo[] =
    draft.fields ??
    currentProjectLayer?.fields ??
    (currentTreeLayer && 'fields' in currentTreeLayer ? (currentTreeLayer as any).fields : undefined) ??
    info?.fields ??
    [];

  const isEditing = isLayerInEditMode(activeId, editableLayerIdsSignal.value);
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [isNewFieldOpen, setIsNewFieldOpen] = useState(false);

  useEffect(() => {
    setSelectedFieldName(null);
    setIsNewFieldOpen(false);
  }, [activeId]);

  /**
   * @function handleDeleteSelectedField
   * @description Removes the selected attribute field from the draft layer fields collection and clears row selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleDeleteSelectedField = useCallback(() => {
    if (!isEditing || !selectedFieldName || !activeId) return;
    const updatedFields = layerFields.filter((f) => f.name !== selectedFieldName);
    updateLayerPropertiesDraft({ fields: updatedFields });
    setSelectedFieldName(null);
  }, [isEditing, selectedFieldName, activeId, layerFields]);

  /**
   * @function handleFieldTypeChange
   * @description Modifies a field's inferredType, marks userOverridden: true, and updates transactional draft state conforming to ADR 0024.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-02
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Name of the target field to modify.
   * @param {InferredFieldType} newType - New canonical field data type.
   * @returns {void}
   */
  const handleFieldTypeChange = useCallback(
    (fieldName: string, newType: InferredFieldType) => {
      if (!activeId) return;
      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          return {
            ...f,
            inferredType: newType,
            userOverridden: true,
          };
        }
        return f;
      });

      // Update draft state exclusively (conforming to ADR 0024)
      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [activeId, layerFields]
  );

  /**
   * @function handleResetFieldType
   * @description Resets the data type of the specified field to its original inferred type and clears user override.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Name of the target field to reset.
   * @returns {void}
   */
  const handleResetFieldType = useCallback(
    (fieldName: string) => {
      if (!activeId) return;
      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          const original = f.originalInferredType ?? f.inferredType;
          return {
            ...f,
            inferredType: original,
            userOverridden: false,
          };
        }
        return f;
      });

      // Update draft state exclusively (conforming to ADR 0024)
      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [activeId, layerFields]
  );

  const [editingCell, setEditingCell] = useState<{
    fieldName: string;
    column: EditableFieldColumn;
  } | null>(null);
  const [cellInputValue, setCellInputValue] = useState<string>("");
  const isCancellingRef = useRef(false);

  useEffect(() => {
    setEditingCell(null);
    if (!isEditing) {
      setSelectedFieldName(null);
    }
  }, [isEditing, activeId]);

  /**
   * @function commitCellEdit
   * @description Commits staged inline cell edits (width, precision, comment) to draft state and marks userOverridden: true.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Target field identifier.
   * @param {EditableFieldColumn} column - Column being edited.
   * @param {string} rawValue - Raw user-entered string value.
   * @returns {void}
   */
  const commitCellEdit = useCallback(
    (fieldName: string, column: EditableFieldColumn, rawValue: string) => {
      const field = layerFields.find((f) => f.name === fieldName);
      if (!field) return;

      const trimmed = rawValue.trim();
      let updatedValue: number | string | undefined;

      if (column === "width" || column === "precision") {
        if (!trimmed) {
          updatedValue = undefined;
        } else {
          const parsed = parseInt(trimmed, 10);
          if (isNaN(parsed) || parsed < 0) {
            updatedValue = field[column];
          } else {
            updatedValue = parsed;
          }
        }
      } else {
        updatedValue = rawValue;
      }

      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          return {
            ...f,
            [column]: updatedValue,
            userOverridden: true,
          };
        }
        return f;
      });

      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [layerFields]
  );

  /**
   * @function handleCellBlur
   * @description Handles inline input blur events, committing edits unless cancellation was requested.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {LayerFieldInfo} field - Target field metadata.
   * @param {EditableFieldColumn} column - Active column.
   * @param {string} value - Current input value.
   * @returns {void}
   */
  const handleCellBlur = useCallback(
    (field: LayerFieldInfo, column: EditableFieldColumn, value: string) => {
      if (isCancellingRef.current) {
        isCancellingRef.current = false;
        return;
      }
      commitCellEdit(field.name, column, value);
      setEditingCell(null);
    },
    [commitCellEdit]
  );

  /**
   * @function handleCellKeyDown
   * @description Handles inline editor keyboard navigation, trapping Enter, Escape, Tab, and Shift-Tab.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {React.KeyboardEvent<HTMLInputElement>} e - Keyboard event.
   * @param {LayerFieldInfo} field - Target field metadata.
   * @param {EditableFieldColumn} column - Active column.
   * @param {string} currentValue - Current input value.
   * @returns {void}
   */
  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      field: LayerFieldInfo,
      column: EditableFieldColumn,
      currentValue: string
    ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitCellEdit(field.name, column, currentValue);
        setEditingCell(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        isCancellingRef.current = true;
        setEditingCell(null);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitCellEdit(field.name, column, currentValue);
        const editableCols = getEditableColumnsForField(field);
        const currentIndex = editableCols.indexOf(column);
        if (e.shiftKey) {
          if (currentIndex > 0) {
            const prevCol = editableCols[currentIndex - 1];
            setEditingCell({ fieldName: field.name, column: prevCol });
            setCellInputValue(resolveFieldColumnStringValue(field, prevCol));
          } else {
            setEditingCell(null);
          }
        } else {
          if (currentIndex >= 0 && currentIndex < editableCols.length - 1) {
            const nextCol = editableCols[currentIndex + 1];
            setEditingCell({ fieldName: field.name, column: nextCol });
            setCellInputValue(resolveFieldColumnStringValue(field, nextCol));
          } else {
            setEditingCell(null);
          }
        }
      }
    },
    [commitCellEdit]
  );

  const showNativeType = Boolean(
    preferencesMapSignal.value["ui.layerProperties.fields.showNativeType"]?.value
  );

  /**
   * @function handleToggleShowNativeType
   * @description Toggles visibility of the Native Type column on the Fields tab and persists preference.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-02
   * @updated 2026-11-02
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleToggleShowNativeType = useCallback(() => {
    updatePreference(
      "ui.layerProperties.fields.showNativeType",
      !showNativeType
    ).catch(() => {});
  }, [showNativeType]);

  const handleClose = useCallback(() => {
    closeLayerPropertiesDialog();
  }, []);

  const handleCancel = useCallback(() => {
    cancelLayerPropertiesEdits();
  }, []);

  const handleApply = useCallback(async () => {
    await applyLayerPropertiesEdits();
  }, []);

  const handleOk = useCallback(async () => {
    await commitAndCloseLayerPropertiesDialog();
  }, []);

  const validationSeqRef = useRef<number>(0);

  const validateAndSyncDraft = useCallback(
    async (contentToValidate: string) => {
      const seq = ++validationSeqRef.current;
      const validation = await validateStyleContent(
        contentToValidate,
        draft.styleFormat,
        draft.sldVersion
      );
      if (seq !== validationSeqRef.current) return;
      const currentKey =
        draft.styleFormat === "cartouche" ?
          "cartouche"
        : draft.styleFormat === "sld" ?
          draft.sldVersion === "1.1.0" ?
            "sld-1.1.0"
          : "sld-1.0.0"
        : "openlayers";

      if (validation.isValid) {
        updateLayerPropertiesDraft({
          styleValidationError: null,
          formatCache: {
            [currentKey]: contentToValidate,
          },
        });
      } else {
        updateLayerPropertiesDraft({
          styleValidationError: validation.error ?? "Invalid style",
        });
      }
    },
    [draft.styleFormat, draft.sldVersion]
  );

  const {
    textareaRef: rawStyleTextareaRef,
    handleRawStyleChange,
    handleRawStyleKeyDown,
    handleRawStyleBlur,
    resetHistory: resetRawStyleHistory,
  } = useRawStyleTextEditorHistory({
    content: draft.styleContent,
    onUpdateContent: (newContent) => {
      updateLayerPropertiesDraft({
        styleContent: newContent,
      });
    },
    onValidateAndSync: validateAndSyncDraft,
  });

  const lastActiveIdRef = useRef<string | null>(null);
  if (activeId !== lastActiveIdRef.current) {
    lastActiveIdRef.current = activeId;
    if (activeId && draft.styleContent) {
      resetRawStyleHistory(draft.styleContent);
    }
  }





  const selectedFormatOption =
    draft.styleFormat === "cartouche" ?
      "cartouche"
    : draft.styleFormat === "sld" ?
      draft.sldVersion === "1.1.0" ?
        "sld-1.1.0"
      : "sld-1.0.0"
    : "openlayers";

  const handleFormatOptionChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const targetOption = e.target.value;
      await switchLayerPropertiesStyleFormat(targetOption, info?.geometryKind);
      resetRawStyleHistory(layerPropertiesDraftSignal.value.styleContent);
    },
    [info?.geometryKind, resetRawStyleHistory]
  );



  const handleLoadStyle = useCallback(async () => {
    if (window.electronAPI?.loadStyleFile) {
      try {
        const loaded = await window.electronAPI.loadStyleFile();
        if (loaded && loaded.content) {
          const loadedFormat = loaded.format || "openlayers";
          const loadedVersion = loaded.version || "1.0.0";
          const validation = await validateStyleContent(
            loaded.content,
            loadedFormat,
            loadedVersion
          );
          const formatKey =
            loadedFormat === "cartouche" ?
              "cartouche"
            : loadedFormat === "sld" ?
              loadedVersion === "1.1.0" ?
                "sld-1.1.0"
              : "sld-1.0.0"
            : "openlayers";

          updateLayerPropertiesDraft({
            styleFormat: loadedFormat,
            sldVersion: loadedVersion,
            styleContent: loaded.content,
            styleValidationError:
              validation.isValid ? null : validation.error ?? "Invalid style",
            formatCache: {
              ...(draft.formatCache || {}),
              [formatKey]: loaded.content,
            },
          });
          resetRawStyleHistory(loaded.content);
        }
      } catch (err: any) {
        updateLayerPropertiesDraft({
          styleValidationError: err?.message || String(err),
        });
      }
    }
  }, [draft.formatCache, resetRawStyleHistory]);

  const handleExportStyle = useCallback(async () => {
    if (window.electronAPI?.saveStyleFile) {
      const defaultExt = draft.styleFormat === "sld" ? ".sld" : ".json";
      const defaultName = `${draft.layerId || "style"}${defaultExt}`;
      await window.electronAPI.saveStyleFile(
        {
          format: draft.styleFormat,
          ...(draft.styleFormat === "sld" ? { version: draft.sldVersion } : {}),
          content: draft.styleContent,
        },
        defaultName
      );
    }
  }, [draft.styleFormat, draft.sldVersion, draft.styleContent, draft.layerId]);

  const handleResetStyle = useCallback(async () => {
    let contentToSet = "";
    if (draft.styleFormat === "cartouche") {
      contentToSet = createDefaultCartoucheLayerStyleJson(info?.geometryKind);
    } else if (draft.styleFormat === "openlayers") {
      contentToSet = generateDefaultVectorStyleJson();
    } else {
      const defaultJson = generateDefaultVectorStyleJson();
      try {
        contentToSet = await convertStyleFormat(defaultJson, {
          fromFormat: "openlayers",
          toFormat: "sld",
          toVersion: draft.sldVersion,
        });
      } catch (err: any) {
        updateLayerPropertiesDraft({
          styleContent: defaultJson,
          styleValidationError: err?.message || String(err),
        });
        return;
      }
    }
    const currentKey =
      draft.styleFormat === "cartouche" ?
        "cartouche"
      : draft.styleFormat === "sld" ?
        draft.sldVersion === "1.1.0" ?
          "sld-1.1.0"
        : "sld-1.0.0"
      : "openlayers";

    updateLayerPropertiesDraft({
      styleContent: contentToSet,
      styleValidationError: null,
      formatCache: {
        ...(draft.formatCache || {}),
        [currentKey]: contentToSet,
      },
    });
    resetRawStyleHistory(contentToSet);
  }, [
    draft.styleFormat,
    draft.sldVersion,
    draft.formatCache,
    info?.geometryKind,
    resetRawStyleHistory,
  ]);

  if (!activeId) {
    return null;
  }

  const geometryKind = info?.geometryKind || "Unknown";

  const dialogTitle = `${t("layer_properties_dialog_title")} — ${info?.name || draft.layerName || activeId}`;

  return (
    <>
      <Dialog
        name='layerPropertiesWindow'
      title={dialogTitle}
      icon={mdiLayersOutline}
      isOpen={Boolean(activeId)}
      onClose={handleClose}
      onCancel={handleCancel}
      defaultWidth={860}
      defaultHeight={620}
      footer={
        <div
          className='layer-properties-footer'
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.5rem",
          }}>
          <button
            type='button'
            className='layer-properties-btn cancel'
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            {t("layer_properties_btn_cancel")}
          </button>
          <button
            type='button'
            className='layer-properties-btn apply'
            onClick={handleApply}
            disabled={Boolean(draft.idValidationError || draft.styleValidationError)}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor:
                draft.idValidationError || draft.styleValidationError ?
                  "not-allowed"
                : "pointer",
              opacity:
                draft.idValidationError || draft.styleValidationError ? 0.6 : 1,
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            {t("layer_properties_btn_apply")}
          </button>
          <button
            type='button'
            className='layer-properties-btn ok'
            onClick={handleOk}
            disabled={Boolean(draft.idValidationError || draft.styleValidationError)}
            style={{
              padding: "6px 16px",
              backgroundColor: "#1b446c",
              border: "1px solid #1b446c",
              borderRadius: "4px",
              cursor:
                draft.idValidationError || draft.styleValidationError ?
                  "not-allowed"
                : "pointer",
              opacity:
                draft.idValidationError || draft.styleValidationError ? 0.6 : 1,
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#ffffff",
            }}>
            {t("layer_properties_btn_ok")}
          </button>
        </div>
      }>
      <div
        className='layer-properties-container'
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
          className='layer-properties-sidebar'
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
          {SIDEBAR_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type='button'
                className={`layer-properties-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  activeLayerPropertiesTabSignal.value = tab.id;
                }}
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
                <Icon
                  path={tab.icon}
                  size='calc(var(--cartouche-ui-icon-size, 24px) * 0.75)'
                />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tab Content */}
        <div
          className='layer-properties-content'
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.25rem",
            gap: "1rem",
            minHeight: 0,
          }}>
          {isLoading && (
            <div
              className='layer-properties-loading'
              style={{
                padding: "1rem",
                color: "#64748b",
                fontStyle: "italic",
              }}>
              {t("layer_properties_loading")}
            </div>
          )}

          {activeTab === "information" && (
            <div
              className='layer-properties-tab-pane information'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* General Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_general")}
                </legend>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_name")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.name || draft.layerName || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_id")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.layerId || activeId}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_source")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{
                      flex: 1,
                      color: "#000000",
                      wordBreak: "break-all",
                    }}>
                    {info?.source || "—"}
                  </span>
                </div>
              </fieldset>

              {/* Provider Information Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_provider")}
                </legend>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_driver")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.driverName || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_geometry")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.geometryKind || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_feature_count")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.featureCount !== undefined ?
                      info.featureCount.toLocaleString()
                    : "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_crs")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.crsDescription || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_extent")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.extent ?
                      `[${info.extent.map((n: number) => Number(n).toFixed(4)).join(", ")}]`
                    : "—"}
                  </span>
                </div>
              </fieldset>

              {/* Fields Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_fields")}
                </legend>
                <div
                  className='layer-properties-table-container'
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    overflow: "auto",
                    maxHeight: "18rem",
                  }}>
                  <table
                    className='layer-properties-fields-table'
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.8125rem",
                    }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f1f5f9",
                          textAlign: "left",
                        }}>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_name")}
                        </th>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_native_type")}
                        </th>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_inferred_type")}
                        </th>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_length")}
                        </th>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_precision")}
                        </th>
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_nullable")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!layerFields || layerFields.length === 0 ?
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              color: "#64748b",
                              fontStyle: "italic",
                            }}>
                            No attribute fields found for this layer.
                          </td>
                        </tr>
                      : layerFields.map((field) => (
                          <tr
                            key={field.name}
                            style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td
                              style={{ padding: "6px 10px", fontWeight: 500 }}>
                              {field.name}
                            </td>
                            <td
                              style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.nativeType}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                fontFamily:
                                  "var(--cartouche-theme-font-family-mono, monospace)",
                                color: field.userOverridden ? "#047857" : "#0f766e",
                                fontWeight: field.userOverridden ? 600 : 400,
                              }}>
                              {field.inferredType ?? field.mappedType}
                              {field.userOverridden && (
                                <span
                                  className='layer-field-override-badge'
                                  title='Field type manually overridden by user'
                                  style={{
                                    marginLeft: "6px",
                                    fontSize: "0.6875rem",
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    backgroundColor: "#dcfce7",
                                    color: "#15803d",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                  }}>
                                  User
                                </span>
                              )}
                            </td>
                            <td
                              style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.width !== undefined && field.width > 0 ?
                                field.width
                              : ""}
                            </td>
                            <td
                              style={{ padding: "6px 10px", color: "#475569" }}>
                              {(
                                field.precision !== undefined
                                && field.precision > 0
                              ) ?
                                field.precision
                              : ""}
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              {field.nullable ?
                                t("layer_properties_yes")
                              : t("layer_properties_no")}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === "source" && (
            <div
              className='layer-properties-tab-pane source'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_source_group_general")}
                </legend>
                {/* Layer Name Input */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-name'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_layer_name")}
                  </label>
                  <input
                    id='layer-prop-name'
                    type='text'
                    value={draft.layerName}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ layerName: e.target.value })
                    }
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>

                {/* Layer ID Input with Validation */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-id'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_layer_id")}
                  </label>
                  <input
                    id='layer-prop-id'
                    type='text'
                    value={draft.layerId}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ layerId: e.target.value })
                    }
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border:
                        draft.idValidationError ? "1px solid #ef4444" : (
                          "1px solid #cbd5e1"
                        ),
                      fontSize: "0.875rem",
                    }}
                  />
                  {draft.idValidationError && (
                    <span
                      className='layer-prop-validation-error'
                      style={{
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                      }}>
                      {draft.idValidationError}
                    </span>
                  )}
                </div>

                {/* Assigned CRS Selector */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-crs'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_crs")}
                  </label>
                  <select
                    id='layer-prop-crs'
                    value={draft.crsAuthId}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ crsAuthId: e.target.value })
                    }
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}>
                    {POPULAR_CRS_OPTIONS.map((crs) => (
                      <option key={crs.authId} value={crs.authId}>
                        {crs.authId} — {crs.name}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              {/* Provider Feature Filter Fieldset */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_source_group_filter")}
                </legend>
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}>
                  <textarea
                    id='layer-prop-feature-filter'
                    rows={4}
                    value={draft.featureFilter}
                    placeholder={t(
                      "layer_properties_source_filter_placeholder"
                    )}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({
                        featureFilter: e.target.value,
                      })
                    }
                    style={{
                      padding: "8px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8125rem",
                      fontFamily: "var(--cartouche-theme-font-family-mono, monospace)",
                      resize: "vertical",
                      lineHeight: 1.4,
                    }}
                  />
                  <span
                    className='layer-prop-dialect-caption'
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      fontStyle: "italic",
                    }}>
                    {info?.driverDialect === "ogr_sql" ?
                      t("layer_properties_dialect_ogr_sql")
                    : info?.driverDialect === "native_sql" ?
                      t("layer_properties_dialect_native_sql")
                    : info?.driverDialect === "nosql" ?
                      t("layer_properties_dialect_nosql")
                    : t("layer_properties_dialect_generic")}
                  </span>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === "styling" && (
            <div
              className='layer-properties-tab-pane styling'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_styling_group")}
                </legend>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}>
                  {/* Action Bar / Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}>
                    {/* Format Selector */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}>
                      <label
                        htmlFor='layer-prop-styling-format'
                        style={{
                          fontWeight: 500,
                          fontSize: "0.875rem",
                          color: "#334155",
                        }}>
                        {t("layer_properties_styling_format")}:
                      </label>
                      <select
                        id='layer-prop-styling-format'
                        value={selectedFormatOption}
                        onChange={handleFormatOptionChange}
                        style={{
                          padding: "0.3125rem 0.625rem",
                          borderRadius: "0.25rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.875rem",
                          backgroundColor: "#ffffff",
                        }}>
                        <option value='cartouche'>
                          {t("layer_properties_format_simple")}
                        </option>
                        <option value='openlayers'>
                          {t("layer_properties_format_openlayers")}
                        </option>
                        <option value='sld-1.0.0'>
                          {t("layer_properties_format_sld_100")}
                        </option>
                        <option value='sld-1.1.0'>
                          {t("layer_properties_format_sld_110")}
                        </option>
                      </select>
                    </div>

                    {/* File and Reset Buttons */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginLeft: "auto",
                      }}>
                      <button
                        type='button'
                        id='layer-prop-styling-load'
                        className='layer-properties-btn'
                        onClick={handleLoadStyle}
                        style={SECONDARY_BUTTON_STYLE}>
                        {t("layer_properties_styling_load")}
                      </button>
                      <button
                        type='button'
                        id='layer-prop-styling-export'
                        className='layer-properties-btn'
                        onClick={handleExportStyle}
                        style={SECONDARY_BUTTON_STYLE}>
                        {t("layer_properties_styling_export")}
                      </button>
                      <button
                        type='button'
                        id='layer-prop-styling-reset'
                        className='layer-properties-btn'
                        onClick={handleResetStyle}
                        style={SECONDARY_BUTTON_STYLE}>
                        {t("layer_properties_styling_reset")}
                      </button>
                    </div>
                  </div>

                  {/* Main Content Layout: Editor / Controls on Left, 120x120 Preview on Right */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1.25rem",
                      alignItems: "flex-start",
                    }}>
                    {/* Left Column: Mode Specific Controls */}
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        minWidth: 0,
                      }}>
                      {/* Common Layer Opacity */}
                      <div
                        className='layer-properties-row'
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                        }}>
                        <label
                          htmlFor='layer-prop-layer-opacity'
                          style={{
                            width: "11rem",
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            color: "#334155",
                          }}>
                          {t("layer_properties_styling_layer_opacity")}:
                        </label>
                        <input
                          id='layer-prop-layer-opacity'
                          className='layer-prop-layer-opacity'
                          type='range'
                          min='0'
                          max='1'
                          step='0.01'
                          value={draft.opacity ?? 1}
                          onChange={(e) =>
                            updateLayerPropertiesDraft({
                              opacity: parseFloat(e.target.value),
                            })
                          }
                          style={{ flex: 1, cursor: "pointer" }}
                        />
                        <span
                          style={{
                            width: "3.5rem",
                            textAlign: "right",
                            fontSize: "0.875rem",
                            color: "#475569",
                          }}>
                          {Math.round((draft.opacity ?? 1) * 100)}%
                        </span>
                      </div>

                      {/* Mode 1: Simple Mode (Cartouche Symbology) */}
                      {draft.styleFormat === "cartouche" && (
                        <SimpleModeEditor
                          styleContent={draft.styleContent}
                          geometryKind={info?.geometryKind}
                          onChange={(newContent) => {
                            updateLayerPropertiesDraft({
                              styleContent: newContent,
                              styleValidationError: null,
                              formatCache: {
                                cartouche: newContent,
                              },
                            });
                          }}
                        />
                      )}

                      {/* Mode 2: External Raw Format Editor (OpenLayers Flat Style or SLD XML) */}
                      {draft.styleFormat !== "cartouche" && (
                        <div
                          id='layer-prop-external-mode-container'
                          className='layer-prop-external-mode-container'
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}>
                          {/* Validation Feedback Banner */}
                          {draft.styleValidationError ?
                            <div
                              className='style-validation-banner style-validation-error'
                              style={{
                                padding: "0.5rem 0.75rem",
                                backgroundColor: "#fee2e2",
                                border: "1px solid #f87171",
                                borderRadius: "0.25rem",
                                color: "#b91c1c",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}>
                              {t("layer_properties_style_syntax_error")}:{" "}
                              {draft.styleValidationError}
                            </div>
                          : <div
                              className='style-validation-banner style-validation-valid'
                              style={{
                                padding: "0.5rem 0.75rem",
                                backgroundColor: "#dcfce7",
                                border: "1px solid #86efac",
                                borderRadius: "0.25rem",
                                color: "#15803d",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}>
                              {t("layer_properties_style_valid")}
                            </div>
                          }

                          {/* Raw Style Textarea */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}>
                            <label
                              htmlFor='layer-prop-styling-raw-style'
                              style={{
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_raw_style")}
                            </label>
                            <textarea
                              ref={rawStyleTextareaRef}
                              id='layer-prop-styling-raw-style'
                              className='layer-prop-styling-raw-style'
                              value={draft.styleContent}
                              onChange={handleRawStyleChange}
                              onKeyDown={handleRawStyleKeyDown}
                              onBlur={handleRawStyleBlur}
                              rows={12}
                              spellCheck={false}
                              style={{
                                width: "100%",
                                fontFamily:
                                  "var(--cartouche-theme-font-family-mono, monospace)",
                                fontSize: "0.8125rem",
                                padding: "0.5rem",
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                boxSizing: "border-box",
                                resize: "vertical",
                                backgroundColor: "#ffffff",
                                color: "#0f172a",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: 120x120 Preview Box */}
                    <div
                      id='layer-prop-preview-container'
                      className='layer-prop-preview-container'
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.25rem",
                        width: "140px",
                        flexShrink: 0,
                      }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}>
                        {t("layer_properties_styling_preview")}
                      </div>
                      <StylePreviewCanvas
                        content={draft.styleContent}
                        format={draft.styleFormat}
                        version={draft.sldVersion}
                        opacity={draft.opacity ?? 1}
                        geometryKind={geometryKind}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === "fields" && (
            <div
              className='layer-properties-tab-pane fields'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Appearance-only Action Toolbar */}
              <div
                className='layer-properties-fields-toolbar'
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "4px 8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                }}>
                <button
                  type='button'
                  className={`layer-prop-toolbar-btn toggle-edit ${isEditing ? "active toolbar-btn" : ""}`}
                  title={t("layer_properties_fields_toggle_edit")}
                  aria-label={t("layer_properties_fields_toggle_edit")}
                  aria-pressed={isEditing}
                  onClick={() => {
                    if (activeId) {
                      toggleLayerEditingAction(activeId);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: isEditing ? "1px solid #0284c7" : "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: isEditing ? "#e0f2fe" : "#ffffff",
                    color: isEditing ? "#0369a1" : "#334155",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiPencilOutline} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn new-field'
                  title={t("layer_properties_fields_new_field")}
                  aria-label={t("layer_properties_fields_new_field")}
                  disabled={!isEditing}
                  onClick={() => {
                    if (isEditing) {
                      setIsNewFieldOpen(true);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid",
                    borderColor: isEditing ? "#cbd5e1" : "#e2e8f0",
                    borderRadius: "3px",
                    backgroundColor: isEditing ? "#ffffff" : "#f8fafc",
                    cursor: isEditing ? "pointer" : "not-allowed",
                    color: isEditing ? "#334155" : "#94a3b8",
                    opacity: isEditing ? 1 : 0.5,
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiTablePlus} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn delete-field'
                  title={t("layer_properties_fields_delete_field")}
                  aria-label={t("layer_properties_fields_delete_field")}
                  disabled={!isEditing || !selectedFieldName}
                  onClick={handleDeleteSelectedField}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid",
                    borderColor:
                      isEditing && selectedFieldName ? "#cbd5e1" : "#e2e8f0",
                    borderRadius: "3px",
                    backgroundColor:
                      isEditing && selectedFieldName ? "#ffffff" : "#f8fafc",
                    cursor:
                      isEditing && selectedFieldName ? "pointer" : "not-allowed",
                    color:
                      isEditing && selectedFieldName ? "#334155" : "#94a3b8",
                    opacity:
                      isEditing && selectedFieldName ? 1 : 0.5,
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiTrashCanOutline} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn calculate'
                  title={t("layer_properties_fields_calculate")}
                  aria-label={t("layer_properties_fields_calculate")}
                  disabled={!isEditing}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid",
                    borderColor: isEditing ? "#cbd5e1" : "#e2e8f0",
                    borderRadius: "3px",
                    backgroundColor: isEditing ? "#ffffff" : "#f8fafc",
                    cursor: isEditing ? "pointer" : "not-allowed",
                    color: isEditing ? "#334155" : "#94a3b8",
                    opacity: isEditing ? 1 : 0.5,
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiCalculator} size='14px' />
                </button>
                <button
                  type='button'
                  className={`layer-prop-toolbar-btn show-native-type ${showNativeType ? "active" : ""}`}
                  title={t("layer_properties_fields_show_native_type")}
                  aria-pressed={showNativeType}
                  onClick={handleToggleShowNativeType}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: showNativeType ? "#e2e8f0" : "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    marginLeft: "auto",
                  }}>
                  <Icon path={mdiCodeTags} size='14px' />
                  <span>{t("layer_properties_fields_show_native_type")}</span>
                </button>
              </div>

              {/* Fields Data Table */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.8125rem",
                  }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#f8fafc",
                        textAlign: "left",
                        color: "#475569",
                      }}>
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                          width: "48px",
                          textAlign: "right",
                        }}>
                        {t("layer_properties_field_col_index")}
                      </th>
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                        }}>
                        {t("layer_properties_field_col_name")}
                      </th>
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                        }}>
                        {t("layer_properties_fields_col_data_type")}
                      </th>
                      {showNativeType && (
                        <th
                          style={{
                            padding: "6px 10px",
                            borderBottom: "1px solid #cbd5e1",
                            borderLeft: "1px solid #cbd5e1",
                            borderRight: "1px solid #cbd5e1",
                          }}>
                          {t("layer_properties_field_col_native_type")}
                        </th>
                      )}
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                        }}>
                        {t("layer_properties_field_col_length")}
                      </th>
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                        }}>
                        {t("layer_properties_field_col_precision")}
                      </th>
                      <th
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #cbd5e1",
                          borderLeft: "1px solid #cbd5e1",
                          borderRight: "1px solid #cbd5e1",
                        }}>
                        {t("layer_properties_fields_col_comment")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!layerFields || layerFields.length === 0 ?
                      <tr>
                        <td
                          colSpan={showNativeType ? 7 : 6}
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#64748b",
                            fontStyle: "italic",
                            borderLeft: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                          }}>
                          No attribute fields found.
                        </td>
                      </tr>
                    : layerFields.map((field, fieldIndex) => {
                        const isSelected = selectedFieldName === field.name;
                        return (
                          <tr
                            key={field.name}
                            className={`layer-properties-field-row ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedFieldName((prev) =>
                                prev === field.name ? null : field.name
                              );
                            }}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                              cursor: "pointer",
                            }}>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderLeft: "1px solid #e2e8f0",
                                borderRight: "1px solid #e2e8f0",
                                textAlign: "right",
                                fontFamily:
                                  "var(--cartouche-theme-font-family-mono, monospace)",
                                color: "#64748b",
                              }}>
                              {resolveFieldIndex(field, layerFields, fieldIndex)}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderLeft: "1px solid #e2e8f0",
                                borderRight: "1px solid #e2e8f0",
                                fontWeight: 500,
                              }}>
                              {field.name}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderLeft: "1px solid #e2e8f0",
                                borderRight: "1px solid #e2e8f0",
                                fontFamily:
                                  "var(--cartouche-theme-font-family-mono, monospace)",
                                color: "#0f766e",
                              }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <select
                                  className='layer-field-type-select'
                                  aria-label={`Field type for ${field.name}`}
                                  disabled={!isEditing}
                                  value={field.inferredType ?? (field.mappedType === 'number' ? 'real' : field.mappedType === 'boolean' ? 'boolean' : 'string')}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    handleFieldTypeChange(
                                      field.name,
                                      e.target.value as InferredFieldType
                                    )
                                  }
                                  style={{
                                    padding: "2px 6px",
                                    fontSize: "0.8125rem",
                                    fontFamily:
                                      "var(--cartouche-theme-font-family-mono, monospace)",
                                    fontWeight: field.userOverridden ? 600 : 400,
                                    color:
                                      field.userOverridden ? "#047857"
                                      : !isEditing ? "#94a3b8"
                                      : "#0f766e",
                                    backgroundColor:
                                      field.userOverridden ? "#f0fdf4"
                                      : !isEditing ? "#f8fafc"
                                      : "#ffffff",
                                    border:
                                      field.userOverridden ? "1px solid #10b981"
                                      : !isEditing ? "1px solid #e2e8f0"
                                      : "1px solid #cbd5e1",
                                    borderRadius: "3px",
                                    cursor: !isEditing ? "not-allowed" : "pointer",
                                    opacity: !isEditing ? 0.8 : 1,
                                  }}>
                                  {CANONICAL_INFERRED_FIELD_TYPES.map((typeOption) => (
                                    <option key={typeOption} value={typeOption}>
                                      {typeOption}
                                    </option>
                                  ))}
                                </select>
                                {field.userOverridden && (
                                  <span
                                    className='layer-field-override-badge'
                                    title='Field type manually overridden by user'
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "1px 5px",
                                      borderRadius: "3px",
                                      backgroundColor: "#dcfce7",
                                      color: "#15803d",
                                      fontWeight: 600,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.025em",
                                    }}>
                                    User
                                  </span>
                                )}
                                {(() => {
                                  const isOverridden = Boolean(
                                    field.userOverridden ||
                                      (field.originalInferredType &&
                                        field.inferredType !== field.originalInferredType)
                                  );
                                  const isResetEnabled = isEditing && isOverridden;
                                  return (
                                    <button
                                      type='button'
                                      className='layer-field-reset-type-btn'
                                      title={t("layer_properties_fields_reset_type")}
                                      aria-label={t("layer_properties_fields_reset_type")}
                                      disabled={!isResetEnabled}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleResetFieldType(field.name);
                                      }}
                                      style={{
                                        padding: "2px 4px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "1px solid",
                                        borderColor: isResetEnabled ? "#cbd5e1" : "#e2e8f0",
                                        borderRadius: "3px",
                                        backgroundColor: isResetEnabled ? "#ffffff" : "#f8fafc",
                                        cursor: isResetEnabled ? "pointer" : "not-allowed",
                                        color: isResetEnabled ? "#334155" : "#94a3b8",
                                        opacity: isResetEnabled ? 1 : 0.5,
                                      }}>
                                      <Icon path={mdiUndo} size='14px' />
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                          {showNativeType && (
                            <td
                              style={{
                                padding: "6px 10px",
                                borderLeft: "1px solid #e2e8f0",
                                borderRight: "1px solid #e2e8f0",
                                color: "#475569",
                              }}>
                              {field.nativeType}
                            </td>
                          )}
                          <td
                            className={`layer-properties-field-cell-length ${isEditing && isSelected && isFieldColumnEditable(field, "width") ? "editable-cell" : ""}`}
                            onClick={(e) => {
                              if (isEditing && isSelected && isFieldColumnEditable(field, "width")) {
                                e.stopPropagation();
                                setEditingCell({ fieldName: field.name, column: "width" });
                                setCellInputValue(resolveFieldColumnStringValue(field, "width"));
                              }
                            }}
                            style={{
                              padding:
                                editingCell?.fieldName === field.name && editingCell?.column === "width"
                                  ? "2px 4px"
                                  : "6px 10px",
                              borderLeft: "1px solid #e2e8f0",
                              borderRight: "1px solid #e2e8f0",
                              color: "#475569",
                              cursor:
                                isEditing && isSelected && isFieldColumnEditable(field, "width")
                                  ? "text"
                                  : "inherit",
                            }}>
                            {editingCell?.fieldName === field.name && editingCell?.column === "width" ? (
                              <input
                                type='text'
                                className='layer-field-cell-input layer-field-cell-input-width'
                                aria-label={`Length for ${field.name}`}
                                value={cellInputValue}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setCellInputValue(e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, field, "width", cellInputValue)}
                                onBlur={() => handleCellBlur(field, "width", cellInputValue)}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "2px 4px",
                                  fontSize: "0.8125rem",
                                  border: "1px solid #0284c7",
                                  borderRadius: "2px",
                                  outline: "none",
                                  backgroundColor: "#ffffff",
                                  color: "#0f172a",
                                }}
                              />
                            ) : (
                              field.width !== undefined && field.width > 0 ?
                                field.width
                              : ""
                            )}
                          </td>
                          <td
                            className={`layer-properties-field-cell-precision ${isEditing && isSelected && isFieldColumnEditable(field, "precision") ? "editable-cell" : ""}`}
                            onClick={(e) => {
                              if (isEditing && isSelected && isFieldColumnEditable(field, "precision")) {
                                e.stopPropagation();
                                setEditingCell({ fieldName: field.name, column: "precision" });
                                setCellInputValue(resolveFieldColumnStringValue(field, "precision"));
                              }
                            }}
                            style={{
                              padding:
                                editingCell?.fieldName === field.name && editingCell?.column === "precision"
                                  ? "2px 4px"
                                  : "6px 10px",
                              borderLeft: "1px solid #e2e8f0",
                              borderRight: "1px solid #e2e8f0",
                              color: "#475569",
                              cursor:
                                isEditing && isSelected && isFieldColumnEditable(field, "precision")
                                  ? "text"
                                  : "inherit",
                            }}>
                            {editingCell?.fieldName === field.name && editingCell?.column === "precision" ? (
                              <input
                                type='text'
                                className='layer-field-cell-input layer-field-cell-input-precision'
                                aria-label={`Precision for ${field.name}`}
                                value={cellInputValue}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setCellInputValue(e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, field, "precision", cellInputValue)}
                                onBlur={() => handleCellBlur(field, "precision", cellInputValue)}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "2px 4px",
                                  fontSize: "0.8125rem",
                                  border: "1px solid #0284c7",
                                  borderRadius: "2px",
                                  outline: "none",
                                  backgroundColor: "#ffffff",
                                  color: "#0f172a",
                                }}
                              />
                            ) : (
                              field.precision !== undefined && field.precision > 0 ?
                                field.precision
                              : ""
                            )}
                          </td>
                          <td
                            className={`layer-properties-field-cell-comment ${isEditing && isSelected && isFieldColumnEditable(field, "comment") ? "editable-cell" : ""}`}
                            onClick={(e) => {
                              if (isEditing && isSelected && isFieldColumnEditable(field, "comment")) {
                                e.stopPropagation();
                                setEditingCell({ fieldName: field.name, column: "comment" });
                                setCellInputValue(resolveFieldColumnStringValue(field, "comment"));
                              }
                            }}
                            style={{
                              padding:
                                editingCell?.fieldName === field.name && editingCell?.column === "comment"
                                  ? "2px 4px"
                                  : "6px 10px",
                              borderLeft: "1px solid #e2e8f0",
                              borderRight: "1px solid #e2e8f0",
                              color: "#64748b",
                              cursor:
                                isEditing && isSelected && isFieldColumnEditable(field, "comment")
                                  ? "text"
                                  : "inherit",
                            }}>
                            {editingCell?.fieldName === field.name && editingCell?.column === "comment" ? (
                              <input
                                type='text'
                                className='layer-field-cell-input layer-field-cell-input-comment'
                                aria-label={`Comment for ${field.name}`}
                                value={cellInputValue}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setCellInputValue(e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, field, "comment", cellInputValue)}
                                onBlur={() => handleCellBlur(field, "comment", cellInputValue)}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "2px 4px",
                                  fontSize: "0.8125rem",
                                  border: "1px solid #0284c7",
                                  borderRadius: "2px",
                                  outline: "none",
                                  backgroundColor: "#ffffff",
                                  color: "#0f172a",
                                }}
                              />
                            ) : (
                              field.comment || ""
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "time_filter" && (
            <div
              className='layer-properties-tab-pane time-filter'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_tab_time_filter")}
                </legend>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}>
                    <input
                      id='layer-prop-time-enable'
                      type='checkbox'
                      defaultChecked={false}
                    />
                    <span>{t("layer_properties_time_enable")}</span>
                  </label>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}>
                    <label
                      htmlFor='layer-prop-time-mode'
                      style={{
                        fontWeight: 500,
                        fontSize: "0.875rem",
                        color: "#334155",
                      }}>
                      {t("layer_properties_time_mode")}
                    </label>
                    <select
                      id='layer-prop-time-mode'
                      defaultValue='single'
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}>
                      <option value='single'>
                        {t("layer_properties_time_mode_single")}
                      </option>
                      <option value='separate'>
                        {t("layer_properties_time_mode_separate")}
                      </option>
                      <option value='fixed'>
                        {t("layer_properties_time_mode_fixed")}
                      </option>
                    </select>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}>
                    <label
                      htmlFor='layer-prop-time-start'
                      style={{
                        fontWeight: 500,
                        fontSize: "0.875rem",
                        color: "#334155",
                      }}>
                      {t("layer_properties_time_start_field")}
                    </label>
                    <select
                      id='layer-prop-time-start'
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}>
                      <option value=''>—</option>
                      {layerFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.nativeType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}>
                    <label
                      htmlFor='layer-prop-time-end'
                      style={{
                        fontWeight: 500,
                        fontSize: "0.875rem",
                        color: "#334155",
                      }}>
                      {t("layer_properties_time_end_field")}
                    </label>
                    <select
                      id='layer-prop-time-end'
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}>
                      <option value=''>—</option>
                      {layerFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.nativeType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}
        </div>
      </div>
    </Dialog>
    <Dialog
      name='newFieldWindow'
      title={t("layer_properties_fields_new_field")}
      icon={mdiTablePlus}
      isOpen={isNewFieldOpen}
      onClose={() => setIsNewFieldOpen(false)}
      defaultWidth={420}
      defaultHeight={320}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
          }}>
          <button
            type='button'
            className='new-field-dialog-cancel-btn'
            onClick={() => setIsNewFieldOpen(false)}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontSize: "0.8125rem",
              color: "#334155",
            }}>
            {t("layer_properties_btn_cancel")}
          </button>
          <button
            type='button'
            className='new-field-dialog-ok-btn'
            onClick={() => setIsNewFieldOpen(false)}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "#2563eb",
              border: "1px solid #1d4ed8",
              borderRadius: "0.25rem",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}>
            {t("layer_properties_btn_ok")}
          </button>
        </div>
      }>
      <div style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        New field configuration placeholder.
      </div>
    </Dialog>
    {/* Confirmation ModalDialog for Discarding Unapplied Field Changes */}
    <ModalDialog
      isOpen={isDiscardFieldChangesModalOpenSignal.value}
      title={t("layer_properties_fields_discard_title") || "Discard Unapplied Field Changes?"}
      onClose={() => {
        isDiscardFieldChangesModalOpenSignal.value = false;
      }}
      buttons={[
        {
          label: t("dialog_cancel") || "Cancel",
          onClick: () => {
            isDiscardFieldChangesModalOpenSignal.value = false;
          },
        },
        {
          label: t("dialog_ok") || "OK",
          primary: true,
          onClick: () => {
            discardUnappliedFieldChanges();
            if (activeId) {
              toggleLayerEditingAction(activeId, { force: true });
            }
            setEditingCell(null);
            setSelectedFieldName(null);
            isDiscardFieldChangesModalOpenSignal.value = false;
          },
        },
      ]}>
      <p style={{ margin: 0 }}>
        {t("layer_properties_fields_discard_warning") ||
          "You have unapplied changes to attribute fields. Turning off Layer Edit Mode will discard these changes. Do you want to proceed?"}
      </p>
    </ModalDialog>
  </>
  );
};

export default LayerPropertiesDialog;
