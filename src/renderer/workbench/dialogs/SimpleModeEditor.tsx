/**
 * @file SimpleModeEditor.tsx
 * @module renderer/workbench/dialogs/SimpleModeEditor
 * @description Visual component stack manager and dynamic Style Options panel for Simple Cartouche Symbology mode in LayerPropertiesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @see {@link SimpleModeEditor}
 * @see {@link SimpleCartoucheStyle}
 * @see {@link StyleComponent}
 */

import React, { useState, useMemo, useCallback } from "react";
import Icon from "@renderer/components/common/Icon";
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
import type {
  SimpleCartoucheStyle,
  StyleComponent,
  SimpleFillComponent,
  SimpleLineComponent,
  SimpleMarkerComponent,
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

const BUTTON_STYLE: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  borderRadius: "0.25rem",
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "#1e293b",
};

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
  const canMoveUp =
    activePainterIndex >= 0 && activePainterIndex < components.length - 1;
  const canMoveDown = activePainterIndex > 0;
  const canRemove =
    activeComponent !== null &&
    !activeComponent.locked &&
    components.length > 1;
  const canDuplicate = activeComponent !== null;
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
  }, [typeToAdd, components, commitComponents]);

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

        {/* Stack Action Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
          }}>
          <button
            type='button'
            id='layer-prop-component-add'
            className='layer-prop-component-btn add'
            title={t("layer_properties_component_add")}
            onClick={handleAdd}
            style={BUTTON_STYLE}>
            <Icon path={mdiPlus} size='14px' />
            <span>{t("layer_properties_component_add")}</span>
          </button>
          <button
            type='button'
            id='layer-prop-component-remove'
            className='layer-prop-component-btn remove'
            title={t("layer_properties_component_remove")}
            disabled={!canRemove}
            onClick={handleRemove}
            style={canRemove ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
            <Icon path={mdiMinus} size='14px' />
            <span>{t("layer_properties_component_remove")}</span>
          </button>
          <button
            type='button'
            id='layer-prop-component-move-up'
            className='layer-prop-component-btn move-up'
            title={t("layer_properties_component_move_up")}
            disabled={!canMoveUp}
            onClick={handleMoveUp}
            style={canMoveUp ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
            <Icon path={mdiArrowUp} size='14px' />
            <span>{t("layer_properties_component_move_up")}</span>
          </button>
          <button
            type='button'
            id='layer-prop-component-move-down'
            className='layer-prop-component-btn move-down'
            title={t("layer_properties_component_move_down")}
            disabled={!canMoveDown}
            onClick={handleMoveDown}
            style={canMoveDown ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
            <Icon path={mdiArrowDown} size='14px' />
            <span>{t("layer_properties_component_move_down")}</span>
          </button>
          <button
            type='button'
            id='layer-prop-component-duplicate'
            className='layer-prop-component-btn duplicate'
            title={t("layer_properties_component_duplicate")}
            disabled={!canDuplicate}
            onClick={handleDuplicate}
            style={canDuplicate ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
            <Icon path={mdiContentCopy} size='14px' />
            <span>{t("layer_properties_component_duplicate")}</span>
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
            disabled={!canLock}
            onClick={handleToggleLock}
            style={canLock ? BUTTON_STYLE : DISABLED_BUTTON_STYLE}>
            <Icon
              path={
                activeComponent?.locked
                  ? mdiLockOutline
                  : mdiLockOpenVariantOutline
              }
              size='14px'
            />
            <span>
              {activeComponent?.locked
                ? t("layer_properties_component_unlock")
                : t("layer_properties_component_lock")}
            </span>
          </button>
        </div>

        {/* Visual Component Stack List */}
        <div
          id='layer-prop-component-stack-list'
          className='layer-prop-component-stack-list'
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "0.25rem",
            backgroundColor: "#f8fafc",
            maxHeight: "9rem",
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
                  {getComponentTypeLabel(comp.type)} ({comp.id})
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
              <input
                id='layer-prop-fill-color'
                type='color'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleFillComponent).color || "#3388ff"}
                onChange={(e) => updateActiveComponent({ color: e.target.value })}
                style={{
                  width: "3rem",
                  height: "1.75rem",
                  padding: 0,
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  cursor: activeComponent.locked ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
                {(activeComponent as SimpleFillComponent).color}
              </span>
            </div>
          </div>
        )}

        {/* 2. Simple Line Options */}
        {activeComponent?.type === "simple-line" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-stroke-color'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_stroke_color")}:
              </label>
              <input
                id='layer-prop-stroke-color'
                type='color'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleLineComponent).color || "#000000"}
                onChange={(e) => updateActiveComponent({ color: e.target.value })}
                style={{
                  width: "3rem",
                  height: "1.75rem",
                  padding: 0,
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  cursor: activeComponent.locked ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
                {(activeComponent as SimpleLineComponent).color}
              </span>
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
                min='1'
                max='100'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleLineComponent).width ?? 1}
                onChange={(e) =>
                  updateActiveComponent({ width: Math.max(1, parseInt(e.target.value, 10) || 1) })
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
                htmlFor='layer-prop-stroke-dash'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_stroke_dash")}:
              </label>
              <input
                id='layer-prop-stroke-dash'
                type='checkbox'
                disabled={activeComponent.locked}
                checked={
                  Array.isArray((activeComponent as SimpleLineComponent).dashArray) &&
                  ((activeComponent as SimpleLineComponent).dashArray?.length ?? 0) > 0
                }
                onChange={(e) =>
                  updateActiveComponent({
                    dashArray: e.target.checked ? [6, 6] : undefined,
                  })
                }
                style={{ cursor: activeComponent.locked ? "not-allowed" : "pointer" }}
              />
            </div>
          </div>
        )}

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
              <input
                id='layer-prop-marker-fill-color'
                type='color'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleMarkerComponent).fillColor || "#3388ff"}
                onChange={(e) => updateActiveComponent({ fillColor: e.target.value })}
                style={{
                  width: "3rem",
                  height: "1.75rem",
                  padding: 0,
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  cursor: activeComponent.locked ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
                {(activeComponent as SimpleMarkerComponent).fillColor}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label
                htmlFor='layer-prop-marker-stroke-color'
                style={{ width: "9rem", fontSize: "0.8125rem", color: "#334155" }}>
                {t("layer_properties_styling_stroke_color")}:
              </label>
              <input
                id='layer-prop-marker-stroke-color'
                type='color'
                disabled={activeComponent.locked}
                value={(activeComponent as SimpleMarkerComponent).strokeColor || "#000000"}
                onChange={(e) => updateActiveComponent({ strokeColor: e.target.value })}
                style={{
                  width: "3rem",
                  height: "1.75rem",
                  padding: 0,
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.25rem",
                  cursor: activeComponent.locked ? "not-allowed" : "pointer",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
                {(activeComponent as SimpleMarkerComponent).strokeColor}
              </span>
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
    </div>
  );
};

export default SimpleModeEditor;
