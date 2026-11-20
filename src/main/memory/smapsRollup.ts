/**
 * @file smapsRollup.ts
 * @module main/memory/smapsRollup
 * @description Reads the Linux per-process memory summary `/proc/<pid>/smaps_rollup` (kernel 4.14+) for the Workbench status bar memory meter: the proportional set size (PSS, each shared page divided evenly among the processes that map it, so PSS figures add up without double counting) and the process's private and shared memory. Files are read asynchronously so Main's event loop never blocks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link aggregateProcessMetrics}
 * @see {@link SmapsRollupFigures}
 */

import { readFile as fsReadFile } from "node:fs/promises";
import type { SmapsRollupFigures } from "../../shared/memory/memoryUsage";

/**
 * @callback TextFileReader
 * @description Reads a whole text file; rejects when it cannot be read.
 * @param {string} path - Absolute file path.
 * @returns {Promise<string>} The file's text.
 */
export type TextFileReader = (path: string) => Promise<string>;

/**
 * @description Parses the text of one `smaps_rollup` file. Private memory is `Private_Clean` + `Private_Dirty` and shared memory is `Shared_Clean` + `Shared_Dirty`; a missing private or shared field counts as zero.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {string} text - File contents.
 * @returns {SmapsRollupFigures | null} The figures in kilobytes, or null when the text has no `Pss` line (an empty file included).
 */
export function parseSmapsRollup(text: string): SmapsRollupFigures | null {
  const fields = new Map<string, number>();
  for (const match of text.matchAll(/^(\w+):\s+(\d+)\s+kB$/gm)) {
    fields.set(match[1], Number(match[2]));
  }
  const pssKb = fields.get("Pss");
  if (pssKb === undefined) return null;
  const field = (name: string): number => fields.get(name) ?? 0;
  return {
    pssKb,
    privateKb: field("Private_Clean") + field("Private_Dirty"),
    sharedKb: field("Shared_Clean") + field("Shared_Dirty"),
  };
}

/**
 * @description Reads `/proc/<pid>/smaps_rollup` for each pid in parallel. A process whose file is missing (it exited, or the kernel predates 4.14), unreadable or unparsable maps to null, so the meter falls back to its resident memory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {number[]} pids - OS process ids.
 * @param {TextFileReader} [readFile] - File reader; defaults to `fs.promises.readFile` as UTF-8.
 * @returns {Promise<Map<number, SmapsRollupFigures | null>>} Figures by pid.
 */
export async function readSmapsRollups(
  pids: number[],
  readFile: TextFileReader = (path) => fsReadFile(path, "utf8")
): Promise<Map<number, SmapsRollupFigures | null>> {
  const entries = await Promise.all(
    pids.map(async (pid): Promise<[number, SmapsRollupFigures | null]> => {
      try {
        return [
          pid,
          parseSmapsRollup(await readFile(`/proc/${pid}/smaps_rollup`)),
        ];
      } catch {
        return [pid, null];
      }
    })
  );
  return new Map(entries);
}
