/**
 * @file smapsRollup.test.ts
 * @module tests/main/memory/smapsRollup.test
 * @description Unit tests for reading Linux `/proc/<pid>/smaps_rollup`: parsing the proportional set size and the private and shared memory of one process from fixture text, and reading several processes at once, where a missing or unreadable file yields no figures for that process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link parseSmapsRollup}
 * @see {@link readSmapsRollups}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSmapsRollup,
  readSmapsRollups,
} from "../../../src/main/memory/smapsRollup";

const ROLLUP = `5a1528c25000-7fffad246000 ---p 00000000 00:00 0                          [rollup]
Rss:                2020 kB
Pss:                 136 kB
Pss_Dirty:           116 kB
Pss_Anon:            116 kB
Shared_Clean:       1904 kB
Shared_Dirty:          8 kB
Private_Clean:         4 kB
Private_Dirty:       116 kB
Referenced:         2020 kB
Swap:                  0 kB
SwapPss:               0 kB
`;

describe("parseSmapsRollup", () => {
  it("reads PSS, private (clean + dirty) and shared (clean + dirty) memory in kB", () => {
    assert.deepEqual(parseSmapsRollup(ROLLUP), {
      pssKb: 136,
      privateKb: 120,
      sharedKb: 1912,
    });
  });

  it("counts a missing private or shared field as zero", () => {
    assert.deepEqual(parseSmapsRollup("Pss: 50 kB\nPrivate_Dirty: 20 kB\n"), {
      pssKb: 50,
      privateKb: 20,
      sharedKb: 0,
    });
  });

  it("returns null when there is no Pss line, including for empty text", () => {
    assert.equal(parseSmapsRollup(""), null);
    assert.equal(parseSmapsRollup("Rss: 2020 kB\nShared_Clean: 10 kB\n"), null);
  });
});

describe("readSmapsRollups", () => {
  it("reads each pid's /proc/<pid>/smaps_rollup and maps an unreadable or empty file to null", async () => {
    const files: Record<string, string> = {
      "/proc/10/smaps_rollup": ROLLUP,
      "/proc/30/smaps_rollup": "",
    };
    const readFile = async (path: string): Promise<string> => {
      if (path in files) return files[path];
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    };

    const result = await readSmapsRollups([10, 20, 30], readFile);

    assert.deepEqual(result.get(10), {
      pssKb: 136,
      privateKb: 120,
      sharedKb: 1912,
    });
    assert.equal(result.get(20), null);
    assert.equal(result.get(30), null);
  });
});
