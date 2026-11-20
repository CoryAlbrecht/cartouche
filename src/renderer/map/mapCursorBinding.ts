/**
 * @file mapCursorBinding.ts
 * @module renderer/map/mapCursorBinding
 * @description Imperative Map Cursor binding: a signal effect that writes the cursor resolved by {@link resolveMapCursor} onto the map container whenever the active tool, the Selection Target or the primary-drag state changes, outside the React render cycle (map canvas isolation rule). Tracks the drag state from OpenLayers `pointerdrag` events and document-level `pointerup` / `pointercancel`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link resolveMapCursor}
 * @see {@link MapController}
 */

import { effect, signal } from "@preact/signals-react";
import { activeToolSignal, selectionTargetSignal } from "../state/gisSignals";
import type OlMap from "ol/Map.js";
import type MapBrowserEvent from "ol/MapBrowserEvent.js";
import { resolveMapCursor, type MapCursorImages } from "./mapCursor";

/**
 * @typedef {Pick<OlMap, "on" | "un">} MapCursorEventSource
 * @description The part of an OpenLayers map the binding listens to for drag state (`pointerdrag`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type MapCursorEventSource = Pick<OlMap, "on" | "un">;

/**
 * @description Binds the Map Cursor of one map viewport. The cursor is applied at once
 * and re-applied on every change of {@link activeToolSignal}, {@link selectionTargetSignal}
 * or the primary-drag state; a drag starts on the first `pointerdrag` with the primary
 * button held and ends on the next `pointerup` or `pointercancel` anywhere in the document.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {HTMLElement} container - Map viewport container whose `style.cursor` is written.
 * @param {MapCursorEventSource} map - OpenLayers map (drag events).
 * @param {MapCursorImages} [images] - Custom Selection Tool cursor image URLs.
 * @returns {() => void} Disposer removing the effect and all listeners.
 */
export function bindMapCursor(
  container: HTMLElement,
  map: MapCursorEventSource,
  images?: MapCursorImages
): () => void {
  const dragging = signal(false);

  const onDrag = (evt: MapBrowserEvent): void => {
    const buttons = (evt?.originalEvent as PointerEvent | undefined)?.buttons;
    if (buttons === undefined || (buttons & 1) === 1) {
      dragging.value = true;
    }
  };
  const onRelease = (): void => {
    dragging.value = false;
  };

  map.on("pointerdrag", onDrag);
  const doc: Pick<Document, "addEventListener" | "removeEventListener"> | null =
    container.ownerDocument ?? null;
  doc?.addEventListener("pointerup", onRelease);
  doc?.addEventListener("pointercancel", onRelease);

  const disposeEffect = effect(() => {
    const cursor = resolveMapCursor(
      activeToolSignal.value,
      selectionTargetSignal.value,
      dragging.value,
      images
    );
    if (container.style) {
      container.style.cursor = cursor;
    }
  });

  return () => {
    disposeEffect();
    map.un("pointerdrag", onDrag);
    doc?.removeEventListener("pointerup", onRelease);
    doc?.removeEventListener("pointercancel", onRelease);
  };
}
