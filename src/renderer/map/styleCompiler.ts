/**
 * @file styleCompiler.ts
 * @module renderer/map/styleCompiler
 * @description Headless Renderer style compiler and feature attribute extractor supporting Cartouche Symbology Specification, screen-anchored Canvas 2D linear gradient fills, native OpenLayers Flat Styles, and OGC Styled Layer Descriptor (SLD) 1.0.0/1.1.0 XML via cached GeoStyler parsers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @see {@link compileLayerStyle}
 * @see {@link compileCartoucheLayerStyleSync}
 * @see {@link compileStyleFunction}
 * @see {@link isCartoucheStyleDescriptor}
 * @see {@link hasGradientFillStyle}
 * @see {@link extractStyleAttributes}
 */

import Style, { type StyleFunction } from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import { SldStyleParser } from "geostyler-sld-parser";
import { OlStyleParser } from "geostyler-openlayers-parser";
import type { Style as GeoStylerStyle } from "geostyler-style";
import { logging } from "../../shared/logging";
import { clamp } from "../../shared/colors";
import {
  createDefaultVectorLayerStyle,
  isProjectLayerStyleWrapper,
  isCartoucheLayerStyle,
} from "../../shared/styles/defaultLayerStyles";
import type {
  ProjectStyleFormat,
  SldStyleVersion,
  ProjectStyleItem,
  CartoucheLayerStyle,
  StyleComponent,
  GradientFillComponent,
} from "../../shared/types";

/**
 * Cached SLD 1.0.0 parser singleton instance.
 * @type {SldStyleParser}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
const sldParser100 = new SldStyleParser({ sldVersion: "1.0.0" });

/**
 * Cached SLD 1.1.0 parser singleton instance.
 * @type {SldStyleParser}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
const sldParser110 = new SldStyleParser({ sldVersion: "1.1.0" });

/**
 * Cached OpenLayers style parser singleton instance.
 * @type {OlStyleParser}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
const olStyleParser = new OlStyleParser();

/**
 * @typedef {Object} CompiledLayerStyleResult
 * @property {any} compiledStyle - Compiled OpenLayers style (Flat Style rules/dictionary or OlStyle/OlParserStyleFct).
 * @property {Set<string>} requiredFields - Feature attribute field names referenced by the style.
 * @property {ProjectStyleFormat} format - Style dialect ("openlayers" or "sld").
 * @property {SldStyleVersion} [version] - SLD version ("1.0.0" or "1.1.0") when format is "sld".
 * @property {boolean} isFallback - True when the input was unstyled or invalid and fell back to the default random-color style.
 * @property {boolean} [hasGradientFill] - True when the compiled style contains an active screen-anchored gradient fill component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
export interface CompiledLayerStyleResult {
  compiledStyle: any;
  requiredFields: Set<string>;
  format: ProjectStyleFormat;
  version?: SldStyleVersion;
  isFallback: boolean;
  hasGradientFill?: boolean;
}

/**
 * @typedef {Object} CompileLayerStyleOptions
 * @property {ProjectStyleItem[]} [sharedStyles] - Shared project styles catalog for resolving `#id` href references.
 * @property {string} [layerId] - Optional layer identifier for diagnostic logging.
 * @property {string} [geometryKind] - Target layer geometry kind ('Polygon', 'LineString', 'Point', etc.) for fallback styling.
 * @property {any} [map] - Optional active OpenLayers Map instance for screen-anchored gradient coordinate projections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
export interface CompileLayerStyleOptions {
  sharedStyles?: ProjectStyleItem[];
  layerId?: string;
  geometryKind?: string;
  map?: any;
}

/**
 * @description Extracts feature attribute names referenced inside `<PropertyName>` elements of an SLD XML string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {string} xml - SLD XML content string.
 * @param {Set<string>} [fields=new Set()] - Accumulator for extracted attribute names.
 * @returns {Set<string>} Set of unique attribute names referenced in the SLD XML.
 */
export function extractSldXmlAttributes(
  xml: string,
  fields: Set<string> = new Set()
): Set<string> {
  if (!xml || typeof xml !== "string") {
    return fields;
  }
  const propTagRegex =
    /<(?:[a-zA-Z0-9_-]+:)?PropertyName[^>]*>\s*([^<\s]+)\s*<\/(?:[a-zA-Z0-9_-]+:)?PropertyName>/gi;
  let match: RegExpExecArray | null;
  while ((match = propTagRegex.exec(xml)) !== null) {
    if (match[1]) {
      fields.add(match[1].trim());
    }
  }
  return fields;
}

/**
 * @description Recursively extracts feature attribute names referenced in a GeoStyler AST (filters, property functions, and `{{field}}` label templates).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {GeoStylerStyle | unknown} ast - GeoStyler Style AST or nested rule/filter/symbolizer structure.
 * @param {Set<string>} [fields=new Set()] - Accumulator for extracted attribute names.
 * @returns {Set<string>} Set of unique attribute names referenced in the GeoStyler AST.
 */
export function extractGeoStylerAttributes(
  ast: GeoStylerStyle | unknown,
  fields: Set<string> = new Set()
): Set<string> {
  if (!ast || typeof ast !== "object") {
    return fields;
  }

  const walkFilter = (filter: unknown): void => {
    if (!Array.isArray(filter) || filter.length === 0) {
      return;
    }
    const op = filter[0];
    if (op === "&&" || op === "||" || op === "!") {
      for (let i = 1; i < filter.length; i++) {
        walkFilter(filter[i]);
      }
      return;
    }
    if (
      op === "=="
      || op === "!="
      || op === "<"
      || op === "<="
      || op === ">"
      || op === ">="
      || op === "*="
      || op === "<=x<="
    ) {
      const propArg = filter[1];
      if (typeof propArg === "string" && propArg.length > 0) {
        fields.add(propArg);
      } else {
        walkValue(propArg);
      }
      for (let i = 2; i < filter.length; i++) {
        walkValue(filter[i]);
      }
    }
  };

  const walkValue = (val: unknown): void => {
    if (!val) {
      return;
    }
    if (typeof val === "string") {
      const tplRegex = /\{\{\s*([^{}\s]+)\s*\}\}/g;
      let match: RegExpExecArray | null;
      while ((match = tplRegex.exec(val)) !== null) {
        if (match[1]) {
          fields.add(match[1]);
        }
      }
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        walkValue(item);
      }
      return;
    }
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (
        obj.name === "property"
        && Array.isArray(obj.args)
        && typeof obj.args[0] === "string"
      ) {
        fields.add(obj.args[0]);
      }
      for (const child of Object.values(obj)) {
        walkValue(child);
      }
    }
  };

  const candidate = ast as Record<string, unknown>;
  if (Array.isArray(candidate.rules)) {
    for (const rule of candidate.rules) {
      if (rule && typeof rule === "object") {
        const r = rule as Record<string, unknown>;
        if (r.filter) {
          walkFilter(r.filter);
        }
        if (Array.isArray(r.symbolizers)) {
          walkValue(r.symbolizers);
        }
      }
    }
  } else {
    walkValue(ast);
  }

  return fields;
}

/**
 * @description Recursively extracts all property names referenced by `['get', '<property>']` expressions in OpenLayers Flat Styles, `<PropertyName>` elements in SLD XML, or rules in a GeoStyler AST.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {unknown} style - Flat style object, array of rules, serialized ProjectLayerStyleItem wrapper, SLD XML string, or GeoStyler AST.
 * @param {Set<string>} [fields=new Set()] - Accumulator for extracted attribute names.
 * @param {ProjectStyleItem[]} [sharedStyles] - Optional shared project styles catalog to resolve `#id` href references.
 * @returns {Set<string>} Set of unique attribute names referenced in the style.
 */
export function extractStyleAttributes(
  style: unknown,
  fields: Set<string> = new Set(),
  sharedStyles?: ProjectStyleItem[]
): Set<string> {
  if (!style) {
    return fields;
  }

  if (typeof style === "string") {
    const trimmed = style.trim();
    if (trimmed.startsWith("<")) {
      return extractSldXmlAttributes(trimmed, fields);
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractStyleAttributes(parsed, fields, sharedStyles);
      } catch {
        return fields;
      }
    }
    return fields;
  }

  if (isProjectLayerStyleWrapper(style)) {
    if (
      style.href
      && !style.content
      && sharedStyles
      && sharedStyles.length > 0
    ) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles.find((s) => s.id === targetId);
      if (matched && matched.content) {
        return extractStyleAttributes(
          {
            content: matched.content,
            format: matched.format || style.format,
            version: matched.version || style.version,
          },
          fields,
          sharedStyles
        );
      }
    }
    if (style.content) {
      const trimmed = style.content.trim();
      if (style.format === "sld" || trimmed.startsWith("<")) {
        return extractSldXmlAttributes(trimmed, fields);
      }
      try {
        const parsed = JSON.parse(trimmed);
        return extractStyleAttributes(parsed, fields, sharedStyles);
      } catch {
        return fields;
      }
    }
    return fields;
  }

  if (typeof style !== "object") {
    return fields;
  }

  if (Array.isArray(style)) {
    if (
      style.length >= 2
      && style[0] === "get"
      && typeof style[1] === "string"
    ) {
      fields.add(style[1]);
    }
    for (const item of style) {
      extractStyleAttributes(item, fields, sharedStyles);
    }
  } else {
    const obj = style as Record<string, unknown>;
    if (Array.isArray(obj.rules)) {
      extractGeoStylerAttributes(obj, fields);
    }
    for (const value of Object.values(obj)) {
      extractStyleAttributes(value, fields, sharedStyles);
    }
  }

  return fields;
}

/**
 * @description Determines whether a raw style descriptor requires asynchronous SLD compilation rather than synchronous OpenLayers Flat Style evaluation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {unknown} style - Candidate style descriptor.
 * @param {ProjectStyleItem[]} [sharedStyles] - Shared project styles catalog.
 * @returns {boolean} True if the style represents SLD XML.
 */
export function isSldStyleDescriptor(
  style: unknown,
  sharedStyles?: ProjectStyleItem[]
): boolean {
  if (!style) {
    return false;
  }
  if (typeof style === "string") {
    return style.trim().startsWith("<");
  }
  if (isProjectLayerStyleWrapper(style)) {
    if (style.format === "sld") {
      return true;
    }
    if (style.href && !style.content && sharedStyles) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles.find((s) => s.id === targetId);
      if (matched) {
        return (
          matched.format === "sld" || matched.content.trim().startsWith("<")
        );
      }
    }
    if (style.content && style.content.trim().startsWith("<")) {
      return true;
    }
  }
  return false;
}

/**
 * @description Determines whether a given style descriptor, wrapper, or raw JSON represents Cartouche Symbology Specification (format="cartouche").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {unknown} style - Style descriptor, ProjectLayerStyleItem container, or raw string/object.
 * @param {ProjectStyleItem[]} [sharedStyles] - Optional shared project styles catalog to resolve `#id` references.
 * @returns {boolean} True if the style is a Cartouche Symbology descriptor.
 */
export function isCartoucheStyleDescriptor(
  style: unknown,
  sharedStyles?: ProjectStyleItem[]
): boolean {
  if (!style) {
    return false;
  }
  if (isProjectLayerStyleWrapper(style)) {
    if (style.format === "cartouche") {
      return true;
    }
    if (style.href && !style.content && sharedStyles) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles.find((s) => s.id === targetId);
      if (matched) {
        if (matched.format === "cartouche") {
          return true;
        }
        try {
          const parsed = JSON.parse(matched.content.trim());
          if (isCartoucheLayerStyle(parsed)) {
            return true;
          }
        } catch {
          // not JSON
        }
      }
    }
    if (style.content) {
      try {
        const parsed = JSON.parse(style.content.trim());
        if (isCartoucheLayerStyle(parsed)) {
          return true;
        }
      } catch {
        // not JSON
      }
    }
  }
  if (typeof style === "object" && isCartoucheLayerStyle(style)) {
    return true;
  }
  if (typeof style === "string") {
    const trimmed = style.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return isCartoucheLayerStyle(parsed);
      } catch {
        return false;
      }
    }
  }
  return false;
}

/**
 * @description Inspects a raw style descriptor, wrapper, or parsed model to determine if it uses gradient fill symbology.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {unknown} style - Style descriptor, wrapper, or parsed CartoucheLayerStyle.
 * @param {ProjectStyleItem[]} [sharedStyles] - Shared project styles catalog for resolving `#id` href references.
 * @returns {boolean} True if the style contains an enabled gradient fill component.
 */
export function hasGradientFillStyle(
  style: unknown,
  sharedStyles?: ProjectStyleItem[]
): boolean {
  if (!style) {
    return false;
  }
  let target = style;
  if (isProjectLayerStyleWrapper(style)) {
    if (style.href && !style.content && sharedStyles) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles.find((s) => s.id === targetId);
      if (matched && matched.content) {
        target = matched.content;
      } else {
        return false;
      }
    } else if (style.content) {
      target = style.content;
    }
  }

  let model: CartoucheLayerStyle | null = null;
  if (typeof target === "string") {
    try {
      const parsed = JSON.parse(target.trim());
      if (isCartoucheLayerStyle(parsed)) {
        model = parsed;
      }
    } catch {
      return false;
    }
  } else if (typeof target === "object" && isCartoucheLayerStyle(target)) {
    model = target;
  }

  if (!model || !Array.isArray(model.components)) {
    return false;
  }

  return model.components.some(
    (c) => c.type === "gradient-fill" && c.enabled !== false
  );
}

/**
 * @typedef {Object} CompiledGradientStop
 * @property {string} color - Normalized CSS color string.
 * @property {number} offset - Clamped offset in range [0, 1].
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
export interface CompiledGradientStop {
  color: string;
  offset: number;
}

/**
 * Parses raw CSS stop strings into structured CompiledGradientStop objects with offsets normalized to [0, 1].
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {string[]} [rawStops] - Array of '<color> <percent>' strings.
 * @returns {CompiledGradientStop[]} Sorted gradient stop definitions.
 */
export function parseGradientStops(rawStops?: string[]): CompiledGradientStop[] {
  if (!rawStops || rawStops.length === 0) {
    return [
      { color: "#ffffff", offset: 0 },
      { color: "#3388ff", offset: 1 },
    ];
  }

  const parsed = rawStops.map((stopStr, idx) => {
    const trimmed = stopStr.trim();
    const match = trimmed.match(/^(.*?)\s+([\d.]+)\s*%?\s*$/);
    if (match) {
      const color = match[1].trim();
      const offset = clamp(parseFloat(match[2]) / 100, 0, 1);
      return { color, offset };
    }
    const offset = rawStops.length > 1 ? idx / (rawStops.length - 1) : 0;
    return { color: trimmed, offset: clamp(offset, 0, 1) };
  });

  return parsed.sort((a, b) => a.offset - b.offset);
}

/**
 * Cached singleton offscreen canvas 2D rendering context used for gradient generation in headless/test environments.
 * @type {CanvasRenderingContext2D | null}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 */
let sharedOffscreenContext: CanvasRenderingContext2D | null = null;

/**
 * Retrieves a CanvasRenderingContext2D instance from the active map viewport or falls back to an offscreen canvas context.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {any} [map] - Optional active OpenLayers Map instance.
 * @returns {CanvasRenderingContext2D | null} Canvas 2D context or null if unavailable.
 */
function getCanvasContext(map?: any): CanvasRenderingContext2D | null {
  if (map && typeof map.getViewport === "function") {
    try {
      const viewport = map.getViewport();
      const canvas = viewport?.querySelector?.("canvas");
      const ctx = canvas?.getContext?.("2d");
      if (ctx) {
        return ctx;
      }
    } catch {
      // Fall through to shared context
    }
  }

  if (!sharedOffscreenContext && typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
      const canvas = document.createElement("canvas");
      sharedOffscreenContext = canvas.getContext("2d");
    } catch {
      sharedOffscreenContext = null;
    }
  }

  return sharedOffscreenContext;
}

/**
 * Dynamically builds an OpenLayers Style instance containing a Canvas 2D linear gradient anchored to the feature's screen pixel bounding extent.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {GradientFillComponent} component - Declarative gradient fill component specification.
 * @param {any} feature - Target OpenLayers Feature under evaluation.
 * @param {any} [map] - Optional active OpenLayers Map instance.
 * @returns {Style} OpenLayers Style with CanvasGradient fill or solid fallback.
 */
function createGradientComponentStyle(
  component: GradientFillComponent,
  feature: any,
  map?: any
): Style {
  const stops = parseGradientStops(component.stops);
  const fallbackColor = stops[0]?.color || "#3388ff";

  if (!feature || typeof feature.getGeometry !== "function") {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const geom = feature.getGeometry();
  if (!geom || typeof geom.getExtent !== "function") {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  if (!map || typeof map.getPixelFromCoordinate !== "function") {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const extent = geom.getExtent(); // [minX, minY, maxX, maxY]
  const topLeftPixel = map.getPixelFromCoordinate([extent[0], extent[3]]);
  const bottomRightPixel = map.getPixelFromCoordinate([extent[2], extent[1]]);

  if (
    !topLeftPixel ||
    !bottomRightPixel ||
    !Number.isFinite(topLeftPixel[0]) ||
    !Number.isFinite(topLeftPixel[1]) ||
    !Number.isFinite(bottomRightPixel[0]) ||
    !Number.isFinite(bottomRightPixel[1])
  ) {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const pxWidth = Math.abs(bottomRightPixel[0] - topLeftPixel[0]);
  const pxHeight = Math.abs(bottomRightPixel[1] - topLeftPixel[1]);

  if (pxWidth <= 0 && pxHeight <= 0) {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const cx = (topLeftPixel[0] + bottomRightPixel[0]) / 2;
  const cy = (topLeftPixel[1] + bottomRightPixel[1]) / 2;

  const angleDeg = Number.isFinite(component.angle) ? component.angle : 0;
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const len = Math.abs(pxWidth * cosA) + Math.abs(pxHeight * sinA);
  const halfLen = len > 0 ? len / 2 : Math.max(pxWidth, pxHeight) / 2 || 1;

  const x0 = cx - halfLen * cosA;
  const y0 = cy - halfLen * sinA;
  const x1 = cx + halfLen * cosA;
  const y1 = cy + halfLen * sinA;

  if (Math.abs(x1 - x0) < 1e-6 && Math.abs(y1 - y0) < 1e-6) {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const ctx = getCanvasContext(map);
  if (!ctx || typeof ctx.createLinearGradient !== "function") {
    return new Style({
      fill: new Fill({ color: fallbackColor }),
    });
  }

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return new Style({
    fill: new Fill({
      color: gradient,
    }),
  });
}

/**
 * @description Compiles an authoritative Cartouche Symbology model into an OpenLayers StyleFunction.
 * Supports static Style closure caching for simple symbology and dynamic feature-anchored Canvas 2D linear gradients.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {CartoucheLayerStyle} cartoucheStyle - Authoritative Cartouche Symbology model.
 * @param {CompileLayerStyleOptions} [options] - Optional compiler options including active OpenLayers Map reference.
 * @returns {StyleFunction} OpenLayers StyleFunction closure returning Style[] array.
 */
export function compileStyleFunction(
  cartoucheStyle: CartoucheLayerStyle,
  options?: CompileLayerStyleOptions
): StyleFunction {
  const styleCache = new Map<string, Style>();

  function getOrCreateComponentStyle(component: StyleComponent): Style | null {
    if (!component.enabled) {
      return null;
    }

    const cacheKey = JSON.stringify(component);
    const cached = styleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let created: Style | null = null;
    if (component.type === "simple-fill") {
      created = new Style({
        fill: new Fill({
          color: component.color,
        }),
      });
    } else if (component.type === "simple-line") {
      if (component.dashPattern === "no-line") {
        return null;
      }
      created = new Style({
        stroke: new Stroke({
          color: component.color,
          width: component.width,
          ...(component.cap ? { lineCap: component.cap } : {}),
          ...(component.join ? { lineJoin: component.join } : {}),
          ...(component.offset !== undefined ? { offset: component.offset } : {}),
          ...(component.dashArray && component.dashArray.length > 0
            ? { lineDash: component.dashArray }
            : {}),
          ...(component.dashOffset !== undefined
            ? { lineDashOffset: component.dashOffset }
            : {}),
        }),
      });
    } else if (component.type === "simple-marker") {
      created = new Style({
        image: new CircleStyle({
          radius: component.radius,
          fill: new Fill({
            color: component.fillColor,
          }),
          stroke: new Stroke({
            color: component.strokeColor,
            width: component.strokeWidth,
          }),
        }),
      });
    }

    if (created) {
      styleCache.set(cacheKey, created);
    }
    return created;
  }

  const hasGradient =
    "components" in cartoucheStyle &&
    Array.isArray(cartoucheStyle.components) &&
    cartoucheStyle.components.some(
      (c) => c.type === "gradient-fill" && c.enabled !== false
    );

  // Pre-resolve the cached Style[] array for static symbology to eliminate allocations during 60 FPS rendering
  let resolvedStylesArray: Style[] | null = null;

  return (feature, _resolution): Style[] => {
    if (!hasGradient && resolvedStylesArray) {
      return resolvedStylesArray;
    }

    const styles: Style[] = [];
    if ("components" in cartoucheStyle && Array.isArray(cartoucheStyle.components)) {
      for (const comp of cartoucheStyle.components) {
        if (!comp.enabled) {
          continue;
        }
        if (comp.type === "gradient-fill") {
          const s = createGradientComponentStyle(comp, feature, options?.map);
          if (s) {
            styles.push(s);
          }
        } else {
          const s = getOrCreateComponentStyle(comp);
          if (s) {
            styles.push(s);
          }
        }
      }
    }

    if (!hasGradient) {
      resolvedStylesArray = styles;
    }
    return styles;
  };
}

/**
 * @description Synchronously compiles a Cartouche Symbology style into an executable OpenLayers StyleFunction.
 * Returns a fallback 3-rule random-color style if the input is unstyled or invalid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {unknown} style - Raw Cartouche Symbology descriptor, JSON string, or ProjectLayerStyleItem wrapper.
 * @param {CompileLayerStyleOptions} [options] - Optional shared styles catalog and layer ID context.
 * @returns {CompiledLayerStyleResult} Compiled layer style result containing the StyleFunction.
 */
export function compileCartoucheLayerStyleSync(
  style: unknown,
  options?: CompileLayerStyleOptions
): CompiledLayerStyleResult {
  const sharedStyles = options?.sharedStyles;

  if (!style) {
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "cartouche",
      isFallback: true,
    };
  }

  let rawTarget: unknown = style;

  if (isProjectLayerStyleWrapper(style)) {
    if (style.href && !style.content) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles?.find((s) => s.id === targetId);
      if (matched && matched.content) {
        rawTarget = matched.content;
      } else {
        logging.warn(
          "Unresolved shared cartouche style href; falling back to default vector style",
          {
            scope: "styleCompiler",
            layerId: options?.layerId,
            href: style.href,
          }
        );
        return {
          compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
          requiredFields: new Set<string>(),
          format: "cartouche",
          isFallback: true,
        };
      }
    } else if (style.content !== undefined) {
      rawTarget = style.content;
    } else {
      logging.warn(
        "Empty cartouche style wrapper; falling back to default vector style",
        { scope: "styleCompiler", layerId: options?.layerId }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "cartouche",
        isFallback: true,
      };
    }
  }

  let cartoucheModel: CartoucheLayerStyle | null = null;
  if (typeof rawTarget === "string") {
    try {
      const parsed = JSON.parse(rawTarget.trim());
      if (isCartoucheLayerStyle(parsed)) {
        cartoucheModel = parsed;
      }
    } catch (err) {
      logging.warn(
        "Failed to parse Cartouche Symbology JSON; falling back to default vector style",
        err,
        { scope: "styleCompiler", layerId: options?.layerId }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "cartouche",
        isFallback: true,
      };
    }
  } else if (typeof rawTarget === "object" && isCartoucheLayerStyle(rawTarget)) {
    cartoucheModel = rawTarget;
  }

  if (!cartoucheModel) {
    logging.warn(
      "Invalid Cartouche Symbology structure; falling back to default vector style",
      { scope: "styleCompiler", layerId: options?.layerId }
    );
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "cartouche",
      isFallback: true,
    };
  }

  const hasGradientFill = Boolean(
    cartoucheModel.components
    && Array.isArray(cartoucheModel.components)
    && cartoucheModel.components.some(
      (c) => c.type === "gradient-fill" && c.enabled !== false
    )
  );

  const styleFunction = compileStyleFunction(cartoucheModel, options);
  return {
    compiledStyle: styleFunction,
    requiredFields: new Set<string>(),
    format: "cartouche",
    isFallback: false,
    hasGradientFill,
  };
}

/**
 * @description Validates whether a parsed object or array is a valid OpenLayers Flat Style rule or dictionary.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {unknown} candidate - Parsed JSON object or array.
 * @returns {boolean} True if valid OpenLayers Flat Style.
 */
function isValidFlatStyleObject(candidate: unknown): boolean {
  if (Array.isArray(candidate)) {
    return (
      candidate.length > 0
      && candidate.every(
        (item) =>
          item !== null
          && typeof item === "object"
          && !Array.isArray(item)
          && ("style" in item
            || Object.keys(item).some(
              (k) =>
                k.includes("fill")
                || k.includes("stroke")
                || k.includes("circle")
                || k.includes("icon")
                || k.includes("text")
                || k.startsWith("regular-")
            ))
      )
    );
  }
  if (candidate !== null && typeof candidate === "object") {
    const keys = Object.keys(candidate as Record<string, unknown>);
    return keys.some(
      (k) =>
        k.includes("fill")
        || k.includes("stroke")
        || k.includes("circle")
        || k.includes("icon")
        || k.includes("text")
        || k.startsWith("regular-")
        || k === "filter"
        || k === "style"
    );
  }
  return false;
}

/**
 * @description Synchronously resolves a native OpenLayers Flat Style descriptor and extracts its required attribute fields.
 * Returns a fallback 3-rule random-color style if the input is unstyled or invalid JSON.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {unknown} style - Raw OpenLayers Flat Style descriptor or wrapper.
 * @param {CompileLayerStyleOptions} [options] - Optional shared styles and layer ID context.
 * @returns {CompiledLayerStyleResult} Synchronously compiled flat style result.
 */
export function compileFlatLayerStyleSync(
  style: unknown,
  options?: CompileLayerStyleOptions
): CompiledLayerStyleResult {
  const sharedStyles = options?.sharedStyles;

  if (!style) {
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "openlayers",
      isFallback: true,
    };
  }

  if (typeof style === "function") {
    return {
      compiledStyle: style,
      requiredFields: new Set<string>(),
      format: "openlayers",
      isFallback: false,
    };
  }

  let rawTarget: unknown = style;

  if (isProjectLayerStyleWrapper(style)) {
    if (style.href && !style.content) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles?.find((s) => s.id === targetId);
      if (matched && matched.content) {
        rawTarget = matched.content;
      } else {
        logging.warn(
          "Unresolved shared style href; falling back to default vector style",
          {
            scope: "styleCompiler",
            layerId: options?.layerId,
            href: style.href,
          }
        );
        return {
          compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
          requiredFields: new Set<string>(),
          format: "openlayers",
          isFallback: true,
        };
      }
    } else if (style.content !== undefined) {
      rawTarget = style.content;
    } else {
      logging.warn(
        "Empty style wrapper; falling back to default vector style",
        { scope: "styleCompiler", layerId: options?.layerId }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "openlayers",
        isFallback: true,
      };
    }
  }

  if (typeof rawTarget === "string") {
    try {
      const parsed = JSON.parse(rawTarget.trim());
      if (isValidFlatStyleObject(parsed)) {
        return {
          compiledStyle: parsed,
          requiredFields: extractStyleAttributes(parsed),
          format: "openlayers",
          isFallback: false,
        };
      }
    } catch (err) {
      logging.warn(
        "Failed to parse OpenLayers Flat Style JSON; falling back to default vector style",
        err,
        { scope: "styleCompiler", layerId: options?.layerId }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "openlayers",
        isFallback: true,
      };
    }
    logging.warn(
      "Invalid OpenLayers Flat Style structure; falling back to default vector style",
      { scope: "styleCompiler", layerId: options?.layerId }
    );
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "openlayers",
      isFallback: true,
    };
  }

  if (isValidFlatStyleObject(rawTarget)) {
    return {
      compiledStyle: rawTarget,
      requiredFields: extractStyleAttributes(rawTarget),
      format: "openlayers",
      isFallback: false,
    };
  }

  logging.warn(
    "Unrecognized layer style payload; falling back to default vector style",
    { scope: "styleCompiler", layerId: options?.layerId }
  );
  return {
    compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
    requiredFields: new Set<string>(),
    format: "openlayers",
    isFallback: true,
  };
}

/**
 * @description Compiles a layer style (`'openlayers'` Flat Style or `'sld'` 1.0.0/1.1.0 XML) into an executable OpenLayers style and extracts all referenced feature attribute fields.
 * Fast-paths `'openlayers'` styles and compiles `'sld'` styles via cached `SldStyleParser` and `OlStyleParser` singletons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {unknown} style - Raw style descriptor, ProjectLayerStyleItem wrapper, or OpenLayers Flat Style rules.
 * @param {CompileLayerStyleOptions} [options] - Optional shared styles and layer ID context.
 * @returns {Promise<CompiledLayerStyleResult>} Compiled style, required attribute fields, format, version, and fallback flag.
 */
export async function compileLayerStyle(
  style: unknown,
  options?: CompileLayerStyleOptions
): Promise<CompiledLayerStyleResult> {
  if (isCartoucheStyleDescriptor(style, options?.sharedStyles)) {
    return compileCartoucheLayerStyleSync(style, options);
  }
  if (!isSldStyleDescriptor(style, options?.sharedStyles)) {
    return compileFlatLayerStyleSync(style, options);
  }

  const sharedStyles = options?.sharedStyles;
  let xmlContent = "";
  let explicitVersion: SldStyleVersion | undefined;

  if (typeof style === "string") {
    xmlContent = style.trim();
  } else if (isProjectLayerStyleWrapper(style)) {
    explicitVersion = style.version;
    if (style.href && !style.content && sharedStyles) {
      const targetId = style.href.replace(/^#/, "");
      const matched = sharedStyles.find((s) => s.id === targetId);
      if (matched && matched.content) {
        xmlContent = matched.content.trim();
        explicitVersion = explicitVersion || matched.version;
      }
    } else if (style.content) {
      xmlContent = style.content.trim();
    }
  }

  if (!xmlContent || !xmlContent.startsWith("<")) {
    logging.warn(
      "Empty or non-XML SLD style content; falling back to default vector style",
      { scope: "styleCompiler", layerId: options?.layerId }
    );
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "sld",
      version: explicitVersion,
      isFallback: true,
    };
  }

  const detectedVersion: SldStyleVersion =
    explicitVersion
    || (xmlContent.includes('version="1.1.0"') ? "1.1.0" : "1.0.0");
  const parser = detectedVersion === "1.1.0" ? sldParser110 : sldParser100;

  try {
    const readResult = await parser.readStyle(xmlContent);
    if (readResult.errors?.length || !readResult.output) {
      logging.warn(
        "Failed to parse SLD XML via SldStyleParser; falling back to default vector style",
        readResult.errors,
        {
          scope: "styleCompiler",
          layerId: options?.layerId,
          version: detectedVersion,
        }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "sld",
        version: detectedVersion,
        isFallback: true,
      };
    }

    const requiredFields = extractSldXmlAttributes(xmlContent);
    extractGeoStylerAttributes(readResult.output, requiredFields);

    const writeResult = await olStyleParser.writeStyle(readResult.output);
    if (writeResult.errors?.length || !writeResult.output) {
      logging.warn(
        "Failed to compile GeoStyler AST via OlStyleParser; falling back to default vector style",
        writeResult.errors,
        {
          scope: "styleCompiler",
          layerId: options?.layerId,
          version: detectedVersion,
        }
      );
      return {
        compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
        requiredFields: new Set<string>(),
        format: "sld",
        version: detectedVersion,
        isFallback: true,
      };
    }

    return {
      compiledStyle: writeResult.output,
      requiredFields,
      format: "sld",
      version: detectedVersion,
      isFallback: false,
    };
  } catch (err) {
    logging.warn(
      "Exception during SLD style compilation; falling back to default vector style",
      err,
      {
        scope: "styleCompiler",
        layerId: options?.layerId,
        version: detectedVersion,
      }
    );
    return {
      compiledStyle: createDefaultVectorLayerStyle(options?.geometryKind),
      requiredFields: new Set<string>(),
      format: "sld",
      version: detectedVersion,
      isFallback: true,
    };
  }
}
