/**
 * @file flatStyleConverter.test.ts
 * @module tests/shared/styles/flatStyleConverter.test
 * @description Unit and round-trip integration tests for GeoStyler AST <-> OpenLayers Flat Style bidirectional converter, SLD 1.0.0/1.1.0 format conversions, and live syntax validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 * @see {@link flatStyleToGeoStyler}
 * @see {@link geoStylerToFlatStyle}
 * @see {@link convertStyleFormat}
 * @see {@link validateStyleContent}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flatStyleToGeoStyler,
  geoStylerToFlatStyle,
  convertStyleFormat,
  validateStyleContent,
  olFilterToGeoStyler,
  geoStylerFilterToOl,
} from '../../../src/shared/styles/flatStyleConverter';
import type { OlFlatStyleRule } from '../../../src/shared/types';
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
});
