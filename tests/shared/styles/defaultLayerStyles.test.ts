/**
 * @file defaultLayerStyles.test.ts
 * @module tests/shared/styles/defaultLayerStyles.test
 * @description Unit tests verifying OpenLayers Flat Style definitions for Polygon, LineString, Point, and Unknown vector layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultLayerStyles, getDefaultLayerStyle } from '../../../src/shared/styles/defaultLayerStyles';

describe('defaultLayerStyles', () => {
  it('defines the correct OpenLayers Flat Style rules for Polygon', () => {
    const style = getDefaultLayerStyle('Polygon');
    assert.deepEqual(style, {
      'fill-color': '#1e293b',
      'stroke-color': '#1b446c',
      'stroke-width': 4
    });
  });

  it('defines the correct OpenLayers Flat Style rules for LineString', () => {
    const style = getDefaultLayerStyle('LineString');
    assert.deepEqual(style, {
      'stroke-color': '#0284c7',
      'stroke-width': 2
    });
  });

  it('defines the correct OpenLayers Flat Style rules for Point', () => {
    const style = getDefaultLayerStyle('Point');
    assert.deepEqual(style, {
      'circle-radius': 8,
      'circle-fill-color': '#0369a1'
    });
  });

  it('defines the combined OpenLayers Flat Style rules for Unknown and falls back to Unknown for unrecognized geometry kinds', () => {
    const unknownStyle = getDefaultLayerStyle('Unknown');
    assert.deepEqual(unknownStyle, {
      'fill-color': '#1e293b',
      'stroke-color': '#0284c7',
      'stroke-width': 2,
      'circle-radius': 8,
      'circle-fill-color': '#0369a1'
    });
    assert.deepEqual(getDefaultLayerStyle('UnknownKind'), defaultLayerStyles.Unknown);
    assert.deepEqual(getDefaultLayerStyle(undefined), defaultLayerStyles.Unknown);
  });
});

