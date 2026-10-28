/**
 * @file SnappingOptionsDialog.tsx
 * @module renderer/workbench/dialogs/SnappingOptionsDialog
 * @description Modeless Dialog window providing advanced per-layer snapping matrix configuration (layers, vertices, segments, and pixel tolerances).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link isSnappingOptionsOpenSignal}
 * @see {@link projectLayersSignal}
 */

import React, { useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiTuneVariant } from "@mdi/js";
import {
  isSnappingOptionsOpenSignal,
  closeSnappingOptionsDialog,
  projectLayersSignal,
  layersSignal,
  snappingDistanceSignal,
} from "@renderer/state/gisSignals";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { Dialog } from "./Dialog";

/**
 * @typedef {Object} LayerSnappingConfig
 * @description Configuration properties governing per-layer snapping behavior.
 * @property {boolean} enabled - Whether snapping is enabled for this specific layer.
 * @property {boolean} vertices - Whether snapping to vertices is enabled for this layer.
 * @property {boolean} segments - Whether snapping to segments is enabled for this layer.
 * @property {number} tolerance - Snapping search tolerance radius in screen pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export interface LayerSnappingConfig {
  enabled: boolean;
  vertices: boolean;
  segments: boolean;
  tolerance: number;
}

/**
 * @component SnappingOptionsDialog
 * @description Modeless Dialog rendering a per-layer snapping matrix table with discrete vertex, segment, and tolerance controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Snapping Options dialog window element or null if closed.
 */
export const SnappingOptionsDialog: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const isOpen = isSnappingOptionsOpenSignal.value;

  const layers =
    projectLayersSignal.value.length > 0
      ? projectLayersSignal.value
      : layersSignal.value;

  const defaultTolerance = snappingDistanceSignal.value || 10;

  const [configs, setConfigs] = useState<Record<string, LayerSnappingConfig>>({});

  /**
   * @function getLayerConfig
   * @description Resolves active or default snapping configuration for a layer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {string} layerId - Unique layer identifier.
   * @returns {LayerSnappingConfig} Configuration descriptor.
   */
  const getLayerConfig = (layerId: string): LayerSnappingConfig => {
    return (
      configs[layerId] || {
        enabled: true,
        vertices: true,
        segments: false,
        tolerance: defaultTolerance,
      }
    );
  };

  /**
   * @function updateLayerConfig
   * @description Mutates a specific configuration property for a layer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {string} layerId - Unique layer identifier.
   * @param {Partial<LayerSnappingConfig>} updates - Updated property values.
   * @returns {void}
   */
  const updateLayerConfig = (
    layerId: string,
    updates: Partial<LayerSnappingConfig>
  ): void => {
    setConfigs((prev) => ({
      ...prev,
      [layerId]: {
        ...getLayerConfig(layerId),
        ...updates,
      },
    }));
  };

  return (
    <Dialog
      name='snappingOptionsWindow'
      title={t("snap_to_advanced") || "Snapping Options"}
      icon={mdiTuneVariant}
      isOpen={isOpen}
      onClose={closeSnappingOptionsDialog}
      onCancel={closeSnappingOptionsDialog}
      defaultWidth={600}
      defaultHeight={450}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
            gap: "0.5rem",
          }}>
          <button
            type='button'
            className='btn btn-secondary'
            id='snapping-options-close-button'
            onClick={closeSnappingOptionsDialog}
            style={{
              padding: "0.375rem 1rem",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}>
            Close
          </button>
        </div>
      }>
      <div
        className='snapping-options-dialog-body'
        style={{ padding: "1rem", backgroundColor: "#ffffff", color: "#000000" }}>
        <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem" }}>
          Configure layer-specific snapping tolerance and geometry targets:
        </p>

        {layers.length === 0 ? (
          <div
            className='snapping-options-empty'
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "#64748b",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "0.25rem",
            }}>
            No layers in project.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className='snapping-options-table'
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
                textAlign: "left",
              }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                  }}>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Layer</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    Snapping
                  </th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    Vertices
                  </th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    Segments
                  </th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                    Tolerance (px)
                  </th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => {
                  const cfg = getLayerConfig(layer.id);
                  return (
                    <tr
                      key={layer.id}
                      style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontWeight: 500,
                        }}>
                        {layer.name || layer.id}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "center",
                        }}>
                        <input
                          type='checkbox'
                          id={`snap-layer-enabled-${layer.id}`}
                          aria-label={`Enable snapping for ${layer.name || layer.id}`}
                          checked={cfg.enabled}
                          onChange={(e) =>
                            updateLayerConfig(layer.id, {
                              enabled: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "center",
                        }}>
                        <input
                          type='checkbox'
                          id={`snap-layer-vertices-${layer.id}`}
                          aria-label={`Snap to vertices for ${layer.name || layer.id}`}
                          checked={cfg.vertices}
                          disabled={!cfg.enabled}
                          onChange={(e) =>
                            updateLayerConfig(layer.id, {
                              vertices: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "center",
                        }}>
                        <input
                          type='checkbox'
                          id={`snap-layer-segments-${layer.id}`}
                          aria-label={`Snap to segments for ${layer.name || layer.id}`}
                          checked={cfg.segments}
                          disabled={!cfg.enabled}
                          onChange={(e) =>
                            updateLayerConfig(layer.id, {
                              segments: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "right",
                        }}>
                        <input
                          type='number'
                          id={`snap-layer-tolerance-${layer.id}`}
                          aria-label={`Snapping tolerance for ${layer.name || layer.id}`}
                          min={0}
                          max={256}
                          step={1}
                          value={cfg.tolerance}
                          disabled={!cfg.enabled}
                          onChange={(e) => {
                            const val = Math.min(
                              256,
                              Math.max(0, Number(e.target.value) || 0)
                            );
                            updateLayerConfig(layer.id, { tolerance: val });
                          }}
                          style={{
                            width: "4rem",
                            padding: "0.2rem 0.4rem",
                            textAlign: "right",
                            border: "1px solid #cbd5e1",
                            borderRadius: "0.2rem",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
};
