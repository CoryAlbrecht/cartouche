/**
 * @file PreferencesDialog.tsx
 * @module renderer/workbench/dialogs/PreferencesDialog
 * @description Preferences dialog component for editing UI styling, toolbar icons, rendering thresholds, and plugin options with debounced automatic saving.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link preferencesMapSignal}
 */

import React, { useEffect, useRef, useCallback } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiPaletteOutline,
  mdiVectorTriangle,
  mdiPuzzleOutline,
  mdiCogOutline,
  mdiFileEditOutline,
  mdiSync,
  mdiCached,
} from "@mdi/js";
import {
  isPreferencesOpenSignal,
  preferencesMapSignal,
  activeCategorySignal,
  updatePreference,
  closePreferencesDialog,
  cancelPreferencesEdits,
} from "@renderer/state/preferencesSignals";
import { t } from "@renderer/state/i18nSignals";
import { Dialog } from "./Dialog";
import type { PreferenceItem, PreferenceControlType } from "@shared/types";
import { logging } from "../../../shared/logging";

/**
 * @typedef {Object} CategoryTab
 * @property {string} id - Category tab unique ID.
 * @property {string} label - Category tab user display label fallback.
 * @property {string} icon - MDI SVG icon path definition.
 */
interface CategoryTab {
  id: string;
  label: string;
  icon: string;
}

const categories: CategoryTab[] = [
  { id: "general", label: "General", icon: mdiCogOutline },
  { id: "ui", label: "UI & Display", icon: mdiPaletteOutline },
  { id: "rendering", label: "Rendering", icon: mdiVectorTriangle },
  { id: "plugins", label: "Plugins & Extensions", icon: mdiPuzzleOutline },
];

const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: "#000000",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#d946ef",
  cyan: "#06b6d4",
  white: "#ffffff",
  gray: "#64748b",
  grey: "#64748b",
};

/**
 * @description Converts a named ANSI/CSS color or loose hex string into a valid 6-digit HTML hex color string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {any} val - Input color value.
 * @returns {string} Normalized #rrggbb hex color string.
 */
function toHexColor(val: any): string {
  if (!val || typeof val !== "string") return "#000000";
  const trimmed = val.trim().toLowerCase();
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 4) {
      return (
        "#" +
        trimmed[1] +
        trimmed[1] +
        trimmed[2] +
        trimmed[2] +
        trimmed[3] +
        trimmed[3]
      );
    }
    if (trimmed.length === 7) {
      return trimmed;
    }
  }
  return COLOR_NAME_TO_HEX[trimmed] || "#000000";
}

/**
 * @description Normalizes legacy type definition or controls array into a canonical list of control variants.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {PreferenceItem} item - Preference item definition.
 * @returns {PreferenceControlType[]} Canonical list of control types to render.
 */
function resolveControls(item: PreferenceItem): PreferenceControlType[] {
  if (item.controls && item.controls.length > 0) {
    return item.controls;
  }
  if (item.type === "boolean") return ["checkbox"];
  if (item.type === "select") return ["dropdown"];
  if (item.type === "number") return ["spinner"];
  return ["text"];
}

/**
 * @description Validates text input value against preference format regex pattern specifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {string} value - User-entered text value.
 * @param {string[]} [patterns] - Optional array of regular expression strings.
 * @returns {boolean} True if patterns are empty or if at least one regex pattern matches the value.
 */
function validateTextPattern(value: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => {
    try {
      return new RegExp(p).test(value);
    } catch {
      return false;
    }
  });
}

/**
 * @component PreferencesDialog
 * @description Renders the tabbed application preferences dialog in a detached window portal, automatically saving user settings after a configurable debounced idle delay.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Rendered detached portal preferences dialog or null if closed.
 */
export const PreferencesDialog: React.FC = () => {
  useSignals();
  /**
   * @signal draftPreferencesSignal
   * @description Local reactive signal holding draft preference values before debounced auto-save flushing.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-10-01
   * @since 0.1.0-dev
   * @type {Signal<Record<string, any>>}
   */
  const draftPreferencesSignal = useSignal<Record<string, any>>({});
  const saveStatusSignal = useSignal<"idle" | "editing" | "saving">("idle");
  const isSyncIconSignal = useSignal<boolean>(true);

  const saveStatus = saveStatusSignal.value;
  const isSyncIcon = isSyncIconSignal.value;

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<Record<string, any>>({});

  const allPrefs = preferencesMapSignal.value;

  /**
   * @description Flushes pending preference edits to Main Process store via IPC and manages save icon animation states.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-30
   * @updated 2026-10-02
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const executeAutosave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const changes = { ...pendingChangesRef.current };
    if (Object.keys(changes).length === 0) {
      saveStatusSignal.value = "idle";
      return;
    }

    saveStatusSignal.value = "saving";

    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
    }
    animIntervalRef.current = setInterval(() => {
      isSyncIconSignal.value = !isSyncIconSignal.value;
    }, 180);

    try {
      for (const [key, value] of Object.entries(changes)) {
        if (allPrefs[key] && allPrefs[key].value !== value) {
          await updatePreference(key, value);
          delete pendingChangesRef.current[key];
        }
      }
    } catch (err) {
      logging.error('Failed to auto-save preferences', err, { scope: 'PreferencesDialog' });
    } finally {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
      saveStatusSignal.value = "idle";
    }
  }, [allPrefs]);

  useEffect(() => {
    if (isPreferencesOpenSignal.value) {
      const initial: Record<string, any> = {};
      for (const [key, item] of Object.entries(allPrefs)) {
        initial[key] = item.value;
      }
      draftPreferencesSignal.value = initial;
      pendingChangesRef.current = {};
      saveStatusSignal.value = "idle";
    }
  }, [isPreferencesOpenSignal.value]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
      // Flush any remaining un-saved changes on unmount
      const remaining = { ...pendingChangesRef.current };
      if (Object.keys(remaining).length > 0) {
        pendingChangesRef.current = {};
        for (const [k, v] of Object.entries(remaining)) {
          updatePreference(k, v);
        }
      }
    };
  }, []);

  if (!isPreferencesOpenSignal.value) {
    return null;
  }

  const activeCat =
    activeCategorySignal.value || categories[0]?.id || "general";

  /**
   * @description Handles control input changes by updating local draft signal and resetting debounced autosave timer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-30
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {string} key - Preference descriptor key.
   * @param {any} newValue - Modified preference value.
   * @param {boolean} [isValid=true] - Format validity flag; suppresses autosave if false.
   * @returns {void}
   */
  const handleFieldChange = (key: string, newValue: any, isValid = true) => {
    draftPreferencesSignal.value = {
      ...draftPreferencesSignal.value,
      [key]: newValue,
    };

    if (!isValid) {
      return;
    }

    const targetItem = allPrefs[key];
    if (targetItem?.signal) {
      targetItem.signal.value = newValue;
    }

    pendingChangesRef.current[key] = newValue;
    saveStatusSignal.value = "editing";

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const timeoutSec =
      typeof allPrefs["general.autosave.preferences"]?.value === "number" ?
        allPrefs["general.autosave.preferences"].value
      : 5;
    const timeoutMs = Math.max(1, timeoutSec) * 1000;

    saveTimerRef.current = setTimeout(() => {
      executeAutosave();
    }, timeoutMs);
  };

  /**
   * @description Cancels pending preference edits, discarding unsaved state, clearing timers, and closing dialog.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleCancel = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingChangesRef.current = {};
    draftPreferencesSignal.value = {};
    saveStatusSignal.value = "idle";
    cancelPreferencesEdits();
  };

  const savedW =
    typeof allPrefs["ui.preferencesDialog.location.width"]?.value === "number" ?
      allPrefs["ui.preferencesDialog.location.width"].value
    : 720;
  const savedH =
    (
      typeof allPrefs["ui.preferencesDialog.location.height"]?.value
      === "number"
    ) ?
      allPrefs["ui.preferencesDialog.location.height"].value
    : 520;
  const savedX =
    typeof allPrefs["ui.preferencesDialog.location.x"]?.value === "number" ?
      allPrefs["ui.preferencesDialog.location.x"].value
    : -1;
  const savedY =
    typeof allPrefs["ui.preferencesDialog.location.y"]?.value === "number" ?
      allPrefs["ui.preferencesDialog.location.y"].value
    : -1;

  // Filter preferences for active category, excluding hidden items
  const visibleEntries = Object.entries(allPrefs).filter(([_, item]) => {
    if (item.hidden) return false;
    const itemCat = item.category || "general";
    return itemCat === activeCat;
  });

  /**
   * @typedef {Object} PreferenceGroupData
   * @property {string} key - Identifier for the preference group.
   * @property {number} minGroupOrder - Minimum group display order index.
   * @property {Array<{ key: string; item: PreferenceItem; displayName: string; description: string }>} items - Group items.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   */
  interface PreferenceGroupData {
    key: string;
    minGroupOrder: number;
    items: Array<{
      key: string;
      item: PreferenceItem;
      displayName: string;
      description: string;
    }>;
  }

  const groupMap = new Map<string, PreferenceGroupData>();

  for (const [key, item] of visibleEntries) {
    const groupKey = item.group?.trim() || "";
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        minGroupOrder: Infinity,
        items: [],
      });
    }

    const gData = groupMap.get(groupKey)!;
    if (item.groupOrder !== undefined && item.groupOrder < gData.minGroupOrder) {
      gData.minGroupOrder = item.groupOrder;
    }

    const i18nId = item.i18nId || `prefs_${key.replace(/\./g, "_")}`;
    const translatedName = t(i18nId);
    const displayName =
      translatedName !== i18nId ? translatedName : (item.displayName || key);

    const descKey = `${i18nId}_descr`;
    const translatedDesc = t(descKey);
    const description =
      translatedDesc !== descKey ? translatedDesc : (item.description || "");

    gData.items.push({ key, item, displayName, description });
  }

  // Sort items within each group by order ascending, then by displayName
  for (const group of groupMap.values()) {
    group.items.sort((a, b) => {
      const orderA = a.item.order ?? 0;
      const orderB = b.item.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  const namedGroups: PreferenceGroupData[] = [];
  let ungroupedGroup: PreferenceGroupData | null = null;

  for (const [gKey, gData] of groupMap.entries()) {
    if (gKey === "") {
      ungroupedGroup = gData;
    } else {
      namedGroups.push(gData);
    }
  }

  namedGroups.sort((a, b) => {
    if (a.minGroupOrder !== b.minGroupOrder) {
      return a.minGroupOrder - b.minGroupOrder;
    }
    return a.key.localeCompare(b.key);
  });

  const orderedGroups = namedGroups;

  const activeCategoryObj = categories.find((c) => c.id === activeCat);
  const activeTabI18nKey = `prefs_tab_${activeCat}_name`;
  const activeTabTranslated = t(activeTabI18nKey);
  const sectionTitle =
    activeTabTranslated !== activeTabI18nKey ? activeTabTranslated : (
      activeCategoryObj?.label || "General Preferences"
    );

  /**
   * @description Resolves the localized display header for a named preference group.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {string} groupKey - Group string identifier.
   * @returns {string} Localized or formatted group title string.
   */
  const resolveGroupTitle = (groupKey: string): string => {
    const i18nGroupKey = `prefs_group_${groupKey}`;
    const translated = t(i18nGroupKey);
    if (translated !== i18nGroupKey) {
      return translated;
    }
    const fallbackDirect = t(groupKey);
    if (fallbackDirect !== groupKey) {
      return fallbackDirect;
    }
    return groupKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  /**
   * @description Renders a specific control variant for a given preference row.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {PreferenceControlType} ctrlType - Canonical control type.
   * @param {string} key - Preference descriptor key.
   * @param {PreferenceItem} item - Preference item definition.
   * @param {any} currentValue - Currently active draft or saved value.
   * @returns {React.ReactNode}
   */
  const renderControl = (
    ctrlType: PreferenceControlType,
    key: string,
    item: PreferenceItem,
    currentValue: any
  ): React.ReactNode => {
    switch (ctrlType) {
      case "text": {
        const isValid = validateTextPattern(
          String(currentValue ?? ""),
          item.patterns
        );
        return (
          <input
            key={`${key}-text`}
            type='text'
            value={currentValue !== undefined ? currentValue : ""}
            onChange={(e) => {
              const val = e.target.value;
              const valid = validateTextPattern(val, item.patterns);
              handleFieldChange(key, val, valid);
            }}
            className={`preference-input-text ${!isValid ? "preference-input-invalid" : ""}`}
            title={
              !isValid ? "Value does not match required format" : undefined
            }
          />
        );
      }
      case "multiline-text": {
        return (
          <textarea
            key={`${key}-multiline`}
            rows={3}
            value={currentValue !== undefined ? currentValue : ""}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            className='preference-textarea'
          />
        );
      }
      case "colour":
      case "color": {
        return (
          <label
            key={`${key}-color`}
            className='preference-color-button-wrapper'
            title='Pick colour'>
            <span
              className='preference-color-swatch'
              style={{ backgroundColor: toHexColor(currentValue) }}
            />
            <input
              type='color'
              className='preference-hidden-color-input'
              value={toHexColor(currentValue)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
            />
          </label>
        );
      }
      case "checkbox": {
        return (
          <label key={`${key}-checkbox`} className='preference-checkbox-label'>
            <input
              type='checkbox'
              checked={!!currentValue}
              onChange={(e) => handleFieldChange(key, e.target.checked)}
              className='preference-checkbox'
            />
            <span>{currentValue ? "Enabled" : "Disabled"}</span>
          </label>
        );
      }
      case "button": {
        return (
          <button
            key={`${key}-btn`}
            type='button'
            className={`preference-btn-toggle ${currentValue ? "active" : ""}`}
            onClick={() => handleFieldChange(key, !currentValue)}>
            {currentValue ? "Enabled" : "Disabled"}
          </button>
        );
      }
      case "toggle": {
        return (
          <button
            key={`${key}-toggle`}
            type='button'
            role='switch'
            aria-checked={!!currentValue}
            className={`preference-switch-toggle ${currentValue ? "active" : ""}`}
            onClick={() => handleFieldChange(key, !currentValue)}>
            <span className='preference-switch-track'>
              <span className='preference-switch-thumb' />
            </span>
          </button>
        );
      }
      case "range": {
        const min = item.minimum ?? 0;
        const max = item.maximum ?? 100;
        const step = item.step ?? 1;
        const val = currentValue !== undefined ? Number(currentValue) : min;
        return (
          <div key={`${key}-range`} className='preference-range-wrapper'>
            <input
              type='range'
              min={min}
              max={max}
              step={step}
              value={val}
              onChange={(e) =>
                handleFieldChange(key, parseFloat(e.target.value))
              }
              className='preference-range-slider'
            />
            <span className='preference-range-value'>
              {val}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
          </div>
        );
      }
      case "spinner": {
        return (
          <div key={`${key}-spinner`} className='preference-number-wrapper'>
            <input
              type='number'
              min={item.minimum}
              max={item.maximum}
              step={item.step !== undefined ? item.step : "any"}
              value={currentValue !== undefined ? currentValue : ""}
              onChange={(e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                if (item.minimum !== undefined && val < item.minimum)
                  val = item.minimum;
                if (item.maximum !== undefined && val > item.maximum)
                  val = item.maximum;
                handleFieldChange(key, val);
              }}
              className='preference-input-number'
            />
            {item.unit && (
              <span className='preference-unit-badge'>{item.unit}</span>
            )}
          </div>
        );
      }
      case "slider": {
        const opts = item.options || [];
        const currIdx = Math.max(
          0,
          opts.findIndex((o) => String(o.value) === String(currentValue))
        );
        return (
          <div
            key={`${key}-slider`}
            className='preference-slider-discrete-wrapper'>
            <input
              type='range'
              min={0}
              max={Math.max(0, opts.length - 1)}
              step={1}
              value={currIdx}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (opts[idx]) handleFieldChange(key, opts[idx].value);
              }}
              className='preference-range-slider'
            />
            <span className='preference-slider-label'>
              {opts[currIdx]?.label || String(currentValue)}
            </span>
          </div>
        );
      }
      case "dropdown": {
        return (
          <select
            key={`${key}-dropdown`}
            value={String(currentValue)}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            className='preference-select'>
            {(item.options || []).map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case "image": {
        return (
          <button
            key={`${key}-image`}
            type='button'
            className='preference-image-picker-btn'
            onClick={async () => {
              if (window.electronAPI?.openFiles) {
                const paths = await window.electronAPI.openFiles({
                  title: "Select Image",
                  filters: [
                    {
                      name: "Images",
                      extensions: ["png", "jpg", "jpeg", "svg", "webp"],
                    },
                  ],
                  multiSelections: false,
                });
                if (paths && paths[0]) {
                  handleFieldChange(key, paths[0]);
                }
              }
            }}>
            {currentValue ?
              <img
                src={String(currentValue)}
                alt='Preview'
                className='preference-image-thumb'
              />
            : <span className='preference-image-empty'>Choose Image...</span>}
          </button>
        );
      }
      case "radio-button": {
        return (
          <div key={`${key}-radio`} className='preference-radio-group'>
            {(item.options || []).map((opt) => (
              <label key={String(opt.value)} className='preference-radio-label'>
                <input
                  type='radio'
                  name={`pref_${key}`}
                  value={String(opt.value)}
                  checked={String(currentValue) === String(opt.value)}
                  onChange={() => handleFieldChange(key, opt.value)}
                  className='preference-radio'
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );
      }
      case "button-group": {
        return (
          <div key={`${key}-btngroup`} className='preference-button-group'>
            {(item.options || []).map((opt) => (
              <button
                key={String(opt.value)}
                type='button'
                className={`preference-btn-group-item ${
                  String(currentValue) === String(opt.value) ? "active" : ""
                }`}
                onClick={() => handleFieldChange(key, opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        );
      }
      case "checkbox-group": {
        const selectedSet = new Set(
          Array.isArray(currentValue) ? currentValue : [currentValue]
        );
        return (
          <div key={`${key}-chkgroup`} className='preference-checkbox-group'>
            {(item.options || []).map((opt) => (
              <label
                key={String(opt.value)}
                className='preference-checkbox-label'>
                <input
                  type='checkbox'
                  checked={selectedSet.has(opt.value)}
                  onChange={(e) => {
                    const next = new Set(selectedSet);
                    if (e.target.checked) next.add(opt.value);
                    else next.delete(opt.value);
                    handleFieldChange(key, Array.from(next));
                  }}
                  className='preference-checkbox'
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  /**
   * @description Renders a single preference item row inside a group container.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {Object} entry - Preference row entry data.
   * @returns {React.ReactNode}
   */
  const renderItemRow = ({
    key,
    item,
    displayName,
    description,
  }: {
    key: string;
    item: PreferenceItem;
    displayName: string;
    description: string;
  }): React.ReactNode => {
    const currentValue =
      draftPreferencesSignal.value[key] !== undefined ?
        draftPreferencesSignal.value[key]
      : item.value;

    const controlsToRender = resolveControls(item);

    return (
      <div key={key} className='preference-item-row'>
        <div className='preference-item-info'>
          <span
            className='preference-item-name'
            title={description || undefined}>
            {displayName}
          </span>
        </div>

        <div className='preference-item-control'>
          {controlsToRender.map((ctrl) =>
            renderControl(ctrl, key, item, currentValue)
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      name='preferencesWindow'
      title='Preferences'
      icon={mdiCogOutline}
      isOpen={isPreferencesOpenSignal.value}
      onClose={() => {
        if (Object.keys(pendingChangesRef.current).length > 0) {
          executeAutosave().then(() => closePreferencesDialog());
        } else {
          closePreferencesDialog();
        }
      }}
      onCancel={handleCancel}
      defaultWidth={savedW}
      defaultHeight={savedH}
      x={savedX}
      y={savedY}
      footer={
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <div className='preferences-status-indicator'>
            {saveStatus === "editing" && (
              <Icon
                path={mdiFileEditOutline}
                size='1.25em'
                title='Changes pending auto-save...'
                style={{ color: "#64748b" }}
              />
            )}
            {saveStatus === "saving" && (
              <Icon
                path={isSyncIcon ? mdiSync : mdiCached}
                size='1.25em'
                title='Auto-saving changes...'
                style={{ color: "#1b446c" }}
              />
            )}
          </div>
          <button
            type='button'
            className='preferences-cancel-btn'
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
            Cancel
          </button>
        </div>
      }>
      <div
        className='preferences-modal-container'
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          height: "100%",
          overflow: "hidden",
        }}>
        {/* Modal Body: Left Sidebar + Right Content */}
        <div className='preferences-modal-body'>
          {/* Left Category Navigation */}
          <div className='preferences-sidebar'>
            <div className='preferences-sidebar-title'>Categories</div>
            {categories.map((cat) => {
              const tabI18nKey = `prefs_tab_${cat.id}_name`;
              const tabTranslated = t(tabI18nKey);
              const tabLabel =
                tabTranslated !== tabI18nKey ? tabTranslated : cat.label;
              return (
                <button
                  key={cat.id}
                  className={`preferences-tab-btn ${activeCat === cat.id ? "active" : ""}`}
                  onClick={() => {
                    activeCategorySignal.value = cat.id;
                  }}>
                  <Icon path={cat.icon} size='1.125em' />
                  <span>{tabLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Right Form Fields */}
          <div className='preferences-content'>
            <div className='preferences-section-title'>{sectionTitle}</div>

            {visibleEntries.length === 0 ?
              <div className='preferences-empty-state'>
                No configurable options found in this category.
              </div>
            : <div className='preferences-form-group'>
                {/* Render Named Groups in order */}
                {orderedGroups.map((group) => (
                  <fieldset key={group.key} className='preference-group-box'>
                    <legend className='preference-group-legend'>
                      {resolveGroupTitle(group.key)}
                    </legend>
                    {group.items.map((row) => renderItemRow(row))}
                  </fieldset>
                ))}

                {/* Render Ungrouped Items in an unlabelled box below named groups */}
                {ungroupedGroup && ungroupedGroup.items.length > 0 && (
                  <div
                    key='_ungrouped'
                    className='preference-group-box ungrouped'>
                    {ungroupedGroup.items.map((row) => renderItemRow(row))}
                  </div>
                )}
              </div>
            }
          </div>
        </div>
      </div>
    </Dialog>
  );
};
