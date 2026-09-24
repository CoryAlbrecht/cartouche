import React, { useState, useEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiClose,
  mdiPaletteOutline,
  mdiVectorTriangle,
  mdiPuzzleOutline,
  mdiCogOutline,
  mdiCheck,
} from "@mdi/js";
import {
  isPreferencesOpenSignal,
  preferencesMapSignal,
  activeCategorySignal,
  updatePreference,
  closePreferencesDialog,
} from "@renderer/state/preferencesSignals";
import type { PreferenceItem } from "@shared/types";

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

export const PreferencesDialog: React.FC = () => {
  useSignals();
  const [draftValues, setDraftValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isPreferencesOpenSignal.value) {
      // Initialize draft values from preferencesMapSignal
      const initial: Record<string, any> = {};
      for (const [key, item] of Object.entries(preferencesMapSignal.value)) {
        initial[key] = item.value;
      }
      setDraftValues(initial);
    }
  }, [isPreferencesOpenSignal.value, preferencesMapSignal.value]);

  if (!isPreferencesOpenSignal.value) {
    return null;
  }

  const activeCat = activeCategorySignal.value;
  const allPrefs = preferencesMapSignal.value;

  // Filter preferences for active category
  const categoryPrefs = Object.entries(allPrefs).filter(([_, item]) => {
    const itemCat = item.category || "general";
    return itemCat === activeCat;
  });

  const handleFieldChange = (key: string, newValue: any) => {
    setDraftValues((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleSave = async () => {
    for (const [key, value] of Object.entries(draftValues)) {
      if (allPrefs[key] && allPrefs[key].value !== value) {
        await updatePreference(key, value);
      }
    }
    closePreferencesDialog();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePreferencesDialog();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      className='preferences-modal-backdrop'
      onClick={closePreferencesDialog}
      onKeyDown={handleKeyDown}
      tabIndex={-1}>
      <div
        className='preferences-modal-container'
        onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className='preferences-modal-header'>
          <div className='preferences-modal-title'>
            <Icon
              path={mdiCogOutline}
              size='20px'
              className='preferences-title-icon'
            />
            <span>Preferences</span>
          </div>
          <button
            className='preferences-close-btn'
            onClick={closePreferencesDialog}
            title='Close (Esc)'
            aria-label='Close Preferences'>
            <Icon path={mdiClose} size='18px' />
          </button>
        </div>

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
                    draftValues[key] !== undefined ?
                      draftValues[key]
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
                        <div className='preference-item-key'>{key}</div>
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
                          <input
                            type='number'
                            step='any'
                            value={
                              currentValue !== undefined ? currentValue : ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className='preference-input-number'
                          />
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

        {/* Modal Footer Actions */}
        <div className='preferences-modal-footer'>
          <div className='preferences-shortcut-hint'>
            Press Esc to cancel, Ctrl+Enter to save
          </div>
          <div className='preferences-footer-buttons'>
            <button
              className='preferences-btn preferences-btn-secondary'
              onClick={closePreferencesDialog}>
              Cancel
            </button>
            <button
              className='preferences-btn preferences-btn-primary'
              onClick={handleSave}>
              <Icon path={mdiCheck} size='16px' />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
