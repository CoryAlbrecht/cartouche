/**
 * @file usePendingDigits.test.ts
 * @module tests/renderer/hooks/usePendingDigits.test
 * @description Unit tests for the pure pending-digits helpers shared by the Timestamp Spinner and later number spinners: digits are kept exactly as typed up to a field's length.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link appendPendingDigit}
 * @see {@link PENDING_DIGITS_COMMIT_DELAY_MS}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendPendingDigit,
  PENDING_DIGITS_COMMIT_DELAY_MS,
} from "../../../src/renderer/hooks/usePendingDigits";

describe("appendPendingDigit (Ticket #396)", () => {
  it("keeps digits exactly as typed, with no padding or limits", () => {
    let digits = "";
    const seen: string[] = [];
    for (const d of ["1", "8", "1", "2"]) {
      digits = appendPendingDigit(digits, d, 4);
      seen.push(digits);
    }
    assert.deepStrictEqual(seen, ["1", "18", "181", "1812"]);
    assert.strictEqual(appendPendingDigit("", "0", 2), "0");
    assert.strictEqual(appendPendingDigit("9", "9", 2), "99");
  });

  it("starts over with the new digit once the field is already full", () => {
    assert.strictEqual(appendPendingDigit("1812", "5", 4), "5");
  });

  it("commits after a 1000 ms pause", () => {
    assert.strictEqual(PENDING_DIGITS_COMMIT_DELAY_MS, 1000);
  });
});
