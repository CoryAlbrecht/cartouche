/**
 * @file project.test.ts
 * @module tests/shared/types/project.test
 * @description Unit tests verifying shared binary WKB packet protocol constants, query extent options, and result interfaces.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link WKB_PACKET_MAGIC}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES,
  type QueryExtentOptions,
  type QueryExtentBinaryResult
} from '../../../src/shared/types';

describe('Shared WKB Feature Packet Protocol Constants & Contracts', () => {
  it('exports correct protocol constants matching ADR 0004 specification', () => {
    assert.equal(WKB_PACKET_MAGIC, 0x43415254);
    assert.equal(WKB_PACKET_VERSION, 1);
    assert.equal(WKB_FLAG_HAS_GEOMETRY, 0x01);
    assert.equal(WKB_FLAG_HAS_PROPERTIES, 0x02);
  });

  it('allows constructing compliant QueryExtentOptions and QueryExtentBinaryResult objects', () => {
    const options: QueryExtentOptions = {
      extent: [-100, 40, -80, 50],
      targetProjection: 'EPSG:3857',
      includeGeometry: true,
      fields: ['NAME', 'POP_EST']
    };
    assert.deepEqual(options.fields, ['NAME', 'POP_EST']);

    const buffer = new ArrayBuffer(12);
    const result: QueryExtentBinaryResult = {
      layerId: 'test-layer-id',
      buffer
    };
    assert.equal(result.layerId, 'test-layer-id');
    assert.equal(result.buffer.byteLength, 12);
  });
});

