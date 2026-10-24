/**
 * @file LayerPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/LayerPropertiesDialog
 * @description Modeless dialog window inspecting layer metadata, provider driver descriptors, attribute field schemas, and configuring source parameters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link activeLayerPropertiesIdSignal}
 */

import React, { useCallback } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiInformationOutline,
  mdiTuneVariant,
  mdiTable,
  mdiClockOutline,
  mdiLayersOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiTrashCanOutline,
  mdiCalculator,
} from "@mdi/js";
import {
  activeLayerPropertiesIdSignal,
  activeLayerPropertiesTabSignal,
  layerDetailedInfoSignal,
  isLayerPropertiesLoadingSignal,
  layerPropertiesDraftSignal,
  closeLayerPropertiesDialog,
  cancelLayerPropertiesEdits,
  updateLayerPropertiesDraft,
  applyLayerPropertiesEdits,
  commitAndCloseLayerPropertiesDialog,
  POPULAR_CRS_OPTIONS,
  type LayerPropertiesTabId,
} from "@renderer/state/layerPropertiesSignals";
import { t } from "@renderer/state/i18nSignals";
import { Dialog } from "./Dialog";

/**
 * @typedef {Object} SidebarTabDef
 * @property {LayerPropertiesTabId} id - Tab identifier.
 * @property {string} labelKey - i18n translation key.
 * @property {string} icon - MDI SVG icon path.
 */
interface SidebarTabDef {
  id: LayerPropertiesTabId;
  labelKey: string;
  icon: string;
}

const SIDEBAR_TABS: SidebarTabDef[] = [
  { id: 'information', labelKey: 'layer_properties_tab_information', icon: mdiInformationOutline },
  { id: 'source', labelKey: 'layer_properties_tab_source', icon: mdiTuneVariant },
  { id: 'fields', labelKey: 'layer_properties_tab_fields', icon: mdiTable },
  { id: 'time_filter', labelKey: 'layer_properties_tab_time_filter', icon: mdiClockOutline },
];

/**
 * @component LayerPropertiesDialog
 * @description Modeless detached child window component rendering comprehensive GIS layer metadata, vector fields, and source configuration controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @returns {JSX.Element | null} The rendered modeless dialog or null if closed.
 */
export const LayerPropertiesDialog: React.FC = () => {
  useSignals();

  const activeId = activeLayerPropertiesIdSignal.value;
  const activeTab = activeLayerPropertiesTabSignal.value;
  const info = layerDetailedInfoSignal.value;
  const isLoading = isLayerPropertiesLoadingSignal.value;
  const draft = layerPropertiesDraftSignal.value;

  const handleClose = useCallback(() => {
    closeLayerPropertiesDialog();
  }, []);

  const handleCancel = useCallback(() => {
    cancelLayerPropertiesEdits();
  }, []);

  const handleApply = useCallback(async () => {
    await applyLayerPropertiesEdits();
  }, []);

  const handleOk = useCallback(async () => {
    await commitAndCloseLayerPropertiesDialog();
  }, []);

  if (!activeId) {
    return null;
  }

  const dialogTitle = `${t('layer_properties_dialog_title')} — ${info?.name || draft.layerName || activeId}`;

  return (
    <Dialog
      name="layerPropertiesWindow"
      title={dialogTitle}
      icon={mdiLayersOutline}
      isOpen={Boolean(activeId)}
      onClose={handleClose}
      onCancel={handleCancel}
      defaultWidth={860}
      defaultHeight={620}
      footer={
        <div
          className="layer-properties-footer"
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            className="layer-properties-btn cancel"
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}
          >
            {t('layer_properties_btn_cancel')}
          </button>
          <button
            type="button"
            className="layer-properties-btn apply"
            onClick={handleApply}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}
          >
            {t('layer_properties_btn_apply')}
          </button>
          <button
            type="button"
            className="layer-properties-btn ok"
            onClick={handleOk}
            style={{
              padding: "6px 16px",
              backgroundColor: "#1b446c",
              border: "1px solid #1b446c",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#ffffff",
            }}
          >
            {t('layer_properties_btn_ok')}
          </button>
        </div>
      }
    >
      <div
        className="layer-properties-container"
        style={{
          display: "flex",
          flex: 1,
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          color: "#000000",
        }}
      >
        {/* Left Sidebar Tabs */}
        <div
          className="layer-properties-sidebar"
          style={{
            width: "13rem",
            borderRight: "1px solid #cbd5e1",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px",
            flexShrink: 0,
          }}
        >
          {SIDEBAR_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`layer-properties-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  activeLayerPropertiesTabSignal.value = tab.id;
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.75rem",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: isActive ? "#e2e8f0" : "transparent",
                  color: isActive ? "#0f172a" : "#475569",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Icon
                  path={tab.icon}
                  size="calc(var(--cartouche-ui-icon-size, 24px) * 0.75)"
                />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tab Content */}
        <div
          className="layer-properties-content"
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.25rem",
            gap: "1rem",
            minHeight: 0,
          }}
        >
          {isLoading && (
            <div
              className="layer-properties-loading"
              style={{ padding: "1rem", color: "#64748b", fontStyle: "italic" }}
            >
              {t('layer_properties_loading')}
            </div>
          )}

          {activeTab === 'information' && (
            <div
              className="layer-properties-tab-pane information"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* General Group */}
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_group_general')}
                </legend>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_name')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000" }}>
                    {info?.name || draft.layerName || '—'}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_id')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000", fontFamily: "monospace" }}>
                    {info?.layerId || activeId}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_source')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000", wordBreak: "break-all" }}>
                    {info?.source || '—'}
                  </span>
                </div>
              </fieldset>

              {/* Provider Information Group */}
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_group_provider')}
                </legend>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_driver')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000" }}>
                    {info?.driverName || '—'}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_geometry')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000" }}>
                    {info?.geometryKind || '—'}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_feature_count')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000" }}>
                    {info?.featureCount !== undefined ? info.featureCount.toLocaleString() : '—'}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_crs')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000" }}>
                    {info?.crsDescription || '—'}
                  </span>
                </div>
                <div className="layer-properties-row" style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span className="layer-properties-label" style={{ width: "12rem", fontWeight: 500, color: "#334155" }}>
                    {t('layer_properties_label_extent')}:
                  </span>
                  <span className="layer-properties-value" style={{ flex: 1, color: "#000000", fontFamily: "monospace" }}>
                    {info?.extent
                      ? `[${info.extent.map((n: number) => Number(n).toFixed(4)).join(", ")}]`
                      : '—'}
                  </span>
                </div>
              </fieldset>

              {/* Fields Group */}
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_group_fields')}
                </legend>
                <div
                  className="layer-properties-table-container"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    overflow: "auto",
                    maxHeight: "18rem",
                  }}
                >
                  <table
                    className="layer-properties-fields-table"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_name')}
                        </th>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_native_type')}
                        </th>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_length')}
                        </th>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_precision')}
                        </th>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_ts_type')}
                        </th>
                        <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                          {t('layer_properties_field_col_nullable')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!info?.fields || info.fields.length === 0) ? (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              color: "#64748b",
                              fontStyle: "italic",
                            }}
                          >
                            No attribute fields found for this layer.
                          </td>
                        </tr>
                      ) : (
                        info.fields.map((field) => (
                          <tr key={field.name} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                              {field.name}
                            </td>
                            <td style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.nativeType}
                            </td>
                            <td style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.width !== undefined && field.width > 0 ? field.width : '—'}
                            </td>
                            <td style={{ padding: "6px 10px", color: "#475569" }}>
                              {field.precision !== undefined && field.precision > 0 ? field.precision : '—'}
                            </td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0f766e" }}>
                              {field.mappedType}
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              {field.nullable ? t('layer_properties_yes') : t('layer_properties_no')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === 'source' && (
            <div
              className="layer-properties-tab-pane source"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_source_group_general')}
                </legend>
                {/* Layer Name Input */}
                <div className="layer-properties-input-row" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="layer-prop-name" style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}>
                    {t('layer_properties_source_layer_name')}
                  </label>
                  <input
                    id="layer-prop-name"
                    type="text"
                    value={draft.layerName}
                    onChange={(e) => updateLayerPropertiesDraft({ layerName: e.target.value })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>

                {/* Layer ID Input with Validation */}
                <div className="layer-properties-input-row" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="layer-prop-id" style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}>
                    {t('layer_properties_source_layer_id')}
                  </label>
                  <input
                    id="layer-prop-id"
                    type="text"
                    value={draft.layerId}
                    onChange={(e) => updateLayerPropertiesDraft({ layerId: e.target.value })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: draft.idValidationError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                  {draft.idValidationError && (
                    <span className="layer-prop-validation-error" style={{ color: "#ef4444", fontSize: "0.75rem", fontWeight: 500 }}>
                      {draft.idValidationError}
                    </span>
                  )}
                </div>

                {/* Assigned CRS Selector */}
                <div className="layer-properties-input-row" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="layer-prop-crs" style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}>
                    {t('layer_properties_source_crs')}
                  </label>
                  <select
                    id="layer-prop-crs"
                    value={draft.crsAuthId}
                    onChange={(e) => updateLayerPropertiesDraft({ crsAuthId: e.target.value })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {POPULAR_CRS_OPTIONS.map((crs) => (
                      <option key={crs.authId} value={crs.authId}>
                        {crs.authId} — {crs.name}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              {/* Provider Feature Filter Fieldset */}
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_source_group_filter')}
                </legend>
                <div className="layer-properties-input-row" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <textarea
                    id="layer-prop-feature-filter"
                    rows={4}
                    value={draft.featureFilter}
                    placeholder={t('layer_properties_source_filter_placeholder')}
                    onChange={(e) => updateLayerPropertiesDraft({ featureFilter: e.target.value })}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8125rem",
                      fontFamily: "monospace",
                      resize: "vertical",
                      lineHeight: 1.4,
                    }}
                  />
                  <span
                    className="layer-prop-dialect-caption"
                    style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}
                  >
                    {info?.driverDialect === 'ogr_sql'
                      ? t('layer_properties_dialect_ogr_sql')
                      : info?.driverDialect === 'native_sql'
                      ? t('layer_properties_dialect_native_sql')
                      : info?.driverDialect === 'nosql'
                      ? t('layer_properties_dialect_nosql')
                      : t('layer_properties_dialect_generic')}
                  </span>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === 'fields' && (
            <div
              className="layer-properties-tab-pane fields"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* Appearance-only Action Toolbar */}
              <div
                className="layer-properties-fields-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "4px 8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                }}
              >
                <button
                  type="button"
                  className="layer-prop-toolbar-btn toggle-edit"
                  title={t('layer_properties_fields_toggle_edit')}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  <Icon path={mdiPencilOutline} size="14px" />
                  <span>{t('layer_properties_fields_toggle_edit')}</span>
                </button>
                <button
                  type="button"
                  className="layer-prop-toolbar-btn new-field"
                  title={t('layer_properties_fields_new_field')}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  <Icon path={mdiPlus} size="14px" />
                  <span>{t('layer_properties_fields_new_field')}</span>
                </button>
                <button
                  type="button"
                  className="layer-prop-toolbar-btn delete-field"
                  title={t('layer_properties_fields_delete_field')}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  <Icon path={mdiTrashCanOutline} size="14px" />
                  <span>{t('layer_properties_fields_delete_field')}</span>
                </button>
                <button
                  type="button"
                  className="layer-prop-toolbar-btn calculate"
                  title={t('layer_properties_fields_calculate')}
                  style={{
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  <Icon path={mdiCalculator} size="14px" />
                  <span>{t('layer_properties_fields_calculate')}</span>
                </button>
              </div>

              {/* Fields Data Table */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.8125rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#f8fafc",
                        textAlign: "left",
                        color: "#475569",
                      }}
                    >
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                        {t('layer_properties_field_col_name')}
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                        {t('layer_properties_field_col_native_type')}
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                        {t('layer_properties_field_col_length')}
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                        {t('layer_properties_field_col_precision')}
                      </th>
                      <th style={{ padding: "6px 10px", borderBottom: "1px solid #cbd5e1" }}>
                        {t('layer_properties_fields_col_comment')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!info?.fields || info.fields.length === 0) ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#64748b",
                            fontStyle: "italic",
                          }}
                        >
                          No attribute fields found.
                        </td>
                      </tr>
                    ) : (
                      info.fields.map((field) => (
                        <tr key={field.name} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                            {field.name}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {field.nativeType}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {field.width !== undefined && field.width > 0 ? field.width : '—'}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#475569" }}>
                            {field.precision !== undefined && field.precision > 0 ? field.precision : '—'}
                          </td>
                          <td style={{ padding: "6px 10px", color: "#64748b", fontStyle: "italic" }}>
                            —
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'time_filter' && (
            <div
              className="layer-properties-tab-pane time-filter"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <fieldset className="preference-group-box">
                <legend className="preference-group-legend">
                  {t('layer_properties_tab_time_filter')}
                </legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      id="layer-prop-time-enable"
                      type="checkbox"
                      defaultChecked={false}
                    />
                    <span>{t('layer_properties_time_enable')}</span>
                  </label>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label
                      htmlFor="layer-prop-time-mode"
                      style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}
                    >
                      {t('layer_properties_time_mode')}
                    </label>
                    <select
                      id="layer-prop-time-mode"
                      defaultValue="single"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <option value="single">{t('layer_properties_time_mode_single')}</option>
                      <option value="separate">{t('layer_properties_time_mode_separate')}</option>
                      <option value="fixed">{t('layer_properties_time_mode_fixed')}</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label
                      htmlFor="layer-prop-time-start"
                      style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}
                    >
                      {t('layer_properties_time_start_field')}
                    </label>
                    <select
                      id="layer-prop-time-start"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <option value="">—</option>
                      {(info?.fields || []).map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.nativeType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label
                      htmlFor="layer-prop-time-end"
                      style={{ fontWeight: 500, fontSize: "0.875rem", color: "#334155" }}
                    >
                      {t('layer_properties_time_end_field')}
                    </label>
                    <select
                      id="layer-prop-time-end"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <option value="">—</option>
                      {(info?.fields || []).map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.nativeType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default LayerPropertiesDialog;
