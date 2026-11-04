/**
 * @file defaultLayerStyles.ts
 * @module shared/styles/defaultLayerStyles
 * @description Shared default OpenLayers vector layer styling rules and lookup helpers for Polygon, LineString, Point, and multi-geometry feature layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link createDefaultVectorLayerStyle}
 * @see {@link generateDefaultVectorStyleJson}
 * @see {@link createDefaultCartoucheLayerStyle}
 * @see {@link createDefaultCartoucheLayerStyleJson}
 * @see {@link isCartoucheLayerStyle}
 * @see {@link getDefaultLayerStyle}
 * @see {@link resolveLayerStyle}
 * @see {@link isProjectLayerStyleWrapper}
 * @see {@link defaultLayerStyles}
 */

import { getRandomCssColors } from "../colors/cssColors";
import {
  isProjectLayerStyleWrapper,
  type ProjectLayerStyleItem,
  type OlFlatStyleRule,
  type OlLayerStyle,
} from "../types/project";
import type {
  CartoucheLayerStyle,
  SimpleCartoucheStyle,
  StyleComponent,
  SimpleFillComponent,
  SimpleLineComponent,
  SimpleMarkerComponent,
} from "../types/styling";

export {
  isProjectLayerStyleWrapper,
  type ProjectLayerStyleItem,
  type OlFlatStyleRule,
  type OlLayerStyle,
  type CartoucheLayerStyle,
  type SimpleCartoucheStyle,
  type StyleComponent,
  type SimpleFillComponent,
  type SimpleLineComponent,
  type SimpleMarkerComponent,
};

/**
 * @description Generates OpenLayers Flat Style rules tailored to a specific geometry kind (single rule for Polygon, LineString, Point) or a 3-rule composite style for Unknown/mixed geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string[]} [colors] - Optional explicit CSS color names for composite rules.
 * @returns {OlFlatStyleRule[]} Array of OpenLayers flat style rules.
 */
export function createDefaultVectorLayerStyle(
  colors?: string[]
): OlFlatStyleRule[];
/**
 * @description Generates OpenLayers Flat Style rules tailored to a specific geometry kind (single rule for Polygon, LineString, Point) or a 3-rule composite style for Unknown/mixed geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Target layer geometry kind ('Polygon', 'LineString', 'Point', 'Unknown', etc.).
 * @param {string[]} [colors] - Optional explicit CSS color names.
 * @returns {OlFlatStyleRule[]} Array of OpenLayers flat style rules.
 */
export function createDefaultVectorLayerStyle(
  geometryKind?: string,
  colors?: string[]
): OlFlatStyleRule[];
/**
 * @description Generates OpenLayers Flat Style rules tailored to a specific geometry kind (single rule for Polygon, LineString, Point) or a 3-rule composite style for Unknown/mixed geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string | string[]} [geometryKindOrColors] - Geometry kind string or explicit colors array.
 * @param {string[]} [explicitColors] - Optional explicit CSS colors array when first parameter is geometryKind.
 * @returns {OlFlatStyleRule[]} Array of OpenLayers flat style rules.
 */
export function createDefaultVectorLayerStyle(
  geometryKindOrColors?: string | string[],
  explicitColors?: string[]
): OlFlatStyleRule[] {
  let geometryKind: string | undefined;
  let colors: string[] | undefined;

  if (Array.isArray(geometryKindOrColors)) {
    geometryKind = undefined;
    colors = geometryKindOrColors;
  } else {
    geometryKind = geometryKindOrColors;
    colors = explicitColors;
  }

  const gKind = (geometryKind || "Unknown").toLowerCase();

  if (gKind.includes("polygon")) {
    const polygonColor =
      (colors && colors[0]) || (getRandomCssColors(1)[0] as string);
    return [
      {
        filter: ["==", ["geometry-type"], "Polygon"],
        style: {
          "fill-color": polygonColor,
          "stroke-color": "#000000",
          "stroke-width": 1,
        },
      },
    ];
  }

  if (gKind.includes("line")) {
    const lineColor =
      (colors && (colors.length >= 2 ? colors[1] : colors[0])) ||
      (getRandomCssColors(1)[0] as string);
    return [
      {
        filter: ["==", ["geometry-type"], "LineString"],
        style: {
          "stroke-color": lineColor,
          "stroke-width": 2,
          "stroke-line-cap": "round",
          "stroke-line-join": "round",
        },
      },
    ];
  }

  if (gKind.includes("point")) {
    const pointColor =
      (colors && (colors.length >= 3 ? colors[2] : colors[0])) ||
      (getRandomCssColors(1)[0] as string);
    return [
      {
        filter: ["==", ["geometry-type"], "Point"],
        style: {
          "circle-radius": 6,
          "circle-fill-color": pointColor,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 1,
        },
      },
    ];
  }

  // Unknown, GeometryCollection, or mixed geometries -> 3-rule composite style
  const [polygonColor, lineColor, pointColor] =
    colors && colors.length >= 3
      ? (colors.slice(0, 3) as [string, string, string])
      : (getRandomCssColors(3) as [string, string, string]);

  return [
    // 1. Polygons
    {
      filter: ["==", ["geometry-type"], "Polygon"],
      style: {
        "fill-color": polygonColor,
        "stroke-color": "#000000",
        "stroke-width": 1,
      },
    },
    // 2. Lines
    {
      filter: ["==", ["geometry-type"], "LineString"],
      style: {
        "stroke-color": lineColor,
        "stroke-width": 1,
        "stroke-line-cap": "round",
        "stroke-line-join": "round",
      },
    },
    // 3. Points
    {
      filter: ["==", ["geometry-type"], "Point"],
      style: {
        "circle-radius": 6,
        "circle-fill-color": pointColor,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1,
      },
    },
  ];
}

/**
 * @description Generates the serialized JSON string representation of default vector layer style rules for a specific geometry kind or composite style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string[]} [colors] - Optional explicit CSS color names for composite rules.
 * @returns {string} Formatted JSON string of OpenLayers flat style rules.
 */
export function generateDefaultVectorStyleJson(colors?: string[]): string;
/**
 * @description Generates the serialized JSON string representation of default vector layer style rules for a specific geometry kind or composite style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Target layer geometry kind ('Polygon', 'LineString', 'Point', 'Unknown', etc.).
 * @param {string[]} [colors] - Optional explicit CSS color names.
 * @returns {string} Formatted JSON string of OpenLayers flat style rules.
 */
export function generateDefaultVectorStyleJson(
  geometryKind?: string,
  colors?: string[]
): string;
/**
 * @description Generates the serialized JSON string representation of default vector layer style rules for a specific geometry kind or composite style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string | string[]} [geometryKindOrColors] - Geometry kind string or explicit colors array.
 * @param {string[]} [explicitColors] - Optional explicit CSS colors array when first parameter is geometryKind.
 * @returns {string} Formatted JSON string of OpenLayers flat style rules.
 */
export function generateDefaultVectorStyleJson(
  geometryKindOrColors?: string | string[],
  explicitColors?: string[]
): string {
  if (Array.isArray(geometryKindOrColors)) {
    return JSON.stringify(
      createDefaultVectorLayerStyle(undefined, geometryKindOrColors),
      null,
      2
    );
  }
  return JSON.stringify(
    createDefaultVectorLayerStyle(geometryKindOrColors, explicitColors),
    null,
    2
  );
}

/**
 * @description Type guard verifying whether an object conforms to the Cartouche Symbology Specification (CartoucheLayerStyle).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {unknown} value - Object to inspect.
 * @returns {boolean} True if value is a valid CartoucheLayerStyle.
 */
export function isCartoucheLayerStyle(
  value: unknown
): value is CartoucheLayerStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, any>;
  if (obj.version !== 1) {
    return false;
  }
  if (obj.format === "simple") {
    return Array.isArray(obj.components);
  }
  return (
    obj.format === "categorized" ||
    obj.format === "graduated" ||
    obj.format === "rules"
  );
}

/**
 * @description Generates a default Cartouche Symbology Specification style (SimpleCartoucheStyle) appropriate to the layer geometry kind.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} [geometryKind='Unknown'] - Geometry kind of the target layer ('Polygon', 'LineString', 'Point', etc.).
 * @param {string} [color] - Optional primary fill/stroke CSS color name or hex code. If omitted, samples random contrast colors.
 * @returns {SimpleCartoucheStyle} Geometry-appropriate Simple CartoucheLayerStyle object.
 */
export function createDefaultCartoucheLayerStyle(
  geometryKind?: string,
  color?: string
): SimpleCartoucheStyle {
  const primaryColor = color || (getRandomCssColors(1)[0] as string);
  const gKind = (geometryKind || "Unknown").toLowerCase();

  let components: StyleComponent[];

  if (gKind.includes("polygon")) {
    components = [
      {
        id: "fill-1",
        type: "simple-fill",
        enabled: true,
        color: primaryColor,
      },
      {
        id: "line-1",
        type: "simple-line",
        enabled: true,
        color: "#000000",
        width: 1,
      },
    ];
  } else if (gKind.includes("line")) {
    components = [
      {
        id: "line-1",
        type: "simple-line",
        enabled: true,
        color: primaryColor,
        width: 2,
      },
    ];
  } else if (gKind.includes("point")) {
    components = [
      {
        id: "marker-1",
        type: "simple-marker",
        enabled: true,
        shape: "circle",
        radius: 6,
        fillColor: primaryColor,
        strokeColor: "#000000",
        strokeWidth: 1,
      },
    ];
  } else {
    // Unknown or mixed geometries -> 3 distinct random colors from contrast-filtered palette
    const [polyColor, lineCol, ptColor] = color
      ? [color, color, color]
      : (getRandomCssColors(3) as [string, string, string]);
    components = [
      {
        id: "fill-1",
        type: "simple-fill",
        enabled: true,
        color: polyColor,
      },
      {
        id: "line-1",
        type: "simple-line",
        enabled: true,
        color: lineCol,
        width: 1,
      },
      {
        id: "marker-1",
        type: "simple-marker",
        enabled: true,
        shape: "circle",
        radius: 6,
        fillColor: ptColor,
        strokeColor: "#000000",
        strokeWidth: 1,
      },
    ];
  }

  return {
    format: "simple",
    version: 1,
    components,
  };
}

/**
 * @description Generates the serialized JSON string representation of the default Cartouche Symbology style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} [geometryKind='Unknown'] - Geometry kind of the target layer.
 * @param {string} [color] - Optional primary fill/stroke CSS color name or hex code.
 * @returns {string} Formatted JSON string of the default Cartouche Symbology style.
 */
export function createDefaultCartoucheLayerStyleJson(
  geometryKind?: string,
  color?: string
): string {
  return JSON.stringify(
    createDefaultCartoucheLayerStyle(geometryKind, color),
    null,
    2
  );
}

/**
 * @description Standard default styling rules for spatial vector layers by geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @type {Record<string, Record<string, any>>}
 */
export const defaultLayerStyles: Record<string, Record<string, any>> = {
  Polygon: {
    "fill-color": "#1e293b",
    "stroke-width": 0,
    "stroke-color": "transparent",
  },
  LineString: { "stroke-color": "#0284c7", "stroke-width": 1 },
  Point: { "circle-radius": 8, "circle-fill-color": "#0369a1" },
  Unknown: {
    "fill-color": "#1e293b",
    "stroke-color": "#0284c7",
    "stroke-width": 2,
    "circle-radius": 8,
    "circle-fill-color": "#0369a1",
  },
};

/**
 * @description Generates default OpenLayers flat styling expression based on geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Optional geometry kind string ('Point' | 'LineString' | 'Polygon' | 'Raster' | 'Unknown').
 * @returns {Record<string, any>} Flat style object definition.
 */
export function getDefaultLayerStyle(
  geometryKind?: string
): Record<string, any> {
  const gKind = (geometryKind || "Unknown").toLowerCase();
  if (gKind.includes("polygon")) {
    return defaultLayerStyles.Polygon;
  }
  if (gKind.includes("line")) {
    return defaultLayerStyles.LineString;
  }
  if (gKind.includes("point")) {
    return defaultLayerStyles.Point;
  }
  return defaultLayerStyles.Unknown;
}

/**
 * @description Resolves OpenLayers Flat Style rules or SLD ProjectLayerStyleItem containers from various raw representations (JSON string, metadata object with content or href, or raw rules object/array), falling back to default geometry style rules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {unknown} style - Raw style descriptor (string, object with content/href, or rule definition).
 * @param {Array<{ id: string; content: string; format?: string; version?: string }>} [sharedStyles] - Optional collection of shared project styles to resolve href references against.
 * @param {string} [fallbackGeometryKind='Unknown'] - Fallback geometry kind when style cannot be resolved.
 * @returns {Record<string, any> | Array<Record<string, any>>} Valid OpenLayers Flat Style rules array/object or SLD ProjectLayerStyleItem container.
 */
export function resolveLayerStyle(
  style: unknown,
  sharedStyles?: Array<{
    id: string;
    content: string;
    format?: string;
    version?: string;
  }>,
  fallbackGeometryKind: string = "Unknown"
): Record<string, any> | Array<Record<string, any>> {
  if (!style) {
    return getDefaultLayerStyle(fallbackGeometryKind);
  }

  // 1. If style is already an array of rules (e.g. OlFlatStyleRule[])
  if (Array.isArray(style)) {
    if (style.length > 0) {
      return style;
    }
    return getDefaultLayerStyle(fallbackGeometryKind);
  }

  // 2. If style is a JSON string
  if (typeof style === "string") {
    const trimmed = style.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isCartoucheLayerStyle(parsed)) {
          return {
            content: trimmed,
            format: "cartouche",
          };
        }
        if (parsed && (typeof parsed === "object" || Array.isArray(parsed))) {
          return resolveLayerStyle(parsed, sharedStyles, fallbackGeometryKind);
        }
      } catch {
        // Fall through to fallback
      }
    }
    return getDefaultLayerStyle(fallbackGeometryKind);
  }

  // 3. If style is a ProjectLayerStyleItem container
  if (isProjectLayerStyleWrapper(style)) {
    // 3a. Check for 'href' reference to shared style
    if (style.href) {
      const targetId = style.href.replace(/^#/, "");
      if (sharedStyles && sharedStyles.length > 0) {
        const matched = sharedStyles.find((s) => s.id === targetId);
        if (matched && matched.content) {
          if (matched.format === "cartouche" || style.format === "cartouche") {
            return {
              content: matched.content,
              format: "cartouche",
            };
          }
          if (matched.format === "sld" || style.format === "sld") {
            const trimmedSld = matched.content.trim();
            if (trimmedSld.startsWith("<")) {
              const ver = matched.version || style.version;
              return {
                content: trimmedSld,
                format: "sld",
                ...(ver === "1.0.0" || ver === "1.1.0" ? { version: ver } : {}),
              };
            }
            return getDefaultLayerStyle(fallbackGeometryKind);
          }
          try {
            const parsed = JSON.parse(matched.content);
            if (
              parsed
              && (typeof parsed === "object" || Array.isArray(parsed))
            ) {
              return resolveLayerStyle(
                parsed,
                sharedStyles,
                fallbackGeometryKind
              );
            }
          } catch {
            // Fall through to fallback
          }
        }
      }
      if (!style.content) {
        return getDefaultLayerStyle(fallbackGeometryKind);
      }
    }

    // 3b. Check for 'content' wrapper property
    if (style.content) {
      if (style.format === "cartouche") {
        return {
          content: style.content,
          format: "cartouche",
        };
      }
      if (style.format === "sld") {
        const trimmedSld = style.content.trim();
        if (trimmedSld.startsWith("<")) {
          return {
            content: trimmedSld,
            format: "sld",
            ...(style.version ? { version: style.version } : {}),
          };
        }
        return getDefaultLayerStyle(fallbackGeometryKind);
      }
      try {
        const parsed = JSON.parse(style.content);
        if (parsed && (typeof parsed === "object" || Array.isArray(parsed))) {
          return resolveLayerStyle(parsed, sharedStyles, fallbackGeometryKind);
        }
      } catch {
        // Fall through to fallback
      }
      return getDefaultLayerStyle(fallbackGeometryKind);
    }
  }

  // 4. If style is an object (CartoucheLayerStyle or Flat Style rule object)
  if (typeof style === "object" && style !== null) {
    if (isCartoucheLayerStyle(style)) {
      return {
        content: JSON.stringify(style, null, 2),
        format: "cartouche",
      };
    }
    const obj = style as Record<string, any>;
    const keys = Object.keys(obj);
    const hasSymbolizerProps = keys.some(
      (k) =>
        k.includes("fill")
        || k.includes("stroke")
        || k.includes("circle")
        || k.includes("icon")
        || k.includes("text")
        || k === "filter"
        || k === "style"
    );

    if (hasSymbolizerProps) {
      return obj;
    }
  }

  return getDefaultLayerStyle(fallbackGeometryKind);
}
