/**
 * @file StyleEditor.tsx
 * @module renderer/workbench/dialogs/StyleEditor
 * @description Reusable style editor shared by the Layer Properties Styling Tab and the Project Properties Default Styles tab: the style format dropdown, Load / Export / Reset actions, the Cartouche Symbology component editor or the raw text editor (with validation banner and undo/redo history), and the live preview canvas. The editor is controlled: it receives a StyleEditorValue and a geometry kind and reports every change as a value patch through `onChange`, with no dependency on any dialog draft store.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link SimpleModeEditor}
 * @see {@link StylePreviewCanvas}
 * @see {@link computeStyleFormatSwitch}
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { actionsMapSignal } from "@renderer/state/actionSignals";
import { t } from "@renderer/state/i18nSignals";
import { validateStyleContent } from "@shared/styles/flatStyleConverter";
import {
  type StyleEditorValue,
  styleFormatOptionKey,
  computeStyleFormatSwitch,
  computeDefaultStyleReset,
} from "@shared/styles/styleFormatSwitch";
import { StylePreviewCanvas } from "./StylePreviewCanvas";
import { SimpleModeEditor } from "./SimpleModeEditor";

export type { StyleEditorValue } from "@shared/styles/styleFormatSwitch";

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
 * Common secondary button style for the Load / Export / Reset actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  padding: "0.3125rem 0.75rem",
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "0.25rem",
  cursor: "pointer",
  fontSize: "0.8125rem",
  color: "#334155",
  fontWeight: 500,
};

/**
 * @typedef {Object} StyleEditorProps
 * @description Properties of {@link StyleEditor}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {StyleEditorValue} value - The style being edited.
 * @property {string} [geometryKind='Unknown'] - Geometry kind of the styled data, driving component filtering, default templates and the preview sample geometry.
 * @property {(patch: Partial<StyleEditorValue>) => void} onChange - Receives every edit as a shallow patch; the owner merges it into its own state (shallow, so a patch's `formatCache` replaces the previous cache as the Layer Properties draft always did).
 * @property {string} [idPrefix='layer-prop'] - Prefix for element ids (`<prefix>-styling-format`, `<prefix>-styling-raw-style`, …) so several editors can coexist in one document.
 * @property {string} [exportBaseName='style'] - Base file name offered by Export to File.
 * @property {string | null} [historyResetKey] - When this key changes the raw text undo history is reset to the current content (the Layer Properties dialog passes the active layer id).
 * @property {number} [opacity] - Layer opacity shown by the preview; when `onOpacityChange` is also given a Layer Opacity slider is rendered above the mode editor.
 * @property {(opacity: number) => void} [onOpacityChange] - Enables the Layer Opacity slider and receives its changes.
 */
export interface StyleEditorProps {
  value: StyleEditorValue;
  geometryKind?: string;
  onChange: (patch: Partial<StyleEditorValue>) => void;
  idPrefix?: string;
  exportBaseName?: string;
  historyResetKey?: string | null;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

/**
 * @component StyleEditor
 * @description Controlled editor for one style value: format selection with per-format text cache, file load/export/reset, Cartouche Symbology component editing or raw text editing with live validation, and a 120×120 preview.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {StyleEditorProps} props - Component properties.
 * @returns {JSX.Element} The editor controls.
 */
export const StyleEditor: React.FC<StyleEditorProps> = ({
  value,
  geometryKind,
  onChange,
  idPrefix = "layer-prop",
  exportBaseName = "style",
  historyResetKey = null,
  opacity,
  onOpacityChange,
}) => {
  const validationSeqRef = useRef<number>(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const validateAndSync = useCallback(
    async (contentToValidate: string) => {
      const seq = ++validationSeqRef.current;
      const validation = await validateStyleContent(
        contentToValidate,
        value.styleFormat,
        value.sldVersion
      );
      if (seq !== validationSeqRef.current) return;
      const currentKey = styleFormatOptionKey(value.styleFormat, value.sldVersion);
      if (validation.isValid) {
        onChangeRef.current({
          styleValidationError: null,
          formatCache: { [currentKey]: contentToValidate },
        });
      } else {
        onChangeRef.current({
          styleValidationError: validation.error ?? "Invalid style",
        });
      }
    },
    [value.styleFormat, value.sldVersion]
  );

  const {
    textareaRef: rawStyleTextareaRef,
    handleRawStyleChange,
    handleRawStyleKeyDown,
    handleRawStyleBlur,
    resetHistory: resetRawStyleHistory,
  } = useRawStyleTextEditorHistory({
    content: value.styleContent,
    onUpdateContent: (newContent) => {
      onChangeRef.current({ styleContent: newContent });
    },
    onValidateAndSync: validateAndSync,
  });

  const lastResetKeyRef = useRef<string | null | undefined>(undefined);
  if (historyResetKey !== lastResetKeyRef.current) {
    lastResetKeyRef.current = historyResetKey;
    if (historyResetKey && value.styleContent) {
      resetRawStyleHistory(value.styleContent);
    }
  }

  const selectedFormatOption = styleFormatOptionKey(value.styleFormat, value.sldVersion);

  const handleFormatOptionChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const patch = await computeStyleFormatSwitch(value, e.target.value, geometryKind);
      if (!patch) return;
      onChangeRef.current(patch);
      resetRawStyleHistory(patch.styleContent ?? "");
    },
    [value, geometryKind, resetRawStyleHistory]
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
          const formatKey = styleFormatOptionKey(loadedFormat, loadedVersion);
          onChangeRef.current({
            styleFormat: loadedFormat,
            sldVersion: loadedVersion,
            styleContent: loaded.content,
            styleValidationError:
              validation.isValid ? null : validation.error ?? "Invalid style",
            formatCache: {
              ...(value.formatCache || {}),
              [formatKey]: loaded.content,
            },
          });
          resetRawStyleHistory(loaded.content);
        }
      } catch (err: any) {
        onChangeRef.current({
          styleValidationError: err?.message || String(err),
        });
      }
    }
  }, [value.formatCache, resetRawStyleHistory]);

  const handleExportStyle = useCallback(async () => {
    if (window.electronAPI?.saveStyleFile) {
      const defaultExt = value.styleFormat === "sld" ? ".sld" : ".json";
      const defaultName = `${exportBaseName || "style"}${defaultExt}`;
      await window.electronAPI.saveStyleFile(
        {
          format: value.styleFormat,
          ...(value.styleFormat === "sld" ? { version: value.sldVersion } : {}),
          content: value.styleContent,
        },
        defaultName
      );
    }
  }, [value.styleFormat, value.sldVersion, value.styleContent, exportBaseName]);

  const handleResetStyle = useCallback(async () => {
    const patch = await computeDefaultStyleReset(value, geometryKind);
    onChangeRef.current(patch);
    if (patch.styleValidationError === null && patch.styleContent !== undefined) {
      resetRawStyleHistory(patch.styleContent);
    }
  }, [value, geometryKind, resetRawStyleHistory]);

  const previewOpacity = opacity ?? 1;

  return (
    <div
      className='style-editor'
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
            htmlFor={`${idPrefix}-styling-format`}
            style={{
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            {t("layer_properties_styling_format")}:
          </label>
          <select
            id={`${idPrefix}-styling-format`}
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
            id={`${idPrefix}-styling-load`}
            className='layer-properties-btn'
            onClick={handleLoadStyle}
            style={SECONDARY_BUTTON_STYLE}>
            {t("layer_properties_styling_load")}
          </button>
          <button
            type='button'
            id={`${idPrefix}-styling-export`}
            className='layer-properties-btn'
            onClick={handleExportStyle}
            style={SECONDARY_BUTTON_STYLE}>
            {t("layer_properties_styling_export")}
          </button>
          <button
            type='button'
            id={`${idPrefix}-styling-reset`}
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
          {/* Optional Layer Opacity */}
          {onOpacityChange && (
            <div
              className='layer-properties-row'
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}>
              <label
                htmlFor={`${idPrefix}-layer-opacity`}
                style={{
                  width: "11rem",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "#334155",
                }}>
                {t("layer_properties_styling_layer_opacity")}:
              </label>
              <input
                id={`${idPrefix}-layer-opacity`}
                className='layer-prop-layer-opacity'
                type='range'
                min='0'
                max='1'
                step='0.01'
                value={previewOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                style={{ flex: 1, cursor: "pointer" }}
              />
              <span
                style={{
                  width: "3.5rem",
                  textAlign: "right",
                  fontSize: "0.875rem",
                  color: "#475569",
                }}>
                {Math.round(previewOpacity * 100)}%
              </span>
            </div>
          )}

          {/* Mode 1: Simple Mode (Cartouche Symbology) */}
          {value.styleFormat === "cartouche" && (
            <SimpleModeEditor
              styleContent={value.styleContent}
              geometryKind={geometryKind}
              onChange={(newContent) => {
                onChangeRef.current({
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
          {value.styleFormat !== "cartouche" && (
            <div
              id={`${idPrefix}-external-mode-container`}
              className='layer-prop-external-mode-container'
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}>
              {/* Validation Feedback Banner */}
              {value.styleValidationError ?
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
                  {value.styleValidationError}
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
                  htmlFor={`${idPrefix}-styling-raw-style`}
                  style={{
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    color: "#334155",
                  }}>
                  {t("layer_properties_styling_raw_style")}
                </label>
                <textarea
                  ref={rawStyleTextareaRef}
                  id={`${idPrefix}-styling-raw-style`}
                  className='layer-prop-styling-raw-style'
                  value={value.styleContent}
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
          id={`${idPrefix}-preview-container`}
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
            content={value.styleContent}
            format={value.styleFormat}
            version={value.sldVersion}
            opacity={previewOpacity}
            geometryKind={geometryKind || "Unknown"}
          />
        </div>
      </div>
    </div>
  );
};

export default StyleEditor;
