/**
 * @file MapViewportPanel.tsx
 * @module renderer/workbench/panels/MapViewportPanel
 * @description Isolated OpenLayers map canvas viewport panel mounting MapController in an unmanaged container, strictly insulated from React Virtual DOM reconciliation loops.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link MapController}
 */

import React, { useEffect, useRef } from 'react';
import { MapController } from '@renderer/map/MapController';
import type { IDockviewPanelProps } from 'dockview-react';
import 'ol/ol.css';

/**
 * @component MapViewportPanel
 * @description Renders unobstructed OpenLayers map viewport canvas inside Dockview layout, mounted via unmanaged DOM ref.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {IDockviewPanelProps} props - Dockview panel properties.
 * @returns {React.ReactElement} Map viewport panel element.
 */
export const MapViewportPanel: React.FC<IDockviewPanelProps | any> = React.memo(
  () => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Instantiate imperative MapController isolated from React VDOM
      const controller = new MapController(containerRef.current);

      // Handle container resizing
      const observer = new ResizeObserver(() => {
        controller.resize();
      });
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
        controller.dispose();
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
      />
    );
  }
);

MapViewportPanel.displayName = 'MapViewportPanel';
