import React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  layersSignal,
  activeLayerIdSignal,
  hasProjectSignal,
  toggleLayerVisibility,
  setLayerOpacity,
  setActiveLayer,
  visibleLayersCountSignal
} from '@renderer/state/gisSignals';
import type { GeometryKind } from '@shared/types';

function getGeometryIcon(kind?: GeometryKind) {
  switch (kind) {
    case 'Point':
      return '●';
    case 'LineString':
      return '╱';
    case 'Polygon':
      return '▰';
    case 'Raster':
      return '▦';
    default:
      return '▪';
  }
}

export const LayerTreePanel: React.FC = () => {
  useSignals();
  const layers = layersSignal.value;
  const hasProject = hasProjectSignal.value;
  const activeLayerId = activeLayerIdSignal.value;
  const visibleCount = visibleLayersCountSignal.value;

  return (
    <div className="layer-tree-panel">
      <div className="panel-toolbar">
        <span className="panel-subtitle">
          Layers ({visibleCount}/{layers.length} visible)
        </span>
        <div className="panel-toolbar-actions">
          <button
            className="icon-btn"
            title="Filter Layers"
            onClick={() => console.log('Filter')}
          >
            🔍
          </button>
          <button
            className="icon-btn"
            title="Add Group"
            onClick={() => console.log('Add group')}
          >
            📁
          </button>
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="empty-layers-state">
          <div className="empty-layers-title">{hasProject ? 'No layers' : 'No project'}</div>
          <div className="empty-layers-desc">
            {hasProject
              ? 'Add a vector or raster layer from the Layers menu.'
              : 'Create or open a project to load and manage map layers.'}
          </div>
        </div>
      ) : (
        <div className="layers-tree-list">
        {layers.map((layer) => {
          const isActive = layer.id === activeLayerId;

          return (
            <div
              key={layer.id}
              className={`layer-tree-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => toggleLayerVisibility(layer.id)}
                onClick={(e) => e.stopPropagation()}
                title="Toggle visibility"
              />

              <span
                className="layer-kind-icon"
                style={{ color: layer.color }}
                title={`${layer.geometryKind || layer.kind} layer`}
              >
                {getGeometryIcon(layer.geometryKind)}
              </span>

              <div className="layer-details">
                <span className="layer-name">{layer.name}</span>
                <div className="layer-meta">
                  <span>{layer.featureCount} features</span>
                  <div
                    className="opacity-control"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label>Opacity:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={layer.opacity}
                      onChange={(e) =>
                        setLayerOpacity(layer.id, parseFloat(e.target.value))
                      }
                      title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
