/**
 * @file styleCompiler.ts
 * @module renderer/map/styleCompiler
 * @description Headless Renderer style compiler and feature attribute extractor supporting native OpenLayers Flat Styles and OGC Styled Layer Descriptor (SLD) 1.0.0/1.1.0 XML via cached GeoStyler parsers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link compileLayerStyle}
 * @see {@link extractStyleAttributes}
 */

import { SldStyleParser } from "geostyler-sld-parser";
import { OlStyleParser } from "geostyler-openlayers-parser";
import type { Style as GeoStylerStyle } from "geostyler-style";
import { logging } from "../../shared/logging";
import {
  createDefaultVectorLayerStyle,
  isProjectLayerStyleWrapper,
} from "../../shared/styles/defaultLayerStyles";
import type {
  ProjectStyleFormat,
  SldStyleVersion,
  ProjectStyleItem,
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export interface CompiledLayerStyleResult {
  compiledStyle: any;
  requiredFields: Set<string>;
  format: ProjectStyleFormat;
  version?: SldStyleVersion;
  isFallback: boolean;
}

/**
 * @typedef {Object} CompileLayerStyleOptions
 * @property {ProjectStyleItem[]} [sharedStyles] - Shared project styles catalog for resolving `#id` href references.
 * @property {string} [layerId] - Optional layer identifier for diagnostic logging.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export interface CompileLayerStyleOptions {
  sharedStyles?: ProjectStyleItem[];
  layerId?: string;
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
      compiledStyle: createDefaultVectorLayerStyle(),
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
          compiledStyle: createDefaultVectorLayerStyle(),
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
        compiledStyle: createDefaultVectorLayerStyle(),
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
        compiledStyle: createDefaultVectorLayerStyle(),
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
      compiledStyle: createDefaultVectorLayerStyle(),
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
    compiledStyle: createDefaultVectorLayerStyle(),
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
      compiledStyle: createDefaultVectorLayerStyle(),
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
        compiledStyle: createDefaultVectorLayerStyle(),
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
        compiledStyle: createDefaultVectorLayerStyle(),
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
      compiledStyle: createDefaultVectorLayerStyle(),
      requiredFields: new Set<string>(),
      format: "sld",
      version: detectedVersion,
      isFallback: true,
    };
  }
}
