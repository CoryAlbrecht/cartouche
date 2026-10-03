/**
 * @file PreferencesDialog.tsx
 * @module renderer/workbench/dialogs/PreferencesDialog
 * @description Preferences dialog component for editing UI styling, toolbar icons, rendering thresholds, and plugin options with debounced automatic saving.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link preferencesMapSignal}
 */

import React, { useEffect, useRef, useCallback } from "react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
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
} from "@renderer/state/preferencesSignals";
import { Dialog } from "./Dialog";
import type { PreferenceItem } from "@shared/types";

/**
 * @typedef {Object} CategoryTab
 * @property {string} id - Category tab unique ID.
 * @property {string} label - Category tab user display label.
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

/**
 * @component PreferencesDialog
 * @description Renders the tabbed application preferences dialog in a detached window portal, automatically saving user settings after a configurable debounced idle delay.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-02
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
      console.error("[PreferencesDialog] Error auto-saving preferences:", err);
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

  // Filter preferences for active category, excluding hidden items
  const categoryPrefs = Object.entries(allPrefs).filter(([_, item]) => {
    if (item.hidden) return false;
    const itemCat = item.category || "general";
    return itemCat === activeCat;
  });

  /**
   * @description Handles control input changes by updating local draft signal and resetting debounced autosave timer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-30
   * @updated 2026-09-30
   * @since 0.1.0-dev
   * @param {string} key - Preference descriptor key.
   * @param {any} newValue - Modified preference value.
   * @returns {void}
   */
  const handleFieldChange = (key: string, newValue: any) => {
    draftPreferencesSignal.value = {
      ...draftPreferencesSignal.value,
      [key]: newValue,
    };

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
   * @description Keyboard event listener handling dialog Escape dismissal and flushing pending autosave edits.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-30
   * @since 0.1.0-dev
   * @param {React.KeyboardEvent} e - Keyboard event object.
   * @returns {void}
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (Object.keys(pendingChangesRef.current).length > 0) {
        executeAutosave().then(() => closePreferencesDialog());
      } else {
        closePreferencesDialog();
      }
    }
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

  let windowFeatures = `width=${savedW},height=${savedH}`;
  if (savedX >= 0 && savedY >= 0) {
    windowFeatures += `,left=${savedX},top=${savedY}`;
  }

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
      defaultWidth={savedW}
      defaultHeight={savedH}
      x={savedX}
      y={savedY}
      footer={
        <div className='preferences-status-indicator'>
          {saveStatus === "editing" && (
            <Icon
              path={mdiFileEditOutline}
              size='20px'
              title='Changes pending auto-save...'
              style={{ color: "#64748b" }}
            />
          )}
          {saveStatus === "saving" && (
            <Icon
              path={isSyncIcon ? mdiSync : mdiCached}
              size='20px'
              title='Auto-saving changes...'
              style={{ color: "#1b446c" }}
            />
          )}
        </div>
      }>
      <div
        className='preferences-modal-container'
        onKeyDown={handleKeyDown}
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
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`preferences-tab-btn ${activeCat === cat.id ? "active" : ""}`}
                onClick={() => {
                  activeCategorySignal.value = cat.id;
                }}>
                <Icon path={cat.icon} size='18px' />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Right Form Fields */}
          <div className='preferences-content'>
            <div className='preferences-section-title'>
              {categories.find((c) => c.id === activeCat)?.label
                || "General Preferences"}
            </div>

            {categoryPrefs.length === 0 ?
              <div className='preferences-empty-state'>
                No configurable options found in this category.
              </div>
            : <div className='preferences-form-group'>
                {categoryPrefs.map(([key, item]: [string, PreferenceItem]) => {
                  const currentValue =
                    draftPreferencesSignal.value[key] !== undefined ?
                      draftPreferencesSignal.value[key]
                    : item.value;

                  return (
                    <div key={key} className='preference-item-row'>
                      <div className='preference-item-info'>
                        <div className='preference-item-name'>
                          {item.displayName}
                        </div>
                        {item.description && (
                          <div className='preference-item-desc'>
                            {item.description}
                          </div>
                        )}
                      </div>

                      <div className='preference-item-control'>
                        {item.type === "boolean" ?
                          <label className='preference-checkbox-label'>
                            <input
                              type='checkbox'
                              checked={!!currentValue}
                              onChange={(e) =>
                                handleFieldChange(key, e.target.checked)
                              }
                              className='preference-checkbox'
                            />
                            <span>{currentValue ? "Enabled" : "Disabled"}</span>
                          </label>
                        : item.type === "select" && item.options ?
                          <select
                            value={String(currentValue)}
                            onChange={(e) =>
                              handleFieldChange(key, e.target.value)
                            }
                            className='preference-select'>
                            {item.options.map((opt) => (
                              <option
                                key={String(opt.value)}
                                value={String(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        : item.type === "number" ?
                          <div className='preference-number-wrapper'>
                            <input
                              type='number'
                              min={item.minimum}
                              max={item.maximum}
                              step={item.step !== undefined ? item.step : "any"}
                              value={
                                currentValue !== undefined ? currentValue : ""
                              }
                              onChange={(e) => {
                                let val = parseFloat(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (
                                  item.minimum !== undefined
                                  && val < item.minimum
                                )
                                  val = item.minimum;
                                if (
                                  item.maximum !== undefined
                                  && val > item.maximum
                                )
                                  val = item.maximum;
                                handleFieldChange(key, val);
                              }}
                              className='preference-input-number'
                            />
                            {item.unit && (
                              <span className='preference-unit-badge'>
                                {item.unit}
                              </span>
                            )}
                          </div>
                        : <input
                            type='text'
                            value={
                              currentValue !== undefined ? currentValue : ""
                            }
                            onChange={(e) =>
                              handleFieldChange(key, e.target.value)
                            }
                            className='preference-input-text'
                          />
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>
      </div>
    </Dialog>
  );
};
