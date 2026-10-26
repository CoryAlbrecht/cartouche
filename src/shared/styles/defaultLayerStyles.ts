/**
 * @file defaultLayerStyles.ts
 * @module shared/styles/defaultLayerStyles
 * @description Shared default OpenLayers vector layer styling rules and lookup helpers for Polygon, LineString, Point, and multi-geometry feature layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see {@link createDefaultVectorLayerStyle}
 * @see {@link generateDefaultVectorStyleJson}
 * @see {@link getDefaultLayerStyle}
 * @see {@link resolveLayerStyle}
 * @see {@link defaultLayerStyles}
 */

import { getRandomCssColors } from "../colors/cssColors";

/**
 * @typedef {Object} OlFlatStyleRule
 * @property {any[]} filter - OpenLayers expression filter.
 * @property {Record<string, any>} style - Flat style property definitions.
 */
export interface OlFlatStyleRule {
  filter: any[];
  style: Record<string, any>;
}

/**
 * @description Generates a 3-rule OpenLayers Flat Style array for Polygon, LineString, and Point geometries with distinct colors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {[string, string, string]} [colors] - Optional explicit [polygonFill, lineStroke, pointFill] CSS color names. If omitted, samples three distinct random colors from the contrast-filtered palette.
 * @returns {OlFlatStyleRule[]} Array of 3 OpenLayers flat style rules.
 */
export function createDefaultVectorLayerStyle(
  colors?: [string, string, string]
): OlFlatStyleRule[] {
  const [polygonColor, lineColor, pointColor] =
    colors || (getRandomCssColors(3) as [string, string, string]);

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
 * @description Generates the serialized JSON string representation of the default multi-geometry vector layer style rules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {[string, string, string]} [colors] - Optional explicit [polygonFill, lineStroke, pointFill] CSS color names.
 * @returns {string} Formatted JSON string of OpenLayers flat style rules.
 */
export function generateDefaultVectorStyleJson(
  colors?: [string, string, string]
): string {
  return JSON.stringify(createDefaultVectorLayerStyle(colors), null, 2);
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
 * @description Resolves OpenLayers Flat Style rules from various raw representations (JSON string, metadata object with content or href, or raw rules object/array), falling back to default geometry style rules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {unknown} style - Raw style descriptor (string, object with content/href, or rule definition).
 * @param {Array<{ id: string; content: string; format?: string }>} [sharedStyles] - Optional collection of shared project styles to resolve href references against.
 * @param {string} [fallbackGeometryKind='Unknown'] - Fallback geometry kind when style cannot be resolved.
 * @returns {Record<string, any> | Array<Record<string, any>>} Valid OpenLayers Flat Style rules array or object.
 */
export function resolveLayerStyle(
  style: unknown,
  sharedStyles?: Array<{ id: string; content: string; format?: string }>,
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
        if (parsed && (typeof parsed === "object" || Array.isArray(parsed))) {
          return resolveLayerStyle(parsed, sharedStyles, fallbackGeometryKind);
        }
      } catch {
        // Fall through to fallback
      }
    }
    return getDefaultLayerStyle(fallbackGeometryKind);
  }

  // 3. If style is an object
  if (typeof style === "object" && style !== null) {
    const obj = style as Record<string, any>;

    // 3a. Check for 'href' reference to shared style
    if ("href" in obj && typeof obj.href === "string") {
      const targetId = obj.href.replace(/^#/, "");
      if (sharedStyles && sharedStyles.length > 0) {
        const matched = sharedStyles.find((s) => s.id === targetId);
        if (matched && matched.content) {
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
      return getDefaultLayerStyle(fallbackGeometryKind);
    }

    // 3b. Check for 'content' wrapper property
    if ("content" in obj && typeof obj.content === "string") {
      try {
        const parsed = JSON.parse(obj.content);
        if (parsed && (typeof parsed === "object" || Array.isArray(parsed))) {
          return resolveLayerStyle(parsed, sharedStyles, fallbackGeometryKind);
        }
      } catch {
        // Fall through to fallback
      }
      return getDefaultLayerStyle(fallbackGeometryKind);
    }

    // 3c. If it's a Flat Style rule object or dictionary of flat styles (has style keys or filter)
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
