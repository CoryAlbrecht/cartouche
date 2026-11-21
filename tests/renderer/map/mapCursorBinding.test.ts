/**
 * @file mapCursorBinding.test.ts
 * @module tests/renderer/map/mapCursorBinding
 * @description Tests that the Map Cursor binding writes the resolved cursor onto the map container imperatively, following the active tool, Vertex Editor Mode and the Pan drag state (grab → grabbing → grab), and stops after disposal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromAny } from "@total-typescript/shoehorn";
import {
  activeToolSignal,
  vertexEditorModeSignal,
} from "../../../src/renderer/state/gisSignals";
import {
  bindMapCursor,
  type MapCursorEventSource,
} from "../../../src/renderer/map/mapCursorBinding";
import type { MapCursorImages } from "../../../src/renderer/map/mapCursor";

/** Listener registry keyed by event type. */
type Listeners = Map<string, Set<(evt: any) => void>>;

/**
 * @description Creates a minimal event target that records listeners and can dispatch to them.
 * @returns {{ listeners: Listeners, addEventListener: Function, removeEventListener: Function, emit: Function }} Fake target.
 */
function makeTarget() {
  const listeners: Listeners = new Map();
  return {
    listeners,
    addEventListener(type: string, fn: (evt: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (evt: any) => void) {
      listeners.get(type)?.delete(fn);
    },
    emit(type: string, evt: any = {}) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn(evt);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

const IMAGES: MapCursorImages = {
  selectClick: "click.svg",
  selectClickVertices: "click-v.svg",
  selectRectangle: "rect.svg",
  selectRectangleVertices: "rect-v.svg",
  selectLasso: "lasso.svg",
  selectLassoVertices: "lasso-v.svg",
};

describe("bindMapCursor", () => {
  let doc: ReturnType<typeof makeTarget>;
  let mapEvents: ReturnType<typeof makeTarget>;
  let container: { style: Record<string, string>; ownerDocument: any };
  let map: MapCursorEventSource;
  let dispose: () => void;

  beforeEach(() => {
    activeToolSignal.value = "pan";
    vertexEditorModeSignal.value = false;
    doc = makeTarget();
    mapEvents = makeTarget();
    container = { style: {}, ownerDocument: doc };
    map = fromAny<MapCursorEventSource, unknown>({
      on: (type: string, fn: (evt: any) => void) =>
        mapEvents.addEventListener(type, fn),
      un: (type: string, fn: (evt: any) => void) =>
        mapEvents.removeEventListener(type, fn),
    });
    dispose = bindMapCursor(
      fromAny<HTMLElement, unknown>(container),
      map,
      IMAGES
    );
  });

  afterEach(() => {
    dispose();
    activeToolSignal.value = "pan";
    vertexEditorModeSignal.value = false;
  });

  it("shows grab for Pan immediately", () => {
    assert.equal(container.style.cursor, "grab");
  });

  it("follows tool switches immediately", () => {
    activeToolSignal.value = "polygon";
    assert.equal(container.style.cursor, "crosshair");
    activeToolSignal.value = "select_click";
    assert.equal(container.style.cursor, 'url("click.svg") 4 3, default');
  });

  it("follows Vertex Editor Mode toggles immediately", () => {
    activeToolSignal.value = "select_rectangle";
    vertexEditorModeSignal.value = true;
    assert.equal(container.style.cursor, 'url("rect-v.svg") 11 11, crosshair');
    vertexEditorModeSignal.value = false;
    assert.equal(container.style.cursor, 'url("rect.svg") 11 11, crosshair');
  });

  it("Pan shows grabbing during a primary drag and grab after release", () => {
    mapEvents.emit("pointerdrag", { originalEvent: { buttons: 1 } });
    assert.equal(container.style.cursor, "grabbing");
    doc.emit("pointerup");
    assert.equal(container.style.cursor, "grab");
  });

  it("a cancelled pointer also ends the drag", () => {
    mapEvents.emit("pointerdrag", { originalEvent: { buttons: 1 } });
    doc.emit("pointercancel");
    assert.equal(container.style.cursor, "grab");
  });

  it("ignores drags without the primary button", () => {
    mapEvents.emit("pointerdrag", { originalEvent: { buttons: 2 } });
    assert.equal(container.style.cursor, "grab");
  });

  it("stops updating and removes its listeners once disposed", () => {
    dispose();
    activeToolSignal.value = "point";
    assert.equal(container.style.cursor, "grab");
    assert.equal(mapEvents.count("pointerdrag"), 0);
    assert.equal(doc.count("pointerup"), 0);
    assert.equal(doc.count("pointercancel"), 0);
    dispose = () => {};
  });
});
