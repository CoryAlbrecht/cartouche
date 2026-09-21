import React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  activeLayerSignal,
  activeLayerFeaturesSignal,
  selectedFeatureIdsSignal,
  toggleFeatureSelection,
  clearSelection
} from '@renderer/state/gisSignals';

export const AttributeTablePanel: React.FC = () => {
  useSignals();
  const activeLayer = activeLayerSignal.value;
  const features = activeLayerFeaturesSignal.value;
  const selectedIds = selectedFeatureIdsSignal.value;

  if (!activeLayer) {
    return (
      <div className="empty-panel-message">
        Select a layer from the Layers panel to inspect attributes.
      </div>
    );
  }

  // Derive attribute column headers
  const attributeKeys = features.length > 0 ? Object.keys(features[0].properties) : [];

  return (
    <div className="attribute-table-container">
      <div className="attribute-table-header">
        <span className="table-title">
          <strong>{activeLayer.name}</strong> — {features.length} features ({selectedIds.size} selected)
        </span>
        <div className="table-actions">
          {selectedIds.size > 0 && (
            <button className="small-action-btn" onClick={clearSelection}>
              Deselect All
            </button>
          )}
        </div>
      </div>

      <div className="table-scroll-wrapper">
        <table className="gis-data-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center' }}>#</th>
              <th style={{ width: 60 }}>ID</th>
              <th style={{ width: 90 }}>Type</th>
              {attributeKeys.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature, index) => {
              const isSelected = selectedIds.has(feature.id);
              return (
                <tr
                  key={feature.id}
                  className={isSelected ? 'selected-row' : ''}
                  onClick={() => toggleFeatureSelection(feature.id)}
                >
                  <td style={{ textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFeatureSelection(feature.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>{index + 1}</span>
                    </label>
                  </td>
                  <td className="cell-id">{feature.id}</td>
                  <td>
                    <span className="geometry-badge">{feature.geometryType}</span>
                  </td>
                  {attributeKeys.map((key) => (
                    <td key={key}>{String(feature.properties[key] ?? '')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
