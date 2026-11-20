/**
 * @file MemoryMeter.test.ts
 * @module tests/main/memory/MemoryMeter.test
 * @description Unit tests for the Main-process memory meter scheduler: it samples and publishes immediately and then about every 2 s while the Workbench is visible, and stops sampling while the Workbench is hidden or minimised, or after disposal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MemoryMeter}
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { MemoryMeter } from "../../../src/main/memory/MemoryMeter";
import type { MemoryUsageSnapshot } from "../../../src/shared/types/memory";

describe("MemoryMeter", () => {
  let samples: number;
  let published: MemoryUsageSnapshot[];
  let meter: MemoryMeter;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setInterval"] });
    samples = 0;
    published = [];
    meter = new MemoryMeter({
      sample: () => {
        samples++;
        return { totalKb: samples, rows: [] };
      },
      publish: (snapshot) => published.push(snapshot),
    });
  });

  afterEach(() => {
    meter.dispose();
    mock.timers.reset();
  });

  it("does not sample until the Workbench is visible", () => {
    mock.timers.tick(10_000);
    assert.equal(samples, 0);
  });

  it("publishes at once when activated, then every 2 s", () => {
    meter.setActive(true);
    assert.deepEqual(
      published.map((s) => s.totalKb),
      [1]
    );
    mock.timers.tick(1999);
    assert.equal(published.length, 1);
    mock.timers.tick(1);
    mock.timers.tick(2000);
    assert.deepEqual(
      published.map((s) => s.totalKb),
      [1, 2, 3]
    );
  });

  it("stops sampling while hidden or minimised and resumes when shown", () => {
    meter.setActive(true);
    meter.setActive(false);
    mock.timers.tick(10_000);
    assert.equal(samples, 1);

    meter.setActive(true);
    assert.equal(samples, 2);
    mock.timers.tick(2000);
    assert.equal(samples, 3);
  });

  it("does not start a second timer when activated twice", () => {
    meter.setActive(true);
    meter.setActive(true);
    mock.timers.tick(2000);
    assert.equal(samples, 2);
  });

  it("stops for good once disposed", () => {
    meter.setActive(true);
    meter.dispose();
    meter.setActive(true);
    mock.timers.tick(10_000);
    assert.equal(samples, 1);
  });

  it("keeps running when one sample throws", () => {
    let calls = 0;
    const flaky = new MemoryMeter({
      sample: () => {
        calls++;
        if (calls === 1) throw new Error("metrics unavailable");
        return { totalKb: calls, rows: [] };
      },
      publish: (snapshot) => published.push(snapshot),
    });
    try {
      flaky.setActive(true);
      mock.timers.tick(2000);
      assert.deepEqual(
        published.map((s) => s.totalKb),
        [2]
      );
    } finally {
      flaky.dispose();
    }
  });
});
