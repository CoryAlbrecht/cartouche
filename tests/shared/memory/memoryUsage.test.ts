/**
 * @file memoryUsage.test.ts
 * @module tests/shared/memory/memoryUsage.test
 * @description Unit tests for the memory meter's pure helpers: grouping Electron process metrics into the per-process breakdown (Main, Workbench and other renderers, Geospatial Worker, GPU, Other) and formatting kilobyte figures in MB below 1 GB and GB with one decimal from 1 GB up.
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
  type ProcessMetricLike,
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
  it("uses whole MB below 1 GB", () => {
    assert.deepEqual(formatMemorySize(512 * 1024, "en"), {
      unit: "mb",
      value: "512",
    });
    assert.deepEqual(formatMemorySize(0, "en"), { unit: "mb", value: "0" });
  });

  it("uses GB with one decimal from 1 GB up", () => {
    assert.deepEqual(formatMemorySize(1024 * 1024, "en"), {
      unit: "gb",
      value: "1.0",
    });
    assert.deepEqual(formatMemorySize(1.25 * 1024 * 1024 + 1, "en"), {
      unit: "gb",
      value: "1.3",
    });
  });

  it("switches to GB when the MB figure would round up to 1024", () => {
    assert.equal(formatMemorySize(1024 * 1024 - 100, "en").unit, "gb");
    assert.equal(formatMemorySize(1023 * 1024, "en").unit, "mb");
  });

  it("formats the number for the locale", () => {
    assert.equal(formatMemorySize(1.5 * 1024 * 1024, "fr").value, "1,5");
    assert.equal(formatMemorySize(5 * 1024 * 1024, "en").value, "5.0");
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

    assert.deepEqual(snapshot.rows, [
      { kind: "main", pid: 10, currentKb: 100, peakKb: 110 },
      { kind: "workbench", pid: 20, currentKb: 200, peakKb: 220 },
      { kind: "renderer", pid: 21, currentKb: 210, peakKb: 211 },
      { kind: "worker", pid: 50, currentKb: 500, peakKb: 600 },
      { kind: "gpu", pid: 30, currentKb: 300, peakKb: 310 },
      { kind: "other", currentKb: 15, peakKb: 27 },
    ]);
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
});
