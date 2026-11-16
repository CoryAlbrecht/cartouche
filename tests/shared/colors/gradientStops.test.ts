/**
 * @file gradientStops.test.ts
 * @module tests/shared/colors/gradientStops.test
 * @description Unit tests for the shared gradient stop helpers: parsing '<color> <percent>' stop strings into GradientStop objects with stable ids, serializing them in a uniform colour format, building a CSS linear-gradient() stop list, the `@shared/colors` re-export, and the module staying free of React and widget dependencies.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link parseInitialStops}
 * @see {@link serializeGradientStops}
 * @see {@link gradientStopsToCss}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseInitialStops, serializeGradientStops, gradientStopsToCss } from '../../../src/shared/colors/gradientStops';
import * as colors from '../../../src/shared/colors/index';

describe('Shared gradient stop helpers (Ticket #310)', () => {
  it('serializes stops uniformly across various color formats', () => {
    const stops = [
      { id: 's1', color: '#ff0000ff', offset: 0 },
      { id: 's2', color: '#00ff00ff', offset: 100 }
    ];
    assert.deepEqual(serializeGradientStops(stops, 'HEX'), ['#ff0000ff 0%', '#00ff00ff 100%']);
    assert.deepEqual(serializeGradientStops(stops, 'RGB'), ['rgb(255 0 0) 0%', 'rgb(0 255 0) 100%']);

    const parsed = parseInitialStops(['#112233 10%', '#445566 90%']);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].offset, 10);
    assert.equal(parsed[1].offset, 90);
  });

  it('generates deterministic stop IDs matching default stops and across array re-indexing', () => {
    assert.deepEqual(
      parseInitialStops().map((s) => s.id),
      ['stop-0', 'stop-100'],
      'Default initial stops must produce stable IDs stop-0 and stop-100'
    );
    assert.deepEqual(
      parseInitialStops(['#000000ff 0%', '#00ff00ff 100%']).map((s) => s.id),
      ['stop-0', 'stop-100'],
      'Parsed initial stops must match default initial stop IDs without index prefix divergence'
    );
    assert.deepEqual(
      parseInitialStops(['#000000ff 0%', '#008000ff 50%', '#00ff00ff 100%']).map((s) => s.id),
      ['stop-0', 'stop-50', 'stop-100'],
      '100% boundary stop must retain stop-100 ID regardless of intermediate stops count'
    );
  });

  it('builds a CSS colour-stop list sorted by offset', () => {
    const stops = [
      { id: 'b', color: '#0000ffff', offset: 100 },
      { id: 'a', color: '#ff0000ff', offset: 0 }
    ];
    assert.equal(gradientStopsToCss(stops), '#ff0000ff 0%, #0000ffff 100%');
    assert.equal(stops[0].id, 'b', 'The input array is not reordered');
  });

  it('is re-exported from @shared/colors', () => {
    assert.equal(colors.parseInitialStops, parseInitialStops);
    assert.equal(colors.serializeGradientStops, serializeGradientStops);
    assert.equal(colors.gradientStopsToCss, gradientStopsToCss);
  });

  it('depends on nothing but sibling colour modules', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../src/shared/colors/gradientStops.ts', import.meta.url)),
      'utf8'
    );
    const imports = [...source.matchAll(/^import[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => m[1]);
    assert.ok(imports.length > 0);
    for (const spec of imports) {
      assert.match(spec, /^\.\/[A-Za-z]+$/, `Unexpected dependency "${spec}"`);
    }
  });
});
