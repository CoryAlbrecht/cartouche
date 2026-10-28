/**
 * @file SnappingToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/SnappingToolbarWidget
 * @description Toolbar widget managing feature vertex and line segment snapping settings, discrete geometry mode toggles, and search tolerance during spatial digitizing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link SplitToolButton}
 * @see {@link SnappingOptionsDialog}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiMagnet,
  mdiLayersOutline,
  mdiLayersTripleOutline,
  mdiTuneVariant,
  mdiVectorPoint,
  mdiRayVertex,
  mdiVectorLine,
} from "@mdi/js";
import {
  type ToolbarZone,
  type SnappingScope,
  snappingEnabledSignal,
  snappingScopeSignal,
  snapToVerticesSignal,
  snapToMidpointSignal,
  snapToSegmentSignal,
  snappingDistanceSignal,
  openSnappingOptionsDialog,
} from "@renderer/state/gisSignals";
import { updatePreference } from "@renderer/state/preferencesSignals";
import { getActionFormattedKey } from "@renderer/state/actionSignals";
import { useTranslation } from "@renderer/hooks/useTranslation";
import {
  SplitToolButton,
  type SplitToolOption,
} from "@renderer/components/common/SplitToolButton";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} SnappingToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export interface SnappingToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @description Available snapping scope options for the SplitToolButton composite control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {SplitToolOption[]}
 */
export const SNAPPING_SCOPE_OPTIONS: SplitToolOption[] = [
  {
    id: "snap_to_active",
    label: "Snap to Active Layer",
    icon: mdiLayersOutline,
  },
  {
    id: "snap_to_all",
    label: "Snap to All Layers",
    icon: mdiLayersTripleOutline,
  },
  {
    id: "snap_to_advanced",
    label: "Advanced Snapping Options...",
    icon: mdiTuneVariant,
  },
];

/**
 * @function getSnappingButtonClass
 * @description Computes the standard CSS class name string for toolbar toggle buttons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} active - Whether the button is in an active state.
 * @param {boolean} disabled - Whether the button is disabled.
 * @returns {string} Clean space-separated class string.
 */
export function getSnappingButtonClass(active: boolean, disabled: boolean): string {
  const parts = ["toolbar-btn"];
  if (active) parts.push("active");
  if (disabled) parts.push("disabled");
  return parts.join(" ");
}

/**
 * @function isSnappingToolbarDisabled
 * @description Evaluates whether child controls in the snapping toolbar should be disabled.
 * Child controls are disabled whenever master snapping is turned off.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} snappingEnabled - Whether snapping is globally enabled.
 * @returns {boolean} True if child controls should be disabled, false otherwise.
 */
export function isSnappingToolbarDisabled(snappingEnabled: boolean): boolean {
  return !snappingEnabled;
}

/**
 * @function clampSnappingDistance
 * @description Constrains a numeric snapping search tolerance distance within the valid range [0, 256] pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {number} value - Input distance value in pixels.
 * @returns {number} Clamped distance value integer.
 */
export function clampSnappingDistance(value: number): number {
  if (isNaN(value)) return 0;
  return Math.min(256, Math.max(0, Math.round(value)));
}

/**
 * @function handleSnappingScopeSelect
 * @description Handles selection of a snapping scope from the SplitToolButton PopupMenu.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string} scope - Selected snapping scope identifier.
 * @returns {void}
 */
export function handleSnappingScopeSelect(scope: string): void {
  if (scope === "snap_to_advanced") {
    snappingScopeSignal.value = "snap_to_advanced";
    openSnappingOptionsDialog();
  } else if (scope === "snap_to_active" || scope === "snap_to_all") {
    snappingScopeSignal.value = scope as SnappingScope;
  }
}

/**
 * @function handleSnappingScopeExecute
 * @description Handles execution of the active snapping scope primary button.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string} scope - Active snapping scope identifier.
 * @returns {void}
 */
export function handleSnappingScopeExecute(scope: string): void {
  if (scope === "snap_to_advanced") {
    openSnappingOptionsDialog();
  } else if (scope === "snap_to_active" || scope === "snap_to_all") {
    snappingScopeSignal.value = scope as SnappingScope;
  }
}

/**
 * @component SnappingToolbarWidget
 * @description Renders snapping control buttons to toggle vertex, midpoint, and segment snapping, switch snapping scope, and configure tolerance.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {SnappingToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} SnappingToolbarWidget instance.
 */
export const SnappingToolbarWidget: React.FC<SnappingToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const { t } = useTranslation();

  const isEnabled = snappingEnabledSignal.value;
  const disabled = isSnappingToolbarDisabled(isEnabled);
  const isHorizontal = zone === "top" || zone === "bottom";

  // Formatted key combination labels
  const masterKey = getActionFormattedKey("snapping", "S");
  const masterLabel = t("snapping") || "Enable Snapping";
  const masterTitle = masterKey ? `${masterLabel} (${masterKey})` : masterLabel;

  const verticesKey = getActionFormattedKey("snap_to_vertices", "Alt+V");
  const verticesLabel = t("snap_to_vertices") || "Snap to Vertices";
  const verticesTitle = verticesKey
    ? `${verticesLabel} (${verticesKey})`
    : verticesLabel;

  const midpointKey = getActionFormattedKey("snap_to_midpoint", "Alt+M");
  const midpointLabel = t("snap_to_midpoint") || "Snap to Midpoints";
  const midpointTitle = midpointKey
    ? `${midpointLabel} (${midpointKey})`
    : midpointLabel;

  const segmentKey = getActionFormattedKey("snap_to_segment", "Alt+E");
  const segmentLabel = t("snap_to_segment") || "Snap to Segments";
  const segmentTitle = segmentKey
    ? `${segmentLabel} (${segmentKey})`
    : segmentLabel;

  /**
   * @function handleDistanceChange
   * @description Handles tolerance number input changes and persists value to preferences.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event.
   * @returns {void}
   */
  const handleDistanceChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return;
    const clamped = clampSnappingDistance(Number(e.target.value));
    snappingDistanceSignal.value = clamped;
    if (typeof (globalThis as any).PreferencesStore?.set === "function") {
      (globalThis as any).PreferencesStore.set("mapTools.snapping.distance", clamped);
    }
    updatePreference("mapTools.snapping.distance", clamped).catch(() => {});
  };

  return (
    <ToolbarWidget id='snapping' zone={zone}>
      {/* Master Snapping Toggle */}
      <button
        type='button'
        id='toolbar-tool-snapping'
        className={getSnappingButtonClass(isEnabled, false)}
        title={masterTitle}
        aria-label={masterLabel}
        onClick={() => {
          snappingEnabledSignal.value = !snappingEnabledSignal.value;
        }}>
        <Icon path={mdiMagnet} />
      </button>

      {/* Snapping Scope SplitToolButton */}
      <SplitToolButton
        activeAction={snappingScopeSignal.value}
        options={SNAPPING_SCOPE_OPTIONS}
        zone={zone}
        disabled={disabled}
        active={isEnabled}
        onSelect={handleSnappingScopeSelect}
        onExecute={handleSnappingScopeExecute}
      />

      {/* Snap to Vertices */}
      <button
        type='button'
        id='toolbar-tool-snap-to-vertices'
        className={getSnappingButtonClass(snapToVerticesSignal.value, disabled)}
        title={verticesTitle}
        aria-label={verticesLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            snapToVerticesSignal.value = !snapToVerticesSignal.value;
          }
        }}>
        <Icon path={mdiVectorPoint} />
      </button>

      {/* Snap to Midpoints */}
      <button
        type='button'
        id='toolbar-tool-snap-to-midpoint'
        className={getSnappingButtonClass(snapToMidpointSignal.value, disabled)}
        title={midpointTitle}
        aria-label={midpointLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            snapToMidpointSignal.value = !snapToMidpointSignal.value;
          }
        }}>
        <Icon path={mdiRayVertex} />
      </button>

      {/* Snap to Segments */}
      <button
        type='button'
        id='toolbar-tool-snap-to-segment'
        className={getSnappingButtonClass(snapToSegmentSignal.value, disabled)}
        title={segmentTitle}
        aria-label={segmentLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            snapToSegmentSignal.value = !snapToSegmentSignal.value;
          }
        }}>
        <Icon path={mdiVectorLine} />
      </button>

      {/* Snapping Distance Numeric Spinner */}
      {isHorizontal ? (
        <div
          className={`snapping-distance-container horizontal ${disabled ? "disabled" : ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.85rem",
            padding: "0 0.25rem",
            opacity: disabled ? 0.35 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}>
          <span
            className='snapping-distance-label'
            style={{ fontSize: "0.85rem", userSelect: "none" }}>
            Tolerance:
          </span>
          <input
            type='number'
            id='toolbar-input-snapping-distance'
            className='toolbar-input-snapping-distance'
            min={0}
            max={256}
            step={1}
            value={snappingDistanceSignal.value}
            disabled={disabled}
            onChange={handleDistanceChange}
            style={{
              width: "3.25rem",
              padding: "0.1rem 0.25rem",
              fontSize: "0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: "0.2rem",
              textAlign: "right",
            }}
            title='Snapping Tolerance (px)'
            aria-label='Snapping Tolerance in pixels'
          />
          <span
            className='snapping-distance-unit'
            style={{ fontSize: "0.85rem", userSelect: "none" }}>
            px
          </span>
        </div>
      ) : (
        <div
          className={`snapping-distance-container vertical ${disabled ? "disabled" : ""}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0.25rem 0",
            opacity: disabled ? 0.35 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}>
          <input
            type='number'
            id='toolbar-input-snapping-distance'
            className='toolbar-input-snapping-distance'
            min={0}
            max={256}
            step={1}
            value={snappingDistanceSignal.value}
            disabled={disabled}
            onChange={handleDistanceChange}
            style={{
              width: "2.5rem",
              padding: "0.1rem",
              fontSize: "0.75rem",
              border: "1px solid #cbd5e1",
              borderRadius: "0.2rem",
              textAlign: "center",
            }}
            title='Snapping Tolerance (px)'
            aria-label='Snapping Tolerance in pixels'
          />
        </div>
      )}
    </ToolbarWidget>
  );
};
