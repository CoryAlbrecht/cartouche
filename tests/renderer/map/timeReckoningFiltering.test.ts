/**
 * @file timeReckoningFiltering.test.ts
 * @module tests/renderer/map/timeReckoningFiltering.test
 * @description Tests how the Time Reckoning (#397) changes Time Filter stepping and filtering: Plain Number steps by bare Step with any Unit, Days and smaller stay fixed lengths in every Calendar, a Custom Era steps Months / Years in Gregorian, preset Calendars step with their own arithmetic (inside Electron), Plain Number reads numeric strings as numbers, layer field eligibility per Time Reckoning, and Undated Features for mismatched fields.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link stepTemporalTimestamp}
 * @see {@link isTimeFilterFieldEligible}
 * @see {@link temporalFieldsSuitReckoning}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import { describeWithTemporal } from "../../temporalRuntime";
import {
  stepTemporalTimestamp,
  snapToTemporalStep,
  computeTemporalStepAttribute,
  computeFrameEnd,
  calculateActiveTemporalRange,
} from "../../../src/renderer/map/timeFilterMath";
import {
  parseTemporalValue,
  evaluateTemporalPredicate,
  isTimeFilterFieldEligible,
  temporalFieldsSuitReckoning,
} from "../../../src/renderer/map/temporalPredicate";
import {
  timeReckoningSignal,
  resetTimeFilterState,
} from "../../../src/renderer/state/timeFilterSignals";
import {
  GREGORIAN_TIME_RECKONING,
  DEFAULT_CUSTOM_ERA,
} from "../../../src/shared/time/timeReckoning";
import {
  presetCalendarEra,
  toReckonedParts,
  fromReckonedParts,
} from "../../../src/shared/time/reckonedTime";
import type {
  GisFeature,
  LayerDescriptor,
  LayerFieldInfo,
  LayerTemporalConfig,
  TimeReckoning,
} from "../../../src/shared/types";

const DAY = 86400000;
const NUMBER: TimeReckoning = { ...GREGORIAN_TIME_RECKONING, kind: "number" };
const CUSTOM: TimeReckoning = { kind: "custom", ...DEFAULT_CUSTOM_ERA };
const HEBREW_KIND: TimeReckoning = { kind: "hebrew", ...DEFAULT_CUSTOM_ERA };

/**
 * @function field
 * @description Minimal field info.
 * @param {string} name - Field name.
 * @param {LayerFieldInfo['inferredType']} inferredType - Inferred type.
 * @returns {LayerFieldInfo} Field info.
 */
function field(
  name: string,
  inferredType: LayerFieldInfo["inferredType"]
): LayerFieldInfo {
  return { name, inferredType, nativeType: inferredType };
}

afterEach(() => {
  resetTimeFilterState();
});

describe("Stepping in a Time Reckoning", () => {
  it("Plain Number steps by the bare Step whatever the Unit, decimals allowed", () => {
    assert.equal(stepTemporalTimestamp(10, 0.5, "Years", NUMBER), 10.5);
    assert.equal(stepTemporalTimestamp(10, -2.25, "Days", NUMBER), 7.75);
    assert.equal(computeTemporalStepAttribute(0.25, "Months", NUMBER), 0.25);
    assert.equal(snapToTemporalStep(10.3, 0, 100, 0.5, "Days", NUMBER), 10.5);
    assert.equal(computeFrameEnd(10, 5, "Years", 12, NUMBER), 12);
  });

  it("Days and smaller stay fixed lengths in every Calendar", () => {
    const t = Date.UTC(2024, 2, 15);
    assert.equal(stepTemporalTimestamp(t, 1, "Days", HEBREW_KIND), t + DAY);
    assert.equal(
      stepTemporalTimestamp(t, 2, "Weeks", HEBREW_KIND),
      t + 14 * DAY
    );
    assert.equal(
      stepTemporalTimestamp(t, 3, "Hours", HEBREW_KIND),
      t + 3 * 3600000
    );
  });

  it("a Custom Era steps Months and Years in Gregorian", () => {
    const t = Date.UTC(2024, 0, 31);
    assert.equal(
      stepTemporalTimestamp(t, 1, "Months", CUSTOM),
      Date.UTC(2024, 1, 29)
    );
    assert.equal(
      stepTemporalTimestamp(t, 1, "Years", CUSTOM),
      Date.UTC(2025, 0, 31)
    );
  });
});

describeWithTemporal("Calendar stepping (Temporal)", import.meta.url, () => {
  it("a Hebrew Months step moves from Adar I to Adar II", () => {
    const hebrew = presetCalendarEra("hebrew");
    const adar1 = fromReckonedParts(
      {
        side: "after",
        year: 5784,
        month: 6,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      hebrew
    );
    const next = stepTemporalTimestamp(adar1, 1, "Months", hebrew);
    assert.equal(toReckonedParts(next, hebrew).month, 7);
    const snapped = snapToTemporalStep(
      next - DAY,
      adar1,
      adar1 + 400 * DAY,
      1,
      "Months",
      hebrew
    );
    assert.equal(snapped, next);
  });
});

describe("Plain Number reads fields as numbers", () => {
  it("numeric strings are numbers in Plain Number and dates otherwise", () => {
    assert.equal(parseTemporalValue("1812", "number"), 1812);
    assert.equal(parseTemporalValue("-3.5", "number"), -3.5);
    assert.equal(parseTemporalValue("1812", "gregory"), Date.parse("1812"));
    assert.equal(
      parseTemporalValue("2026-11-10T00:00:00Z", "number"),
      Date.UTC(2026, 10, 10)
    );
  });

  it("date-typed fields are always read as dates, numeric-typed fields as numbers", () => {
    assert.equal(
      parseTemporalValue("1812", "number", "date"),
      Date.parse("1812"),
      "a date field holding a bare year is a date"
    );
    assert.equal(
      parseTemporalValue("1812", "number", "datetime"),
      Date.parse("1812")
    );
    assert.equal(parseTemporalValue("1812", "number", "integer"), 1812);
    assert.equal(parseTemporalValue("2.5", "number", "real"), 2.5);
  });

  it("the Time Filter reads a date field as a date in Plain Number", () => {
    timeReckoningSignal.value = NUMBER;
    const layer = fromPartial<LayerDescriptor>({
      id: "l1",
      name: "Events",
      visible: true,
      temporal: { enabled: true, mode: "start", startField: "when" },
      fields: [field("when", "date")],
    });
    const range = calculateActiveTemporalRange(
      [layer],
      [
        fromPartial<GisFeature>({
          id: "a",
          layerId: "l1",
          properties: { when: "1812" },
        }),
      ],
      NUMBER
    );
    assert.deepEqual(range, {
      from: Date.parse("1812"),
      to: Date.parse("1812"),
    });
    const config = {
      enabled: true,
      mode: "start" as const,
      startField: "when",
      startOp: ">=" as const,
      fieldTypes: { when: "date" as const },
    };
    const at = (frame: number) =>
      evaluateTemporalPredicate({ when: "1812" }, config, {
        globalEnabled: true,
        frameStartUtc: frame,
        frameEndUtc: frame,
        reckoning: "number",
      });
    assert.equal(at(Date.parse("1812") - 1), false, "before 1812 is hidden");
    assert.equal(at(1000), true, "1812 is not read as the number 1812");
  });

  it("Auto-Range reads numeric fields as numbers in Plain Number", () => {
    timeReckoningSignal.value = NUMBER;
    const layer = fromPartial<LayerDescriptor>({
      id: "l1",
      name: "Counts",
      visible: true,
      temporal: { enabled: true, mode: "start", startField: "n" },
      fields: [field("n", "integer")],
    });
    const range = calculateActiveTemporalRange(
      [layer],
      [
        fromPartial<GisFeature>({
          id: "a",
          layerId: "l1",
          properties: { n: "5" },
        }),
        fromPartial<GisFeature>({
          id: "b",
          layerId: "l1",
          properties: { n: "1812" },
        }),
      ],
      timeReckoningSignal.value
    );
    assert.deepEqual(range, { from: 5, to: 1812 });
  });
});

describe("Layer field eligibility", () => {
  it("Plain Number offers numeric and date fields; other Time Reckonings date fields only", () => {
    for (const t of ["integer", "real", "date", "datetime"] as const) {
      assert.equal(isTimeFilterFieldEligible(t, "number"), true, t);
    }
    assert.equal(isTimeFilterFieldEligible("string", "number"), false);
    assert.equal(isTimeFilterFieldEligible("integer", "gregory"), false);
    assert.equal(isTimeFilterFieldEligible("real", "custom"), false);
    assert.equal(isTimeFilterFieldEligible("datetime", "hebrew"), true);
    assert.equal(isTimeFilterFieldEligible("date", "custom"), true);
  });

  it("configured fields that don't suit the Time Reckoning make the layer's features Undated", () => {
    const config: LayerTemporalConfig = {
      enabled: true,
      mode: "start_end",
      startField: "year",
      endField: "until",
    };
    const fields = [field("year", "integer"), field("until", "datetime")];
    assert.equal(temporalFieldsSuitReckoning(config, fields, "gregory"), false);
    assert.equal(temporalFieldsSuitReckoning(config, fields, "number"), true);
    const endOnly: LayerTemporalConfig = { ...config, mode: "end" };
    assert.equal(temporalFieldsSuitReckoning(endOnly, fields, "gregory"), true);
    assert.equal(
      temporalFieldsSuitReckoning(config, undefined, "gregory"),
      true,
      "unknown field types are not judged"
    );
  });

  it("mismatched layers add nothing to Auto-Range", () => {
    const layer = fromPartial<LayerDescriptor>({
      id: "l1",
      name: "Counts",
      visible: true,
      temporal: { enabled: true, mode: "start", startField: "n" },
      fields: [field("n", "integer")],
    });
    const range = calculateActiveTemporalRange(
      [layer],
      [
        fromPartial<GisFeature>({
          id: "a",
          layerId: "l1",
          properties: { n: 5 },
        }),
      ],
      timeReckoningSignal.value
    );
    assert.equal(range, null);
  });
});
