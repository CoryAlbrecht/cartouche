/**
 * @file styling.ts
 * @module shared/types/styling
 * @description Centralized TypeScript type definitions and interfaces for the internal map feature styling system and Cartouche Symbology Specification.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-30
 * @updated 2026-11-01
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
 * @typedef {Object} SimpleLineComponent
 * @property {string} id - Unique identifier of the line component.
 * @property {'simple-line'} type - Component symbolizer discriminator.
 * @property {boolean} enabled - Whether the component is rendered.
 * @property {boolean} [locked] - Whether the component options are locked against accidental edits or deletion.
 * @property {string} color - Hex, RGB, or CSS color string for the line or outline stroke.
 * @property {number} width - Stroke width in pixels.
 * @property {number[]} [dashArray] - Optional dash and gap sequence in pixels (e.g. [4, 4]).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface SimpleLineComponent {
  id: string;
  type: 'simple-line';
  enabled: boolean;
  locked?: boolean;
  color: string;
  width: number;
  dashArray?: number[];
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
 * @typedef {SimpleFillComponent | SimpleLineComponent | SimpleMarkerComponent} StyleComponent
 * @description Tagged union of discrete symbolizer components stored in sequential painter's execution order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export type StyleComponent =
  | SimpleFillComponent
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

