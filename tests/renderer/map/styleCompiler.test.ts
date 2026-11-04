/**
 * @file styleCompiler.test.ts
 * @module tests/renderer/map/styleCompiler.test
 * @description Unit tests for renderer styleCompiler verifying Cartouche Symbology compilation, OpenLayers StyleFunction closure caching, painter execution order, disabled component filtering, and format routing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import CircleStyle from 'ol/style/Circle';
import {
  compileStyleFunction,
  compileCartoucheLayerStyleSync,
  compileLayerStyle,
  isCartoucheStyleDescriptor
} from '../../../src/renderer/map/styleCompiler';
import type { CartoucheLayerStyle, ProjectStyleItem } from '../../../src/shared/types';

describe('styleCompiler: Cartouche Symbology Compiler & StyleFunction Caching (Ticket #126)', () => {
  const sampleCartoucheStyle: CartoucheLayerStyle = {
    format: 'simple',
    version: 1,
    components: [
      {
        id: 'fill-1',
        type: 'simple-fill',
        enabled: true,
        color: '#ff5500'
      },
      {
        id: 'line-casing',
        type: 'simple-line',
        enabled: true,
        color: '#000000',
        width: 4
      },
      {
        id: 'line-core',
        type: 'simple-line',
        enabled: true,
        color: '#ffffff',
        width: 2,
        dashArray: [4, 4]
      },
      {
        id: 'marker-1',
        type: 'simple-marker',
        enabled: true,
        shape: 'circle',
        radius: 8,
        fillColor: '#3388ff',
        strokeColor: '#002266',
        strokeWidth: 2
      }
    ]
  };

  it('compiles SimpleFill, SimpleLine, and SimpleMarker components into OpenLayers Style instances', () => {
    const styleFunction = compileStyleFunction(sampleCartoucheStyle);
    const feature = new Feature(new Point([0, 0]));
    const styles = styleFunction(feature, 1) as import('ol/style/Style').default[];

    assert.ok(Array.isArray(styles));
    assert.equal(styles.length, 4);

    // 1. SimpleFill
    const fillStyle = styles[0];
    assert.ok(fillStyle.getFill());
    assert.equal(fillStyle.getFill()?.getColor(), '#ff5500');

    // 2. SimpleLine (casing)
    const casingStyle = styles[1];
    assert.ok(casingStyle.getStroke());
    assert.equal(casingStyle.getStroke()?.getColor(), '#000000');
    assert.equal(casingStyle.getStroke()?.getWidth(), 4);

    // 3. SimpleLine with dashArray (core)
    const coreStyle = styles[2];
    assert.ok(coreStyle.getStroke());
    assert.equal(coreStyle.getStroke()?.getColor(), '#ffffff');
    assert.equal(coreStyle.getStroke()?.getWidth(), 2);
    assert.deepEqual(coreStyle.getStroke()?.getLineDash(), [4, 4]);

    // 4. SimpleMarker
    const markerStyle = styles[3];
    const image = markerStyle.getImage();
    assert.ok(image instanceof CircleStyle);
    assert.equal(image.getRadius(), 8);
    assert.equal(image.getFill()?.getColor(), '#3388ff');
    assert.equal(image.getStroke()?.getColor(), '#002266');
    assert.equal(image.getStroke()?.getWidth(), 2);
  });

  it('preserves painter execution order matching components array indices', () => {
    const orderedStyle: CartoucheLayerStyle = {
      format: 'simple',
      version: 1,
      components: [
        { id: 'bottom', type: 'simple-fill', enabled: true, color: '#111111' },
        { id: 'middle', type: 'simple-line', enabled: true, color: '#222222', width: 2 },
        { id: 'top', type: 'simple-line', enabled: true, color: '#333333', width: 1 }
      ]
    };
    const styleFunction = compileStyleFunction(orderedStyle);
    const styles = styleFunction(new Feature(), 1) as import('ol/style/Style').default[];

    assert.equal(styles.length, 3);
    assert.equal(styles[0].getFill()?.getColor(), '#111111', 'Bottom fill must be index 0');
    assert.equal(styles[1].getStroke()?.getColor(), '#222222', 'Middle line must be index 1');
    assert.equal(styles[2].getStroke()?.getColor(), '#333333', 'Top line must be index 2');
  });

  it('skips disabled components (enabled === false)', () => {
    const styleWithDisabled: CartoucheLayerStyle = {
      format: 'simple',
      version: 1,
      components: [
        { id: 'fill-1', type: 'simple-fill', enabled: false, color: '#111111' },
        { id: 'line-1', type: 'simple-line', enabled: true, color: '#222222', width: 2 },
        { id: 'marker-1', type: 'simple-marker', enabled: false, shape: 'circle', radius: 5, fillColor: '#f00', strokeColor: '#000', strokeWidth: 1 }
      ]
    };
    const styleFunction = compileStyleFunction(styleWithDisabled);
    const styles = styleFunction(new Feature(), 1) as import('ol/style/Style').default[];

    assert.equal(styles.length, 1);
    assert.equal(styles[0].getStroke()?.getColor(), '#222222');
  });

  it('caches Style instances across render frames for 60 FPS performance', () => {
    const styleFunction = compileStyleFunction(sampleCartoucheStyle);
    const feature1 = new Feature(new Point([10, 20]));
    const feature2 = new Feature(new Point([30, 40]));

    const frame1 = styleFunction(feature1, 1);
    const frame2 = styleFunction(feature2, 1);
    const frame3 = styleFunction(feature1, 2);

    // Exact same array reference returned to avoid garbage collection churn
    assert.strictEqual(frame1, frame2);
    assert.strictEqual(frame1, frame3);
  });

  describe('isCartoucheStyleDescriptor', () => {
    it('detects Cartouche format from ProjectLayerStyleItem with format="cartouche"', () => {
      assert.equal(isCartoucheStyleDescriptor({ format: 'cartouche', content: '{}' }), true);
    });

    it('detects Cartouche format from shared style href', () => {
      const shared: ProjectStyleItem[] = [
        { id: 'cart-1', format: 'cartouche', content: JSON.stringify(sampleCartoucheStyle) }
      ];
      assert.equal(isCartoucheStyleDescriptor({ href: '#cart-1' }, shared), true);
    });

    it('detects Cartouche format from raw CartoucheLayerStyle object or JSON string', () => {
      assert.equal(isCartoucheStyleDescriptor(sampleCartoucheStyle), true);
      assert.equal(isCartoucheStyleDescriptor(JSON.stringify(sampleCartoucheStyle)), true);
    });

    it('returns false for OpenLayers Flat Style, SLD XML, or invalid descriptors', () => {
      assert.equal(isCartoucheStyleDescriptor(null), false);
      assert.equal(isCartoucheStyleDescriptor({ format: 'openlayers' }), false);
      assert.equal(isCartoucheStyleDescriptor({ format: 'sld' }), false);
      assert.equal(isCartoucheStyleDescriptor('<StyledLayerDescriptor />'), false);
      assert.equal(isCartoucheStyleDescriptor('{"fill-color": "red"}'), false);
    });
  });

  describe('compileCartoucheLayerStyleSync', () => {
    it('synchronously compiles inline Cartouche style item', () => {
      const result = compileCartoucheLayerStyleSync({
        format: 'cartouche',
        content: JSON.stringify(sampleCartoucheStyle)
      });
      assert.equal(result.format, 'cartouche');
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, 'function');
      assert.equal(result.requiredFields.size, 0);

      const styles = result.compiledStyle(new Feature(), 1);
      assert.equal(styles.length, 4);
    });

    it('synchronously compiles shared Cartouche style reference', () => {
      const shared: ProjectStyleItem[] = [
        { id: 'shared-style-1', format: 'cartouche', content: JSON.stringify(sampleCartoucheStyle) }
      ];
      const result = compileCartoucheLayerStyleSync(
        { href: '#shared-style-1', format: 'cartouche' },
        { sharedStyles: shared, layerId: 'layer-test' }
      );
      assert.equal(result.format, 'cartouche');
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, 'function');
    });

    it('falls back to default vector style on unstyled or invalid JSON', () => {
      const result1 = compileCartoucheLayerStyleSync(null);
      assert.equal(result1.isFallback, true);
      assert.equal(result1.format, 'cartouche');
      assert.ok(Array.isArray(result1.compiledStyle));

      const result2 = compileCartoucheLayerStyleSync({ format: 'cartouche', content: 'invalid-json' });
      assert.equal(result2.isFallback, true);

      const result3 = compileCartoucheLayerStyleSync({ format: 'cartouche', content: '{"format": "unknown"}' });
      assert.equal(result3.isFallback, true);
    });
  });

  describe('Advanced SimpleLineComponent Stroke Options (Ticket #156)', () => {
    it('maps lineCap, lineJoin, offset, lineDash, lineDashOffset, and float width to ol/style/Stroke', () => {
      const advancedLineStyle: CartoucheLayerStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'line-adv',
            type: 'simple-line',
            enabled: true,
            color: '#10b981',
            width: 3.5,
            offset: -4.5,
            cap: 'square',
            join: 'miter',
            dashPattern: 'custom',
            dashArray: [12, 6, 3, 6],
            dashOffset: 2.5
          }
        ]
      };

      const styleFunction = compileStyleFunction(advancedLineStyle);
      const styles = styleFunction(new Feature(), 1) as import('ol/style/Style').default[];

      assert.equal(styles.length, 1);
      const stroke = styles[0].getStroke();
      assert.ok(stroke);
      assert.equal(stroke.getColor(), '#10b981');
      assert.equal(stroke.getWidth(), 3.5);
      assert.equal(stroke.getLineCap(), 'square');
      assert.equal(stroke.getLineJoin(), 'miter');
      assert.equal(stroke.getOffset(), -4.5);
      assert.deepEqual(stroke.getLineDash(), [12, 6, 3, 6]);
      assert.equal(stroke.getLineDashOffset(), 2.5);
    });

    it('suppresses stroke rendering when dashPattern === "no-line" while preserving component in style definition', () => {
      const noLineStyle: CartoucheLayerStyle = {
        format: 'simple',
        version: 1,
        components: [
          {
            id: 'fill-1',
            type: 'simple-fill',
            enabled: true,
            color: '#3b82f6'
          },
          {
            id: 'line-suppressed',
            type: 'simple-line',
            enabled: true,
            color: '#ef4444',
            width: 2,
            dashPattern: 'no-line'
          }
        ]
      };

      // Verify component remains intact in the style definition
      assert.equal(noLineStyle.components.length, 2);
      assert.equal(noLineStyle.components[1].type, 'simple-line');
      assert.equal((noLineStyle.components[1] as any).dashPattern, 'no-line');

      // Verify compiled output has no stroke (only the fill style is returned)
      const styleFunction = compileStyleFunction(noLineStyle);
      const styles = styleFunction(new Feature(), 1) as import('ol/style/Style').default[];

      assert.equal(styles.length, 1);
      assert.ok(styles[0].getFill());
      assert.equal(styles[0].getStroke(), null);
    });
  });

  describe('compileLayerStyle routing', () => {
    it('routes Cartouche styles through compileCartoucheLayerStyleSync', async () => {
      const result = await compileLayerStyle({
        format: 'cartouche',
        content: JSON.stringify(sampleCartoucheStyle)
      });
      assert.equal(result.format, 'cartouche');
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, 'function');
    });
  });
});
