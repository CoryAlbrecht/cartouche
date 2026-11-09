/**
 * @file styling.ts
 * @module shared/types/styling
 * @description Centralized TypeScript type definitions and interfaces for the internal map feature styling system, Cartouche Symbology Specification, and screen-anchored gradient fills.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-30
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */

import type { ProjectStyleFormat, SldStyleVersion } from './project';

/**
 * @typedef {Object} SimpleFillComponent
 * @property {string} id - Unique identifier of the fill component.
 * @property {'simple-fill'} type - Component symbolizer discriminator.
 * @property {boolean} enabled - Whether the component is rendered.
 * @property {boolean} [locked] - Whether the component options are locked against accidental edits or deletion.
 * @property {string} color - Hex, RGB, or CSS color string for the polygon fill.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface SimpleFillComponent {
  id: string;
  type: 'simple-fill';
  enabled: boolean;
  locked?: boolean;
  color: string;
}

/**
 * @typedef {Object} GradientFillComponent
 * @property {string} id - Unique identifier of the gradient fill component.
 * @property {'gradient-fill'} type - Component symbolizer discriminator.
 * @property {boolean} enabled - Whether the component is rendered.
 * @property {boolean} [locked] - Whether the component options are locked against accidental edits or deletion.
 * @property {string[]} stops - Array of '<color> <percent>' gradient stop strings (e.g. ['#ffffffff 0%', '#3388ffff 100%']).
 * @property {number} angle - Gradient rotation orientation in degrees [0.0, 360.0] (0° is horizontal left-to-right, 90° is vertical top-to-bottom).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
export interface GradientFillComponent {
  id: string;
  type: 'gradient-fill';
  enabled: boolean;
  locked?: boolean;
  stops: string[];
  angle: number;
}

/**
 * @typedef {Object} SimpleLineComponent
 * @property {string} id - Unique identifier of the line component.
 * @property {'simple-line'} type - Component symbolizer discriminator.
 * @property {boolean} enabled - Whether the component is rendered.
 * @property {boolean} [locked] - Whether the component options are locked against accidental edits or deletion.
 * @property {string} color - Hex, RGB, or CSS color string for the line or outline stroke.
 * @property {number} width - Stroke width in pixels (floating-point >= 0.0).
 * @property {number} [offset] - Perpendicular line offset in pixels along feature normal.
 * @property {'butt' | 'round' | 'square'} [cap] - Line cap style.
 * @property {'bevel' | 'miter' | 'round'} [join] - Line join style.
 * @property {string} [dashPattern] - Dash pattern preset name ('solid' | 'no-line' | 'dash' | 'dot' | 'dash-dot' | 'dash-dot-dot' | 'long-dash' | 'long-dash-dot' | 'sparse-dot' | 'custom').
 * @property {number} [dashOffset] - Phase offset of the dash pattern along the stroke in pixels (floating-point >= 0.0).
 * @property {number[]} [dashArray] - Sequence of line and gap lengths in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export interface SimpleLineComponent {
  id: string;
  type: 'simple-line';
  enabled: boolean;
  locked?: boolean;
  color: string;
  width: number;
  offset?: number;
  cap?: 'butt' | 'round' | 'square';
  join?: 'bevel' | 'miter' | 'round';
  dashPattern?: string;
  dashOffset?: number;
  dashArray?: number[];
}

/**
 * @typedef {'solid' | 'no-line' | 'dash' | 'dot' | 'dash-dot' | 'dash-dot-dot' | 'long-dash' | 'long-dash-dot' | 'sparse-dot' | 'custom'} DashPatternPreset
 * @description Standard CAD/GIS and custom stroke dash pattern preset identifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export type DashPatternPreset =
  | 'solid'
  | 'no-line'
  | 'dash'
  | 'dot'
  | 'dash-dot'
  | 'dash-dot-dot'
  | 'long-dash'
  | 'long-dash-dot'
  | 'sparse-dot'
  | 'custom';

/**
 * Standard dictionary mapping CAD/GIS dash pattern presets to their alternating line/gap length sequences in pixels.
 * @type {Record<string, number[]>}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export const DASH_PATTERN_PRESETS: Record<string, number[]> = {
  'solid': [],
  'no-line': [],
  'dash': [10, 5],
  'dot': [2, 3],
  'dash-dot': [10, 4, 2, 4],
  'dash-dot-dot': [10, 4, 2, 4, 2, 4],
  'long-dash': [18, 6],
  'long-dash-dot': [18, 5, 2, 5],
  'sparse-dot': [2, 6],
};

/**
 * Matches a numeric dash array sequence or explicit pattern token against standard CAD/GIS dash pattern presets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {number[]} [dashArray] - Optional alternating line and gap lengths array.
 * @param {string} [explicitPattern] - Optional explicit dashPattern string.
 * @returns {string} Matched preset identifier or 'custom'.
 */
export function matchDashPattern(
  dashArray?: number[],
  explicitPattern?: string
): string {
  if (explicitPattern === 'no-line') {
    return 'no-line';
  }
  if (explicitPattern === 'custom') {
    return 'custom';
  }
  if (!dashArray || dashArray.length === 0) {
    return explicitPattern === 'no-line' ? 'no-line' : 'solid';
  }
  for (const [preset, arr] of Object.entries(DASH_PATTERN_PRESETS)) {
    if (preset === 'solid' || preset === 'no-line') {
      continue;
    }
    if (
      arr.length === dashArray.length &&
      arr.every((val, idx) => Math.abs(val - dashArray[idx]) < 1e-4)
    ) {
      return preset;
    }
  }
  return 'custom';
}

/**
 * @typedef {Object} SimpleMarkerComponent
 * @property {string} id - Unique identifier of the marker component.
 * @property {'simple-marker'} type - Component symbolizer discriminator.
 * @property {boolean} enabled - Whether the component is rendered.
 * @property {boolean} [locked] - Whether the component options are locked against accidental edits or deletion.
 * @property {'circle'} shape - Marker shape geometry.
 * @property {number} radius - Marker radius in pixels.
 * @property {string} fillColor - Hex, RGB, or CSS color string for marker interior.
 * @property {string} strokeColor - Hex, RGB, or CSS color string for marker border.
 * @property {number} strokeWidth - Marker border stroke width in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface SimpleMarkerComponent {
  id: string;
  type: 'simple-marker';
  enabled: boolean;
  locked?: boolean;
  shape: 'circle';
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

/**
 * @typedef {SimpleFillComponent | GradientFillComponent | SimpleLineComponent | SimpleMarkerComponent} StyleComponent
 * @description Tagged union of discrete symbolizer components stored in sequential painter's execution order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
export type StyleComponent =
  | SimpleFillComponent
  | GradientFillComponent
  | SimpleLineComponent
  | SimpleMarkerComponent;

/**
 * @typedef {'simple' | 'categorized' | 'graduated' | 'rules'} CartoucheStyleFormat
 * @description Top-level symbology model format classification.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export type CartoucheStyleFormat = 'simple' | 'categorized' | 'graduated' | 'rules';

/**
 * @typedef {Object} SimpleCartoucheStyle
 * @property {'simple'} format - Simple single-symbolizer or multi-component stack symbology mode.
 * @property {1} version - Cartouche Symbology Specification version number.
 * @property {StyleComponent[]} components - Sequential painter's order components (index 0 is painted bottom-most).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface SimpleCartoucheStyle {
  format: 'simple';
  version: 1;
  components: StyleComponent[];
}

/**
 * @typedef {Object} CategorizedCartoucheStyle
 * @property {'categorized'} format - Attribute value categorical symbology mode.
 * @property {1} version - Cartouche Symbology Specification version number.
 * @property {StyleComponent[]} [components] - Optional default or fallback symbolizer components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface CategorizedCartoucheStyle {
  format: 'categorized';
  version: 1;
  components?: StyleComponent[];
}

/**
 * @typedef {Object} GraduatedCartoucheStyle
 * @property {'graduated'} format - Numeric range graduated symbology mode.
 * @property {1} version - Cartouche Symbology Specification version number.
 * @property {StyleComponent[]} [components] - Optional default or fallback symbolizer components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface GraduatedCartoucheStyle {
  format: 'graduated';
  version: 1;
  components?: StyleComponent[];
}

/**
 * @typedef {Object} RulesCartoucheStyle
 * @property {'rules'} format - Expression rule-based symbology mode.
 * @property {1} version - Cartouche Symbology Specification version number.
 * @property {StyleComponent[]} [components] - Optional default or fallback symbolizer components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface RulesCartoucheStyle {
  format: 'rules';
  version: 1;
  components?: StyleComponent[];
}

/**
 * @typedef {SimpleCartoucheStyle | CategorizedCartoucheStyle | GraduatedCartoucheStyle | RulesCartoucheStyle} CartoucheLayerStyle
 * @description Canonical serializable Cartouche Symbology Specification model.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export type CartoucheLayerStyle =
  | SimpleCartoucheStyle
  | CategorizedCartoucheStyle
  | GraduatedCartoucheStyle
  | RulesCartoucheStyle;

/**
 * @typedef {Object} StyleValidationResult
 * @property {boolean} isValid - Whether the style syntax and structure is valid.
 * @property {string} [error] - Error message if invalid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface StyleValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * @typedef {Object} StyleFormatConversionOptions
 * @property {ProjectStyleFormat} fromFormat - Source style format dialect.
 * @property {ProjectStyleFormat} toFormat - Target style format dialect.
 * @property {SldStyleVersion} [fromVersion] - Optional source SLD specification version.
 * @property {SldStyleVersion} [toVersion] - Optional target SLD specification version.
 * @property {string} [geometryKind] - Optional geometry kind hint for target format mapping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface StyleFormatConversionOptions {
  fromFormat: ProjectStyleFormat;
  toFormat: ProjectStyleFormat;
  fromVersion?: SldStyleVersion;
  toVersion?: SldStyleVersion;
  geometryKind?: string;
}

/**
 * @typedef {Object} LayerVisualSymbolizer
 * @property {string} [fillColor] - Hex or CSS color string for polygon or marker fill.
 * @property {number} [fillOpacity] - Fill opacity between 0.0 and 1.0.
 * @property {string} [strokeColor] - Hex or CSS color string for outline or line stroke.
 * @property {number} [strokeWidth] - Outline or line stroke width in pixels.
 * @property {boolean} [strokeLineDash] - Whether the stroke uses a dashed line pattern.
 * @property {'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'x'} [pointShape] - Well-known point marker shape.
 * @property {number} [pointRadius] - Point marker radius in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface LayerVisualSymbolizer {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeLineDash?: boolean;
  pointShape?: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'x';
  pointRadius?: number;
}

