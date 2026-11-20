/**
 * @file memoryUsage.test.ts
 * @module tests/shared/memory/memoryUsage.test
 * @description Unit tests for the memory meter's pure helpers: choosing the platform's memory measure, grouping Electron process metrics into the per-process breakdown (Main, Workbench and other renderers, Geospatial Worker, GPU, Other) counted by proportional set size, private bytes or resident memory with a per-process fallback and the exact/approximate decision, and formatting kilobyte figures in MB below 1 GB and GB from 1 GB up, with at most two decimals.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link aggregateProcessMetrics}
 * @see {@link formatMemorySize}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateProcessMetrics,
  formatMemorySize,
  memoryMeasureForPlatform,
  type ProcessMetricLike,
  type SmapsRollupFigures,
} from "../../../src/shared/memory/memoryUsage";

/**
 * @function metric
 * @description Builds a mocked Electron `ProcessMetric` entry.
 * @param {Partial<ProcessMetricLike>} fields - Overrides; `memory` figures default to 1000 KB current / 2000 KB peak.
 * @returns {ProcessMetricLike} The mocked metric.
 */
function metric(fields: Partial<ProcessMetricLike>): ProcessMetricLike {
  return {
    pid: 1,
    type: "Utility",
    memory: { workingSetSize: 1000, peakWorkingSetSize: 2000 },
    ...fields,
  };
}

describe("formatMemorySize", () => {
  it("uses MB, with at most two decimals, below 1 GB", () => {
    assert.deepEqual(formatMemorySize(512 * 1024, "en"), {
      unit: "mb",
      value: "512",
    });
    assert.deepEqual(formatMemorySize(0, "en"), { unit: "mb", value: "0" });
    assert.deepEqual(formatMemorySize(1.5 * 1024, "en"), {
      unit: "mb",
      value: "1.5",
    });
  });

  it("uses GB, with at most two decimals, from 1 GB up", () => {
    assert.deepEqual(formatMemorySize(1024 * 1024, "en"), {
      unit: "gb",
      value: "1",
    });
    assert.deepEqual(formatMemorySize(1.25 * 1024 * 1024 + 1, "en"), {
      unit: "gb",
      value: "1.25",
    });
  });

  it("switches to GB when the MB figure would round up to 1024", () => {
    assert.equal(formatMemorySize(1024 * 1024 - 100, "en").unit, "gb");
    assert.equal(formatMemorySize(1023 * 1024, "en").unit, "mb");
  });

  it("formats the number for the locale", () => {
    assert.equal(formatMemorySize(1.5 * 1024 * 1024, "fr").value, "1,5");
    assert.equal(formatMemorySize(5 * 1024 * 1024, "en").value, "5");
  });
});

describe("aggregateProcessMetrics", () => {
  it("sums workingSetSize across every process for the total", () => {
    const snapshot = aggregateProcessMetrics([
      metric({
        pid: 1,
        type: "Browser",
        memory: { workingSetSize: 100, peakWorkingSetSize: 150 },
      }),
      metric({
        pid: 2,
        type: "Tab",
        memory: { workingSetSize: 200, peakWorkingSetSize: 250 },
      }),
      metric({
        pid: 3,
        type: "GPU",
        memory: { workingSetSize: 300, peakWorkingSetSize: 350 },
      }),
      metric({
        pid: 4,
        type: "Utility",
        memory: { workingSetSize: 400, peakWorkingSetSize: 450 },
      }),
    ]);
    assert.equal(snapshot.totalKb, 1000);
  });

  it("groups processes into Main, renderers, Geospatial Worker, GPU and Other, in that order", () => {
    const snapshot = aggregateProcessMetrics(
      [
        metric({
          pid: 40,
          type: "Utility",
          serviceName: "network.mojom.NetworkService",
          memory: { workingSetSize: 10, peakWorkingSetSize: 20 },
        }),
        metric({
          pid: 30,
          type: "GPU",
          memory: { workingSetSize: 300, peakWorkingSetSize: 310 },
        }),
        metric({
          pid: 21,
          type: "Tab",
          memory: { workingSetSize: 210, peakWorkingSetSize: 211 },
        }),
        metric({
          pid: 50,
          type: "Utility",
          name: "geospatial-worker",
          serviceName: "node.mojom.NodeService",
          memory: { workingSetSize: 500, peakWorkingSetSize: 600 },
        }),
        metric({
          pid: 10,
          type: "Browser",
          memory: { workingSetSize: 100, peakWorkingSetSize: 110 },
        }),
        metric({
          pid: 20,
          type: "Tab",
          memory: { workingSetSize: 200, peakWorkingSetSize: 220 },
        }),
        metric({
          pid: 41,
          type: "Zygote",
          memory: { workingSetSize: 5, peakWorkingSetSize: 7 },
        }),
      ],
      { workbenchPid: 20 }
    );

    assert.deepEqual(
      snapshot.rows.map(({ kind, pid, currentKb, peakKb }) => ({
        kind,
        pid,
        currentKb,
        peakKb,
      })),
      [
        { kind: "main", pid: 10, currentKb: 100, peakKb: 110 },
        { kind: "workbench", pid: 20, currentKb: 200, peakKb: 220 },
        { kind: "renderer", pid: 21, currentKb: 210, peakKb: 211 },
        { kind: "worker", pid: 50, currentKb: 500, peakKb: 600 },
        { kind: "gpu", pid: 30, currentKb: 300, peakKb: 310 },
        { kind: "other", pid: undefined, currentKb: 15, peakKb: 27 },
      ]
    );
    assert.equal(snapshot.totalKb, 1325);
  });

  it("identifies the Geospatial Worker by the name Electron reports for its fork serviceName, whatever its pid after a restart", () => {
    const before = aggregateProcessMetrics([
      metric({
        pid: 500,
        type: "Utility",
        name: "geospatial-worker",
        serviceName: "node.mojom.NodeService",
      }),
    ]);
    const after = aggregateProcessMetrics([
      metric({
        pid: 777,
        type: "Utility",
        name: "geospatial-worker",
        serviceName: "node.mojom.NodeService",
      }),
    ]);
    assert.equal(before.rows[0].kind, "worker");
    assert.equal(after.rows[0].kind, "worker");
    assert.equal(after.rows[0].pid, 777);
  });

  it("does not treat a non-Utility process named geospatial-worker as the worker", () => {
    const snapshot = aggregateProcessMetrics([
      metric({
        pid: 5,
        type: "Tab",
        name: "geospatial-worker",
        serviceName: "node.mojom.NodeService",
      }),
    ]);
    assert.equal(snapshot.rows[0].kind, "renderer");
  });

  it("does not treat other Node utility processes as the worker", () => {
    const snapshot = aggregateProcessMetrics([
      metric({
        pid: 6,
        type: "Utility",
        name: "some-other-service",
        serviceName: "node.mojom.NodeService",
      }),
    ]);
    assert.equal(snapshot.rows[0].kind, "other");
  });

  it("omits the worker row (and other empty groups) when no such process exists", () => {
    const snapshot = aggregateProcessMetrics([
      metric({ pid: 1, type: "Browser" }),
      metric({ pid: 2, type: "Tab" }),
    ]);
    assert.deepEqual(
      snapshot.rows.map((r) => r.kind),
      ["main", "renderer"]
    );
  });

  it("counts every process by resident memory and marks the total approximate by default (macOS)", () => {
    const snapshot = aggregateProcessMetrics([
      metric({ pid: 1, type: "Browser" }),
    ]);
    assert.equal(snapshot.measure, "resident");
    assert.equal(snapshot.approximate, true);
    assert.equal(snapshot.totalKb, 1000);
  });
});

describe("memoryMeasureForPlatform", () => {
  it("uses PSS on Linux, private bytes on Windows and resident memory elsewhere", () => {
    assert.equal(memoryMeasureForPlatform("linux"), "proportional");
    assert.equal(memoryMeasureForPlatform("win32"), "private");
    assert.equal(memoryMeasureForPlatform("darwin"), "resident");
  });
});

describe("aggregateProcessMetrics with a precise measure", () => {
  const rollup = (pssKb: number, privateKb: number, sharedKb: number) =>
    ({ pssKb, privateKb, sharedKb }) satisfies SmapsRollupFigures;

  it("on Linux sums PSS, shows private and shared memory per row, and marks the total exact when every process was read", () => {
    const snapshot = aggregateProcessMetrics(
      [
        metric({
          pid: 1,
          type: "Browser",
          memory: { workingSetSize: 900, peakWorkingSetSize: 950 },
        }),
        metric({
          pid: 2,
          type: "Zygote",
          memory: { workingSetSize: 500, peakWorkingSetSize: 510 },
        }),
        metric({
          pid: 3,
          type: "Utility",
          memory: { workingSetSize: 300, peakWorkingSetSize: 320 },
        }),
      ],
      {
        measure: "proportional",
        smaps: new Map([
          [1, rollup(600, 550, 350)],
          [2, rollup(60, 10, 490)],
          [3, rollup(40, 20, 280)],
        ]),
      }
    );

    assert.equal(snapshot.measure, "proportional");
    assert.equal(snapshot.approximate, false);
    assert.equal(snapshot.totalKb, 700);
    assert.deepEqual(snapshot.rows, [
      {
        kind: "main",
        pid: 1,
        currentKb: 600,
        peakKb: 950,
        residentKb: 900,
        privateKb: 550,
        sharedKb: 350,
        approximate: false,
      },
      {
        kind: "other",
        currentKb: 100,
        peakKb: 830,
        residentKb: 800,
        privateKb: 30,
        sharedKb: 770,
        approximate: false,
      },
    ]);
  });

  it("falls back to the working set for a process whose smaps_rollup could not be read, and marks it and the total approximate", () => {
    const snapshot = aggregateProcessMetrics(
      [
        metric({
          pid: 1,
          type: "Browser",
          memory: { workingSetSize: 900, peakWorkingSetSize: 950 },
        }),
        metric({
          pid: 2,
          type: "GPU",
          memory: { workingSetSize: 300, peakWorkingSetSize: 310 },
        }),
        metric({
          pid: 3,
          type: "Zygote",
          memory: { workingSetSize: 50, peakWorkingSetSize: 50 },
        }),
        metric({
          pid: 4,
          type: "Zygote",
          memory: { workingSetSize: 70, peakWorkingSetSize: 70 },
        }),
      ],
      {
        measure: "proportional",
        smaps: new Map<number, SmapsRollupFigures | null>([
          [1, rollup(600, 550, 350)],
          [2, null],
          [3, rollup(5, 1, 45)],
        ]),
      }
    );

    assert.equal(snapshot.approximate, true);
    assert.equal(snapshot.totalKb, 600 + 300 + 5 + 70);
    const [main, gpu, other] = snapshot.rows;
    assert.equal(main.approximate, false);
    assert.deepEqual(gpu, {
      kind: "gpu",
      pid: 2,
      currentKb: 300,
      peakKb: 310,
      residentKb: 300,
      approximate: true,
    });
    assert.deepEqual(other, {
      kind: "other",
      currentKb: 75,
      peakKb: 120,
      residentKb: 120,
      approximate: true,
    });
  });

  it("on Windows sums private bytes and shows the working set alongside, marking the total exact", () => {
    const snapshot = aggregateProcessMetrics(
      [
        metric({
          pid: 1,
          type: "Browser",
          memory: {
            workingSetSize: 900,
            peakWorkingSetSize: 950,
            privateBytes: 400,
          },
        }),
        metric({
          pid: 2,
          type: "Tab",
          memory: {
            workingSetSize: 300,
            peakWorkingSetSize: 310,
            privateBytes: 250,
          },
        }),
      ],
      { measure: "private" }
    );

    assert.equal(snapshot.measure, "private");
    assert.equal(snapshot.approximate, false);
    assert.equal(snapshot.totalKb, 650);
    assert.deepEqual(snapshot.rows[0], {
      kind: "main",
      pid: 1,
      currentKb: 400,
      peakKb: 950,
      residentKb: 900,
      approximate: false,
    });
  });

  it("on Windows falls back to the working set when privateBytes is missing", () => {
    const snapshot = aggregateProcessMetrics(
      [
        metric({
          pid: 1,
          type: "Browser",
          memory: {
            workingSetSize: 900,
            peakWorkingSetSize: 950,
            privateBytes: 400,
          },
        }),
        metric({
          pid: 2,
          type: "Tab",
          memory: { workingSetSize: 300, peakWorkingSetSize: 310 },
        }),
      ],
      { measure: "private" }
    );

    assert.equal(snapshot.approximate, true);
    assert.equal(snapshot.totalKb, 700);
    assert.equal(snapshot.rows[1].approximate, true);
  });
});
