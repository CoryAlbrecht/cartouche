/**
 * @file reckonedTime.test.ts
 * @module tests/shared/time/reckonedTime.test
 * @description Tests for showing, editing and stepping Time Filter instants in a Time Reckoning (#397, ADR 0038): Gregorian with BCE and no year zero, Custom Era Dates and Durations, era side switching and keys, segment limits, symbol Era Labels always before the value, Plain Number text and stepping noise, and — inside Electron, which provides `Temporal` — the preset Calendars (Hebrew leap month 13, Ethiopian month 13, Islamic, Persian, Coptic, Buddhist), their Eras (Islamic BH, Ethiopian Amete Alem years before AM 1) and their Months / Years arithmetic.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link toReckonedParts}
 * @see {@link fromReckonedParts}
 * @see {@link formatInstant}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeWithTemporal } from "../../temporalRuntime";
import {
  toReckonedParts,
  fromReckonedParts,
  formatInstant,
  reckonedSegmentRange,
  setReckonedSegment,
  switchEraSide,
  eraSideForKey,
  presetCalendarEra,
  stepCalendarInstant,
  timeReckoningFor,
  roundStepNoise,
  type ReckonedParts,
} from "../../../src/shared/time/reckonedTime";
import {
  CALENDAR_IDS,
  GREGORIAN_TIME_RECKONING,
  DEFAULT_CUSTOM_ERA,
} from "../../../src/shared/time/timeReckoning";
import type {
  CalendarId,
  TimeReckoning,
} from "../../../src/shared/types/project";

const DAY = 86400000;

/**
 * @function utc
 * @description UTC epoch ms for a proleptic Gregorian date, years 0–99 and negative years taken literally.
 * @param {number} year - Astronomical year (0 = 1 BCE).
 * @param {number} month - Month 1–12.
 * @param {number} day - Day of month.
 * @param {number} [hour=0] - Hour.
 * @returns {number} Epoch milliseconds.
 */
function utc(year: number, month: number, day: number, hour = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime();
}

const GREGORY: TimeReckoning = { ...GREGORIAN_TIME_RECKONING };
const RELATIVE: TimeReckoning = {
  kind: "custom",
  ...DEFAULT_CUSTOM_ERA,
  zeroTime: utc(2000, 1, 1),
};
const FOUNDING: TimeReckoning = {
  kind: "custom",
  zeroTime: utc(2000, 3, 15),
  eraLabelAfter: "AF",
  eraLabelBefore: "BF",
  eraLabelPosition: "suffix",
  eraCounting: "dates",
};
const NUMBER: TimeReckoning = { ...GREGORY, kind: "number" };

describe("Gregorian Time Reckoning", () => {
  it("shows CE dates with a CE suffix", () => {
    assert.equal(
      formatInstant(utc(2024, 3, 15, 13), GREGORY),
      "2024-03-15 13:00:00 CE"
    );
  });

  it("has no year zero: 1 BCE is directly followed by 1 CE", () => {
    assert.equal(
      formatInstant(utc(0, 12, 31), GREGORY),
      "1-12-31 00:00:00 BCE"
    );
    assert.equal(formatInstant(utc(1, 1, 1), GREGORY), "1-01-01 00:00:00 CE");
    assert.equal(
      formatInstant(utc(-43, 3, 15), GREGORY),
      "44-03-15 00:00:00 BCE"
    );
  });

  it("builds instants back from BCE parts", () => {
    const parts: ReckonedParts = {
      side: "before",
      year: 44,
      month: 3,
      day: 15,
      hour: 0,
      minute: 0,
      second: 0,
    };
    assert.equal(fromReckonedParts(parts, GREGORY), utc(-43, 3, 15));
    assert.deepEqual(toReckonedParts(utc(-43, 3, 15), GREGORY), parts);
  });

  it("covers the Temporal range of about ±271,000 years", () => {
    assert.equal(toReckonedParts(-8.64e15, GREGORY).year, 271822);
    assert.equal(toReckonedParts(8.64e15, GREGORY).year, 275760);
    const far = fromReckonedParts(
      {
        side: "before",
        year: 999999,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      GREGORY
    );
    assert.equal(far, -8.64e15, "clamps to the earliest instant");
  });

  it("limits days to the month, and months to 1–12", () => {
    const feb = toReckonedParts(utc(2024, 2, 10), GREGORY);
    assert.deepEqual(reckonedSegmentRange(feb, "day", GREGORY), {
      min: 1,
      max: 29,
    });
    assert.deepEqual(reckonedSegmentRange(feb, "month", GREGORY), {
      min: 1,
      max: 12,
    });
    assert.equal(reckonedSegmentRange(feb, "year", GREGORY).min, 1);
    assert.equal(setReckonedSegment(feb, "day", 31, GREGORY).day, 29);
  });
});

describe("Custom Era", () => {
  it("Durations count from 0: +57-02-02 is 57 years, 2 months and 2 days after the Zero Time", () => {
    assert.equal(
      formatInstant(utc(2057, 3, 3), RELATIVE),
      "+57-02-02 00:00:00"
    );
    assert.equal(formatInstant(utc(2000, 1, 1), RELATIVE), "+0-00-00 00:00:00");
  });

  it("Durations: −0-00-01 is one day before the Zero Time", () => {
    assert.equal(
      formatInstant(utc(2000, 1, 1) - DAY, RELATIVE),
      "−0-00-01 00:00:00"
    );
    assert.equal(
      fromReckonedParts(
        {
          side: "before",
          year: 0,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
        },
        RELATIVE
      ),
      utc(2000, 1, 1) - DAY
    );
  });

  it("Durations round-trip on both sides of the Zero Time", () => {
    for (const t of [
      utc(2057, 3, 3, 5),
      utc(1931, 7, 31, 23),
      utc(1999, 12, 31),
    ]) {
      assert.equal(
        fromReckonedParts(toReckonedParts(t, RELATIVE), RELATIVE),
        t
      );
    }
  });

  it("Dates count from 1 with no year zero and months running forward on both sides", () => {
    assert.equal(
      formatInstant(utc(2000, 3, 15), FOUNDING),
      "1-01-01 00:00:00 AF"
    );
    assert.equal(
      formatInstant(utc(2001, 4, 16), FOUNDING),
      "2-02-02 00:00:00 AF"
    );
    assert.equal(
      formatInstant(utc(2000, 3, 14), FOUNDING),
      "1-12-29 00:00:00 BF"
    );
    for (const t of [utc(2001, 4, 16), utc(2000, 3, 14), utc(1900, 1, 1, 7)]) {
      assert.equal(
        fromReckonedParts(toReckonedParts(t, FOUNDING), FOUNDING),
        t
      );
    }
  });

  it("limits Durations months to 0–11 and years to 0 and up; Dates start at 1", () => {
    const parts = toReckonedParts(utc(2057, 3, 3), RELATIVE);
    assert.deepEqual(reckonedSegmentRange(parts, "month", RELATIVE), {
      min: 0,
      max: 11,
    });
    assert.equal(reckonedSegmentRange(parts, "year", RELATIVE).min, 0);
    assert.equal(reckonedSegmentRange(parts, "day", RELATIVE).min, 0);
    const dates = toReckonedParts(utc(2001, 4, 16), FOUNDING);
    assert.equal(reckonedSegmentRange(dates, "day", FOUNDING).min, 1);
  });

  it("puts word labels a space away, before or after as set", () => {
    const prefixWord: TimeReckoning = {
      ...FOUNDING,
      eraLabelPosition: "prefix",
    };
    assert.equal(
      formatInstant(utc(2000, 3, 15), prefixWord),
      "AF 1-01-01 00:00:00"
    );
    assert.equal(
      formatInstant(utc(2000, 3, 15), FOUNDING),
      "1-01-01 00:00:00 AF"
    );
  });

  it("always puts symbol labels right before the value, whatever the position", () => {
    const suffixSymbol: TimeReckoning = {
      ...RELATIVE,
      eraLabelPosition: "suffix",
    };
    assert.equal(
      formatInstant(utc(2000, 1, 2), suffixSymbol),
      "+0-00-01 00:00:00"
    );
    assert.equal(
      formatInstant(utc(1999, 12, 31), suffixSymbol),
      "−0-00-01 00:00:00"
    );
  });
});

describe("Era side", () => {
  it("switching keeps the year number on the other side of the Zero Time", () => {
    const ce = toReckonedParts(utc(44, 3, 15), GREGORY);
    const bce = switchEraSide(ce);
    assert.equal(bce.side, "before");
    assert.equal(bce.year, 44);
    assert.equal(fromReckonedParts(bce, GREGORY), utc(-43, 3, 15));
    assert.equal(switchEraSide(bce, "before").side, "before");
  });

  it("+ and - choose the sides, and so does a label's first letter", () => {
    assert.equal(eraSideForKey("+", RELATIVE), "after");
    assert.equal(eraSideForKey("-", RELATIVE), "before");
    assert.equal(eraSideForKey("−", RELATIVE), "before");
    assert.equal(eraSideForKey("b", GREGORY), "before");
    assert.equal(eraSideForKey("C", GREGORY), "after");
    assert.equal(eraSideForKey("a", FOUNDING), "after");
    assert.equal(eraSideForKey("x", GREGORY), null);
  });
});

describe("Plain Number", () => {
  it("shows bare numbers, decimals included", () => {
    assert.equal(formatInstant(42, NUMBER), "42");
    assert.equal(formatInstant(-1.5, NUMBER), "-1.5");
    assert.equal(formatInstant(0.1 + 0.2, NUMBER), "0.3");
    assert.equal(
      formatInstant(Number.MAX_SAFE_INTEGER, NUMBER),
      "9007199254740991"
    );
  });

  it("stepping noise is rounded away, integers are left exact", () => {
    assert.equal(roundStepNoise(0.1 + 0.2), 0.3);
    assert.equal(
      roundStepNoise(Number.MAX_SAFE_INTEGER),
      Number.MAX_SAFE_INTEGER
    );
    assert.equal(roundStepNoise(-2.5), -2.5);
  });
});

describe("Choosing a Time Reckoning", () => {
  it("Gregorian fills CE / BCE, Dates and the Zero Time 0001-01-01", () => {
    assert.deepEqual(timeReckoningFor("gregory", RELATIVE), GREGORY);
  });

  it("Custom Era and Plain Number keep the Era fields shown before", () => {
    const custom = timeReckoningFor("custom", GREGORY);
    assert.equal(custom.kind, "custom");
    assert.equal(custom.eraLabelAfter, "CE");
    const plain = timeReckoningFor("number", FOUNDING);
    assert.equal(plain.kind, "number");
    assert.equal(plain.zeroTime, FOUNDING.zeroTime);
  });
});

describeWithTemporal("Preset Calendars (Temporal)", import.meta.url, () => {
  /**
   * @function reckoningOf
   * @description The preset Time Reckoning of a Calendar.
   * @param {CalendarId} calendar - Calendar id.
   * @returns {TimeReckoning} Its Time Reckoning.
   */
  const reckoningOf = (calendar: CalendarId): TimeReckoning =>
    presetCalendarEra(calendar);

  it("shows 2024-03-15 in each Calendar, months as their position in the year", () => {
    const t = utc(2024, 3, 15);
    const expected: Record<CalendarId, [number, number, number]> = {
      "gregory": [2024, 3, 15],
      "hebrew": [5784, 7, 5], // 5 Adar II, leap year: Adar II is month 7
      "islamic-civil": [1445, 9, 5],
      "persian": [1402, 12, 25],
      "ethiopic": [2016, 7, 6],
      "coptic": [1740, 7, 6],
      "buddhist": [2567, 3, 15],
    };
    for (const calendar of CALENDAR_IDS) {
      const [year, month, day] = expected[calendar];
      const parts = toReckonedParts(t, reckoningOf(calendar));
      assert.deepEqual(
        [parts.side, parts.year, parts.month, parts.day],
        ["after", year, month, day],
        calendar
      );
    }
  });

  it("Hebrew leap years run months 1–13 and Ethiopian years have month 13", () => {
    const hebrew = reckoningOf("hebrew");
    const adar2 = toReckonedParts(utc(2024, 3, 15), hebrew);
    assert.deepEqual(reckonedSegmentRange(adar2, "month", hebrew), {
      min: 1,
      max: 13,
    });
    const ethiopic = reckoningOf("ethiopic");
    const pagume = toReckonedParts(utc(2023, 9, 6), ethiopic);
    assert.deepEqual([pagume.year, pagume.month, pagume.day], [2015, 13, 1]);
    assert.equal(fromReckonedParts(pagume, ethiopic), utc(2023, 9, 6));
  });

  it("days start at midnight UTC", () => {
    const hebrew = reckoningOf("hebrew");
    assert.equal(toReckonedParts(utc(2024, 3, 15) - 1, hebrew).day, 4);
    assert.equal(toReckonedParts(utc(2024, 3, 15), hebrew).day, 5);
  });

  it("fills the Era from Intl and the Calendar's 1-1-1", () => {
    assert.deepEqual(reckoningOf("gregory"), GREGORY);
    const hebrew = reckoningOf("hebrew");
    assert.equal(hebrew.eraLabelAfter, "AM");
    assert.equal(hebrew.eraLabelBefore, "−", "single-era calendar");
    assert.equal(hebrew.zeroTime, utc(-3760, 9, 7));
    assert.equal(hebrew.eraCounting, "dates");
    assert.equal(reckoningOf("islamic-civil").eraLabelAfter, "AH");
    assert.equal(reckoningOf("islamic-civil").zeroTime, utc(622, 7, 19));
    assert.equal(reckoningOf("ethiopic").eraLabelBefore, "AA");
  });

  it("Islamic dates before 1 AH are labelled BH", () => {
    assert.equal(reckoningOf("islamic-civil").eraLabelBefore, "BH");
  });

  it("Ethiopian dates before AM 1 count Amete Alem years", () => {
    const ethiopic = reckoningOf("ethiopic");
    const zero = ethiopic.zeroTime;
    const dayBefore = toReckonedParts(zero - DAY, ethiopic);
    assert.deepEqual(
      [dayBefore.side, dayBefore.year, dayBefore.month, dayBefore.day],
      ["before", 5500, 13, 5]
    );
    assert.equal(formatInstant(zero - DAY, ethiopic), "5500-13-05 00:00:00 AA");
    assert.equal(fromReckonedParts(dayBefore, ethiopic), zero - DAY);
    assert.deepEqual(
      reckonedSegmentRange(dayBefore, "year", ethiopic).max,
      5500
    );
    // Switching AM 2016 to the before side lands on AA 2016, which round-trips.
    const am = toReckonedParts(utc(2024, 3, 15), ethiopic);
    const aa = switchEraSide(am);
    const back = toReckonedParts(fromReckonedParts(aa, ethiopic), ethiopic);
    assert.deepEqual([back.side, back.year], ["before", 2016]);
  });

  it("dates before a Calendar's year 1 use the before label with no year zero", () => {
    const hebrew = reckoningOf("hebrew");
    const parts = toReckonedParts(utc(-3760, 9, 6), hebrew);
    assert.equal(parts.side, "before");
    assert.equal(parts.year, 1);
    assert.equal(fromReckonedParts(parts, hebrew), utc(-3760, 9, 6));
  });

  it("round-trips instants through the parts of every Calendar", () => {
    for (const calendar of [
      "hebrew",
      "islamic-civil",
      "persian",
      "ethiopic",
      "coptic",
      "buddhist",
    ] as const) {
      const r = reckoningOf(calendar);
      for (const t of [utc(2024, 3, 15, 6), utc(1, 1, 1), utc(-500, 6, 1)]) {
        assert.equal(fromReckonedParts(toReckonedParts(t, r), r), t, calendar);
      }
    }
  });

  it("steps Months and Years with the Calendar's arithmetic", () => {
    const hebrew = reckoningOf("hebrew");
    // 15 Adar I 5784 (month 6) + 1 month = 15 Adar II (month 7), 30 days later.
    const adar1 = fromReckonedParts(
      {
        side: "after",
        year: 5784,
        month: 6,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
      },
      hebrew
    );
    const next = stepCalendarInstant(adar1, 1, "Months", "hebrew");
    const p = toReckonedParts(next, hebrew);
    assert.deepEqual([p.year, p.month, p.day], [5784, 7, 15]);
    assert.equal(next - adar1, 30 * DAY);

    const ethiopic = reckoningOf("ethiopic");
    const nehase = fromReckonedParts(
      {
        side: "after",
        year: 2016,
        month: 12,
        day: 10,
        hour: 0,
        minute: 0,
        second: 0,
      },
      ethiopic
    );
    const pagume = toReckonedParts(
      stepCalendarInstant(nehase, 1, "Months", "ethiopic"),
      ethiopic
    );
    assert.deepEqual([pagume.month, pagume.day], [13, 5], "Pagume has 5 days");

    const islamic = reckoningOf("islamic-civil");
    const start = fromReckonedParts(
      {
        side: "after",
        year: 1445,
        month: 9,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      islamic
    );
    const y = toReckonedParts(
      stepCalendarInstant(start, 1, "Years", "islamic-civil"),
      islamic
    );
    assert.deepEqual([y.year, y.month, y.day], [1446, 9, 1]);
  });
});
