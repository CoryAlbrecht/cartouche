/**
 * @file featurePacket.test.ts
 * @module tests/shared/layers/featurePacket
 * @description Tests the WKB Feature Packet codec: number and string Feature IDs survive a round trip with their type, geometry and property payloads are framed
 * exactly, and a buffer that is not a packet of the current version, or is cut short, is rejected instead of being read partly.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeFeaturePacket,
  encodeFeaturePacket,
  featurePacketOf,
} from "../../../src/shared/layers/featurePacket";
import {
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES,
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
} from "../../../src/shared/types";

const utf8 = new TextEncoder();
const text = new TextDecoder();

describe("WKB Feature Packet codec (Ticket #387)", () => {
  it("round-trips number and string Feature IDs, keeping their types", () => {
    const ids = [0, 1, 42, -7, Number.MAX_SAFE_INTEGER, "feature-1", "5", ""];
    const packet = encodeFeaturePacket(
      ids.map((id) => ({ id, wkb: null, properties: null }))
    );
    assert.deepEqual(
      decodeFeaturePacket(packet).map((r) => r.id),
      ids
    );
  });

  it("frames geometry and property bytes per record and sets the header flags", () => {
    const wkb = new Uint8Array([1, 2, 3, 4, 5]);
    const props = utf8.encode('{"name":"Italy"}');
    const packet = encodeFeaturePacket([
      { id: "a", wkb, properties: props },
      { id: 9, wkb: null, properties: null },
    ]);
    const view = new DataView(packet);
    assert.equal(view.getUint32(0, true), WKB_PACKET_MAGIC);
    assert.equal(view.getUint16(4, true), WKB_PACKET_VERSION);
    assert.equal(
      view.getUint16(6, true),
      WKB_FLAG_HAS_GEOMETRY | WKB_FLAG_HAS_PROPERTIES
    );
    assert.equal(view.getUint32(8, true), 2);

    const [first, second] = decodeFeaturePacket(packet);
    assert.deepEqual([...first.wkb!], [1, 2, 3, 4, 5]);
    assert.equal(text.decode(first.properties!), '{"name":"Italy"}');
    assert.equal(second.wkb, null);
    assert.equal(second.properties, null);
  });

  it("encodes non-ASCII string Feature IDs as UTF-8", () => {
    const packet = encodeFeaturePacket([
      { id: "Zürich-東京-🗺", wkb: null, properties: null },
    ]);
    assert.equal(decodeFeaturePacket(packet)[0].id, "Zürich-東京-🗺");
  });

  it("reads a packet held in a typed-array view of a larger buffer", () => {
    const packet = new Uint8Array(
      encodeFeaturePacket([{ id: 3, wkb: null, properties: null }])
    );
    const padded = new Uint8Array(packet.byteLength + 8);
    padded.set(packet, 4);
    const view = new Uint8Array(padded.buffer, 4, packet.byteLength);
    assert.deepEqual(
      decodeFeaturePacket(view).map((r) => r.id),
      [3]
    );
  });

  it("rejects number Feature IDs that are not safe integers", () => {
    for (const id of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      assert.throws(
        () => encodeFeaturePacket([{ id, wkb: null, properties: null }]),
        RangeError,
        String(id)
      );
    }
  });

  it("rejects a buffer with the wrong magic number or version, or one cut short", () => {
    const packet = encodeFeaturePacket([
      { id: "abc", wkb: new Uint8Array([1, 2]), properties: null },
    ]);
    const badMagic = packet.slice(0);
    new DataView(badMagic).setUint32(0, 0x12345678, true);
    assert.throws(() => decodeFeaturePacket(badMagic), /magic/);

    const oldVersion = packet.slice(0);
    new DataView(oldVersion).setUint16(4, 1, true);
    assert.throws(() => decodeFeaturePacket(oldVersion), /version/);

    for (let length = 0; length < packet.byteLength; length++) {
      assert.throws(
        () => decodeFeaturePacket(packet.slice(0, length)),
        RangeError,
        `length ${length}`
      );
    }
  });

  it("rejects bytes after the last record", () => {
    const packet = new Uint8Array(
      encodeFeaturePacket([{ id: 1, wkb: null, properties: null }])
    );
    const longer = new Uint8Array(packet.byteLength + 1);
    longer.set(packet);
    assert.throws(() => decodeFeaturePacket(longer), /after its last record/);
  });

  it("picks a packet out of a queryExtent result only when its buffer can hold a header", () => {
    const packet = encodeFeaturePacket([]);
    const view = new Uint8Array(packet);
    assert.equal(featurePacketOf({ buffer: packet }), packet);
    assert.equal(featurePacketOf({ buffer: view }), view);
    assert.equal(featurePacketOf({ buffer: new ArrayBuffer(11) }), null);
    assert.equal(featurePacketOf({ features: [] }), null);
    assert.equal(featurePacketOf({ buffer: "nope" }), null);
    assert.equal(featurePacketOf(null), null);
  });
});
