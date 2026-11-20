/**
 * @file workbenchMemoryMeter.ts
 * @module main/memory/workbenchMemoryMeter
 * @description Electron glue for the Workbench status bar memory meter: binds a {@link MemoryMeter} to the Workbench window, sampling `app.getAppMetrics()` in Main and pushing each snapshot to the Workbench renderer on the `app:memory-usage` channel only while the window is visible and not minimised. The meter reads memory figures only.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MemoryMeter}
 * @see {@link aggregateProcessMetrics}
 */

import { app, type BrowserWindow } from "electron";
import { aggregateProcessMetrics } from "../../shared/memory/memoryUsage";
import { MemoryMeter } from "./MemoryMeter";

/**
 * @description IPC channel the memory snapshots are pushed on.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const MEMORY_USAGE_CHANNEL = "app:memory-usage";

/**
 * @description Starts the memory meter for the Workbench window. It runs while the window is shown and not minimised, pauses on `hide` / `minimize`, resumes on `show` / `restore`, and is disposed when the window closes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {BrowserWindow} win - The Workbench window.
 * @returns {MemoryMeter} The bound meter.
 */
export function attachWorkbenchMemoryMeter(win: BrowserWindow): MemoryMeter {
  const meter = new MemoryMeter({
    sample: () =>
      aggregateProcessMetrics(app.getAppMetrics(), {
        workbenchPid: win.webContents.getOSProcessId(),
      }),
    publish: (snapshot) => {
      if (!win.isDestroyed()) {
        win.webContents.send(MEMORY_USAGE_CHANNEL, snapshot);
      }
    },
  });

  /**
   * @description Re-evaluates whether the Workbench is visible and not minimised, starting or stopping the meter.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {void}
   */
  const update = (): void =>
    meter.setActive(
      !win.isDestroyed() && win.isVisible() && !win.isMinimized()
    );

  win.on("show", update);
  win.on("hide", update);
  win.on("minimize", update);
  win.on("restore", update);
  win.on("closed", () => meter.dispose());
  // A sample sent before the page loads is lost; send a fresh one once it has.
  win.webContents.on("did-finish-load", () => {
    meter.setActive(false);
    update();
  });
  update();
  return meter;
}
