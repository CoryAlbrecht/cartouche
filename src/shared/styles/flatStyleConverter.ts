/**
 * @file flatStyleConverter.ts
 * @module shared/styles/flatStyleConverter
 * @description Bidirectional converter between Cartouche OpenLayers Flat Style JSON rules and GeoStyler intermediate Style AST (geostyler-style), supporting cross-format SLD conversion and validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @see {@link flatStyleToGeoStyler}
 * @see {@link geoStylerToFlatStyle}
 * @see {@link convertStyleFormat}
 * @see {@link validateStyleContent}
 */

import { SldStyleParser } from 'geostyler-sld-parser';
import type {
  Style as GeoStylerStyle,
  Rule as GeoStylerRule,
  Symbolizer,
  FillSymbolizer,
  LineSymbolizer,
  MarkSymbolizer,
  Filter as GeoStylerFilter,
  ComparisonFilter,
  CombinationFilter,
  NegationFilter,
} from 'geostyler-style';
import type {
  OlFlatStyleRule,
  ProjectStyleFormat,
  SldStyleVersion,
  StyleFormatConversionOptions,
  StyleValidationResult,
} from '../types';

/**
 * Cached SLD 1.0.0 parser instance for format conversions.
 * @type {SldStyleParser}
 */
const sldParser100 = new SldStyleParser({ sldVersion: '1.0.0' });

/**
 * Cached SLD 1.1.0 parser instance for format conversions.
 * @type {SldStyleParser}
 */
const sldParser110 = new SldStyleParser({ sldVersion: '1.1.0' });

/**
 * @description Converts an OpenLayers Flat Style filter expression into a GeoStyler AST Filter.
 * Strips standalone or combined geometry-type filters as they are inherently modeled by Symbolizer kind.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {any[]} [olFilter] - OpenLayers flat style filter array.
 * @returns {GeoStylerFilter | undefined} Converted GeoStyler Filter, or undefined if no attribute filter exists.
 */
export function olFilterToGeoStyler(olFilter?: any[]): GeoStylerFilter | undefined {
  if (!Array.isArray(olFilter) || olFilter.length === 0) {
    return undefined;
  }

  const op = olFilter[0];

  // 1. Geometry-type discriminator: handled via symbolizer kind, so omit from GeoStyler rule filter
  if (
    (op === '==' || op === '!=') &&
    Array.isArray(olFilter[1]) &&
    olFilter[1][0] === 'geometry-type'
  ) {
    return undefined;
  }

  // 2. Combination filters: ['all', ...conditions] or ['any', ...conditions]
  if (op === 'all' || op === 'any') {
    const childFilters: GeoStylerFilter[] = [];
    for (let i = 1; i < olFilter.length; i++) {
      const converted = olFilterToGeoStyler(olFilter[i]);
      if (converted) {
        childFilters.push(converted);
      }
    }
    if (childFilters.length === 0) {
      return undefined;
    }
    if (childFilters.length === 1) {
      return childFilters[0];
    }
    const gsOp = op === 'all' ? '&&' : '||';
    return [gsOp, ...childFilters] as CombinationFilter;
  }

  // 3. Negation filter: ['!', condition]
  if (op === '!') {
    const converted = olFilterToGeoStyler(olFilter[1]);
    if (!converted) {
      return undefined;
    }
    return ['!', converted] as NegationFilter;
  }

  // 4. Comparison filters: [op, ['get', propName], value] or [op, propName, value]
  const validOps = ['==', '!=', '<', '<=', '>', '>=', '*='];
  if (validOps.includes(op)) {
    let propName = '';
    if (Array.isArray(olFilter[1]) && olFilter[1][0] === 'get' && typeof olFilter[1][1] === 'string') {
      propName = olFilter[1][1];
    } else if (typeof olFilter[1] === 'string') {
      propName = olFilter[1];
    }
    if (propName) {
      const val = olFilter[2];
      return [op, propName, val] as ComparisonFilter;
    }
  }

  return undefined;
}

/**
 * @description Converts a GeoStyler AST Filter into an OpenLayers Flat Style filter expression.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {GeoStylerFilter} [gsFilter] - GeoStyler AST filter expression.
 * @returns {any[] | undefined} OpenLayers filter array, or undefined if no filter exists.
 */
export function geoStylerFilterToOl(gsFilter?: GeoStylerFilter): any[] | undefined {
  if (!Array.isArray(gsFilter) || gsFilter.length === 0) {
    return undefined;
  }

  const op = gsFilter[0];

  if (op === '&&' || op === '||') {
    const childFilters: any[] = [];
    for (let i = 1; i < gsFilter.length; i++) {
      const converted = geoStylerFilterToOl(gsFilter[i] as GeoStylerFilter);
      if (converted) {
        childFilters.push(converted);
      }
    }
    if (childFilters.length === 0) return undefined;
    if (childFilters.length === 1) return childFilters[0];
    const olOp = op === '&&' ? 'all' : 'any';
    return [olOp, ...childFilters];
  }

  if (op === '!') {
    const converted = geoStylerFilterToOl(gsFilter[1] as GeoStylerFilter);
    if (!converted) return undefined;
    return ['!', converted];
  }

  const validOps = ['==', '!=', '<', '<=', '>', '>=', '*='];
  if (validOps.includes(op)) {
    const propArg = gsFilter[1];
    const val = gsFilter[2];
    if (typeof propArg === 'string') {
      return [op, ['get', propArg], val];
    }
  }

  return undefined;
}

/**
 * @description Maps an OpenLayers Flat Style dictionary to one or more GeoStyler Symbolizer objects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {Record<string, any>} styleDict - OpenLayers flat style dictionary.
 * @param {string} [geometryHint] - Optional geometry hint derived from filter ('Polygon' | 'LineString' | 'Point').
 * @returns {Symbolizer[]} Array of GeoStyler symbolizers.
 */
function parseStyleDictToSymbolizers(
  styleDict: Record<string, any>,
  geometryHint?: string
): Symbolizer[] {
  const symbolizers: Symbolizer[] = [];

  const hasFill = 'fill-color' in styleDict;
  const hasLine = 'stroke-color' in styleDict || 'stroke-width' in styleDict;
  const hasCircle = 'circle-radius' in styleDict || 'circle-fill-color' in styleDict;
  const hasRegularShape =
    'shape-points' in styleDict ||
    'shape-radius' in styleDict ||
    'shape-fill-color' in styleDict ||
    'regular-shape' in styleDict;

  // 1. Polygon / Fill Symbolizer
  if (hasFill || (geometryHint === 'Polygon' && hasLine)) {
    const fillSym: FillSymbolizer = {
      kind: 'Fill',
      ...(styleDict['fill-color'] ? { color: String(styleDict['fill-color']) } : {}),
      ...(styleDict['fill-opacity'] !== undefined
        ? { fillOpacity: Number(styleDict['fill-opacity']) }
        : styleDict['opacity'] !== undefined
          ? { opacity: Number(styleDict['opacity']) }
          : {}),
      ...(styleDict['stroke-color'] ? { outlineColor: String(styleDict['stroke-color']) } : {}),
      ...(styleDict['stroke-width'] !== undefined
        ? { outlineWidth: Number(styleDict['stroke-width']) }
        : {}),
      ...(Array.isArray(styleDict['stroke-line-dash'])
        ? { outlineDasharray: styleDict['stroke-line-dash'].map(Number) }
        : {}),
    };
    symbolizers.push(fillSym);
  }

  // 2. LineString / Line Symbolizer
  if (
    (hasLine && !hasFill && geometryHint !== 'Point' && !hasCircle && !hasRegularShape) ||
    geometryHint === 'LineString'
  ) {
    const lineSym: LineSymbolizer = {
      kind: 'Line',
      ...(styleDict['stroke-color'] ? { color: String(styleDict['stroke-color']) } : {}),
      ...(styleDict['stroke-width'] !== undefined
        ? { width: Number(styleDict['stroke-width']) }
        : {}),
      ...(styleDict['stroke-opacity'] !== undefined
        ? { opacity: Number(styleDict['stroke-opacity']) }
        : styleDict['opacity'] !== undefined
          ? { opacity: Number(styleDict['opacity']) }
          : {}),
      ...(Array.isArray(styleDict['stroke-line-dash'])
        ? { dasharray: styleDict['stroke-line-dash'].map(Number) }
        : {}),
      ...(typeof styleDict['stroke-line-cap'] === 'string'
        ? { cap: styleDict['stroke-line-cap'] as LineSymbolizer['cap'] }
        : {}),
      ...(typeof styleDict['stroke-line-join'] === 'string'
        ? { join: styleDict['stroke-line-join'] as LineSymbolizer['join'] }
        : {}),
    };
    symbolizers.push(lineSym);
  }

  // 3. Point / Mark Symbolizer (Circle)
  if (hasCircle || (geometryHint === 'Point' && !hasRegularShape)) {
    const markSym: MarkSymbolizer = {
      kind: 'Mark',
      wellKnownName: 'circle',
      ...(styleDict['circle-radius'] !== undefined
        ? { radius: Number(styleDict['circle-radius']) }
        : { radius: 6 }),
      ...(styleDict['circle-fill-color']
        ? { color: String(styleDict['circle-fill-color']) }
        : styleDict['fill-color']
          ? { color: String(styleDict['fill-color']) }
          : {}),
      ...(styleDict['circle-stroke-color']
        ? { strokeColor: String(styleDict['circle-stroke-color']) }
        : styleDict['stroke-color']
          ? { strokeColor: String(styleDict['stroke-color']) }
          : {}),
      ...(styleDict['circle-stroke-width'] !== undefined
        ? { strokeWidth: Number(styleDict['circle-stroke-width']) }
        : styleDict['stroke-width'] !== undefined
          ? { strokeWidth: Number(styleDict['stroke-width']) }
          : {}),
      ...(styleDict['circle-opacity'] !== undefined
        ? { opacity: Number(styleDict['circle-opacity']) }
        : styleDict['opacity'] !== undefined
          ? { opacity: Number(styleDict['opacity']) }
          : {}),
    };
    symbolizers.push(markSym);
  }

  // 4. Point / Mark Symbolizer (Regular Shape: Square, Triangle, Star, Cross, X)
  if (hasRegularShape) {
    const points = Number(styleDict['shape-points'] || 4);
    let wellKnownName: 'square' | 'triangle' | 'star' | 'cross' | 'x' = 'square';
    if (points === 3) {
      wellKnownName = 'triangle';
    } else if (points === 5) {
      wellKnownName = 'star';
    } else if (points === 4 && styleDict['shape-radius2'] === 0) {
      wellKnownName = styleDict['shape-angle'] ? 'x' : 'cross';
    } else {
      wellKnownName = 'square';
    }

    const markSym: MarkSymbolizer = {
      kind: 'Mark',
      wellKnownName,
      ...(styleDict['shape-radius'] !== undefined
        ? { radius: Number(styleDict['shape-radius']) }
        : { radius: 6 }),
      ...(styleDict['shape-fill-color']
        ? { color: String(styleDict['shape-fill-color']) }
        : {}),
      ...(styleDict['shape-stroke-color']
        ? { strokeColor: String(styleDict['shape-stroke-color']) }
        : {}),
      ...(styleDict['shape-stroke-width'] !== undefined
        ? { strokeWidth: Number(styleDict['shape-stroke-width']) }
        : {}),
      ...(styleDict['shape-opacity'] !== undefined
        ? { opacity: Number(styleDict['shape-opacity']) }
        : styleDict['opacity'] !== undefined
          ? { opacity: Number(styleDict['opacity']) }
          : {}),
    };
    symbolizers.push(markSym);
  }

  return symbolizers;
}

/**
 * @description Converts Cartouche OpenLayers Flat Style JSON (array of rules or style dictionary) into an in-memory GeoStyler Style AST.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {unknown} flatStyle - OpenLayers flat style rules array, dictionary, or serialized JSON string.
 * @param {string} [styleName='Cartouche Style'] - Optional style title.
 * @returns {GeoStylerStyle} In-memory GeoStyler Style AST.
 */
export function flatStyleToGeoStyler(
  flatStyle: unknown,
  styleName: string = 'Cartouche Style'
): GeoStylerStyle {
  if (!flatStyle) {
    return { name: styleName, rules: [] };
  }

  let parsed: unknown = flatStyle;
  if (typeof flatStyle === 'string') {
    try {
      parsed = JSON.parse(flatStyle.trim());
    } catch {
      return { name: styleName, rules: [] };
    }
  }

  // 1. Array of rule objects
  if (Array.isArray(parsed)) {
    const rules: GeoStylerRule[] = [];

    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const ruleObj = item as Record<string, any>;
        const filterArr = Array.isArray(ruleObj.filter) ? ruleObj.filter : undefined;
        let geometryHint: string | undefined;

        if (filterArr) {
          const filterStr = JSON.stringify(filterArr);
          if (filterStr.includes('"Polygon"')) geometryHint = 'Polygon';
          else if (filterStr.includes('"LineString"')) geometryHint = 'LineString';
          else if (filterStr.includes('"Point"')) geometryHint = 'Point';
        }

        const styleDict =
          ruleObj.style && typeof ruleObj.style === 'object'
            ? ruleObj.style
            : ruleObj;

        const symbolizers = parseStyleDictToSymbolizers(styleDict, geometryHint);
        const gsFilter = olFilterToGeoStyler(filterArr);

        if (symbolizers.length > 0) {
          rules.push({
            name: geometryHint || 'Rule',
            ...(gsFilter ? { filter: gsFilter } : {}),
            symbolizers,
          });
        }
      }
    }

    return { name: styleName, rules };
  }

  // 2. Single flat style rule or dictionary
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, any>;
    const filterArr = Array.isArray(obj.filter) ? obj.filter : undefined;
    let geometryHint: string | undefined;

    if (filterArr) {
      const filterStr = JSON.stringify(filterArr);
      if (filterStr.includes('"Polygon"')) geometryHint = 'Polygon';
      else if (filterStr.includes('"LineString"')) geometryHint = 'LineString';
      else if (filterStr.includes('"Point"')) geometryHint = 'Point';
    }

    const styleDict =
      obj.style && typeof obj.style === 'object' ? obj.style : obj;
    const symbolizers = parseStyleDictToSymbolizers(styleDict, geometryHint);
    const gsFilter = olFilterToGeoStyler(filterArr);

    return {
      name: styleName,
      rules:
        symbolizers.length > 0
          ? [
              {
                name: geometryHint || 'Rule 1',
                ...(gsFilter ? { filter: gsFilter } : {}),
                symbolizers,
              },
            ]
          : [],
    };
  }

  return { name: styleName, rules: [] };
}

/**
 * @description Converts a GeoStyler Style AST into a multi-rule OpenLayers Flat Style JSON array.
 * Automatically injects geometry-type filter discriminators for Fill, Line, and Mark symbolizers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {GeoStylerStyle} ast - GeoStyler Style AST.
 * @returns {OlFlatStyleRule[]} Array of OpenLayers Flat Style rules.
 */
export function geoStylerToFlatStyle(ast: GeoStylerStyle): OlFlatStyleRule[] {
  if (!ast || !Array.isArray(ast.rules) || ast.rules.length === 0) {
    return [];
  }

  const olRules: OlFlatStyleRule[] = [];

  for (const rule of ast.rules) {
    if (!rule || !Array.isArray(rule.symbolizers)) continue;

    const baseOlFilter = geoStylerFilterToOl(rule.filter);

    for (const sym of rule.symbolizers) {
      if (!sym || typeof sym !== 'object') continue;

      let geomType = 'Polygon';
      const styleDict: Record<string, any> = {};

      if (sym.kind === 'Fill') {
        geomType = 'Polygon';
        if (sym.color) styleDict['fill-color'] = sym.color;
        if (sym.fillOpacity !== undefined) styleDict['fill-opacity'] = sym.fillOpacity;
        else if (sym.opacity !== undefined) styleDict['fill-opacity'] = sym.opacity;

        if (sym.outlineColor) styleDict['stroke-color'] = sym.outlineColor;
        if (sym.outlineWidth !== undefined) styleDict['stroke-width'] = sym.outlineWidth;
        if (Array.isArray(sym.outlineDasharray)) {
          styleDict['stroke-line-dash'] = sym.outlineDasharray;
        }
      } else if (sym.kind === 'Line') {
        geomType = 'LineString';
        if (sym.color) styleDict['stroke-color'] = sym.color;
        if (sym.width !== undefined) styleDict['stroke-width'] = sym.width;
        if (sym.opacity !== undefined) styleDict['stroke-opacity'] = sym.opacity;
        if (Array.isArray(sym.dasharray)) styleDict['stroke-line-dash'] = sym.dasharray;
        if (sym.cap) styleDict['stroke-line-cap'] = sym.cap;
        if (sym.join) styleDict['stroke-line-join'] = sym.join;
      } else if (sym.kind === 'Mark') {
        geomType = 'Point';
        const wellKnownName = sym.wellKnownName?.toLowerCase() || 'circle';

        if (wellKnownName === 'circle') {
          styleDict['circle-radius'] = sym.radius ?? 6;
          if (sym.color) styleDict['circle-fill-color'] = sym.color;
          if (sym.strokeColor) styleDict['circle-stroke-color'] = sym.strokeColor;
          if (sym.strokeWidth !== undefined) styleDict['circle-stroke-width'] = sym.strokeWidth;
          if (sym.opacity !== undefined) styleDict['circle-opacity'] = sym.opacity;
        } else {
          // Regular shapes
          let points = 4;
          if (wellKnownName === 'triangle') points = 3;
          else if (wellKnownName === 'star') points = 5;

          styleDict['shape-points'] = points;
          styleDict['shape-radius'] = sym.radius ?? 6;
          if (sym.color) styleDict['shape-fill-color'] = sym.color;
          if (sym.strokeColor) styleDict['shape-stroke-color'] = sym.strokeColor;
          if (sym.strokeWidth !== undefined) styleDict['shape-stroke-width'] = sym.strokeWidth;
          if (sym.opacity !== undefined) styleDict['shape-opacity'] = sym.opacity;

          if (wellKnownName === 'star') {
            const r = typeof sym.radius === 'number' ? sym.radius : 6;
            styleDict['shape-radius2'] = r / 2;
          } else if (wellKnownName === 'cross' || wellKnownName === 'x') {
            styleDict['shape-radius2'] = 0;
            if (wellKnownName === 'x') {
              styleDict['shape-angle'] = Math.PI / 4;
            }
          }
        }
      }

      if (Object.keys(styleDict).length > 0) {
        const geomFilter = ['==', ['geometry-type'], geomType];
        const combinedFilter = baseOlFilter ? ['all', geomFilter, baseOlFilter] : geomFilter;

        olRules.push({
          filter: combinedFilter,
          style: styleDict,
        });
      }
    }
  }

  return olRules;
}

/**
 * @description Converts a raw style string between OpenLayers Flat Style JSON and OGC SLD XML (1.0.0 or 1.1.0) using GeoStyler AST as the intermediate representation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {string} content - Raw input style text.
 * @param {StyleFormatConversionOptions} options - Conversion configuration options.
 * @returns {Promise<string>} Converted style string in the target format and version.
 * @throws {Error} If parsing or writing the style fails.
 */
export async function convertStyleFormat(
  content: string,
  options: StyleFormatConversionOptions
): Promise<string> {
  const { fromFormat, toFormat, fromVersion = '1.0.0', toVersion = '1.0.0' } = options;

  if (fromFormat === toFormat && fromVersion === toVersion) {
    return content;
  }

  let ast: GeoStylerStyle;

  // 1. Parse input to GeoStyler AST
  if (fromFormat === 'openlayers') {
    ast = flatStyleToGeoStyler(content);
  } else {
    const sldInParser = fromVersion === '1.1.0' ? sldParser110 : sldParser100;
    const readResult = await sldInParser.readStyle(content.trim());
    if (readResult.errors?.length || !readResult.output) {
      throw new Error(
        `Failed to parse SLD ${fromVersion} style: ${readResult.errors?.map((e) => e.message || String(e)).join(', ') || 'Unknown error'}`
      );
    }
    ast = readResult.output as unknown as GeoStylerStyle;
  }

  // 2. Write GeoStyler AST to target format
  if (toFormat === 'openlayers') {
    const flatRules = geoStylerToFlatStyle(ast);
    return JSON.stringify(flatRules, null, 2);
  } else {
    const sldOutParser = toVersion === '1.1.0' ? sldParser110 : sldParser100;
    const writeResult = await sldOutParser.writeStyle(ast);
    if (writeResult.errors?.length || !writeResult.output) {
      throw new Error(
        `Failed to generate SLD ${toVersion} style: ${writeResult.errors?.map((e) => e.message || String(e)).join(', ') || 'Unknown error'}`
      );
    }
    return writeResult.output;
  }
}

/**
 * @description Validates a style text string against its declared format dialect and optional SLD version.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @param {string} content - Style text to validate.
 * @param {ProjectStyleFormat} format - Style format ('openlayers' | 'sld').
 * @param {SldStyleVersion} [version='1.0.0'] - Optional SLD specification version.
 * @returns {Promise<StyleValidationResult>} Validation status and optional error message.
 */
export async function validateStyleContent(
  content: string,
  format: ProjectStyleFormat,
  version: SldStyleVersion = '1.0.0'
): Promise<StyleValidationResult> {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Style content cannot be empty.' };
  }

  if (format === 'openlayers') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err: any) {
      return { isValid: false, error: `Invalid JSON syntax: ${err.message || String(err)}` };
    }

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (Array.isArray(parsed) && parsed.length === 0)
    ) {
      return { isValid: false, error: 'OpenLayers Flat Style must be a non-empty object or array of rules.' };
    }

    return { isValid: true };
  }

  // SLD format validation
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return { isValid: false, error: 'SLD style content must be a valid XML document starting with "<".' };
  }

  if (
    !trimmed.includes('StyledLayerDescriptor') &&
    !trimmed.includes('FeatureTypeStyle') &&
    !trimmed.includes('UserStyle')
  ) {
    return { isValid: false, error: 'SLD XML must contain a StyledLayerDescriptor, FeatureTypeStyle, or UserStyle root.' };
  }

  const parser = version === '1.1.0' ? sldParser110 : sldParser100;
  try {
    const readResult = await parser.readStyle(trimmed);
    if (readResult.errors && readResult.errors.length > 0) {
      const msg = readResult.errors.map((e) => e.message || String(e)).join('; ');
      return { isValid: false, error: `SLD ${version} parse error: ${msg}` };
    }
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: `SLD parsing failed: ${err.message || String(err)}` };
  }
}
