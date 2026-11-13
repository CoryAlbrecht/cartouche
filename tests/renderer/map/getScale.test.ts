/**
 * @file getScale.test.ts
 * @module tests/renderer/map/getScale.test
 * @description Unit tests for cartographic scale denominator calculation from screen DPI and OpenLayers view point resolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link getScale}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import View from 'ol/View.js';
import { fromLonLat } from 'ol/proj.js';
import { computeScaleDenominator, getScale, resolveScaleSampleCoordinates } from '../../../src/renderer/map/getScale';

describe('computeScaleDenominator', () => {
  it('calculates expected scale denominator for standard 96 DPI', () => {
    // 1 meter/pixel at 96 DPI: 1 * 96 / 0.0254 = 3779.527... -> 3780
    const scale = computeScaleDenominator(1, 96);
    assert.equal(scale, 3780);
  });

  it('calculates expected scale denominator for high-DPI 192 DPI (2x scaling)', () => {
    // 1 meter/pixel at 192 DPI: 1 * 192 / 0.0254 = 7559.055... -> 7559
    const scale = computeScaleDenominator(1, 192);
    assert.equal(scale, 7559);
  });

  it('calculates scale denominator for fractional point resolution', () => {
    // 0.5 meters/pixel at 96 DPI: 0.5 * 96 / 0.0254 = 1889.76... -> 1890
    const scale = computeScaleDenominator(0.5, 96);
    assert.equal(scale, 1890);
  });

  it('safely handles non-positive or non-finite point resolutions', () => {
    assert.equal(computeScaleDenominator(0, 96), 1);
    assert.equal(computeScaleDenominator(-5, 96), 1);
    assert.equal(computeScaleDenominator(NaN, 96), 1);
    assert.equal(computeScaleDenominator(Infinity, 96), 1);
  });
});

describe('getScale with OpenLayers View', () => {
  it('computes scale denominator for EPSG:3857 view at equator', () => {
    const view = new View({
      center: [0, 0],
      resolution: 100,
    });

    const scale = getScale(view, { dpi: 96 });
    // 100 * 96 / 0.0254 = 377952.75... -> 377953
    assert.equal(scale, 377953);
  });

  it('accounts for Mercator latitude distortion at 60 degrees latitude in EPSG:3857', () => {
    const center60 = fromLonLat([0, 60]);
    const view = new View({
      center: center60,
      resolution: 100,
    });

    const scale = getScale(view, { dpi: 96 });
    // At 60 deg lat, cos(60) = 0.5, so pointResolution = 50 m/px
    // 50 * 96 / 0.0254 = 188976.37... -> 188976
    assert.equal(scale, 188976);
  });

  it('computes scale denominator for EPSG:4326 geographic view', () => {
    const view = new View({
      center: [0, 0],
      resolution: 0.001, // ~111.2 meters/px at equator
      ['proj' + 'ection']: 'EPSG:4326',
    } as any);

    const scale = getScale(view, { dpi: 96 });
    assert.ok(scale > 400000 && scale < 450000, `Expected scale ~420k, got ${scale}`);
  });

  it('returns 1 if view has undefined resolution', () => {
    const view = new View({
      center: [0, 0],
    });

    assert.equal(getScale(view), 1);
  });
});

describe('getScale Scale Calculation methods (Ticket #275)', () => {
  const SIZE: [number, number] = [800, 600];
  const DPI = 96;

  /**
   * @function viewAt60
   * @description Builds an EPSG:3857 view centred at 60°N with a 100 m/px nominal resolution.
   * @returns {View} The view.
   */
  function viewAt60(): View {
    return new View({ center: fromLonLat([0, 60]), resolution: 100 });
  }

  it('middle matches the previous default (centre point resolution)', () => {
    const view = viewAt60();
    assert.equal(getScale(view, { dpi: DPI, method: 'middle', size: SIZE }), getScale(view, { dpi: DPI }));
  });

  it('top and bottom sample the viewport edges, so in Mercator the top (further north) is a smaller denominator than the bottom', () => {
    const view = viewAt60();
    const top = getScale(view, { dpi: DPI, method: 'top', size: SIZE });
    const middle = getScale(view, { dpi: DPI, method: 'middle', size: SIZE });
    const bottom = getScale(view, { dpi: DPI, method: 'bottom', size: SIZE });
    assert.ok(top < middle, `top ${top} must be below middle ${middle}`);
    assert.ok(middle < bottom, `middle ${middle} must be below bottom ${bottom}`);
  });

  it('average is the rounded mean of the top, middle and bottom denominators', () => {
    const view = viewAt60();
    const top = getScale(view, { dpi: DPI, method: 'top', size: SIZE });
    const middle = getScale(view, { dpi: DPI, method: 'middle', size: SIZE });
    const bottom = getScale(view, { dpi: DPI, method: 'bottom', size: SIZE });
    const average = getScale(view, { dpi: DPI, method: 'average', size: SIZE });
    assert.equal(average, Math.round((top + middle + bottom) / 3));
  });

  it('equator ignores the view latitude and matches the nominal resolution', () => {
    const view = viewAt60();
    const equator = getScale(view, { dpi: DPI, method: 'equator', size: SIZE });
    // 100 m/px * 96 dpi / 0.0254 = 377953 at the equator regardless of where the view is.
    assert.equal(equator, 377953);
    assert.notEqual(equator, getScale(view, { dpi: DPI, method: 'middle', size: SIZE }));
  });

  it('top / bottom / average fall back to the middle when no viewport size is known', () => {
    const view = viewAt60();
    const middle = getScale(view, { dpi: DPI, method: 'middle' });
    assert.equal(getScale(view, { dpi: DPI, method: 'top' }), middle);
    assert.equal(getScale(view, { dpi: DPI, method: 'bottom' }), middle);
    assert.equal(getScale(view, { dpi: DPI, method: 'average' }), middle);
  });

  it('resolveScaleSampleCoordinates returns the expected sample points', () => {
    const view = viewAt60();
    const center = view.getCenter()!;
    assert.deepEqual(resolveScaleSampleCoordinates(view, 'middle', SIZE), [center]);
    assert.equal(resolveScaleSampleCoordinates(view, 'average', SIZE).length, 3);
    const [eq] = resolveScaleSampleCoordinates(view, 'equator', SIZE);
    assert.equal(eq[0], center[0]);
    assert.ok(Math.abs(eq[1]) < 1e-6, 'equator sample lies at y = 0 in EPSG:3857');
  });
});
