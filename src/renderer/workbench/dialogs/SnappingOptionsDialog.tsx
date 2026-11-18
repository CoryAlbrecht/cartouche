/**
 * @file SnappingOptionsDialog.tsx
 * @module renderer/workbench/dialogs/SnappingOptionsDialog
 * @description Modeless Dialog window providing advanced per-layer snapping configuration (layers, vertices, segments, and pixel tolerances) as a Control Matrix: a hand-built per-layer table of independent settings, not a TableWidget. Colours, spacing and text sizes come from the `.snapping-options-*` classes in workbench.css, bound to the `--cartouche-snapping-options-*` Component Tokens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-17
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
 * @description Modeless Dialog rendering the per-layer snapping Control Matrix: one row per layer with independent enable, vertex, segment, and tolerance controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Snapping Options dialog window element or null if closed.
 */
export const SnappingOptionsDialog: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const isOpen = isSnappingOptionsOpenSignal.value;

  const layers =
    projectLayersSignal.value.length > 0 ?
      projectLayersSignal.value
    : layersSignal.value;

  const defaultTolerance = snappingDistanceSignal.value || 10;

  const [configs, setConfigs] = useState<Record<string, LayerSnappingConfig>>(
    {}
  );

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
      [layerId]: { ...getLayerConfig(layerId), ...updates },
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
        <div className='snapping-options-footer'>
          <button
            type='button'
            className='btn btn-secondary dialog-btn dialog-btn-wide dialog-btn-secondary'
            id='snapping-options-close-button'
            onClick={closeSnappingOptionsDialog}>
            Close
          </button>
        </div>
      }>
      <div className='snapping-options-dialog-body'>
        <p className='snapping-options-intro'>
          Configure layer-specific snapping tolerance and geometry targets:
        </p>

        {layers.length === 0 ?
          <div className='snapping-options-empty'>No layers in project.</div>
        : <div className='snapping-options-table-scroll'>
            <table className='snapping-options-table'>
              <thead>
                <tr className='snapping-options-header-row'>
                  <th className='snapping-options-cell'>Layer</th>
                  <th className='snapping-options-cell snapping-options-cell--center'>
                    Snapping
                  </th>
                  <th className='snapping-options-cell snapping-options-cell--center'>
                    Vertices
                  </th>
                  <th className='snapping-options-cell snapping-options-cell--center'>
                    Segments
                  </th>
                  <th className='snapping-options-cell snapping-options-cell--right'>
                    Tolerance (px)
                  </th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => {
                  const cfg = getLayerConfig(layer.id);
                  return (
                    <tr key={layer.id} className='snapping-options-row'>
                      <td className='snapping-options-cell snapping-options-cell--layer'>
                        {layer.name || layer.id}
                      </td>
                      <td className='snapping-options-cell snapping-options-cell--center'>
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
                      <td className='snapping-options-cell snapping-options-cell--center'>
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
                      <td className='snapping-options-cell snapping-options-cell--center'>
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
                      <td className='snapping-options-cell snapping-options-cell--right'>
                        <input
                          type='number'
                          id={`snap-layer-tolerance-${layer.id}`}
                          aria-label={`Snapping tolerance for ${layer.name || layer.id}`}
                          min={0}
                          max={256}
                          step={1}
                          className='snap-layer-tolerance-input'
                          value={cfg.tolerance}
                          disabled={!cfg.enabled}
                          onChange={(e) => {
                            const val = Math.min(
                              256,
                              Math.max(0, Number(e.target.value) || 0)
                            );
                            updateLayerConfig(layer.id, { tolerance: val });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      </div>
    </Dialog>
  );
};
