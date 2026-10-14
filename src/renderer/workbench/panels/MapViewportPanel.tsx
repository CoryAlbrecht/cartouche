/**
 * @file MapViewportPanel.tsx
 * @module renderer/workbench/panels/MapViewportPanel
 * @description Isolated OpenLayers map canvas viewport panel mounting MapController in an unmanaged container, strictly insulated from React Virtual DOM reconciliation loops.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link MapController}
 */

import React, { useEffect, useRef } from 'react';
import { MapController } from '@renderer/map/MapController';
import type { IDockviewPanelProps } from 'dockview-react';
import 'ol/ol.css';

/**
 * @component MapViewportPanel
 * @description Renders OpenLayers map viewport canvas inside Dockview layout with floating navigation controls, mounted via unmanaged DOM ref.
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
    const controllerRef = useRef<MapController | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Instantiate imperative MapController isolated from React VDOM
      const controller = new MapController(containerRef.current);
      controllerRef.current = controller;

      // Handle container resizing
      const observer = new ResizeObserver(() => {
        controller.resize();
      });
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
        controller.dispose();
        controllerRef.current = null;
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
          userSelect: 'none',
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
            zIndex: 10,
          }}
        >
          <button
            className="map-action-btn"
            title="Zoom In"
            onClick={() => controllerRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            className="map-action-btn"
            title="Zoom Out"
            onClick={() => controllerRef.current?.zoomOut()}
          >
            −
          </button>
          <button
            className="map-action-btn"
            title="Reset Extent"
            onClick={() => controllerRef.current?.resetExtent()}
          >
            ⟲
          </button>
        </div>
      </div>
    );
  }
);

MapViewportPanel.displayName = 'MapViewportPanel';
