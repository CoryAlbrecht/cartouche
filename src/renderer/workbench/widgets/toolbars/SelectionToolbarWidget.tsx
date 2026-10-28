/**
 * @file SelectionToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/SelectionToolbarWidget
 * @description Toolbar widget hosting spatial feature selection tools: SplitToolButton for selection modes, Select by Value dialog trigger, Select All, and Deselect All.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link SplitToolButton}
 * @see {@link SelectByValueDialog}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  mdiTableSearch,
  mdiSelectAll,
  mdiSelectionOff,
} from "@mdi/js";
import {
  type ToolbarZone,
  type ActiveTool,
  type SelectionMode,
  activeToolSignal,
  activeSelectionModeSignal,
  selectedFeatureIdsSignal,
  openSelectByValueDialog,
  selectAllFeaturesAction,
  deselectAllFeaturesAction,
} from "@renderer/state/gisSignals";
import {
  getActionFormattedKey,
} from "@renderer/state/actionSignals";
import { SplitToolButton } from "@renderer/components/common/SplitToolButton";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} SelectionToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface SelectionToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @description Map linking discrete selection action mode identifiers to corresponding ActiveTool modes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {Record<string, ActiveTool>}
 */
export const SELECTION_ACTION_TO_TOOL_MAP: Record<string, ActiveTool> = {
  select_feature: "select",
  select_features_by_drag: "select_drag",
  select_features_by_freehand: "select_freehand",
};

/**
 * @description Available selection mode option action names for the SplitToolButton composite control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {string[]}
 */
export const SELECTION_TOOL_OPTIONS: string[] = [
  "select_feature",
  "select_features_by_drag",
  "select_features_by_freehand",
];

/**
 * @function isDeselectAllDisabled
 * @description Evaluates whether the Deselect All Features toolbar button should be disabled.
 * Disabled when there are no features currently selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {Set<string | number> | number} selectedFeatures - Set of selected feature IDs or count of selected features.
 * @returns {boolean} True if disabled, false otherwise.
 */
export function isDeselectAllDisabled(
  selectedFeatures: Set<string | number> | number
): boolean {
  if (typeof selectedFeatures === "number") {
    return selectedFeatures <= 0;
  }
  return !selectedFeatures || selectedFeatures.size === 0;
}

/**
 * @component SelectionToolbarWidget
 * @description Renders spatial feature selection tools: SplitToolButton for selection modes, Select by Value dialog trigger, Select All, and Deselect All.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {SelectionToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} SelectionToolbarWidget instance.
 */
export const SelectionToolbarWidget: React.FC<SelectionToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const { t } = useTranslation();

  const isSelectionActive =
    activeToolSignal.value === "select" ||
    activeToolSignal.value === "select_drag" ||
    activeToolSignal.value === "select_freehand";

  const handleSelectionModeSelect = (actionId: string): void => {
    activeSelectionModeSignal.value = actionId as SelectionMode;
    const tool = SELECTION_ACTION_TO_TOOL_MAP[actionId];
    if (tool) {
      activeToolSignal.value = tool;
    }
  };

  const handleSelectionExecute = (actionId: string): void => {
    activeSelectionModeSignal.value = actionId as SelectionMode;
    const tool = SELECTION_ACTION_TO_TOOL_MAP[actionId];
    if (tool) {
      activeToolSignal.value = tool;
    }
  };

  const selectByValueShortcut = getActionFormattedKey(
    "select_features_by_value",
    "F6"
  );
  const selectByValueTitle = selectByValueShortcut
    ? `${t("select_features_by_value")} (${selectByValueShortcut})`
    : t("select_features_by_value");

  const selectAllShortcut = getActionFormattedKey(
    "select_all_features",
    "Ctrl+A"
  );
  const selectAllTitle = selectAllShortcut
    ? `${t("select_all_features")} (${selectAllShortcut})`
    : t("select_all_features");

  const deselectAllShortcut = getActionFormattedKey(
    "deselect_all_features",
    "Ctrl+Shift+A"
  );
  const deselectAllTitle = deselectAllShortcut
    ? `${t("deselect_all_features")} (${deselectAllShortcut})`
    : t("deselect_all_features");

  const deselectDisabled = isDeselectAllDisabled(selectedFeatureIdsSignal.value);

  return (
    <ToolbarWidget id='selection' zone={zone}>
      <SplitToolButton
        activeAction={activeSelectionModeSignal.value}
        options={SELECTION_TOOL_OPTIONS}
        zone={zone}
        active={isSelectionActive}
        onSelect={handleSelectionModeSelect}
        onExecute={handleSelectionExecute}
      />

      <button
        type='button'
        id='toolbar-tool-select-by-value'
        className='toolbar-btn'
        title={selectByValueTitle}
        aria-label={t("select_features_by_value") || "Select Features by Value..."}
        onClick={openSelectByValueDialog}>
        <Icon path={mdiTableSearch} />
      </button>

      <button
        type='button'
        id='toolbar-tool-select-all'
        className='toolbar-btn'
        title={selectAllTitle}
        aria-label={t("select_all_features") || "Select All Features"}
        onClick={selectAllFeaturesAction}>
        <Icon path={mdiSelectAll} />
      </button>

      <button
        type='button'
        id='toolbar-tool-deselect-all'
        className={`toolbar-btn ${deselectDisabled ? "disabled" : ""}`}
        title={deselectAllTitle}
        aria-label={t("deselect_all_features") || "Deselect All Features"}
        disabled={deselectDisabled}
        onClick={deselectAllFeaturesAction}>
        <Icon path={mdiSelectionOff} />
      </button>
    </ToolbarWidget>
  );
};
