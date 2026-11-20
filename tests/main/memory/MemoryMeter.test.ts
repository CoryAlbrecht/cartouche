/**
 * @file MemoryMeter.test.ts
 * @module tests/main/memory/MemoryMeter.test
 * @description Unit tests for the Main-process memory meter scheduler: it samples and publishes immediately and then about every 2 s while the Workbench is visible, stops sampling while the Workbench is hidden or minimised, or after disposal, and skips a tick while an asynchronous sample is still running.
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

/**
 * @function snapshotOf
 * @description Builds a minimal memory snapshot whose total identifies the sample.
 * @param {number} totalKb - Sample identifier.
 * @returns {MemoryUsageSnapshot} The snapshot.
 */
function snapshotOf(totalKb: number): MemoryUsageSnapshot {
  return { totalKb, measure: "resident", approximate: true, rows: [] };
}

/**
 * @function settle
 * @description Lets pending sample promises resolve and their snapshots publish.
 * @returns {Promise<void>}
 */
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

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
        return snapshotOf(samples);
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

  it("publishes at once when activated, then every 2 s", async () => {
    meter.setActive(true);
    await settle();
    assert.deepEqual(
      published.map((s) => s.totalKb),
      [1]
    );
    mock.timers.tick(1999);
    assert.equal(published.length, 1);
    mock.timers.tick(1);
    await settle();
    mock.timers.tick(2000);
    await settle();
    assert.deepEqual(
      published.map((s) => s.totalKb),
      [1, 2, 3]
    );
  });

  it("stops sampling while hidden or minimised and resumes when shown", async () => {
    meter.setActive(true);
    meter.setActive(false);
    mock.timers.tick(10_000);
    assert.equal(samples, 1);

    meter.setActive(true);
    assert.equal(samples, 2);
    await settle();
    mock.timers.tick(2000);
    assert.equal(samples, 3);
  });

  it("does not start a second timer when activated twice", async () => {
    meter.setActive(true);
    meter.setActive(true);
    await settle();
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

  it("keeps running when one sample throws", async () => {
    let calls = 0;
    const flaky = new MemoryMeter({
      sample: () => {
        calls++;
        if (calls === 1) throw new Error("metrics unavailable");
        return snapshotOf(calls);
      },
      publish: (snapshot) => published.push(snapshot),
    });
    try {
      flaky.setActive(true);
      await settle();
      mock.timers.tick(2000);
      await settle();
      assert.deepEqual(
        published.map((s) => s.totalKb),
        [2]
      );
    } finally {
      flaky.dispose();
    }
  });

  it("skips a tick while the previous asynchronous sample is still running", async () => {
    const pending: Array<(snapshot: MemoryUsageSnapshot) => void> = [];
    const slow = new MemoryMeter({
      sample: () =>
        new Promise<MemoryUsageSnapshot>((resolve) => pending.push(resolve)),
      publish: (snapshot) => published.push(snapshot),
    });
    try {
      slow.setActive(true);
      mock.timers.tick(2000);
      mock.timers.tick(2000);
      assert.equal(pending.length, 1);

      pending[0](snapshotOf(1));
      await settle();
      mock.timers.tick(2000);
      assert.equal(pending.length, 2);
      assert.deepEqual(
        published.map((s) => s.totalKb),
        [1]
      );
    } finally {
      slow.dispose();
    }
  });

  it("does not publish a sample that finishes after the meter stopped", async () => {
    const pending: Array<(snapshot: MemoryUsageSnapshot) => void> = [];
    const slow = new MemoryMeter({
      sample: () =>
        new Promise<MemoryUsageSnapshot>((resolve) => pending.push(resolve)),
      publish: (snapshot) => published.push(snapshot),
    });
    try {
      slow.setActive(true);
      slow.setActive(false);
      pending[0](snapshotOf(1));
      await settle();
      assert.equal(published.length, 0);
    } finally {
      slow.dispose();
    }
  });

  it("samples at once when reactivated even if a sample from before it stopped is still running", async () => {
    const pending: Array<(snapshot: MemoryUsageSnapshot) => void> = [];
    const slow = new MemoryMeter({
      sample: () =>
        new Promise<MemoryUsageSnapshot>((resolve) => pending.push(resolve)),
      publish: (snapshot) => published.push(snapshot),
    });
    try {
      slow.setActive(true);
      slow.setActive(false);
      slow.setActive(true);
      assert.equal(pending.length, 2);
      pending[0](snapshotOf(1));
      pending[1](snapshotOf(2));
      await settle();
      assert.deepEqual(
        published.map((s) => s.totalKb),
        [2]
      );
    } finally {
      slow.dispose();
    }
  });
});
