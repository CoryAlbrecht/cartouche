/**
 * @file addLayersBatch.ts
 * @module renderer/workbench/dialogs/addLayersBatch
 * @description Batch runner for the Add Layers Dialog: adds the chosen files as layers one at a time, in order, and for each file that can't be loaded waits for the user to acknowledge a warning before moving on to the next file. A failure never stops the rest of the batch and never rejects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link AddLayersDialog}
 */

import type { AddLayerParams } from "@shared/types";

/**
 * @typedef {Object} LayerLoadFailure
 * @description One file of the batch that could not be added as a layer.
 * @property {string} filePath - Path of the file that failed.
 * @property {"missing" | "load-error"} reason - `missing` when the file does not exist on disk; `load-error` when the format is unrecognised or the loader failed.
 * @property {string} message - Human-readable reason for a `load-error`, with IPC wrapper prefixes removed; empty for `missing`.
 */
export interface LayerLoadFailure {
  filePath: string;
  reason: "missing" | "load-error";
  message: string;
}

/**
 * @typedef {Object} AddLayersBatchDeps
 * @description Injected collaborators of {@link addLayersOneByOne}.
 * @property {(filePath: string) => Promise<boolean>} [pathExists] - Existence check; when absent, existence is left to `addLayer`.
 * @property {(params: AddLayerParams) => Promise<unknown>} addLayer - Adds one layer; rejects when the file can't be loaded.
 * @property {(failure: LayerLoadFailure) => Promise<void>} warn - Shows a warning for one failed file and resolves once the user acknowledges it.
 * @property {() => boolean} [isCancelled] - Checked before each file; once true, the remaining files are skipped (e.g. the dialog was closed mid-batch).
 */
export interface AddLayersBatchDeps {
  pathExists?: (filePath: string) => Promise<boolean>;
  addLayer: (params: AddLayerParams) => Promise<unknown>;
  warn: (failure: LayerLoadFailure) => Promise<void>;
  isCancelled?: () => boolean;
}

/**
 * @typedef {Object} AddLayersBatchResult
 * @description Outcome of one {@link addLayersOneByOne} run.
 * @property {string[]} added - Paths added as layers, in order.
 * @property {LayerLoadFailure[]} failed - Files that could not be added, in order.
 */
export interface AddLayersBatchResult {
  added: string[];
  failed: LayerLoadFailure[];
}

/**
 * @description Turns a rejection from adding a layer into the reason shown to the user, removing the
 * `Error invoking remote method '<channel>':` and `Error:` prefixes Electron adds to IPC rejections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {unknown} err - Rejection value.
 * @returns {string} Reason text.
 */
export function describeLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/^Error invoking remote method '[^']*':\s*/, "")
    .replace(/^(?:[A-Za-z]*Error:\s*)+/, "")
    .trim();
}

/**
 * @description Adds each file as a vector layer, one at a time and in order. A file that is missing
 * or fails to load is reported through `deps.warn`, and the next file is processed only after that
 * warning resolves. Stops early once `deps.isCancelled` returns true. Never rejects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {string[]} files - Paths chosen in the Add Layers Dialog.
 * @param {AddLayersBatchDeps} deps - Existence check, layer adder and warning presenter.
 * @returns {Promise<AddLayersBatchResult>} Files added and files that failed.
 */
export async function addLayersOneByOne(
  files: string[],
  deps: AddLayersBatchDeps
): Promise<AddLayersBatchResult> {
  const result: AddLayersBatchResult = { added: [], failed: [] };

  for (const filePath of files) {
    if (deps.isCancelled?.()) break;
    let failure: LayerLoadFailure | null = null;
    try {
      if (deps.pathExists && !(await deps.pathExists(filePath))) {
        failure = { filePath, reason: "missing", message: "" };
      } else {
        await deps.addLayer({ sourceType: "vector", filePath });
        result.added.push(filePath);
      }
    } catch (err) {
      failure = {
        filePath,
        reason: "load-error",
        message: describeLoadError(err),
      };
    }

    if (failure) {
      result.failed.push(failure);
      try {
        await deps.warn(failure);
      } catch {
        // A broken warning presenter must not stop the batch.
      }
    }
  }

  return result;
}
