/**
 * @file flatStyleConverter.test.ts
 * @module tests/shared/styles/flatStyleConverter.test
 * @description Unit and round-trip integration tests for GeoStyler AST <-> OpenLayers Flat Style bidirectional converter, Cartouche Simple Symbology converter, SLD 1.0.0/1.1.0 format conversions, and live syntax validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @see {@link flatStyleToGeoStyler}
 * @see {@link geoStylerToFlatStyle}
 * @see {@link cartoucheToGeoStyler}
 * @see {@link geoStylerToCartouche}
 * @see {@link convertStyleFormat}
 * @see {@link validateStyleContent}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flatStyleToGeoStyler,
  geoStylerToFlatStyle,
  cartoucheToGeoStyler,
  geoStylerToCartouche,
  convertStyleFormat,
  validateStyleContent,
  olFilterToGeoStyler,
  geoStylerFilterToOl,
  extractVisualSymbolizers,
  applyVisualSymbolizersToGeoStyler,
  parseStyleTextToGeoStyler,
  serializeGeoStylerToText,
} from '../../../src/shared/styles/flatStyleConverter';
import type {
  OlFlatStyleRule,
  SimpleCartoucheStyle,
  SimpleFillComponent,
  SimpleLineComponent,
  SimpleMarkerComponent,
} from '../../../src/shared/types';
import type {
  Style as GeoStylerStyle,
  FillSymbolizer,
  LineSymbolizer,
  MarkSymbolizer,
} from 'geostyler-style';

describe('GeoStyler AST <-> OpenLayers Flat Style Converter (Ticket #122)', () => {
  describe('Filter Conversions', () => {
    it('converts basic binary comparison filters bidirectionally', () => {
      const olFilter = ['==', ['get', 'scalerank'], 3];
      const geoFilter = olFilterToGeoStyler(olFilter);
      assert.deepStrictEqual(geoFilter, ['==', 'scalerank', 3]);

      const roundtrip = geoStylerFilterToOl(geoFilter);
      assert.deepStrictEqual(roundtrip, olFilter);
    });

    it('converts combination logical filters (all / any / not) bidirectionally', () => {
      const olFilter = [
        'all',
        ['>', ['get', 'pop_max'], 1000000],
        ['!=', ['get', 'featurecla'], 'Admin-0 capital'],
      ];
      const geoFilter = olFilterToGeoStyler(olFilter);
      assert.deepStrictEqual(geoFilter, [
        '&&',
        ['>', 'pop_max', 1000000],
        ['!=', 'featurecla', 'Admin-0 capital'],
      ]);

      const roundtrip = geoStylerFilterToOl(geoFilter);
      assert.deepStrictEqual(roundtrip, olFilter);
    });

    it('converts negation filters (! / not)', () => {
      const olFilter = ['!', ['==', ['get', 'type'], 'water']];
      const geoFilter = olFilterToGeoStyler(olFilter);
      assert.deepStrictEqual(geoFilter, ['!', ['==', 'type', 'water']]);

      const roundtrip = geoStylerFilterToOl(geoFilter);
      assert.deepStrictEqual(roundtrip, olFilter);
    });
  });

  describe('flatStyleToGeoStyler Conversion', () => {
    it('converts polygon fill and outline rules to GeoStyler FillSymbolizer', () => {
      const flatRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Polygon'],
        style: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.75,
          'stroke-color': '#1d4ed8',
          'stroke-width': 2,
          'stroke-line-dash': [4, 4],
        },
      };

      const geoStyle = flatStyleToGeoStyler(flatRule, 'Polygon');
      assert.strictEqual(geoStyle.rules.length, 1);
      const symbolizers = geoStyle.rules[0].symbolizers;
      assert.strictEqual(symbolizers.length, 1);
      assert.strictEqual(symbolizers[0].kind, 'Fill');

      const fill = symbolizers[0] as FillSymbolizer;
      assert.strictEqual(fill.color, '#3b82f6');
      assert.strictEqual(fill.fillOpacity, 0.75);
      assert.strictEqual(fill.outlineColor, '#1d4ed8');
      assert.strictEqual(fill.outlineWidth, 2);
      assert.deepStrictEqual(fill.outlineDasharray, [4, 4]);
    });

    it('converts line stroke rules to GeoStyler LineSymbolizer', () => {
      const flatRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'LineString'],
        style: {
          'stroke-color': '#ef4444',
          'stroke-width': 3,
          'stroke-opacity': 0.9,
          'stroke-line-cap': 'round',
          'stroke-line-join': 'miter',
        },
      };

      const geoStyle = flatStyleToGeoStyler(flatRule, 'LineString');
      assert.strictEqual(geoStyle.rules.length, 1);
      const symbolizers = geoStyle.rules[0].symbolizers;
      assert.strictEqual(symbolizers.length, 1);
      assert.strictEqual(symbolizers[0].kind, 'Line');

      const line = symbolizers[0] as LineSymbolizer;
      assert.strictEqual(line.color, '#ef4444');
      assert.strictEqual(line.width, 3);
      assert.strictEqual(line.opacity, 0.9);
      assert.strictEqual(line.cap, 'round');
      assert.strictEqual(line.join, 'miter');
    });

    it('converts circle point rules to GeoStyler MarkSymbolizer', () => {
      const flatRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'circle-radius': 8,
          'circle-fill-color': '#10b981',
          'circle-stroke-color': '#065f46',
          'circle-stroke-width': 1.5,
        },
      };

      const geoStyle = flatStyleToGeoStyler(flatRule, 'Point');
      assert.strictEqual(geoStyle.rules.length, 1);
      const mark = geoStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(mark.kind, 'Mark');
      assert.strictEqual(mark.wellKnownName, 'circle');
      assert.strictEqual(mark.radius, 8);
      assert.strictEqual(mark.color, '#10b981');
      assert.strictEqual(mark.strokeColor, '#065f46');
      assert.strictEqual(mark.strokeWidth, 1.5);
    });

    it('converts regular shapes (square, triangle, star, cross, x) to GeoStyler MarkSymbolizers', () => {
      const squareRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'shape-points': 4,
          'shape-radius': 10,
          'shape-fill-color': '#8b5cf6',
        },
      };
      const squareStyle = flatStyleToGeoStyler(squareRule, 'Point');
      const squareMark = squareStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(squareMark.wellKnownName, 'square');
      assert.strictEqual(squareMark.radius, 10);

      const triangleRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'shape-points': 3,
          'shape-radius': 12,
        },
      };
      const triStyle = flatStyleToGeoStyler(triangleRule, 'Point');
      const triMark = triStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(triMark.wellKnownName, 'triangle');

      const starRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'shape-points': 5,
          'shape-radius': 14,
          'shape-radius2': 7,
        },
      };
      const starStyle = flatStyleToGeoStyler(starRule, 'Point');
      const starMark = starStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(starMark.wellKnownName, 'star');

      const crossRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'shape-points': 4,
          'shape-radius': 8,
          'shape-radius2': 0,
        },
      };
      const crossStyle = flatStyleToGeoStyler(crossRule, 'Point');
      const crossMark = crossStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(crossMark.wellKnownName, 'cross');

      const xRule: OlFlatStyleRule = {
        filter: ['==', ['geometry-type'], 'Point'],
        style: {
          'shape-points': 4,
          'shape-radius': 8,
          'shape-radius2': 0,
          'shape-angle': Math.PI / 4,
        },
      };
      const xStyle = flatStyleToGeoStyler(xRule, 'Point');
      const xMark = xStyle.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(xMark.wellKnownName, 'x');
    });
  });

  describe('geoStylerToFlatStyle Conversion', () => {
    it('converts multi-symbolizer GeoStyler style into partitioned OpenLayers Flat Style rules with geometry-type filters', () => {
      const geoStyle: GeoStylerStyle = {
        name: 'Combined Style',
        rules: [
          {
            name: 'Vector Features',
            symbolizers: [
              {
                kind: 'Fill',
                color: '#22c55e',
                outlineColor: '#15803d',
                outlineWidth: 1,
              },
              {
                kind: 'Line',
                color: '#0284c7',
                width: 2,
              },
              {
                kind: 'Mark',
                wellKnownName: 'circle',
                color: '#f59e0b',
                radius: 6,
              },
            ],
          },
        ],
      };

      const flatRules = geoStylerToFlatStyle(geoStyle);
      assert.strictEqual(flatRules.length, 3);

      const polyRule = flatRules.find(
        (r) => Array.isArray(r.filter) && r.filter[2] === 'Polygon'
      );
      assert.ok(polyRule);
      assert.strictEqual(polyRule.style['fill-color'], '#22c55e');
      assert.strictEqual(polyRule.style['stroke-color'], '#15803d');

      const lineRule = flatRules.find(
        (r) => Array.isArray(r.filter) && r.filter[2] === 'LineString'
      );
      assert.ok(lineRule);
      assert.strictEqual(lineRule.style['stroke-color'], '#0284c7');
      assert.strictEqual(lineRule.style['stroke-width'], 2);

      const pointRule = flatRules.find(
        (r) => Array.isArray(r.filter) && r.filter[2] === 'Point'
      );
      assert.ok(pointRule);
      assert.strictEqual(pointRule.style['circle-fill-color'], '#f59e0b');
      assert.strictEqual(pointRule.style['circle-radius'], 6);
    });

    it('combines user attribute filters with geometry-type filter using "all"', () => {
      const geoStyle: GeoStylerStyle = {
        name: 'Filtered Style',
        rules: [
          {
            name: 'High Population',
            filter: ['>', 'population', 50000],
            symbolizers: [
              {
                kind: 'Fill',
                color: '#dc2626',
              },
            ],
          },
        ],
      };

      const flatRules = geoStylerToFlatStyle(geoStyle);
      assert.strictEqual(flatRules.length, 1);
      const rule = flatRules[0];
      assert.ok(Array.isArray(rule.filter));
      assert.strictEqual(rule.filter[0], 'all');
      assert.deepStrictEqual(rule.filter[1], ['==', ['geometry-type'], 'Polygon']);
      assert.deepStrictEqual(rule.filter[2], ['>', ['get', 'population'], 50000]);
    });
  });

  describe('convertStyleFormat', () => {
    it('converts OpenLayers Flat Style JSON to SLD 1.0.0 XML and back', async () => {
      const initialJson = JSON.stringify(
        [
          {
            filter: ['==', ['geometry-type'], 'Polygon'],
            style: {
              'fill-color': '#3b82f6',
              'stroke-color': '#1d4ed8',
              'stroke-width': 2,
            },
          },
        ],
        null,
        2
      );

      const sldXml = await convertStyleFormat(initialJson, {
        fromFormat: 'openlayers',
        toFormat: 'sld',
        toVersion: '1.0.0',
      });
      assert.ok(sldXml.includes('<StyledLayerDescriptor'));
      assert.ok(sldXml.includes('version="1.0.0"'));
      assert.ok(sldXml.includes('PolygonSymbolizer'));
      assert.ok(sldXml.includes('#3b82f6'));

      const backToJson = await convertStyleFormat(sldXml, {
        fromFormat: 'sld',
        fromVersion: '1.0.0',
        toFormat: 'openlayers',
      });
      const parsed = JSON.parse(backToJson);
      assert.ok(Array.isArray(parsed));
      assert.ok(parsed.length >= 1);
      const poly = parsed.find(
        (r: any) => Array.isArray(r.filter) && r.filter[2] === 'Polygon'
      );
      assert.ok(poly);
      assert.strictEqual(poly.style['fill-color'], '#3b82f6');
    });

    it('converts OpenLayers Flat Style JSON to SLD 1.1.0 XML and between versions', async () => {
      const initialJson = JSON.stringify(
        [
          {
            filter: ['==', ['geometry-type'], 'LineString'],
            style: {
              'stroke-color': '#059669',
              'stroke-width': 3,
            },
          },
        ],
        null,
        2
      );

      const sld110 = await convertStyleFormat(initialJson, {
        fromFormat: 'openlayers',
        toFormat: 'sld',
        toVersion: '1.1.0',
      });
      assert.ok(sld110.includes('<StyledLayerDescriptor'));
      assert.ok(sld110.includes('version="1.1.0"'));
      assert.ok(sld110.includes('LineSymbolizer'));

      const sld100 = await convertStyleFormat(sld110, {
        fromFormat: 'sld',
        fromVersion: '1.1.0',
        toFormat: 'sld',
        toVersion: '1.0.0',
      });
      assert.ok(sld100.includes('version="1.0.0"'));
    });
  });

  describe('validateStyleContent', () => {
    it('validates correct OpenLayers Flat Style JSON', async () => {
      const valid = JSON.stringify([
        {
          style: {
            'fill-color': '#000000',
          },
        },
      ]);
      const result = await validateStyleContent(valid, 'openlayers');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.error, undefined);
    });

    it('rejects invalid OpenLayers Flat Style JSON with informative syntax error', async () => {
      const invalid = '{"style": "unclosed json';
      const result = await validateStyleContent(invalid, 'openlayers');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.error && /JSON/i.test(result.error));
    });

    it('validates correct SLD 1.0.0 and 1.1.0 XML', async () => {
      const validSld = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>test</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#ff0000</CssParameter></Fill>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

      const result = await validateStyleContent(validSld, 'sld', '1.0.0');
      assert.strictEqual(result.isValid, true);
    });

    it('rejects invalid or malformed SLD XML', async () => {
      const malformedXml = '<StyledLayerDescriptor><UnclosedTag></StyledLayerDescriptor>';
      const result = await validateStyleContent(malformedXml, 'sld', '1.0.0');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.error);
    });
  });

  describe('Visual Symbolizer Extraction & Injection (Ticket #123)', () => {
    it('extracts Polygon visual symbolizers from GeoStyler AST with fallbacks', () => {
      const ast: GeoStylerStyle = {
        name: 'Polygon Style',
        rules: [
          {
            name: 'Polygon Rule',
            symbolizers: [
              {
                kind: 'Fill',
                color: '#22c55e',
                fillOpacity: 0.75,
                outlineColor: '#15803d',
                outlineWidth: 2,
              } as FillSymbolizer,
            ],
          },
        ],
      };

      const visual = extractVisualSymbolizers(ast, 'Polygon');
      assert.strictEqual(visual.fillColor, '#22c55e');
      assert.strictEqual(visual.fillOpacity, 0.75);
      assert.strictEqual(visual.strokeColor, '#15803d');
      assert.strictEqual(visual.strokeWidth, 2);

      // Default fallback when empty
      const emptyVisual = extractVisualSymbolizers({ name: 'Empty', rules: [] }, 'Polygon');
      assert.strictEqual(emptyVisual.fillColor, '#1e293b');
      assert.strictEqual(emptyVisual.fillOpacity, 1);
      assert.strictEqual(emptyVisual.strokeColor, '#0284c7');
      assert.strictEqual(emptyVisual.strokeWidth, 0);
    });

    it('extracts LineString visual symbolizers from GeoStyler AST with dash detection', () => {
      const ast: GeoStylerStyle = {
        name: 'Line Style',
        rules: [
          {
            name: 'Line Rule',
            symbolizers: [
              {
                kind: 'Line',
                color: '#ef4444',
                width: 3,
                dasharray: [4, 4],
              } as LineSymbolizer,
            ],
          },
        ],
      };

      const visual = extractVisualSymbolizers(ast, 'LineString');
      assert.strictEqual(visual.strokeColor, '#ef4444');
      assert.strictEqual(visual.strokeWidth, 3);
      assert.strictEqual(visual.strokeLineDash, true);

      // Default fallback when empty
      const emptyVisual = extractVisualSymbolizers({ name: 'Empty', rules: [] }, 'LineString');
      assert.strictEqual(emptyVisual.strokeColor, '#0284c7');
      assert.strictEqual(emptyVisual.strokeWidth, 1);
      assert.strictEqual(emptyVisual.strokeLineDash, false);
    });

    it('extracts Point visual symbolizers from GeoStyler AST', () => {
      const ast: GeoStylerStyle = {
        name: 'Point Style',
        rules: [
          {
            name: 'Point Rule',
            symbolizers: [
              {
                kind: 'Mark',
                wellKnownName: 'star',
                radius: 8,
                color: '#eab308',
                strokeColor: '#ca8a04',
                strokeWidth: 2,
              } as MarkSymbolizer,
            ],
          },
        ],
      };

      const visual = extractVisualSymbolizers(ast, 'Point');
      assert.strictEqual(visual.pointShape, 'star');
      assert.strictEqual(visual.pointRadius, 8);
      assert.strictEqual(visual.fillColor, '#eab308');
      assert.strictEqual(visual.strokeColor, '#ca8a04');
      assert.strictEqual(visual.strokeWidth, 2);

      // Default fallback when empty
      const emptyVisual = extractVisualSymbolizers({ name: 'Empty', rules: [] }, 'Point');
      assert.strictEqual(emptyVisual.pointShape, 'circle');
      assert.strictEqual(emptyVisual.pointRadius, 6);
      assert.strictEqual(emptyVisual.fillColor, '#0369a1');
    });

    it('applies visual symbolizer mutations to existing and newly constructed GeoStyler AST', () => {
      // 1. Mutate existing Polygon Fill symbolizer
      const polyAst: GeoStylerStyle = {
        name: 'Poly',
        rules: [
          {
            name: 'Rule 1',
            symbolizers: [
              { kind: 'Fill', color: '#000000', fillOpacity: 1 } as FillSymbolizer,
            ],
          },
        ],
      };
      const updatedPoly = applyVisualSymbolizersToGeoStyler(
        polyAst,
        { fillColor: '#3b82f6', fillOpacity: 0.5, strokeColor: '#1d4ed8', strokeWidth: 2 },
        'Polygon'
      );
      const fillSym = updatedPoly.rules[0].symbolizers[0] as FillSymbolizer;
      assert.strictEqual(fillSym.color, '#3b82f6');
      assert.strictEqual(fillSym.fillOpacity, 0.5);
      assert.strictEqual(fillSym.outlineColor, '#1d4ed8');
      assert.strictEqual(fillSym.outlineWidth, 2);

      // 2. Synthesize new symbolizer on empty AST
      const emptyAst: GeoStylerStyle = { name: 'Empty', rules: [] };
      const pointAst = applyVisualSymbolizersToGeoStyler(
        emptyAst,
        { pointShape: 'triangle', pointRadius: 10, fillColor: '#ec4899' },
        'Point'
      );
      assert.strictEqual(pointAst.rules.length, 1);
      const markSym = pointAst.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(markSym.kind, 'Mark');
      assert.strictEqual(markSym.wellKnownName, 'triangle');
      assert.strictEqual(markSym.radius, 10);
      assert.strictEqual(markSym.color, '#ec4899');
    });

    it('parses style text to GeoStyler and serializes back across openlayers and sld formats', async () => {
      const olJson = JSON.stringify([
        {
          filter: ['==', ['geometry-type'], 'Polygon'],
          style: {
            'fill-color': '#10b981',
            'stroke-color': '#047857',
            'stroke-width': 2,
          },
        },
      ]);

      const ast = await parseStyleTextToGeoStyler(olJson, 'openlayers');
      assert.ok(ast.rules.length > 0);

      const serializedOl = await serializeGeoStylerToText(ast, 'openlayers');
      const parsedOl = JSON.parse(serializedOl);
      assert.strictEqual(parsedOl[0].style['fill-color'], '#10b981');

      const sldXml = await serializeGeoStylerToText(ast, 'sld', '1.0.0');
      assert.ok(sldXml.includes('StyledLayerDescriptor'));
      assert.ok(sldXml.includes('#10b981'));

      const sldAst = await parseStyleTextToGeoStyler(sldXml, 'sld', '1.0.0');
      assert.ok(sldAst.rules.length > 0);
    });
  });

  describe('Cartouche Symbology <-> GeoStyler & Format Conversion (Ticket #131)', () => {
    it('converts SimpleCartoucheStyle to GeoStyler AST for Polygon, LineString, and Point', () => {
      // 1. Polygon: fill + line should combine into FillSymbolizer with fill & outline properties
      const polyCartouche: SimpleCartoucheStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'fill-1',
            type: 'simple-fill',
            enabled: true,
            color: '#d8b4e2', // lavender
          },
          {
            id: 'line-1',
            type: 'simple-line',
            enabled: true,
            color: '#6b21a8', // purple
            width: 1.5,
          },
        ],
      };

      const polyAst = cartoucheToGeoStyler(polyCartouche, 'Polygon');
      assert.strictEqual(polyAst.rules.length, 1);
      assert.strictEqual(polyAst.rules[0].symbolizers.length, 1);
      const fillSym = polyAst.rules[0].symbolizers[0] as FillSymbolizer;
      assert.strictEqual(fillSym.kind, 'Fill');
      assert.strictEqual(fillSym.color, '#d8b4e2');
      assert.strictEqual(fillSym.outlineColor, '#6b21a8');
      assert.strictEqual(fillSym.outlineWidth, 1.5);

      // 2. LineString: simple-line should produce LineSymbolizer
      const lineCartouche: SimpleCartoucheStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'line-1',
            type: 'simple-line',
            enabled: true,
            color: '#2563eb',
            width: 2.5,
            dashArray: [5, 5],
          },
        ],
      };
      const lineAst = cartoucheToGeoStyler(lineCartouche, 'LineString');
      assert.strictEqual(lineAst.rules.length, 1);
      const lineSym = lineAst.rules[0].symbolizers[0] as LineSymbolizer;
      assert.strictEqual(lineSym.kind, 'Line');
      assert.strictEqual(lineSym.color, '#2563eb');
      assert.strictEqual(lineSym.width, 2.5);
      assert.deepStrictEqual(lineSym.dasharray, [5, 5]);

      // 3. Point: simple-marker should produce MarkSymbolizer
      const pointCartouche: SimpleCartoucheStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'marker-1',
            type: 'simple-marker',
            enabled: true,
            shape: 'circle',
            radius: 8,
            fillColor: '#ef4444',
            strokeColor: '#991b1b',
            strokeWidth: 2,
          },
        ],
      };
      const pointAst = cartoucheToGeoStyler(pointCartouche, 'Point');
      assert.strictEqual(pointAst.rules.length, 1);
      const markSym = pointAst.rules[0].symbolizers[0] as MarkSymbolizer;
      assert.strictEqual(markSym.kind, 'Mark');
      assert.strictEqual(markSym.color, '#ef4444');
      assert.strictEqual(markSym.strokeColor, '#991b1b');
      assert.strictEqual(markSym.strokeWidth, 2);
      assert.strictEqual(markSym.radius, 8);

      const pointCartoucheResult = geoStylerToCartouche(pointAst, 'Point');
      const markerComp = pointCartoucheResult.components[0] as SimpleMarkerComponent;
      assert.strictEqual(markerComp.type, 'simple-marker');
      assert.strictEqual(markerComp.fillColor, '#ef4444');
      assert.strictEqual(markerComp.strokeColor, '#991b1b');
      assert.strictEqual(markerComp.radius, 8);
    });

    it('converts GeoStyler AST to SimpleCartoucheStyle with painter ordering (fill bottom, stroke top)', () => {
      const ast: GeoStylerStyle = {
        name: 'Polygon Style',
        rules: [
          {
            name: 'Rule 1',
            symbolizers: [
              {
                kind: 'Fill',
                color: '#d8b4e2',
                outlineColor: '#6b21a8',
                outlineWidth: 2,
              } as FillSymbolizer,
            ],
          },
        ],
      };

      const cartouche = geoStylerToCartouche(ast, 'Polygon');
      assert.strictEqual(cartouche.format, 'simple');
      assert.strictEqual(cartouche.version, 1);
      assert.strictEqual(cartouche.components.length, 2);

      // Painter's order: fill is at index 0 (bottom), line is at index 1 (top)
      const fillComp = cartouche.components[0] as SimpleFillComponent;
      assert.strictEqual(fillComp.type, 'simple-fill');
      assert.strictEqual(fillComp.color, '#d8b4e2');

      const lineComp = cartouche.components[1] as SimpleLineComponent;
      assert.strictEqual(lineComp.type, 'simple-line');
      assert.strictEqual(lineComp.color, '#6b21a8');
      assert.strictEqual(lineComp.width, 2);
    });

    it('converts OpenLayers Flat Style to Cartouche Symbology and back (lavender fill, purple stroke)', async () => {
      // The exact test case from project-4.cproj layer timeline_level_0
      const olJson = JSON.stringify([
        {
          style: {
            'fill-color': '#d8b4e2',
            'stroke-color': '#6b21a8',
            'stroke-width': 1.5,
          },
        },
      ]);

      const cartoucheJson = await convertStyleFormat(olJson, {
        fromFormat: 'openlayers',
        toFormat: 'cartouche',
        geometryKind: 'Polygon',
      });

      const parsedCartouche = JSON.parse(cartoucheJson) as SimpleCartoucheStyle;
      assert.strictEqual(parsedCartouche.format, 'simple');
      assert.strictEqual(parsedCartouche.components.length, 2);

      const fill = parsedCartouche.components.find((c) => c.type === 'simple-fill') as SimpleFillComponent;
      const line = parsedCartouche.components.find((c) => c.type === 'simple-line') as SimpleLineComponent;
      assert.ok(fill, 'Must have a simple-fill component');
      assert.ok(line, 'Must have a simple-line component');
      assert.strictEqual(fill.color, '#d8b4e2');
      assert.strictEqual(line.color, '#6b21a8');
      assert.strictEqual(line.width, 1.5);

      // Convert back to OpenLayers
      const convertedBackOl = await convertStyleFormat(cartoucheJson, {
        fromFormat: 'cartouche',
        toFormat: 'openlayers',
        geometryKind: 'Polygon',
      });
      const parsedOl = JSON.parse(convertedBackOl);
      assert.ok(Array.isArray(parsedOl));
      assert.strictEqual(parsedOl[0].style['fill-color'], '#d8b4e2');
      assert.strictEqual(parsedOl[0].style['stroke-color'], '#6b21a8');
      assert.strictEqual(parsedOl[0].style['stroke-width'], 1.5);
    });

    it('converts Simple Cartouche Symbology to OGC SLD 1.1.0 and 1.0.0 without empty text', async () => {
      const cartoucheStyle: SimpleCartoucheStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'fill-1',
            type: 'simple-fill',
            enabled: true,
            color: '#d8b4e2',
          },
          {
            id: 'line-1',
            type: 'simple-line',
            enabled: true,
            color: '#6b21a8',
            width: 1.5,
          },
        ],
      };
      const cartoucheJson = JSON.stringify(cartoucheStyle);

      // Convert to SLD 1.1.0
      const sld110 = await convertStyleFormat(cartoucheJson, {
        fromFormat: 'cartouche',
        toFormat: 'sld',
        toVersion: '1.1.0',
        geometryKind: 'Polygon',
      });
      assert.ok(sld110.length > 0, 'SLD 1.1.0 text must not be empty');
      assert.ok(sld110.includes('StyledLayerDescriptor'), 'Must be valid SLD XML');
      assert.ok(sld110.includes('#d8b4e2') || sld110.includes('#D8B4E2'), 'Must contain fill color');
      assert.ok(sld110.includes('#6b21a8') || sld110.includes('#6B21A8'), 'Must contain stroke color');

      // Convert back from SLD 1.1.0 to cartouche
      const fromSld110 = await convertStyleFormat(sld110, {
        fromFormat: 'sld',
        fromVersion: '1.1.0',
        toFormat: 'cartouche',
        geometryKind: 'Polygon',
      });
      const parsedFromSld110 = JSON.parse(fromSld110) as SimpleCartoucheStyle;
      assert.strictEqual(parsedFromSld110.format, 'simple');
      const sldFill = parsedFromSld110.components.find((c) => c.type === 'simple-fill') as SimpleFillComponent;
      const sldLine = parsedFromSld110.components.find((c) => c.type === 'simple-line') as SimpleLineComponent;
      assert.ok(sldFill);
      assert.ok(sldLine);
      assert.strictEqual(sldFill.color.toLowerCase(), '#d8b4e2');
      assert.strictEqual(sldLine.color.toLowerCase(), '#6b21a8');

      // Convert to SLD 1.0.0
      const sld100 = await convertStyleFormat(cartoucheJson, {
        fromFormat: 'cartouche',
        toFormat: 'sld',
        toVersion: '1.0.0',
        geometryKind: 'Polygon',
      });
      assert.ok(sld100.length > 0, 'SLD 1.0.0 text must not be empty');
      assert.ok(sld100.includes('StyledLayerDescriptor'), 'Must be valid SLD XML');
      assert.ok(sld100.includes('#d8b4e2') || sld100.includes('#D8B4E2'), 'Must contain fill color');
      assert.ok(sld100.includes('#6b21a8') || sld100.includes('#6B21A8'), 'Must contain stroke color');
    });

    it('supports cartouche format in parseStyleTextToGeoStyler and serializeGeoStylerToText', async () => {
      const cartoucheStyle: SimpleCartoucheStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'line-1',
            type: 'simple-line',
            enabled: true,
            color: '#10b981',
            width: 3,
          },
        ],
      };
      const json = JSON.stringify(cartoucheStyle);

      const ast = await parseStyleTextToGeoStyler(json, 'cartouche', '1.0.0', 'LineString');
      assert.strictEqual(ast.rules.length, 1);
      const sym = ast.rules[0].symbolizers[0] as LineSymbolizer;
      assert.strictEqual(sym.kind, 'Line');
      assert.strictEqual(sym.color, '#10b981');
      assert.strictEqual(sym.width, 3);

      const serialized = await serializeGeoStylerToText(ast, 'cartouche', '1.0.0', 'LineString');
      const parsed = JSON.parse(serialized) as SimpleCartoucheStyle;
      assert.strictEqual(parsed.format, 'simple');
      const lineComp = parsed.components[0] as SimpleLineComponent;
      assert.strictEqual(lineComp.color, '#10b981');
      assert.strictEqual(lineComp.width, 3);
    });
  });
});
