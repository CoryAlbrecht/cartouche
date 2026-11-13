/**
 * @file projectDefaultStyles.test.ts
 * @module tests/shared/styles/projectDefaultStyles.test
 * @description Tests for Project Default Styles: reserved `_` ids, slot read/write in the shared style collection, geometry families, the default chosen for a new layer, the composite for mixed or unknown geometries with per-slot fallback, and the random-colour default when no slot is set.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link resolveNewLayerStyleContent}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_DEFAULT_STYLE_IDS,
  isReservedStyleId,
  filterUserSharedStyles,
  geometryFamily,
  getProjectDefaultStyles,
  setProjectDefaultStyles,
  resolveNewLayerStyleContent,
} from '../../../src/shared/styles/projectDefaultStyles';

const POINT = JSON.stringify({ format: 'simple', version: 1, components: [{ id: 'marker-1', type: 'simple-marker', enabled: true, shape: 'circle', radius: 9, fillColor: '#ff0000', strokeColor: '#000000', strokeWidth: 1 }] });
const LINE = JSON.stringify({ format: 'simple', version: 1, components: [{ id: 'line-1', type: 'simple-line', enabled: true, color: '#00ff00', width: 3 }] });
const POLYGON = JSON.stringify({ format: 'simple', version: 1, components: [{ id: 'fill-1', type: 'simple-fill', enabled: true, color: '#0000ff' }] });

describe('Project Default Styles (Ticket #282)', () => {
  it('reserves _-prefixed ids and hides them from user shared-style lists', () => {
    assert.equal(isReservedStyleId('_project_default_point'), true);
    assert.equal(isReservedStyleId('#_anything'), true);
    assert.equal(isReservedStyleId('shared-style-1'), false);
    assert.deepEqual(
      filterUserSharedStyles([{ id: '_project_default_line', content: LINE }, { id: 'roads', content: '[]' }]).map((s) => s.id),
      ['roads']
    );
  });

  it('maps geometry kinds to families, multi-part included', () => {
    assert.equal(geometryFamily('Point'), 'point');
    assert.equal(geometryFamily('MultiPoint'), 'point');
    assert.equal(geometryFamily('LineString'), 'line');
    assert.equal(geometryFamily('MultiLineString'), 'line');
    assert.equal(geometryFamily('Polygon'), 'polygon');
    assert.equal(geometryFamily('MultiPolygon'), 'polygon');
    assert.equal(geometryFamily('GeometryCollection'), 'mixed');
    assert.equal(geometryFamily('Unknown'), 'mixed');
    assert.equal(geometryFamily(undefined), 'mixed');
  });

  it('reads and writes slots under the reserved ids, writing only set slots and keeping user styles', () => {
    const user = { id: 'roads', format: 'openlayers' as const, content: '[]' };
    let styles = setProjectDefaultStyles([user], { point: POINT, line: null });
    assert.deepEqual(styles.map((s) => s.id), ['roads', PROJECT_DEFAULT_STYLE_IDS.point]);
    assert.equal(styles[1].format, 'cartouche');
    assert.deepEqual(getProjectDefaultStyles(styles), { point: POINT });
    styles = setProjectDefaultStyles(styles, { point: null, polygon: POLYGON });
    assert.deepEqual(styles.map((s) => s.id), ['roads', PROJECT_DEFAULT_STYLE_IDS.polygon]);
  });

  it('gives a new layer the default of its geometry family, multi-part included', () => {
    const defaults = { point: POINT, line: LINE, polygon: POLYGON };
    assert.equal(resolveNewLayerStyleContent('MultiPoint', defaults), POINT);
    assert.equal(resolveNewLayerStyleContent('LineString', defaults), LINE);
    assert.equal(resolveNewLayerStyleContent('MultiPolygon', defaults), POLYGON);
  });

  it('keeps the random-colour application default for unset slots', () => {
    const lineStyle = JSON.parse(resolveNewLayerStyleContent('LineString', { point: POINT }));
    assert.equal(lineStyle.components.length, 1);
    assert.equal(lineStyle.components[0].type, 'simple-line');
    assert.equal(lineStyle.components[0].width, 2, 'application default line width');
    const none = JSON.parse(resolveNewLayerStyleContent('Unknown', {}));
    assert.deepEqual(none.components.map((c: any) => c.type), ['simple-fill', 'simple-line', 'simple-marker'], "today's mixed default when nothing is set");
  });

  it('builds a composite for mixed or unknown geometry, falling back per slot', () => {
    const composite = JSON.parse(resolveNewLayerStyleContent('GeometryCollection', { point: POINT, polygon: POLYGON }));
    const ids = composite.components.map((c: any) => c.id);
    assert.deepEqual(ids, ['polygon-fill-1', 'line-line-1', 'point-marker-1'], 'polygon, then line (application default), then point, ids unique');
    assert.equal(composite.components[0].color, '#0000ff', 'polygon slot from the project default');
    assert.equal(composite.components[1].width, 2, 'unset line slot falls back to the application default');
    assert.equal(composite.components[2].radius, 9, 'point slot from the project default');
  });
});
