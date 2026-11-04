/**
 * @file SimpleModeEditor.tsx
 * @module renderer/workbench/dialogs/SimpleModeEditor
 * @description Visual component stack manager and dynamic Style Options panel for Simple Cartouche Symbology mode in LayerPropertiesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link SimpleModeEditor}
 * @see {@link SimpleCartoucheStyle}
 * @see {@link StyleComponent}
 * @see {@link ColorInput}
 * @see {@link DASH_PATTERN_PRESETS}
 * @see {@link matchDashPattern}
 */

import React, { useState, useMemo, useCallback } from "react";
import Icon from "@renderer/components/common/Icon";
import { ColorInput, CssColorsDatalist } from "@renderer/components/common/ColorInput";
import {
  mdiPlus,
  mdiMinus,
  mdiArrowUp,
  mdiArrowDown,
  mdiContentCopy,
  mdiLockOutline,
  mdiLockOpenVariantOutline,
} from "@mdi/js";
import { dictionarySignal } from "@renderer/state/i18nSignals";
import {
  createDefaultCartoucheLayerStyle,
} from "@shared/styles/defaultLayerStyles";
import {
  DASH_PATTERN_PRESETS,
  matchDashPattern,
} from "@shared/types/styling";
import type {
  SimpleCartoucheStyle,
  StyleComponent,
  SimpleFillComponent,
  SimpleLineComponent,
  SimpleMarkerComponent,
  DashPatternPreset,
} from "@shared/types/styling";

/**
 * @typedef {Object} SimpleModeEditorProps
 * @property {string} styleContent - JSON serialized Cartouche Symbology specification string.
 * @property {string} [geometryKind='Unknown'] - Target layer geometry kind for filtering available symbolizer types.
 * @property {(newContent: string) => void} onChange - Callback invoked when the component stack or component options are modified.
 */
export interface SimpleModeEditorProps {
  styleContent: string;
  geometryKind?: string;
  onChange: (newContent: string) => void;
}

/**
 * Maximum allowed components in a Simple Cartouche Symbology stack.
 *
 * @constant {number} MAX_COMPONENTS
 * @description Hard cap enforcing a maximum of 32 symbolizer components in a single layer style stack.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
const MAX_COMPONENTS = 32;

/**
 * @description Standard CSS style applied to compact icon action buttons in the component stack grid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
const BUTTON_STYLE: React.CSSProperties = {
  padding: "0.25rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "0.25rem",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  color: "#1e293b",
  lineHeight: 0,
};

/**
 * @description Standard CSS style applied to disabled icon action buttons in the component stack grid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
const DISABLED_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  opacity: 0.5,
  cursor: "not-allowed",
  backgroundColor: "#f1f5f9",
};

/**
 * Helper to safely parse Cartouche Symbology JSON or fall back to default template.
 *
 * @function parseCartoucheStyleSafe
 * @description Parses style JSON string into a SimpleCartoucheStyle object.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {string} content - Serialized JSON string.
 * @param {string} [geometryKind] - Layer geometry kind.
 * @returns {SimpleCartoucheStyle} Parsed or generated style object.
 */
export function parseCartoucheStyleSafe(
  content: string,
  geometryKind?: string
): SimpleCartoucheStyle {
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (
        parsed &&
        parsed.format === "simple" &&
        Array.isArray(parsed.components)
      ) {
        return parsed as SimpleCartoucheStyle;
      }
    } catch {
      // Fallback below
    }
  }
  return createDefaultCartoucheLayerStyle(geometryKind);
}

/**
 * Visual component stack list and dynamic style options editor for Cartouche Symbology.
 *
 * @component SimpleModeEditor
 * @description Manages painter-order components rendered in reversed visual stack order with add, remove, reorder, duplicate, lock, and options editing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {SimpleModeEditorProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const SimpleModeEditor: React.FC<SimpleModeEditorProps> = ({
  styleContent,
  geometryKind = "Unknown",
  onChange,
}) => {
  const dict = dictionarySignal.value;
  const t = useCallback(
    (key: string): string => dict[key] ?? key,
    [dict]
  );

  const cartoucheStyle = useMemo(
    () => parseCartoucheStyleSafe(styleContent, geometryKind),
    [styleContent, geometryKind]
  );
  const components = cartoucheStyle.components;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDashRow, setSelectedDashRow] = useState<number | null>(null);

  // Active component resolution
  const activeComponent = useMemo(() => {
    if (selectedId) {
      const match = components.find((c) => c.id === selectedId);
      if (match) return match;
    }
    return components[components.length - 1] || null;
  }, [components, selectedId]);

  const activeId = activeComponent?.id || null;
  const activePainterIndex = activeComponent
    ? components.findIndex((c) => c.id === activeId)
    : -1;

  // Filter available component types based on layer geometry
  const availableTypes: Array<{ value: StyleComponent["type"]; label: string }> =
    useMemo(() => {
      const g = (geometryKind || "").toLowerCase();
      if (g.includes("line")) {
        return [
          {
            value: "simple-line",
            label: t("layer_properties_component_type_line"),
          },
        ];
      }
      if (g.includes("point")) {
        return [
          {
            value: "simple-marker",
            label: t("layer_properties_component_type_marker"),
          },
          {
            value: "simple-line",
            label: t("layer_properties_component_type_line"),
          },
        ];
      }
      return [
        {
          value: "simple-fill",
          label: t("layer_properties_component_type_fill"),
        },
        {
          value: "simple-line",
          label: t("layer_properties_component_type_line"),
        },
        {
          value: "simple-marker",
          label: t("layer_properties_component_type_marker"),
        },
      ];
    }, [geometryKind, t]);

  const [typeToAdd, setTypeToAdd] = useState<StyleComponent["type"]>(
    availableTypes[0]?.value || "simple-fill"
  );

  const commitComponents = useCallback(
    (newComponents: StyleComponent[]) => {
      const updated: SimpleCartoucheStyle = {
        format: "simple",
        version: 1,
        components: newComponents,
      };
      onChange(JSON.stringify(updated, null, 2));
    },
    [onChange]
  );

  // Visual order is reversed painter order (index components.length - 1 is top visual item)
  const visualComponents = useMemo(() => {
    return [...components].reverse();
  }, [components]);

  // Actions
  const canAdd = components.length < MAX_COMPONENTS;
  const canMoveUp =
    activePainterIndex >= 0 && activePainterIndex < components.length - 1;
  const canMoveDown = activePainterIndex > 0;
  const canRemove =
    activeComponent !== null &&
    !activeComponent.locked &&
    components.length > 1;
  const canDuplicate =
    activeComponent !== null && components.length < MAX_COMPONENTS;
  const canLock = activeComponent !== null;

  const handleMoveUp = useCallback(() => {
    if (!canMoveUp || activePainterIndex < 0) return;
    const next = [...components];
    const target = next[activePainterIndex];
    next[activePainterIndex] = next[activePainterIndex + 1];
    next[activePainterIndex + 1] = target;
    commitComponents(next);
  }, [canMoveUp, activePainterIndex, components, commitComponents]);

  const handleMoveDown = useCallback(() => {
    if (!canMoveDown || activePainterIndex <= 0) return;
    const next = [...components];
    const target = next[activePainterIndex];
    next[activePainterIndex] = next[activePainterIndex - 1];
    next[activePainterIndex - 1] = target;
    commitComponents(next);
  }, [canMoveDown, activePainterIndex, components, commitComponents]);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    const newId = `${typeToAdd}-${Date.now()}`;
    let newComp: StyleComponent;
    if (typeToAdd === "simple-fill") {
      newComp = {
        id: newId,
        type: "simple-fill",
        enabled: true,
        color: "#3b82f6",
      };
    } else if (typeToAdd === "simple-line") {
      newComp = {
        id: newId,
        type: "simple-line",
        enabled: true,
        color: "#000000",
        width: 2,
      };
    } else {
      newComp = {
        id: newId,
        type: "simple-marker",
        enabled: true,
        shape: "circle",
        radius: 6,
        fillColor: "#3b82f6",
        strokeColor: "#000000",
        strokeWidth: 1,
      };
    }
    const next = [...components, newComp];
    setSelectedId(newId);
    commitComponents(next);
  }, [canAdd, typeToAdd, components, commitComponents]);

  const handleRemove = useCallback(() => {
    if (!canRemove || !activeComponent) return;
    const next = components.filter((c) => c.id !== activeId);
    const nextSelected =
      next[Math.min(activePainterIndex, next.length - 1)]?.id || null;
    setSelectedId(nextSelected);
    commitComponents(next);
  }, [canRemove, activeComponent, components, activeId, activePainterIndex, commitComponents]);

  const handleDuplicate = useCallback(() => {
    if (!canDuplicate || !activeComponent) return;
    const newId = `${activeComponent.type}-${Date.now()}`;
    const clone: StyleComponent = {
      ...activeComponent,
      id: newId,
      locked: false,
    };
    const next = [...components];
    next.splice(activePainterIndex + 1, 0, clone);
    setSelectedId(newId);
    commitComponents(next);
  }, [canDuplicate, activeComponent, components, activePainterIndex, commitComponents]);

  const handleToggleLock = useCallback(() => {
    if (!canLock || !activeComponent) return;
    const next = components.map((c) =>
      c.id === activeId ? { ...c, locked: !c.locked } : c
    );
    commitComponents(next);
  }, [canLock, activeComponent, components, activeId, commitComponents]);

  const handleMorphType = useCallback(
    (newType: StyleComponent["type"]) => {
      if (!activeComponent || activeComponent.locked || activeComponent.type === newType) {
        return;
      }
      let morphed: StyleComponent;
      if (newType === "simple-fill") {
        const color =
          (activeComponent as SimpleFillComponent).color ||
          (activeComponent as SimpleMarkerComponent).fillColor ||
          "#3b82f6";
        morphed = {
          id: activeComponent.id,
          type: "simple-fill",
          enabled: activeComponent.enabled,
          locked: activeComponent.locked,
          color,
        };
      } else if (newType === "simple-line") {
        const color =
          (activeComponent as SimpleLineComponent).color ||
          (activeComponent as SimpleMarkerComponent).strokeColor ||
          "#000000";
        const width =
          (activeComponent as SimpleLineComponent).width ||
          (activeComponent as SimpleMarkerComponent).strokeWidth ||
          2;
        morphed = {
          id: activeComponent.id,
          type: "simple-line",
          enabled: activeComponent.enabled,
          locked: activeComponent.locked,
          color,
          width,
        };
      } else {
        const fillColor =
          (activeComponent as SimpleFillComponent).color ||
          (activeComponent as SimpleMarkerComponent).fillColor ||
          "#3b82f6";
        const strokeColor =
          (activeComponent as SimpleMarkerComponent).strokeColor || "#000000";
        const strokeWidth =
          (activeComponent as SimpleMarkerComponent).strokeWidth ||
          (activeComponent as SimpleLineComponent).width ||
          1;
        morphed = {
          id: activeComponent.id,
          type: "simple-marker",
          enabled: activeComponent.enabled,
          locked: activeComponent.locked,
          shape: "circle",
          radius: 6,
          fillColor,
          strokeColor,
          strokeWidth,
        };
      }
      const next = components.map((c) => (c.id === activeId ? morphed : c));
      commitComponents(next);
    },
    [activeComponent, activeId, components, commitComponents]
  );

  const updateActiveComponent = useCallback(
    (patch: Record<string, any>) => {
      if (!activeComponent || activeComponent.locked) return;
      const next = components.map((c) =>
        c.id === activeId ? ({ ...c, ...patch } as StyleComponent) : c
      );
      commitComponents(next);
    },
    [activeComponent, activeId, components, commitComponents]
  );

  const getComponentTypeLabel = (type: StyleComponent["type"]): string => {
    switch (type) {
      case "simple-fill":
        return t("layer_properties_component_type_fill");
      case "simple-line":
        return t("layer_properties_component_type_line");
      case "simple-marker":
        return t("layer_properties_component_type_marker");
    }
  };

  return (
    <div
      id='layer-prop-simple-mode-container'
      className='layer-prop-simple-mode-container'
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}>
      {/* Visual Component Stack Section */}
      <fieldset
        className='preference-group-box'
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: "0.25rem",
          padding: "0.75rem",
          backgroundColor: "#ffffff",
        }}>
        <legend
          className='preference-group-legend'
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "#1e293b",
            padding: "0 0.25rem",
          }}>
          {t("layer_properties_component_stack")}
        </legend>

        {/* Component Stack List & Actions Container */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}>
          {/* Visual Component Stack List */}
          <div
            id='layer-prop-component-stack-list'
            className='layer-prop-component-stack-list'
            style={{
              flex: 1,
              minWidth: 0,
              border: "1px solid #cbd5e1",
              borderRadius: "0.25rem",
              backgroundColor: "#f8fafc",
              minHeight: "12rem",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}>
            {visualComponents.map((comp) => {
              const isSelected = comp.id === activeId;
              return (
                <div
                  key={comp.id}
                  data-component-id={comp.id}
                  className={`layer-prop-component-item ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedId(comp.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.375rem 0.625rem",
                    gap: "0.5rem",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                    borderLeft: isSelected ? "3px solid #0284c7" : "3px solid transparent",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "0.8125rem",
                    color: "#0f172a",
                  }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.75rem",
                      height: "0.75rem",
                      borderRadius: comp.type === "simple-marker" ? "50%" : "2px",
                      backgroundColor:
                        (comp as any).color || (comp as any).fillColor || "#000000",
                      border: "1px solid #94a3b8",
                    }}
                  />
                  <span style={{ fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                    {getComponentTypeLabel(comp.type)}
                  </span>
                  {comp.locked && (
                    <span title={t("layer_properties_component_locked_notice")}>
                      <Icon path={mdiLockOutline} size='14px' color='#64748b' />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2-Column Action Buttons Grid */}
          <div
            id='layer-prop-component-actions'
            className='layer-prop-component-actions'
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, auto)",
              gap: "0.375rem",
              alignItems: "center",
            }}>
            <button
              type='button'
              id='layer-prop-component-add'
              className='layer-prop-component-btn add'
              title={t("layer_properties_component_add")}
              aria-label={t("layer_properties_component_add")}
              disabled={!canAdd}
              onClick={handleAdd}
              style={canAdd ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon path={mdiPlus} />
            </button>
            <button
              type='button'
              id='layer-prop-component-remove'
              className='layer-prop-component-btn remove'
              title={t("layer_properties_component_remove")}
              aria-label={t("layer_properties_component_remove")}
              disabled={!canRemove}
              onClick={handleRemove}
              style={canRemove ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon path={mdiMinus} />
            </button>
            <button
              type='button'
              id='layer-prop-component-move-up'
              className='layer-prop-component-btn move-up'
              title={t("layer_properties_component_move_up")}
              aria-label={t("layer_properties_component_move_up")}
              disabled={!canMoveUp}
              onClick={handleMoveUp}
              style={canMoveUp ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon path={mdiArrowUp} />
            </button>
            <button
              type='button'
              id='layer-prop-component-move-down'
              className='layer-prop-component-btn move-down'
              title={t("layer_properties_component_move_down")}
              aria-label={t("layer_properties_component_move_down")}
              disabled={!canMoveDown}
              onClick={handleMoveDown}
              style={canMoveDown ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon path={mdiArrowDown} />
            </button>
            <button
              type='button'
              id='layer-prop-component-duplicate'
              className='layer-prop-component-btn duplicate'
              title={t("layer_properties_component_duplicate")}
              aria-label={t("layer_properties_component_duplicate")}
              disabled={!canDuplicate}
              onClick={handleDuplicate}
              style={canDuplicate ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon path={mdiContentCopy} />
            </button>
            <button
              type='button'
              id='layer-prop-component-lock'
              className='layer-prop-component-btn lock'
              title={
                activeComponent?.locked
                  ? t("layer_properties_component_unlock")
                  : t("layer_properties_component_lock")
              }
              aria-label={
                activeComponent?.locked
                  ? t("layer_properties_component_unlock")
                  : t("layer_properties_component_lock")
              }
              disabled={!canLock}
              onClick={handleToggleLock}
              style={canLock ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
              <Icon
                path={
                  activeComponent?.locked
                    ? mdiLockOutline
                    : mdiLockOpenVariantOutline
                }
              />
            </button>
          </div>
        </div>

        {/* Component Type Selector / Morph Selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}>
          <label
            htmlFor='layer-prop-component-type-select'
            style={{
              fontWeight: 500,
              fontSize: "0.8125rem",
              color: "#334155",
            }}>
            {t("layer_properties_component_type")}:
          </label>
          <select
            id='layer-prop-component-type-select'
            value={activeComponent?.type || typeToAdd}
            disabled={activeComponent?.locked}
            onChange={(e) => {
              const val = e.target.value as StyleComponent["type"];
              setTypeToAdd(val);
              if (activeComponent && activeComponent.type !== val) {
                handleMorphType(val);
              }
            }}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid #cbd5e1",
              fontSize: "0.8125rem",
              backgroundColor: activeComponent?.locked ? "#f1f5f9" : "#ffffff",
              cursor: activeComponent?.locked ? "not-allowed" : "pointer",
            }}>
            {availableTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* Dynamic Style Options Panel */}
      <fieldset
        id='layer-prop-component-options-card'
        className='preference-group-box'
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: "0.25rem",
          padding: "0.75rem",
          backgroundColor: "#ffffff",
        }}>
        <legend
          className='preference-group-legend'
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "#1e293b",
            padding: "0 0.25rem",
          }}>
          {t("layer_properties_component_options")}
          {activeComponent ? ` — ${getComponentTypeLabel(activeComponent.type)}` : ""}
        </legend>

        {activeComponent?.locked && (
          <div
            className='component-locked-banner'
            style={{
              padding: "0.375rem 0.625rem",
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "0.25rem",
              color: "#92400e",
              fontSize: "0.8125rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}>
            <Icon path={mdiLockOutline} size='14px' />
            <span>{t("layer_properties_component_locked_notice")}</span>
          </div>
        )}

        {/* 1. Simple Fill Options */}
        {activeComponent?.type === "simple-fill" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-fill-color'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_fill_color")}:
              </label>
              <ColorInput
                id='layer-prop-fill-color'
                value={(activeComponent as SimpleFillComponent).color || "#3388ff"}
                disabled={activeComponent.locked}
                ariaLabel={t("layer_properties_styling_fill_color")}
                inputStyle={{ width: "7.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                onChange={(val, isValid) => {
                  if (isValid) {
                    updateActiveComponent({ color: val });
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* 2. Simple Line Options */}
        {activeComponent?.type === "simple-line" && (() => {
          const lineComp = activeComponent as SimpleLineComponent;
          const currentPattern = lineComp.dashPattern ?? matchDashPattern(lineComp.dashArray, lineComp.dashPattern);
          const isCustom = currentPattern === "custom";
          const isReadOnly = !isCustom || !!activeComponent.locked;

          const displayArray =
            currentPattern in DASH_PATTERN_PRESETS
              ? DASH_PATTERN_PRESETS[currentPattern]
              : lineComp.dashArray ?? [];

          const pairs: Array<{ line: number; gap: number }> = [];
          for (let i = 0; i < displayArray.length; i += 2) {
            pairs.push({
              line: displayArray[i] ?? 0,
              gap: displayArray[i + 1] ?? 0,
            });
          }

          const activeRowIndex =
            selectedDashRow !== null && selectedDashRow >= 0 && selectedDashRow < pairs.length
              ? selectedDashRow
              : pairs.length > 0
              ? 0
              : null;

          const canAddDash = isCustom && !activeComponent.locked;
          const canRemoveDash = isCustom && !activeComponent.locked && activeRowIndex !== null;
          const canMoveUpDash = isCustom && !activeComponent.locked && activeRowIndex !== null && activeRowIndex > 0;
          const canMoveDownDash =
            isCustom && !activeComponent.locked && activeRowIndex !== null && activeRowIndex < pairs.length - 1;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-stroke-color'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_stroke_color")}:
                </label>
                <ColorInput
                  id='layer-prop-stroke-color'
                  value={lineComp.color || "#000000"}
                  disabled={activeComponent.locked}
                  ariaLabel={t("layer_properties_styling_stroke_color")}
                  inputStyle={{ width: "7.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                  onChange={(val, isValid) => {
                    if (isValid) {
                      updateActiveComponent({ color: val });
                    }
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-stroke-width'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_stroke_width")}:
                </label>
                <input
                  id='layer-prop-stroke-width'
                  type='number'
                  min='0'
                  step='0.1'
                  disabled={activeComponent.locked}
                  value={lineComp.width ?? 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateActiveComponent({ width: isNaN(val) ? 0 : Math.max(0, val) });
                  }}
                  style={{
                    width: "5rem",
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}
                />
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>px</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-line-offset'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_line_offset")}:
                </label>
                <input
                  id='layer-prop-line-offset'
                  type='number'
                  step='0.1'
                  disabled={activeComponent.locked}
                  value={lineComp.offset ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateActiveComponent({ offset: isNaN(val) ? 0 : val });
                  }}
                  style={{
                    width: "5rem",
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}
                />
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>px</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-line-cap'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_line_cap")}:
                </label>
                <select
                  id='layer-prop-line-cap'
                  disabled={activeComponent.locked}
                  value={lineComp.cap ?? "round"}
                  onChange={(e) =>
                    updateActiveComponent({
                      cap: e.target.value as "butt" | "round" | "square",
                    })
                  }
                  style={{
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}>
                  <option value='butt'>{t("layer_properties_line_cap_butt")}</option>
                  <option value='round'>{t("layer_properties_line_cap_round")}</option>
                  <option value='square'>{t("layer_properties_line_cap_square")}</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-line-join'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_line_join")}:
                </label>
                <select
                  id='layer-prop-line-join'
                  disabled={activeComponent.locked}
                  value={lineComp.join ?? "round"}
                  onChange={(e) =>
                    updateActiveComponent({
                      join: e.target.value as "bevel" | "miter" | "round",
                    })
                  }
                  style={{
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}>
                  <option value='bevel'>{t("layer_properties_line_join_bevel")}</option>
                  <option value='miter'>{t("layer_properties_line_join_miter")}</option>
                  <option value='round'>{t("layer_properties_line_join_round")}</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-dash-pattern'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_dash_pattern")}:
                </label>
                <select
                  id='layer-prop-dash-pattern'
                  disabled={activeComponent.locked}
                  value={currentPattern}
                  onChange={(e) => {
                    const nextPattern = e.target.value as DashPatternPreset;
                    if (nextPattern === "solid") {
                      updateActiveComponent({ dashPattern: "solid", dashArray: [] });
                    } else if (nextPattern === "no-line") {
                      updateActiveComponent({ dashPattern: "no-line", dashArray: [] });
                    } else if (nextPattern === "custom") {
                      const existing = lineComp.dashArray;
                      const initial = existing && existing.length > 0 ? existing : [5, 2];
                      updateActiveComponent({ dashPattern: "custom", dashArray: initial });
                    } else {
                      const presetArr = DASH_PATTERN_PRESETS[nextPattern] ?? [];
                      updateActiveComponent({ dashPattern: nextPattern, dashArray: [...presetArr] });
                    }
                  }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}>
                  <option value='solid'>{t("layer_properties_dash_pattern_solid")}</option>
                  <option value='no-line'>{t("layer_properties_dash_pattern_no_line")}</option>
                  <option value='dash'>{t("layer_properties_dash_pattern_dash")}</option>
                  <option value='dot'>{t("layer_properties_dash_pattern_dot")}</option>
                  <option value='dash-dot'>{t("layer_properties_dash_pattern_dash_dot")}</option>
                  <option value='dash-dot-dot'>{t("layer_properties_dash_pattern_dash_dot_dot")}</option>
                  <option value='long-dash'>{t("layer_properties_dash_pattern_long_dash")}</option>
                  <option value='long-dash-dot'>{t("layer_properties_dash_pattern_long_dash_dot")}</option>
                  <option value='sparse-dot'>{t("layer_properties_dash_pattern_sparse_dot")}</option>
                  <option value='custom'>{t("layer_properties_dash_pattern_custom")}</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label
                  htmlFor='layer-prop-dash-offset'
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                  {t("layer_properties_styling_dash_offset")}:
                </label>
                <input
                  id='layer-prop-dash-offset'
                  type='number'
                  min='0'
                  step='0.1'
                  disabled={activeComponent.locked}
                  value={lineComp.dashOffset ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateActiveComponent({ dashOffset: isNaN(val) ? 0 : Math.max(0, val) });
                  }}
                  style={{
                    width: "5rem",
                    padding: "0.25rem 0.5rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.25rem",
                    fontSize: "0.8125rem",
                  }}
                />
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>px</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <label
                  style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155", paddingTop: "0.25rem" }}>
                  {t("layer_properties_styling_dash_array")}:
                </label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <div
                    id='layer-prop-dash-array-container'
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.25rem",
                      overflow: "hidden",
                      width: "12rem",
                      backgroundColor: isReadOnly ? "#f8fafc" : "#ffffff",
                    }}>
                    <table
                      id='layer-prop-dash-array-table'
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.8125rem",
                      }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ padding: "0.25rem 0.5rem", textAlign: "left", width: "50%", fontWeight: 600 }}>
                            {t("layer_properties_dash_array_col_line")}
                          </th>
                          <th style={{ padding: "0.25rem 0.5rem", textAlign: "left", width: "50%", fontWeight: 600 }}>
                            {t("layer_properties_dash_array_col_gap")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pairs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              style={{
                                padding: "0.5rem",
                                textAlign: "center",
                                color: "#94a3b8",
                                fontStyle: "italic",
                                fontSize: "0.75rem",
                              }}>
                              —
                            </td>
                          </tr>
                        ) : (
                          pairs.map((pair, idx) => (
                            <tr
                              key={idx}
                              onClick={() => setSelectedDashRow(idx)}
                              style={{
                                backgroundColor: activeRowIndex === idx ? "#e2e8f0" : "transparent",
                                cursor: isCustom ? "pointer" : "default",
                              }}>
                              <td style={{ padding: "0.125rem 0.25rem" }}>
                                <input
                                  type='number'
                                  min='0'
                                  step='0.1'
                                  aria-label={`${t("layer_properties_dash_array_col_line")} ${idx + 1}`}
                                  disabled={isReadOnly}
                                  value={pair.line}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const num = isNaN(val) ? 0 : Math.max(0, val);
                                    const newPairs = pairs.map((p, pIdx) =>
                                      pIdx === idx ? { ...p, line: num } : p
                                    );
                                    updateActiveComponent({
                                      dashPattern: "custom",
                                      dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                                    });
                                  }}
                                  onFocus={() => setSelectedDashRow(idx)}
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "0.125rem 0.25rem",
                                    fontSize: "0.8125rem",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "0.125rem",
                                    backgroundColor: isReadOnly ? "#f1f5f9" : "#ffffff",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "0.125rem 0.25rem" }}>
                                <input
                                  type='number'
                                  min='0'
                                  step='0.1'
                                  aria-label={`${t("layer_properties_dash_array_col_gap")} ${idx + 1}`}
                                  disabled={isReadOnly}
                                  value={pair.gap}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const num = isNaN(val) ? 0 : Math.max(0, val);
                                    const newPairs = pairs.map((p, pIdx) =>
                                      pIdx === idx ? { ...p, gap: num } : p
                                    );
                                    updateActiveComponent({
                                      dashPattern: "custom",
                                      dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                                    });
                                  }}
                                  onFocus={() => setSelectedDashRow(idx)}
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "0.125rem 0.25rem",
                                    fontSize: "0.8125rem",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "0.125rem",
                                    backgroundColor: isReadOnly ? "#f1f5f9" : "#ffffff",
                                  }}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div
                    id='layer-prop-dash-array-actions'
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, auto)",
                      gap: "0.25rem",
                    }}>
                    <button
                      type='button'
                      id='layer-prop-dash-array-add'
                      title={t("layer_properties_dash_array_add")}
                      aria-label={t("layer_properties_dash_array_add")}
                      disabled={!canAddDash}
                      onClick={() => {
                        if (!canAddDash) return;
                        const newPairs = [...pairs, { line: 5.0, gap: 2.0 }];
                        setSelectedDashRow(newPairs.length - 1);
                        updateActiveComponent({
                          dashPattern: "custom",
                          dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                        });
                      }}
                      style={canAddDash ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
                      <Icon path={mdiPlus} />
                    </button>
                    <button
                      type='button'
                      id='layer-prop-dash-array-remove'
                      title={t("layer_properties_dash_array_remove")}
                      aria-label={t("layer_properties_dash_array_remove")}
                      disabled={!canRemoveDash}
                      onClick={() => {
                        if (!canRemoveDash || activeRowIndex === null) return;
                        const newPairs = pairs.filter((_, idx) => idx !== activeRowIndex);
                        const nextIndex = newPairs.length > 0 ? Math.min(activeRowIndex, newPairs.length - 1) : null;
                        setSelectedDashRow(nextIndex);
                        updateActiveComponent({
                          dashPattern: "custom",
                          dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                        });
                      }}
                      style={canRemoveDash ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
                      <Icon path={mdiMinus} />
                    </button>
                    <button
                      type='button'
                      id='layer-prop-dash-array-move-up'
                      title={t("layer_properties_dash_array_move_up")}
                      aria-label={t("layer_properties_dash_array_move_up")}
                      disabled={!canMoveUpDash}
                      onClick={() => {
                        if (!canMoveUpDash || activeRowIndex === null) return;
                        const newPairs = [...pairs];
                        const temp = newPairs[activeRowIndex];
                        newPairs[activeRowIndex] = newPairs[activeRowIndex - 1];
                        newPairs[activeRowIndex - 1] = temp;
                        setSelectedDashRow(activeRowIndex - 1);
                        updateActiveComponent({
                          dashPattern: "custom",
                          dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                        });
                      }}
                      style={canMoveUpDash ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
                      <Icon path={mdiArrowUp} />
                    </button>
                    <button
                      type='button'
                      id='layer-prop-dash-array-move-down'
                      title={t("layer_properties_dash_array_move_down")}
                      aria-label={t("layer_properties_dash_array_move_down")}
                      disabled={!canMoveDownDash}
                      onClick={() => {
                        if (!canMoveDownDash || activeRowIndex === null) return;
                        const newPairs = [...pairs];
                        const temp = newPairs[activeRowIndex];
                        newPairs[activeRowIndex] = newPairs[activeRowIndex + 1];
                        newPairs[activeRowIndex + 1] = temp;
                        setSelectedDashRow(activeRowIndex + 1);
                        updateActiveComponent({
                          dashPattern: "custom",
                          dashArray: newPairs.flatMap((p) => [p.line, p.gap]),
                        });
                      }}
                      style={canMoveDownDash ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
                      <Icon path={mdiArrowDown} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. Simple Marker Options */}
        {activeComponent?.type === "simple-marker" && (() => {
          const { shape: markerShape = "circle" } = activeComponent as SimpleMarkerComponent;
          return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-point-shape'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_point_shape")}:
              </label>
              <select
                id='layer-prop-point-shape'
                disabled={activeComponent.locked}
                value={markerShape}
                onChange={(e) =>
                  updateActiveComponent({
                    shape: e.target.value as "circle",
                  })
                }
                style={{
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  fontSize: "0.8125rem",
                  backgroundColor: "#ffffff",
                }}>
                <option value='circle'>{t("layer_properties_shape_circle")}</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-marker-radius'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_point_radius")}:
              </label>
              <input
                id='layer-prop-marker-radius'
                type='number'
                min='1'
                max='100'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleMarkerComponent).radius ?? 6}
                onChange={(e) =>
                  updateActiveComponent({ radius: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                style={{
                  width: "5rem",
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  fontSize: "0.8125rem",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>px</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-marker-fill-color'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_fill_color")}:
              </label>
              <ColorInput
                id='layer-prop-marker-fill-color'
                value={(activeComponent as SimpleMarkerComponent).fillColor || "#3388ff"}
                disabled={activeComponent.locked}
                ariaLabel={t("layer_properties_styling_fill_color")}
                inputStyle={{ width: "7.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                onChange={(val, isValid) => {
                  if (isValid) {
                    updateActiveComponent({ fillColor: val });
                  }
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-marker-stroke-color'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_stroke_color")}:
              </label>
              <ColorInput
                id='layer-prop-marker-stroke-color'
                value={(activeComponent as SimpleMarkerComponent).strokeColor || "#000000"}
                disabled={activeComponent.locked}
                ariaLabel={t("layer_properties_styling_stroke_color")}
                inputStyle={{ width: "7.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                onChange={(val, isValid) => {
                  if (isValid) {
                    updateActiveComponent({ strokeColor: val });
                  }
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-marker-stroke-width'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_stroke_width")}:
              </label>
              <input
                id='layer-prop-marker-stroke-width'
                type='number'
                min='0'
                max='50'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleMarkerComponent).strokeWidth ?? 1}
                onChange={(e) =>
                  updateActiveComponent({ strokeWidth: Math.max(0, parseInt(e.target.value, 10) || 0) })
                }
                style={{
                  width: "5rem",
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  fontSize: "0.8125rem",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>px</span>
            </div>
          </div>
        ); })()}
      </fieldset>
      <CssColorsDatalist />
    </div>
  );
};

export default SimpleModeEditor;
