/**
 * @file workbenchMinimumSize.ts
 * @module main/workbenchMinimumSize
 * @description Applies the Workbench window's minimum size, which the renderer computes from the map viewport's minimum, the docked widgets' minimums and the fixed Workbench bars (menubar, outer toolbars, status bar) (ADR 0025 §8). Validates the renderer's numbers, sets the `BrowserWindow` minimum, and grows a window that is already smaller than the new minimum.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link applyWorkbenchMinimumSize}
 */

import type { WorkbenchMinimumSize } from "../shared/types";

/**
 * @description Minimum Workbench window size used until the renderer reports the real one, and the smallest saved window size restored at start-up.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {WorkbenchMinimumSize}
 */
export const WORKBENCH_FALLBACK_MINIMUM_SIZE: WorkbenchMinimumSize = {
  width: 640,
  height: 480,
};

/**
 * @description Largest minimum width or height accepted from the renderer, in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
const MAX_MINIMUM_EXTENT = 16384;

/**
 * @typedef {Object} MinimumSizeWindow
 * @description The parts of a `BrowserWindow` the minimum size needs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {() => boolean} isDestroyed - Whether the window is gone.
 * @property {() => boolean} isMaximized - Whether the window is maximized.
 * @property {() => boolean} isFullScreen - Whether the window is full screen.
 * @property {() => number[]} getSize - Current outer size as [width, height].
 * @property {(width: number, height: number) => void} setSize - Resizes the window.
 * @property {(width: number, height: number) => void} setMinimumSize - Sets the minimum size.
 */
export interface MinimumSizeWindow {
  isDestroyed(): boolean;
  isMaximized(): boolean;
  isFullScreen(): boolean;
  getSize(): number[];
  setSize(width: number, height: number): void;
  setMinimumSize(width: number, height: number): void;
}

/**
 * Validates a minimum size sent by the renderer.
 * @function sanitizeMinimumSize
 * @description Accepts an object with finite, positive `width` and `height`, rounds them up to whole pixels and caps them at 16384.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {unknown} raw - The value received over IPC.
 * @returns {WorkbenchMinimumSize | null} The size, or null when invalid.
 */
export function sanitizeMinimumSize(raw: unknown): WorkbenchMinimumSize | null {
  if (!raw || typeof raw !== "object") return null;
  const { width, height } = raw as { width?: unknown; height?: unknown };
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    width: Math.min(MAX_MINIMUM_EXTENT, Math.ceil(width)),
    height: Math.min(MAX_MINIMUM_EXTENT, Math.ceil(height)),
  };
}

/**
 * Applies the renderer's minimum size to the Workbench window.
 * @function applyWorkbenchMinimumSize
 * @description Sets the window's minimum size. A window that is neither maximized nor full screen and is smaller than the new minimum grows to it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {MinimumSizeWindow | null} win - The Workbench window.
 * @param {unknown} raw - The minimum size received over IPC.
 * @returns {boolean} True when a minimum was applied.
 */
export function applyWorkbenchMinimumSize(
  win: MinimumSizeWindow | null,
  raw: unknown
): boolean {
  const size = sanitizeMinimumSize(raw);
  if (!win || win.isDestroyed() || !size) return false;

  win.setMinimumSize(size.width, size.height);

  if (!win.isMaximized() && !win.isFullScreen()) {
    const [width, height] = win.getSize();
    if (width < size.width || height < size.height) {
      win.setSize(Math.max(width, size.width), Math.max(height, size.height));
    }
  }
  return true;
}
