/**
 * @file selectionHighlight.test.ts
 * @module tests/renderer/map/selectionHighlight.test
 * @description Tests for the selection highlight style: selected polygons and point markers are filled with the Selection Colour, selected lines are stroked with it, and mixed geometries receive every treatment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link createSelectionHighlightStyleFunction}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import Polygon from 'ol/geom/Polygon.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import CircleStyle from 'ol/style/Circle.js';
import type Style from 'ol/style/Style.js';
import {
  createSelectionHighlightStyleFunction,
  resolveSelectionGeometryFamily,
  SELECTION_HIGHLIGHT_LINE_WIDTH,
  SELECTION_HIGHLIGHT_POINT_RADIUS,
} from '../../../src/renderer/map/selectionHighlight';

const COLOUR = 'rgba(255,255,0,0.6)';

/**
 * @function styleFor
 * @description Resolves the highlight style for a geometry.
 * @param {any} geometry - OpenLayers geometry.
 * @returns {Style} Resolved style.
 */
function styleFor(geometry: any): Style {
  const fn = createSelectionHighlightStyleFunction(COLOUR);
  return fn(new Feature({ geometry }), 1) as Style;
}

describe('selection highlight style (Ticket #273)', () => {
  it('maps geometry types to highlight families', () => {
    assert.equal(resolveSelectionGeometryFamily('Point'), 'point');
    assert.equal(resolveSelectionGeometryFamily('MultiPoint'), 'point');
    assert.equal(resolveSelectionGeometryFamily('LineString'), 'line');
    assert.equal(resolveSelectionGeometryFamily('MultiLineString'), 'line');
    assert.equal(resolveSelectionGeometryFamily('Polygon'), 'polygon');
    assert.equal(resolveSelectionGeometryFamily('MultiPolygon'), 'polygon');
    assert.equal(resolveSelectionGeometryFamily('GeometryCollection'), 'other');
    assert.equal(resolveSelectionGeometryFamily(undefined), 'other');
  });

  it('fills selected polygons with the Selection Colour and does not stroke them', () => {
    for (const geometry of [
      new Polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]]),
      new MultiPolygon([[[[0, 0], [1, 0], [1, 1], [0, 0]]]]),
    ]) {
      const style = styleFor(geometry);
      assert.equal(style.getFill()?.getColor(), COLOUR);
      assert.equal(style.getStroke(), null);
      assert.equal(style.getImage(), null);
    }
  });

  it('strokes selected lines with the Selection Colour and does not fill them', () => {
    for (const geometry of [
      new LineString([[0, 0], [1, 1]]),
      new MultiLineString([[[0, 0], [1, 1]]]),
    ]) {
      const style = styleFor(geometry);
      assert.equal(style.getStroke()?.getColor(), COLOUR);
      assert.equal(style.getStroke()?.getWidth(), SELECTION_HIGHLIGHT_LINE_WIDTH);
      assert.equal(style.getFill(), null);
      assert.equal(style.getImage(), null);
    }
  });

  it('draws selected points as a marker filled with the Selection Colour', () => {
    for (const geometry of [new Point([0, 0]), new MultiPoint([[0, 0], [1, 1]])]) {
      const style = styleFor(geometry);
      const image = style.getImage();
      assert.ok(image instanceof CircleStyle, 'point highlight is a circle marker');
      assert.equal((image as CircleStyle).getRadius(), SELECTION_HIGHLIGHT_POINT_RADIUS);
      assert.equal((image as CircleStyle).getFill()?.getColor(), COLOUR);
      assert.equal(style.getFill(), null);
      assert.equal(style.getStroke(), null);
    }
  });

  it('gives geometry collections fill, stroke and marker so every part is visible', () => {
    const style = styleFor(new GeometryCollection([new Point([0, 0]), new LineString([[0, 0], [1, 1]])]));
    assert.equal(style.getFill()?.getColor(), COLOUR);
    assert.equal(style.getStroke()?.getColor(), COLOUR);
    assert.ok(style.getImage() instanceof CircleStyle);
  });

  it('reuses one cached Style per family and honours a different colour per function', () => {
    const fn = createSelectionHighlightStyleFunction('#ff00ff');
    const a = fn(new Feature({ geometry: new Polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]]) }), 1);
    const b = fn(new Feature({ geometry: new Polygon([[[2, 2], [3, 2], [3, 3], [2, 2]]]) }), 1);
    assert.equal(a, b, 'same family shares the cached style');
    assert.equal((a as Style).getFill()?.getColor(), '#ff00ff');
  });
});
