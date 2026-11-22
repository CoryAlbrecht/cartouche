/**
 * @file featurePacket.ts
 * @module shared/layers/featurePacket
 * @description Encoder and decoder of the WKB Feature Packet, the one contiguous `ArrayBuffer` a feature query returns from the Geospatial Worker to the
 * Renderer (ADR 0004). The Geospatial Worker encodes it and the Renderer decodes it, so its framing lives in this one module instead of in every reader.
 *
 * Layout, little-endian:
 * - Header (12 bytes): `uint32` magic {@link WKB_PACKET_MAGIC}, `uint16` version {@link WKB_PACKET_VERSION}, `uint16` flags ({@link WKB_FLAG_HAS_GEOMETRY},
 *   {@link WKB_FLAG_HAS_PROPERTIES}), `uint32` record count.
 * - Each record: the Feature ID as a `uint8` kind followed by either an `int64` (kind 0, a number) or a `uint32` byte length and that many UTF-8 bytes (kind 1, a
 *   string); then a `uint32` WKB length and the WKB bytes; then a `uint32` property length and the UTF-8 JSON property bytes. A length of 0 means none.
 *
 * Version 2 (Ticket #387) added the Feature ID kind, so string Feature IDs (text Primary Keys, staged new features) reach the map unchanged instead of as 0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link FeatureId}
 */

import {
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES,
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
  type FeatureId,
} from "../types/project";

/**
 * @typedef {Object} FeaturePacketRecord
 * @description One feature of a WKB Feature Packet. Decoded byte payloads are views on the packet's buffer, not copies.
 * @property {FeatureId} id - The feature's Feature ID.
 * @property {Uint8Array | null} wkb - OGC WKB geometry bytes, or null when the query left geometry out or the feature has none.
 * @property {Uint8Array | null} properties - UTF-8 JSON attribute bytes, or null when the query left attributes out.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export interface FeaturePacketRecord {
  id: FeatureId;
  wkb: Uint8Array | null;
  properties: Uint8Array | null;
}

/**
 * @description Feature ID kind byte of a number Feature ID, stored as an `int64`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
const ID_KIND_NUMBER = 0;

/**
 * @description Feature ID kind byte of a string Feature ID, stored as a `uint32` byte length and UTF-8 bytes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
const ID_KIND_STRING = 1;

/**
 * @description Byte length of the packet header.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
const HEADER_BYTES = 12;

/**
 * @description Encodes feature records as one WKB Feature Packet.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {readonly FeaturePacketRecord[]} records - Features in result order.
 * @returns {ArrayBuffer} The packet.
 * @throws {RangeError} If a number Feature ID is not a safe integer.
 */
export function encodeFeaturePacket(
  records: readonly FeaturePacketRecord[]
): ArrayBuffer {
  const encoder = new TextEncoder();
  const stringIds = records.map((r) =>
    typeof r.id === "string" ? encoder.encode(r.id) : null
  );

  let totalBytes = HEADER_BYTES;
  let flags = 0;
  records.forEach((record, i) => {
    if (typeof record.id === "number" && !Number.isSafeInteger(record.id)) {
      throw new RangeError(
        `Feature ID ${record.id} is not a safe integer and cannot be encoded as a number`
      );
    }
    const wkbBytes = record.wkb?.byteLength ?? 0;
    const propBytes = record.properties?.byteLength ?? 0;
    if (wkbBytes > 0) flags |= WKB_FLAG_HAS_GEOMETRY;
    if (propBytes > 0) flags |= WKB_FLAG_HAS_PROPERTIES;
    const idBytes = stringIds[i] ? 4 + stringIds[i]!.byteLength : 8;
    totalBytes += 1 + idBytes + 4 + wkbBytes + 4 + propBytes;
  });

  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, WKB_PACKET_MAGIC, true);
  view.setUint16(4, WKB_PACKET_VERSION, true);
  view.setUint16(6, flags, true);
  view.setUint32(8, records.length, true);

  let offset = HEADER_BYTES;
  const writeBlock = (block: Uint8Array | null): void => {
    const length = block?.byteLength ?? 0;
    view.setUint32(offset, length, true);
    offset += 4;
    if (block && length > 0) {
      bytes.set(block, offset);
      offset += length;
    }
  };
  records.forEach((record, i) => {
    const stringId = stringIds[i];
    if (stringId) {
      view.setUint8(offset, ID_KIND_STRING);
      offset += 1;
      writeBlock(stringId);
    } else {
      view.setUint8(offset, ID_KIND_NUMBER);
      offset += 1;
      view.setBigInt64(offset, BigInt(record.id as number), true);
      offset += 8;
    }
    writeBlock(record.wkb);
    writeBlock(record.properties);
  });
  return buffer;
}

/**
 * @description Decodes a WKB Feature Packet. A typed-array view is read in place, without copying.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ArrayBuffer | ArrayBufferView} packet - The packet, or a view over exactly its bytes.
 * @returns {FeaturePacketRecord[]} The features in packet order.
 * @throws {RangeError} If the buffer does not start with the packet magic number, has another version, has an unknown Feature ID kind, is cut short, or has bytes
 * after its last record.
 */
export function decodeFeaturePacket(
  packet: ArrayBuffer | ArrayBufferView
): FeaturePacketRecord[] {
  const buffer = ArrayBuffer.isView(packet) ? packet.buffer : packet;
  const start = ArrayBuffer.isView(packet) ? packet.byteOffset : 0;
  const end = start + packet.byteLength;
  const view = new DataView(buffer, start, packet.byteLength);
  const decoder = new TextDecoder();

  const need = (offset: number, length: number): void => {
    if (start + offset + length > end) {
      throw new RangeError(
        `WKB Feature Packet is cut short: ${length} bytes needed at offset ${offset} of ${packet.byteLength}`
      );
    }
  };

  need(0, HEADER_BYTES);
  const magic = view.getUint32(0, true);
  if (magic !== WKB_PACKET_MAGIC) {
    throw new RangeError(
      `Not a WKB Feature Packet: magic 0x${magic.toString(16)}`
    );
  }
  const version = view.getUint16(4, true);
  if (version !== WKB_PACKET_VERSION) {
    throw new RangeError(
      `Unsupported WKB Feature Packet version ${version}: expected ${WKB_PACKET_VERSION}`
    );
  }
  const count = view.getUint32(8, true);

  let offset = HEADER_BYTES;
  const readBlock = (): Uint8Array | null => {
    need(offset, 4);
    const length = view.getUint32(offset, true);
    offset += 4;
    if (length === 0) return null;
    need(offset, length);
    const block = new Uint8Array(buffer, start + offset, length);
    offset += length;
    return block;
  };

  const records: FeaturePacketRecord[] = [];
  for (let i = 0; i < count; i++) {
    need(offset, 1);
    const kind = view.getUint8(offset);
    offset += 1;
    let id: FeatureId;
    if (kind === ID_KIND_NUMBER) {
      need(offset, 8);
      id = Number(view.getBigInt64(offset, true));
      offset += 8;
    } else if (kind === ID_KIND_STRING) {
      const idBytes = readBlock();
      id = idBytes ? decoder.decode(idBytes) : "";
    } else {
      throw new RangeError(
        `Unknown Feature ID kind ${kind} in record ${i} of a WKB Feature Packet`
      );
    }
    const wkb = readBlock();
    const properties = readBlock();
    records.push({ id, wkb, properties });
  }
  if (offset !== packet.byteLength) {
    throw new RangeError(
      `WKB Feature Packet has ${packet.byteLength - offset} bytes after its last record`
    );
  }
  return records;
}

/**
 * @description Picks the WKB Feature Packet out of a `queryExtent` result: its `buffer` when that is an `ArrayBuffer` or typed-array view long enough to hold a
 * packet header, otherwise null (the result carries no packet, so a reader falls back to its `features` list).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {unknown} result - A `queryExtent` result, or anything else.
 * @returns {ArrayBuffer | ArrayBufferView | null} The packet bytes to pass to {@link decodeFeaturePacket}, or null.
 */
export function featurePacketOf(
  result: unknown
): ArrayBuffer | ArrayBufferView | null {
  const buffer =
    result && typeof result === "object" ?
      (result as { buffer?: unknown }).buffer
    : undefined;
  return (
      (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer))
        && buffer.byteLength >= HEADER_BYTES
    ) ?
      buffer
    : null;
}
