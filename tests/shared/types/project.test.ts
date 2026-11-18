/**
 * @file project.test.ts
 * @module tests/shared/types/project.test
 * @description Unit tests verifying shared binary WKB packet protocol constants, query extent options, and result interfaces.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link WKB_PACKET_MAGIC}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES,
  type QueryExtentOptions,
  type QueryExtentBinaryResult,
  type SortKey,
} from "../../../src/shared/types";

describe("Shared WKB Feature Packet Protocol Constants & Contracts", () => {
  it("exports correct protocol constants matching ADR 0004 specification", () => {
    assert.equal(WKB_PACKET_MAGIC, 0x43415254);
    assert.equal(WKB_PACKET_VERSION, 1);
    assert.equal(WKB_FLAG_HAS_GEOMETRY, 0x01);
    assert.equal(WKB_FLAG_HAS_PROPERTIES, 0x02);
  });

  it("allows constructing compliant QueryExtentOptions and QueryExtentBinaryResult objects", () => {
    const options: QueryExtentOptions = {
      extent: [-100, 40, -80, 50],
      targetProjection: "EPSG:3857",
      includeGeometry: true,
      fields: ["NAME", "POP_EST"],
      orderBy: [
        ["start_date", "ASC"],
        ["category", "ASC"],
        ["priority", "DESC"],
      ],
    };
    assert.deepEqual(options.fields, ["NAME", "POP_EST"]);
    assert.deepEqual(options.orderBy, [
      ["start_date", "ASC"],
      ["category", "ASC"],
      ["priority", "DESC"],
    ]);

    const key: SortKey = ["start_date", "DESC"];
    const [field, direction] = key;
    assert.equal(field, "start_date");
    assert.equal(direction, "DESC");

    // @ts-expect-error A Sort Key has no implicit direction: it must name ASC or DESC.
    const missingDirection: SortKey = ["start_date"];
    assert.equal(missingDirection.length, 1);

    const buffer = new ArrayBuffer(12);
    const result: QueryExtentBinaryResult = {
      layerId: "test-layer-id",
      buffer,
    };
    assert.equal(result.layerId, "test-layer-id");
    assert.equal(result.buffer.byteLength, 12);
  });
});
