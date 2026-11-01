/**
 * @file LayerPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/LayerPropertiesDialog
 * @description Modeless dialog window inspecting layer metadata, provider driver descriptors, attribute field schemas, and configuring source parameters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link activeLayerPropertiesIdSignal}
 */

import React, { useCallback, useRef, useLayoutEffect, useEffect } from "react";
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
  applyLayerPropertiesEdits,
  commitAndCloseLayerPropertiesDialog,
  POPULAR_CRS_OPTIONS,
  type LayerPropertiesTabId,
} from "@renderer/state/layerPropertiesSignals";
import {
  convertStyleFormat,
  validateStyleContent,
  parseStyleTextToGeoStyler,
  serializeGeoStylerToText,
  extractVisualSymbolizers,
  applyVisualSymbolizersToGeoStyler,
} from "@shared/styles/flatStyleConverter";
import { generateDefaultVectorStyleJson } from "@shared/styles/defaultLayerStyles";
import type {
  ProjectStyleFormat,
  SldStyleVersion,
  LayerVisualSymbolizer,
} from "@shared/types";
import { t } from "@renderer/state/i18nSignals";
import { Dialog } from "./Dialog";

/**
 * Normalizes a hex color string for HTML5 color inputs (#rrggbb).
 *
 * @function formatHexColor
 * @description Ensures an input color string matches the 7-character hexadecimal format (#rrggbb) required by HTML5 color inputs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {string} [color] - Input color candidate.
 * @param {string} [fallback="#000000"] - Fallback hex color if input is missing or malformed.
 * @returns {string} Normalized 7-character hex color.
 */
function formatHexColor(color?: string, fallback = "#000000"): string {
  if (!color || typeof color !== "string") return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  return fallback;
}

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
 * @component LayerPropertiesDialog
 * @description Modeless detached child window component rendering comprehensive GIS layer metadata, vector fields, and source configuration controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-31
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
      if (validation.isValid) {
        try {
          const ast = await parseStyleTextToGeoStyler(
            contentToValidate,
            draft.styleFormat,
            draft.sldVersion
          );
          const extracted = extractVisualSymbolizers(ast, info?.geometryKind);
          updateLayerPropertiesDraft({
            styleValidationError: null,
            visualSymbolizer: extracted,
          });
        } catch (err: any) {
          updateLayerPropertiesDraft({
            styleValidationError: err?.message || String(err),
          });
        }
      } else {
        updateLayerPropertiesDraft({
          styleValidationError: validation.error ?? "Invalid style",
        });
      }
    },
    [draft.styleFormat, draft.sldVersion, info?.geometryKind]
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



  const handleVisualChange = useCallback(
    async (updates: Partial<LayerVisualSymbolizer>) => {
      const nextVisual: LayerVisualSymbolizer = {
        ...draft.visualSymbolizer,
        ...updates,
      };
      try {
        let ast;
        try {
          ast = await parseStyleTextToGeoStyler(
            draft.styleContent,
            draft.styleFormat,
            draft.sldVersion
          );
        } catch {
          ast = { name: "Cartouche Style", rules: [] };
        }
        const updatedAst = applyVisualSymbolizersToGeoStyler(
          ast,
          nextVisual,
          info?.geometryKind
        );
        const regeneratedText = await serializeGeoStylerToText(
          updatedAst,
          draft.styleFormat,
          draft.sldVersion
        );
        updateLayerPropertiesDraft({
          visualSymbolizer: nextVisual,
          styleContent: regeneratedText,
          styleValidationError: null,
        });
        resetRawStyleHistory(regeneratedText);
      } catch (err: any) {
        updateLayerPropertiesDraft({
          visualSymbolizer: nextVisual,
          styleValidationError: err?.message || String(err),
        });
      }
    },
    [
      draft.visualSymbolizer,
      draft.styleContent,
      draft.styleFormat,
      draft.sldVersion,
      info?.geometryKind,
    ]
  );

  const handleFormatChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFormat = e.target.value as ProjectStyleFormat;
      if (newFormat === draft.styleFormat) return;
      try {
        const converted = await convertStyleFormat(draft.styleContent, {
          fromFormat: draft.styleFormat,
          toFormat: newFormat,
          fromVersion: draft.sldVersion,
          toVersion: draft.sldVersion,
        });
        let extracted = draft.visualSymbolizer;
        try {
          const ast = await parseStyleTextToGeoStyler(
            converted,
            newFormat,
            draft.sldVersion
          );
          extracted = extractVisualSymbolizers(ast, info?.geometryKind);
        } catch {
          // retain previous visual symbolizer
        }
        updateLayerPropertiesDraft({
          styleFormat: newFormat,
          styleContent: converted,
          styleValidationError: null,
          visualSymbolizer: extracted,
        });
        resetRawStyleHistory(converted);
      } catch (err: any) {
        updateLayerPropertiesDraft({
          styleFormat: newFormat,
          styleValidationError: err?.message || String(err),
        });
      }
    },
    [
      draft.styleFormat,
      draft.sldVersion,
      draft.styleContent,
      draft.visualSymbolizer,
      info?.geometryKind,
    ]
  );

  const handleVersionChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVersion = e.target.value as SldStyleVersion;
      if (newVersion === draft.sldVersion) return;
      try {
        const converted = await convertStyleFormat(draft.styleContent, {
          fromFormat: "sld",
          toFormat: "sld",
          fromVersion: draft.sldVersion,
          toVersion: newVersion,
        });
        updateLayerPropertiesDraft({
          sldVersion: newVersion,
          styleContent: converted,
          styleValidationError: null,
        });
        resetRawStyleHistory(converted);
      } catch (err: any) {
        updateLayerPropertiesDraft({
          sldVersion: newVersion,
          styleValidationError: err?.message || String(err),
        });
      }
    },
    [draft.sldVersion, draft.styleContent]
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
          let extracted = draft.visualSymbolizer;
          if (validation.isValid) {
            try {
              const ast = await parseStyleTextToGeoStyler(
                loaded.content,
                loadedFormat,
                loadedVersion
              );
              extracted = extractVisualSymbolizers(ast, info?.geometryKind);
            } catch {
              // preserve existing
            }
          }
          updateLayerPropertiesDraft({
            styleFormat: loadedFormat,
            sldVersion: loadedVersion,
            styleContent: loaded.content,
            styleValidationError:
              validation.isValid ? null : (validation.error ?? "Invalid style"),
            visualSymbolizer: extracted,
          });
          resetRawStyleHistory(loaded.content);
        }
      } catch (err: any) {
        updateLayerPropertiesDraft({
          styleValidationError: err?.message || String(err),
        });
      }
    }
  }, [draft.visualSymbolizer, info?.geometryKind]);

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
    const defaultJson = generateDefaultVectorStyleJson();
    let contentToSet = defaultJson;
    if (draft.styleFormat === "sld") {
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
    try {
      const ast = await parseStyleTextToGeoStyler(
        contentToSet,
        draft.styleFormat,
        draft.sldVersion
      );
      const extracted = extractVisualSymbolizers(ast, info?.geometryKind);
      updateLayerPropertiesDraft({
        styleContent: contentToSet,
        styleValidationError: null,
        visualSymbolizer: extracted,
      });
      resetRawStyleHistory(contentToSet);
    } catch {
      updateLayerPropertiesDraft({
        styleContent: contentToSet,
        styleValidationError: null,
      });
      resetRawStyleHistory(contentToSet);
    }
  }, [draft.styleFormat, draft.sldVersion, info?.geometryKind]);

  if (!activeId) {
    return null;
  }

  const visual = draft.visualSymbolizer || {};
  const geometryKind = info?.geometryKind || "Unknown";
  const isLine = geometryKind === "LineString";
  const isPoint = geometryKind === "Point";
  const isPolygon = !isLine && !isPoint;

  const dialogTitle = `${t("layer_properties_dialog_title")} — ${info?.name || draft.layerName || activeId}`;

  return (
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
                          {t("layer_properties_field_col_ts_type")}
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
                      {!info?.fields || info.fields.length === 0 ?
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
                      : info.fields.map((field) => (
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
                              style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.width !== undefined && field.width > 0 ?
                                field.width
                              : "—"}
                            </td>
                            <td
                              style={{ padding: "6px 10px", color: "#475569" }}>
                              {(
                                field.precision !== undefined
                                && field.precision > 0
                              ) ?
                                field.precision
                              : "—"}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                fontFamily: "var(--cartouche-theme-font-family-mono, monospace)",
                                color: "#0f766e",
                              }}>
                              {field.mappedType}
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
                        {t("layer_properties_styling_format")}
                      </label>
                      <select
                        id='layer-prop-styling-format'
                        value={draft.styleFormat}
                        onChange={handleFormatChange}
                        style={{
                          padding: "0.3125rem 0.625rem",
                          borderRadius: "0.25rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.875rem",
                          backgroundColor: "#ffffff",
                        }}>
                        <option value='openlayers'>
                          {t("layer_properties_format_openlayers")}
                        </option>
                        <option value='sld'>
                          {t("layer_properties_format_sld")}
                        </option>
                      </select>
                    </div>

                    {/* Conditional SLD Version Selector */}
                    {draft.styleFormat === "sld" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}>
                        <label
                          htmlFor='layer-prop-styling-version'
                          style={{
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            color: "#334155",
                          }}>
                          {t("layer_properties_styling_version")}
                        </label>
                        <select
                          id='layer-prop-styling-version'
                          value={draft.sldVersion}
                          onChange={handleVersionChange}
                          style={{
                            padding: "0.3125rem 0.625rem",
                            borderRadius: "0.25rem",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.875rem",
                            backgroundColor: "#ffffff",
                          }}>
                          <option value='1.0.0'>1.0.0</option>
                          <option value='1.1.0'>1.1.0</option>
                        </select>
                      </div>
                    )}

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

                  {/* Visual Symbolizer Controls Group */}
                  <fieldset className='preference-group-box visual-symbolizer-group'>
                    <legend className='preference-group-legend'>
                      {t("layer_properties_styling_visual_group")}
                    </legend>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.625rem",
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

                      {/* Point Controls */}
                      {isPoint && (
                        <>
                          {/* Marker Shape */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-point-shape'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_point_shape")}:
                            </label>
                            <select
                              id='layer-prop-visual-point-shape'
                              className='layer-prop-visual-point-shape'
                              value={visual.pointShape || "circle"}
                              onChange={(e) =>
                                handleVisualChange({
                                  pointShape: e.target.value as any,
                                })
                              }
                              style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                                backgroundColor: "#ffffff",
                              }}>
                              <option value='circle'>
                                {t("layer_properties_shape_circle")}
                              </option>
                              <option value='square'>
                                {t("layer_properties_shape_square")}
                              </option>
                              <option value='triangle'>
                                {t("layer_properties_shape_triangle")}
                              </option>
                              <option value='star'>
                                {t("layer_properties_shape_star")}
                              </option>
                              <option value='cross'>
                                {t("layer_properties_shape_cross")}
                              </option>
                              <option value='x'>
                                {t("layer_properties_shape_x")}
                              </option>
                            </select>
                          </div>

                          {/* Point Radius / Size */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-point-radius'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_point_radius")}:
                            </label>
                            <input
                              id='layer-prop-visual-point-radius'
                              className='layer-prop-visual-point-radius'
                              type='number'
                              min='1'
                              max='100'
                              step='1'
                              value={visual.pointRadius ?? 6}
                              onChange={(e) =>
                                handleVisualChange({
                                  pointRadius: Number(e.target.value),
                                })
                              }
                              style={{
                                width: "5rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>

                          {/* Fill Color */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-fill-color'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_fill_color")}:
                            </label>
                            <input
                              id='layer-prop-visual-fill-color'
                              className='layer-prop-visual-fill-color'
                              type='color'
                              value={formatHexColor(
                                visual.fillColor,
                                "#0369a1"
                              )}
                              onChange={(e) =>
                                handleVisualChange({
                                  fillColor: e.target.value,
                                })
                              }
                              style={{
                                width: "3rem",
                                height: "1.75rem",
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>

                          {/* Stroke Color */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-color'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_color")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-color'
                              className='layer-prop-visual-stroke-color'
                              type='color'
                              value={formatHexColor(
                                visual.strokeColor,
                                "#0284c7"
                              )}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeColor: e.target.value,
                                })
                              }
                              style={{
                                width: "3rem",
                                height: "1.75rem",
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>

                          {/* Stroke Width */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-width'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_width")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-width'
                              className='layer-prop-visual-stroke-width'
                              type='number'
                              min='0'
                              max='50'
                              step='1'
                              value={visual.strokeWidth ?? 1}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              style={{
                                width: "5rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>
                        </>
                      )}

                      {/* LineString Controls */}
                      {isLine && (
                        <>
                          {/* Stroke Color */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-color'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_color")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-color'
                              className='layer-prop-visual-stroke-color'
                              type='color'
                              value={formatHexColor(
                                visual.strokeColor,
                                "#0284c7"
                              )}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeColor: e.target.value,
                                })
                              }
                              style={{
                                width: "3rem",
                                height: "1.75rem",
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>

                          {/* Stroke Width */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-width'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_width")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-width'
                              className='layer-prop-visual-stroke-width'
                              type='number'
                              min='0'
                              max='50'
                              step='1'
                              value={visual.strokeWidth ?? 1}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              style={{
                                width: "5rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>

                          {/* Stroke Dash Toggle */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-dash'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_dash")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-dash'
                              className='layer-prop-visual-stroke-dash'
                              type='checkbox'
                              checked={Boolean(visual.strokeLineDash)}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeLineDash: e.target.checked,
                                })
                              }
                              style={{
                                width: "1.125rem",
                                height: "1.125rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>
                        </>
                      )}

                      {/* Polygon / Default Controls */}
                      {isPolygon && (
                        <>
                          {/* Fill Color */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-fill-color'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_fill_color")}:
                            </label>
                            <input
                              id='layer-prop-visual-fill-color'
                              className='layer-prop-visual-fill-color'
                              type='color'
                              value={formatHexColor(
                                visual.fillColor,
                                "#1e293b"
                              )}
                              onChange={(e) =>
                                handleVisualChange({
                                  fillColor: e.target.value,
                                })
                              }
                              style={{
                                width: "3rem",
                                height: "1.75rem",
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>

                          {/* Fill Opacity */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-fill-opacity'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_fill_opacity")}:
                            </label>
                            <input
                              id='layer-prop-visual-fill-opacity'
                              className='layer-prop-visual-fill-opacity'
                              type='range'
                              min='0'
                              max='1'
                              step='0.05'
                              value={visual.fillOpacity ?? 1}
                              onChange={(e) =>
                                handleVisualChange({
                                  fillOpacity: parseFloat(e.target.value),
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
                              {Math.round((visual.fillOpacity ?? 1) * 100)}%
                            </span>
                          </div>

                          {/* Stroke Color */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-color'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_color")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-color'
                              className='layer-prop-visual-stroke-color'
                              type='color'
                              value={formatHexColor(
                                visual.strokeColor,
                                "#0284c7"
                              )}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeColor: e.target.value,
                                })
                              }
                              style={{
                                width: "3rem",
                                height: "1.75rem",
                                padding: 0,
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            />
                          </div>

                          {/* Stroke Width */}
                          <div
                            className='layer-properties-row'
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                            }}>
                            <label
                              htmlFor='layer-prop-visual-stroke-width'
                              style={{
                                width: "11rem",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                color: "#334155",
                              }}>
                              {t("layer_properties_styling_stroke_width")}:
                            </label>
                            <input
                              id='layer-prop-visual-stroke-width'
                              className='layer-prop-visual-stroke-width'
                              type='number'
                              min='0'
                              max='50'
                              step='1'
                              value={visual.strokeWidth ?? 0}
                              onChange={(e) =>
                                handleVisualChange({
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              style={{
                                width: "5rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </fieldset>

                  {/* Validation Feedback Banner */}
                  {draft.styleValidationError ? (
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
                  ) : (
                    <div
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
                  )}

                  {/* Raw Style Text Editor */}
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
                  className='layer-prop-toolbar-btn toggle-edit'
                  title={t("layer_properties_fields_toggle_edit")}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiPencilOutline} size='14px' />
                  <span>{t("layer_properties_fields_toggle_edit")}</span>
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn new-field'
                  title={t("layer_properties_fields_new_field")}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiTablePlus} size='14px' />
                  <span>{t("layer_properties_fields_new_field")}</span>
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn delete-field'
                  title={t("layer_properties_fields_delete_field")}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiTrashCanOutline} size='14px' />
                  <span>{t("layer_properties_fields_delete_field")}</span>
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn calculate'
                  title={t("layer_properties_fields_calculate")}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}>
                  <Icon path={mdiCalculator} size='14px' />
                  <span>{t("layer_properties_fields_calculate")}</span>
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
                        {t("layer_properties_fields_col_comment")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!info?.fields || info.fields.length === 0 ?
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#64748b",
                            fontStyle: "italic",
                          }}>
                          No attribute fields found.
                        </td>
                      </tr>
                    : info.fields.map((field) => (
                        <tr
                          key={field.name}
                          style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                            {field.name}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {field.nativeType}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {field.width !== undefined && field.width > 0 ?
                              field.width
                            : "—"}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {(
                              field.precision !== undefined
                              && field.precision > 0
                            ) ?
                              field.precision
                            : "—"}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px",
                              color: "#64748b",
                              fontStyle: "italic",
                            }}>
                            —
                          </td>
                        </tr>
                      ))
                    }
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
                      {(info?.fields || []).map((f) => (
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
                      {(info?.fields || []).map((f) => (
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
  );
};

export default LayerPropertiesDialog;
