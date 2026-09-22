import React, { useEffect, useRef } from 'react';
import { effect } from '@preact/signals-react';
import {
  cursorCoordsSignal,
  zoomSignal,
  scaleDenominatorSignal,
  layersSignal,
  selectedFeatureIdsSignal,
  activeCrsSignal,
  featuresSignal,
  activeToolSignal,
  mapActionSignal,
  addConsoleLog
} from '@renderer/state/gisSignals';
import type { GisLayer, GisFeature, CRS } from '@shared/types';

/**
 * High-performance, isolated Imperative Map Engine.
 * Runs directly on the HTML5 Canvas DOM without React VDOM involvement.
 */
class ImperativeMapCanvasEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = window.devicePixelRatio || 1;

  // View state: center in geographic degrees, zoom level
  private centerLon = 15;
  private centerLat = 35;
  private zoom = 2.5; // degrees per 100px scale factor
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private activeTool: 'pan' | 'select' | 'point' | 'line' | 'polygon' = 'pan';

  private layers: GisLayer[] = [];
  private features: GisFeature[] = [];
  private selectedIds: Set<string | number> = new Set();
  private crs: CRS = { authId: 'EPSG:4326', name: 'WGS 84', isGeographic: true };
  private animFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'grab';

    this.container.appendChild(this.canvas);
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to create 2D canvas context');
    }
    this.ctx = context;

    this.bindEvents();
    this.resize();
    this.render();
  }

  public resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(10, Math.floor(rect.width));
    this.height = Math.max(10, Math.floor(rect.height));
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.requestRender();
  }

  public setLayers(layers: GisLayer[]): void {
    this.layers = layers;
    this.requestRender();
  }

  public setFeatures(features: GisFeature[]): void {
    this.features = features;
    this.requestRender();
  }

  public setSelection(selectedIds: Set<string | number>): void {
    this.selectedIds = selectedIds;
    this.requestRender();
  }

  public setCrs(crs: CRS): void {
    this.crs = crs;
    this.requestRender();
  }

  public zoomIn(): void {
    this.setZoomLevel(this.zoom * 1.3);
  }

  public zoomOut(): void {
    this.setZoomLevel(this.zoom / 1.3);
  }

  public resetExtent(): void {
    this.centerLon = 15;
    this.centerLat = 35;
    this.setZoomLevel(2.5);
  }

  private setZoomLevel(newZoom: number): void {
    this.zoom = Math.max(0.2, Math.min(60, newZoom));
    zoomSignal.value = parseFloat(this.zoom.toFixed(2));
    // Approximate cartographic scale denominator
    const scale = Math.round(50000000 / this.zoom);
    scaleDenominatorSignal.value = scale;
    this.requestRender();
  }

  // Coordinate projection from Lon/Lat to Canvas pixels
  private geoToPixel(lon: number, lat: number): [number, number] {
    const scaleFactor = (this.width / 360) * this.zoom;
    const px = this.width / 2 + (lon - this.centerLon) * scaleFactor;
    const py = this.height / 2 - (lat - this.centerLat) * scaleFactor;
    return [px, py];
  }

  // Inverse projection from Canvas pixels to Lon/Lat
  private pixelToGeo(px: number, py: number): [number, number] {
    const scaleFactor = (this.width / 360) * this.zoom;
    const lon = this.centerLon + (px - this.width / 2) / scaleFactor;
    const lat = this.centerLat - (py - this.height / 2) / scaleFactor;
    return [lon, lat];
  }

  public setActiveTool(tool: 'pan' | 'select' | 'point' | 'line' | 'polygon'): void {
    this.activeTool = tool;
    this.updateCursor();
  }

  private updateCursor(): void {
    if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.activeTool === 'pan') {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.updateCursor();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        const scaleFactor = (this.width / 360) * this.zoom;
        this.centerLon -= dx / scaleFactor;
        this.centerLat += dy / scaleFactor;

        // Wrap longitude
        if (this.centerLon > 180) this.centerLon -= 360;
        if (this.centerLon < -180) this.centerLon += 360;
        // Clamp latitude
        this.centerLat = Math.max(-85, Math.min(85, this.centerLat));

        this.requestRender();
      }

      // DIRECT SIGNAL UPDATE: high-frequency cursor coordinates without React VDOM re-renders
      const [lon, lat] = this.pixelToGeo(px, py);
      cursorCoordsSignal.value = {
        lon: parseFloat(lon.toFixed(6)),
        lat: parseFloat(lat.toFixed(6)),
        x: Math.round(px),
        y: Math.round(py)
      };
    });

    this.canvas.addEventListener('mouseleave', () => {
      cursorCoordsSignal.value = null;
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        this.setZoomLevel(this.zoom * factor);
      },
      { passive: false }
    );
  }

  private requestRender(): void {
    if (this.animFrameId === null) {
      this.animFrameId = requestAnimationFrame(() => {
        this.animFrameId = null;
        this.render();
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Canvas Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.width, this.height);

    // Render geographic grid / graticule
    this.drawGraticule(ctx);

    // Render vector map layers
    this.drawFeatures(ctx);

    // Render viewport decoration (Compass, Scale Bar)
    this.drawOverlayDecorations(ctx);

    ctx.restore();
  }

  private drawGraticule(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillStyle = '#6b7280';
    ctx.font = '10pt -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const step = this.zoom > 10 ? 5 : this.zoom > 4 ? 15 : 30;

    // Meridians (Longitude lines)
    for (let lon = -180; lon <= 180; lon += step) {
      const [px] = this.geoToPixel(lon, 0);
      if (px >= 0 && px <= this.width) {
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, this.height);
        ctx.stroke();

        const label = lon === 0 ? '0°' : lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`;
        ctx.fillText(label, px + 4, this.height - 8);
      }
    }

    // Parallels (Latitude lines)
    for (let lat = -80; lat <= 80; lat += step) {
      const [, py] = this.geoToPixel(0, lat);
      if (py >= 0 && py <= this.height) {
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(this.width, py);
        ctx.stroke();

        const label = lat === 0 ? 'Equator' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`;
        ctx.fillText(label, 8, py - 4);
      }
    }
  }

  private drawFeatures(ctx: CanvasRenderingContext2D): void {
    if (this.features.length === 0 || this.layers.length === 0) return;

    ctx.save();
    ctx.font = '11pt -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const visibleLayersMap = new Map(
      this.layers.filter((l) => l.visible).map((l) => [l.id, l])
    );

    for (const feature of this.features) {
      const layer = visibleLayersMap.get(feature.layerId);
      if (!layer) continue;

      const isSelected = this.selectedIds.has(feature.id);
      const layerColor = layer.color || '#2563eb';
      const layerOpacity = layer.opacity ?? 1;

      ctx.globalAlpha = layerOpacity;

      if (layer.geometryKind === 'Point' && Array.isArray(feature.coordinates)) {
        const [lon, lat] = feature.coordinates as [number, number];
        const [px, py] = this.geoToPixel(lon, lat);

        if (px < -20 || px > this.width + 20 || py < -20 || py > this.height + 20) continue;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 13, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#2563eb' : layerColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (feature.properties?.name || feature.id) {
          const name = String(feature.properties?.name || feature.id);
          ctx.fillStyle = '#111827';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeText(name, px + 10, py + 4);
          ctx.fillText(name, px + 10, py + 4);
        }
      } else if (layer.geometryKind === 'Polygon' && Array.isArray(feature.coordinates)) {
        const rings = feature.coordinates as [number, number][][];
        if (rings.length > 0 && Array.isArray(rings[0])) {
          ctx.beginPath();
          rings[0].forEach(([lon, lat], idx) => {
            const [px, py] = this.geoToPixel(lon, lat);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.25)' : 'rgba(0, 0, 0, 0.08)';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : layerColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (layer.geometryKind === 'LineString' && Array.isArray(feature.coordinates)) {
        const points = feature.coordinates as [number, number][];
        if (points.length > 1) {
          ctx.beginPath();
          points.forEach(([lon, lat], idx) => {
            const [px, py] = this.geoToPixel(lon, lat);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.strokeStyle = isSelected ? '#2563eb' : layerColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  private drawOverlayDecorations(ctx: CanvasRenderingContext2D): void {
    // Scale Bar in bottom left
    const barWidth = 100;
    const [startLon] = this.pixelToGeo(20, this.height - 20);
    const [endLon] = this.pixelToGeo(20 + barWidth, this.height - 20);
    const distKm = Math.round(Math.abs(endLon - startLon) * 111.32);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(16, this.height - 34, 110, 22);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(20, this.height - 18);
    ctx.lineTo(20 + barWidth, this.height - 18);
    ctx.moveTo(20, this.height - 24);
    ctx.lineTo(20, this.height - 18);
    ctx.moveTo(20 + barWidth, this.height - 24);
    ctx.lineTo(20 + barWidth, this.height - 18);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = '10pt sans-serif';
    ctx.fillText(`${distKm} km • ${this.crs.authId}`, 24, this.height - 22);
    ctx.restore();
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.canvas.remove();
  }
}

/**
 * React Wrapper for Map Canvas.
 * STRICT ISOLATION BOUNDARY: React NEVER re-renders or touches the canvas DOM.
 */
export const MapViewportPanel: React.FC = React.memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ImperativeMapCanvasEngine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Imperative instantiation directly on the container DOM
    const engine = new ImperativeMapCanvasEngine(container);
    engineRef.current = engine;
    addConsoleLog('info', 'Hardware map viewport canvas instantiated.', 'MapEngine');

    // 2. Native ResizeObserver to resize canvas when Dockview splitters are dragged
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    resizeObserver.observe(container);

    // 3. Unidirectional Signal Bridge via @preact/signals-react effect()
    let lastActionTimestamp = 0;
    const disposeSignals = effect(() => {
      engine.setLayers(layersSignal.value);
      engine.setFeatures(featuresSignal.value);
      engine.setSelection(selectedFeatureIdsSignal.value);
      engine.setCrs(activeCrsSignal.value);
      engine.setActiveTool(activeToolSignal.value);

      const action = mapActionSignal.value;
      if (action && action.timestamp > lastActionTimestamp) {
        lastActionTimestamp = action.timestamp;
        if (action.action === 'zoomIn') {
          engine.zoomIn();
        } else if (action.action === 'zoomOut') {
          engine.zoomOut();
        } else if (action.action === 'reset') {
          engine.resetExtent();
        }
      }
    });

    // 4. Cleanup and context destruction
    return () => {
      disposeSignals();
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
      addConsoleLog('info', 'Map viewport canvas destroyed.', 'MapEngine');
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        userSelect: 'none'
      }}
    >
      {/* Floating Canvas Quick Controls (Zoom, Reset) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10
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
});

MapViewportPanel.displayName = 'MapViewportPanel';
