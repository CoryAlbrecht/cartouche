import React, { useEffect, useRef } from "react";
import { effect } from "@preact/signals-react";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Graticule from "ol/layer/Graticule.js";
import Stroke from "ol/style/Stroke.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import Feature from "ol/Feature.js";
import Polygon from "ol/geom/Polygon.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import { ol as flatgeobufOl } from "flatgeobuf";
import {
  cursorCoordsSignal,
  zoomSignal,
  scaleDenominatorSignal,
  effectiveVisibleLayersSignal,
  featuresSignal,
  mapActionSignal,
  getDefaultOlFlatStyle,
  addConsoleLog,
} from "@renderer/state/gisSignals";
import type { GisLayer, GisFeature } from "@shared/types";
import type { IDockviewPanelProps } from "dockview-react";
import "ol/ol.css";

/**
 * Isolated OpenLayers Map Engine.
 * Runs directly on the DOM container, completely insulated from React VDOM reconciliation.
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

  public resize(): void {
    this.map.updateSize();
  }

  public destroy(): void {
    this.map.setTarget(undefined);
  }
}

export const MapViewportPanel: React.FC<IDockviewPanelProps | any> = React.memo(
  () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<OpenLayersEngine | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Instantiate OpenLayers engine isolated from React VDOM
      const engine = new OpenLayersEngine(containerRef.current);
      engineRef.current = engine;

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
