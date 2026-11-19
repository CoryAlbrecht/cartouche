/**
 * @file DashPatternSelect.tsx
 * @module renderer/workbench/dialogs/DashPatternSelect
 * @description Dash pattern dropdown for Simple Line styles, built on the shared Select: localized text labels on the left and 128px horizontal stroke samples on the right, in both the trigger and the drop-down list.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link DashPatternSelect}
 * @see {@link DashPatternSample}
 * @see {@link Select}
 * @see {@link DASH_PATTERN_PRESETS}
 */

import React from "react";
import { Select, type SelectOption } from "@renderer/components/common/Select";
import {
  DASH_PATTERN_PRESETS,
  type DashPatternPreset,
} from "@shared/types/styling";

/**
 * @typedef {Object} DashPatternOption
 * @property {DashPatternPreset} value - Pattern preset identifier.
 * @property {string} labelKey - Localization key for the pattern name.
 */
interface DashPatternOption {
  value: DashPatternPreset;
  labelKey: string;
}

/**
 * Standard ordered list of dash pattern options available in Simple Line styling.
 *
 * @constant {DashPatternOption[]} PATTERN_OPTIONS
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export const PATTERN_OPTIONS: DashPatternOption[] = [
  { value: "solid", labelKey: "layer_properties_dash_pattern_solid" },
  { value: "no-line", labelKey: "layer_properties_dash_pattern_no_line" },
  { value: "dash", labelKey: "layer_properties_dash_pattern_dash" },
  { value: "dot", labelKey: "layer_properties_dash_pattern_dot" },
  { value: "dash-dot", labelKey: "layer_properties_dash_pattern_dash_dot" },
  {
    value: "dash-dot-dot",
    labelKey: "layer_properties_dash_pattern_dash_dot_dot",
  },
  { value: "long-dash", labelKey: "layer_properties_dash_pattern_long_dash" },
  {
    value: "long-dash-dot",
    labelKey: "layer_properties_dash_pattern_long_dash_dot",
  },
  { value: "sparse-dot", labelKey: "layer_properties_dash_pattern_sparse_dot" },
  { value: "custom", labelKey: "layer_properties_dash_pattern_custom" },
];

/**
 * @typedef {Object} DashPatternSampleProps
 * @property {string} pattern - Dash pattern identifier or preset token.
 * @property {number[]} [dashArray] - Active alternating line and gap lengths array for custom patterns.
 * @property {string} [className] - Optional custom CSS class name.
 */
export interface DashPatternSampleProps {
  pattern: string;
  dashArray?: number[];
  className?: string;
}

/**
 * Visual SVG stroke sample component rendering a ~128px horizontal line preview.
 *
 * @component DashPatternSample
 * @description Renders a 128px horizontal line using fixed neutral 2px black stroke, displaying solid lines, repeating preset dash intervals, blank spaces for no-line, or custom dash arrays.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {DashPatternSampleProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const DashPatternSample: React.FC<DashPatternSampleProps> = ({
  pattern,
  dashArray,
  className,
}) => {
  if (pattern === "no-line") {
    return (
      <div
        data-testid='dash-sample-no-line'
        style={{
          width: "128px",
          height: "14px",
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
        }}
      />
    );
  }

  let strokeDasharray = "none";
  if (pattern === "custom" && dashArray && dashArray.length > 0) {
    strokeDasharray = dashArray.join(" ");
  } else if (pattern in DASH_PATTERN_PRESETS) {
    const arr = DASH_PATTERN_PRESETS[pattern];
    strokeDasharray = arr && arr.length > 0 ? arr.join(" ") : "none";
  }

  return (
    <svg
      width={128}
      height={14}
      viewBox='0 0 128 14'
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
      className={className}
      aria-hidden='true'>
      <line
        x1={0}
        y1={7}
        x2={128}
        y2={7}
        stroke='currentColor'
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        strokeLinecap='butt'
      />
    </svg>
  );
};

/**
 * @typedef {Object} DashPatternSelectProps
 * @property {string} id - HTML element identifier for accessibility and form association.
 * @property {string} value - Currently selected dash pattern preset identifier.
 * @property {number[]} [dashArray] - Active alternating line/gap lengths for custom patterns.
 * @property {boolean} [disabled=false] - Whether the dropdown is disabled against user interaction.
 * @property {(pattern: DashPatternPreset) => void} onChange - Callback invoked when a pattern is chosen.
 * @property {(key: string) => string} t - Translation helper function.
 */
export interface DashPatternSelectProps {
  id: string;
  value: string;
  dashArray?: number[];
  disabled?: boolean;
  onChange: (pattern: DashPatternPreset) => void;
  t: (key: string) => string;
}

/**
 * Dash pattern dropdown: the shared {@link Select} with a stroke sample after each label.
 *
 * @component DashPatternSelect
 * @description Renders the shared {@link Select} dropdown for Simple Line dash patterns. Each option, and the trigger that mirrors the selected one, shows its localized label on the left and a 128px stroke sample on the right, so the control looks, focuses and behaves exactly like every other dropdown.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {DashPatternSelectProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const DashPatternSelect: React.FC<DashPatternSelectProps> = ({
  id,
  value,
  dashArray,
  disabled = false,
  onChange,
  t,
}) => {
  const options: SelectOption<DashPatternPreset>[] = PATTERN_OPTIONS.map(
    (opt) => ({
      value: opt.value,
      label: t(opt.labelKey),
      adornment: (
        <DashPatternSample pattern={opt.value} dashArray={dashArray} />
      ),
    })
  );
  return (
    <Select<DashPatternPreset>
      id={id}
      className='dash-pattern-select'
      value={value as DashPatternPreset}
      options={options}
      disabled={disabled}
      onChange={onChange}
    />
  );
};
