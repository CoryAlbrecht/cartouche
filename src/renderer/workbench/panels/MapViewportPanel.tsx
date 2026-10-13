/**
 * @file MapViewportPanel.tsx
 * @module renderer/workbench/panels/MapViewportPanel
 * @description Isolated imperative OpenLayers map canvas viewport panel, strictly insulated from React VDOM reconciliation loops.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link OpenLayersEngine}
 */

import React, { useEffect, useRef } from "react";
import { effect } from "@preact/signals-react";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Graticule from "ol/layer/Graticule.js";
import Stroke from "ol/style/Stroke.js";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj.js";
import Feature from "ol/Feature.js";
import Polygon from "ol/geom/Polygon.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import { ol as flatgeobufOl } from "flatgeobuf";
import {
  cursorCoordsSignal,
  viewportExtentSignal,
  zoomSignal,
  scaleDenominatorSignal,
  effectiveVisibleLayersSignal,
  featuresSignal,
  mapActionSignal,
  currentProjectSignal,
  getDefaultOlFlatStyle,
  addConsoleLog,
} from "@renderer/state/gisSignals";
import type { GisLayer, GisFeature, BoundingBox } from "@shared/types";
import type { IDockviewPanelProps } from "dockview-react";
import "ol/ol.css";

/**
 * @class OpenLayersEngine
 * @description Imperative OpenLayers map canvas engine operating directly on target DOM element, isolated from React VDOM reconciliation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
class OpenLayersEngine {
  private map: OlMap;
  private vectorLayersMap = new Map<
    string,
    { layer: VectorLayer<VectorSource>; source: VectorSource }
  >();

  constructor(container: HTMLElement) {
    const graticule = new Graticule({
      strokeStyle: new Stroke({
        color: "rgba(0, 0, 0, 0.2)",
        width: 1,
        lineDash: [4, 4],
      }),
      showLabels: true,
      wrapX: true,
    });

    this.map = new OlMap({
      target: container,
      layers: [graticule],
      view: new View({
        center: fromLonLat([15, 35]),
        zoom: 3,
        projection: "EPSG:3857",
      }),
      controls: [],
    });

    this.bindEvents();
    addConsoleLog(
      "info",
      "OpenLayers spatial canvas engine initialized.",
      "OpenLayers",
    );
  }

  /**
   * @description Synchronizes current map canvas bounding envelope and zoom metrics into reactive signals.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public updateViewportSignals(): void {
    const size = this.map.getSize();
    if (!size || size[0] <= 0 || size[1] <= 0) return;
    const view = this.map.getView();
    const extent3857 = view.calculateExtent(size);
    if (!extent3857 || extent3857.some((val) => !isFinite(val))) return;
    const [minLon, minLat, maxLon, maxLat] = transformExtent(
      extent3857,
      "EPSG:3857",
      "EPSG:4326"
    );
    viewportExtentSignal.value = [
      Math.round(minLon * 100000) / 100000,
      Math.round(minLat * 100000) / 100000,
      Math.round(maxLon * 100000) / 100000,
      Math.round(maxLat * 100000) / 100000,
    ];
    const zoom = view.getZoom();
    if (zoom !== undefined && isFinite(zoom)) {
      zoomSignal.value = Math.round(zoom * 10) / 10;
      scaleDenominatorSignal.value = Math.round(500000000 / Math.pow(2, zoom));
    }
  }

  private bindEvents(): void {
    // Cursor location tracking
    this.map.on("pointermove", (evt) => {
      if (evt.coordinate) {
        const [lon, lat] = toLonLat(evt.coordinate);
        cursorCoordsSignal.value = {
          lon: Math.round(lon * 100000) / 100000,
          lat: Math.round(lat * 100000) / 100000,
          x: Math.round(evt.pixel[0]),
          y: Math.round(evt.pixel[1]),
        };
      }
    });

    // View resolution change signal updates
    this.map.getView().on("change:resolution", () => {
      const zoom = this.map.getView().getZoom() || 3;
      zoomSignal.value = Math.round(zoom * 10) / 10;
      scaleDenominatorSignal.value = Math.round(500000000 / Math.pow(2, zoom));
    });

    // Viewport bounding box updates on movement completion
    this.map.on("moveend", () => {
      this.updateViewportSignals();
    });
  }

  public updateVisibleLayers(
    visibleLayers: GisLayer[],
    allFeatures: GisFeature[],
  ): void {
    const currentLayerIds = new Set(visibleLayers.map((l) => l.id));

    // Remove layers no longer visible or present
    for (const [id, entry] of this.vectorLayersMap.entries()) {
      if (!currentLayerIds.has(id)) {
        this.map.removeLayer(entry.layer);
        this.vectorLayersMap.delete(id);
      }
    }

    // Add or update visible layers
    for (const layerConfig of visibleLayers) {
      const existing = this.vectorLayersMap.get(layerConfig.id);
      const style =
        layerConfig.flatStyle ||
        getDefaultOlFlatStyle(layerConfig.geometryKind);

      if (!existing) {
        const source = new VectorSource();
        const vectorLayer = new VectorLayer({
          source,
          style: style as any,
          opacity: layerConfig.opacity ?? 1,
        });

        this.map.addLayer(vectorLayer);
        this.vectorLayersMap.set(layerConfig.id, {
          layer: vectorLayer,
          source,
        });
        this.loadLayerFeatures(layerConfig, allFeatures, source);
      } else {
        existing.layer.setStyle(style as any);
        existing.layer.setOpacity(layerConfig.opacity ?? 1);
      }
    }
  }

  private async loadLayerFeatures(
    layerConfig: GisLayer,
    allFeatures: GisFeature[],
    source: VectorSource,
  ): Promise<void> {
    try {
      // 1. If binary FlatGeobuf buffer exists directly on layer, deserialize using flatgeobuf.ol
      if (
        layerConfig.flatGeobufBuffer &&
        layerConfig.flatGeobufBuffer.byteLength > 0
      ) {
        const uint8 = new Uint8Array(layerConfig.flatGeobufBuffer);
        const features: Feature[] = [];
        for await (const feature of flatgeobufOl.deserialize(uint8)) {
          features.push(feature as Feature);
        }
        source.clear();
        source.addFeatures(features);
        return;
      }

      // 2. Otherwise load layer features from signal and encode/deserialize via FlatGeobuf IPC pipeline
      const layerFeatures = allFeatures.filter(
        (f) => f.layerId === layerConfig.id,
      );
      if (
        layerFeatures.length > 0 &&
        window.electronAPI?.encodeFeaturesToFlatGeobuf
      ) {
        const buffer = await window.electronAPI.encodeFeaturesToFlatGeobuf(
          layerFeatures,
          layerConfig.geometryKind || "Point",
        );

        if (buffer && buffer.byteLength > 0) {
          const uint8 = new Uint8Array(buffer);
          const olFeatures: Feature[] = [];
          for await (const feature of flatgeobufOl.deserialize(uint8)) {
            olFeatures.push(feature as Feature);
          }
          source.clear();
          source.addFeatures(olFeatures);
          return;
        }
      }

      // Fallback manual feature conversion
      if (layerFeatures.length > 0) {
        const olFeatures = layerFeatures.map((f) => this.convertToOlFeature(f));
        source.clear();
        source.addFeatures(olFeatures.filter((f): f is Feature => f !== null));
      }
    } catch (err) {
      addConsoleLog(
        "error",
        `Failed to load FlatGeobuf features for layer "${layerConfig.name}": ${err}`,
        "OpenLayers",
      );
    }
  }

  private convertToOlFeature(f: GisFeature): Feature | null {
    try {
      const coords = f.coordinates as any;
      if (!coords) return null;

      let geom;
      if (f.geometryType === "Polygon" && Array.isArray(coords)) {
        const transformedRings = coords.map((ring: any[]) =>
          ring.map((pt: any[]) => fromLonLat([pt[0], pt[1]])),
        );
        geom = new Polygon(transformedRings);
      } else if (f.geometryType === "LineString" && Array.isArray(coords)) {
        const transformedPts = coords.map((pt: any[]) =>
          fromLonLat([pt[0], pt[1]]),
        );
        geom = new LineString(transformedPts);
      } else if (f.geometryType === "Point" && Array.isArray(coords)) {
        geom = new Point(fromLonLat([coords[0], coords[1]]));
      }

      if (!geom) return null;
      const feat = new Feature({ geometry: geom, ...f.properties });
      feat.setId(f.id);
      return feat;
    } catch {
      return null;
    }
  }

  public zoomIn(): void {
    const view = this.map.getView();
    view.animate({ zoom: (view.getZoom() || 3) + 1, duration: 200 });
  }

  public zoomOut(): void {
    const view = this.map.getView();
    view.animate({ zoom: (view.getZoom() || 3) - 1, duration: 200 });
  }

  public resetExtent(): void {
    const view = this.map.getView();
    view.animate({ center: fromLonLat([15, 35]), zoom: 3, duration: 300 });
  }

  /**
   * @description Fits or sets viewport center, extent, zoom, and rotation on the OpenLayers view.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {Object} payload - Viewport configuration parameters.
   * @param {BoundingBox} [payload.extent] - Bounding envelope [minX, minY, maxX, maxY].
   * @param {{ x: number; y: number }} [payload.center] - Center point coordinate.
   * @param {number} [payload.zoom] - Zoom level.
   * @param {number} [payload.rotation] - Camera rotation.
   * @returns {void}
   */
  public setViewport(payload: {
    extent?: BoundingBox;
    center?: { x: number; y: number };
    zoom?: number;
    rotation?: number;
  }): void {
    const view = this.map.getView();
    if (payload.rotation !== undefined) {
      view.setRotation(payload.rotation);
    }
    if (payload.extent && payload.extent.length === 4) {
      const extent3857 = transformExtent(payload.extent, "EPSG:4326", "EPSG:3857");
      const size = this.map.getSize();
      if (size && size[0] > 0 && size[1] > 0) {
        view.fit(extent3857, { size, padding: [20, 20, 20, 20] });
      } else {
        view.fit(extent3857);
      }
      if (payload.zoom !== undefined) {
        view.setZoom(payload.zoom);
      }
    } else if (payload.center) {
      view.setCenter(fromLonLat([payload.center.x, payload.center.y]));
      if (payload.zoom !== undefined) {
        view.setZoom(payload.zoom);
      }
    } else if (payload.zoom !== undefined) {
      view.setZoom(payload.zoom);
    }
  }

  public resize(): void {
    this.map.updateSize();
    this.updateViewportSignals();
  }

  public destroy(): void {
    this.map.setTarget(undefined);
  }
}

/**
 * @component MapViewportPanel
 * @description Renders OpenLayers map viewport canvas inside Dockview layout with floating navigation controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {IDockviewPanelProps} props - Dockview panel properties.
 * @returns {React.ReactElement} Map viewport panel element.
 */
export const MapViewportPanel: React.FC<IDockviewPanelProps | any> = React.memo(
  () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<OpenLayersEngine | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Instantiate OpenLayers engine isolated from React VDOM
      const engine = new OpenLayersEngine(containerRef.current);
      engineRef.current = engine;

      // If active project has a saved viewport prior to mount, apply it
      const currentProject = currentProjectSignal.value;
      if (currentProject?.viewport) {
        engine.setViewport({
          extent: currentProject.viewport.extent ? [
            currentProject.viewport.extent.xmin,
            currentProject.viewport.extent.ymin,
            currentProject.viewport.extent.xmax,
            currentProject.viewport.extent.ymax
          ] : undefined,
          center: currentProject.viewport.center,
          zoom: currentProject.viewport.zoom,
          rotation: currentProject.viewport.rotation
        });
      }
      engine.updateViewportSignals();

      // Handle container resizing
      const observer = new ResizeObserver(() => {
        engine.resize();
      });
      observer.observe(containerRef.current);

      // Reactive signal subscriptions
      const disposeLayers = effect(() => {
        const visibleLayers = effectiveVisibleLayersSignal.value;
        const allFeatures = featuresSignal.value;
        engine.updateVisibleLayers(visibleLayers, allFeatures);
      });

      const disposeActions = effect(() => {
        const mapAction = mapActionSignal.value;
        if (!mapAction) return;

        if (mapAction.action === "zoomIn") {
          engine.zoomIn();
        } else if (mapAction.action === "zoomOut") {
          engine.zoomOut();
        } else if (mapAction.action === "reset") {
          engine.resetExtent();
        } else if (mapAction.action === "setViewport") {
          engine.setViewport(mapAction);
        }
      });

      return () => {
        disposeLayers();
        disposeActions();
        observer.disconnect();
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          userSelect: "none",
        }}
      >
        {/* Floating Canvas Quick Controls (Zoom, Reset) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 10,
          }}
        >
          <button
            className="map-action-btn"
            title="Zoom In"
            onClick={() => engineRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            className="map-action-btn"
            title="Zoom Out"
            onClick={() => engineRef.current?.zoomOut()}
          >
            −
          </button>
          <button
            className="map-action-btn"
            title="Reset Extent"
            onClick={() => engineRef.current?.resetExtent()}
          >
            ⟲
          </button>
        </div>
      </div>
    );
  },
);

MapViewportPanel.displayName = "MapViewportPanel";
