/**
 * @file LayerPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/LayerPropertiesDialog
 * @description Modeless dialog window inspecting layer metadata, provider driver descriptors, attribute field schemas, and configuring source parameters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link ModalDialog}
 * @see {@link TabbedDialogShell}
 * @see {@link StyleEditor}
 * @see {@link activeLayerPropertiesIdSignal}
 */

import React, { useState, useCallback, useEffect } from "react";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiInformationOutline,
  mdiTuneVariant,
  mdiTable,
  mdiClockOutline,
  mdiPencilOutline,
  mdiTablePlus,
  mdiTrashCanOutline,
  mdiCalculator,
  mdiPaletteOutline,
  mdiCodeTags,
  mdiUndo,
  mdiGreaterThan,
  mdiGreaterThanOrEqual,
  mdiLessThan,
  mdiLessThanOrEqual,
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
  findLayerInTree,
  POPULAR_CRS_OPTIONS,
  isDiscardFieldChangesModalOpenSignal,
  discardUnappliedFieldChanges,
  type LayerPropertiesTabId,
} from "@renderer/state/layerPropertiesSignals";
import {
  projectLayersSignal,
  projectTreeSignal,
} from "@renderer/state/projectSignals";
import {
  type InferredFieldType,
  type LayerFieldInfo,
  type LayerTemporalConfig,
  CANONICAL_INFERRED_FIELD_TYPES,
} from "@shared/types";
import { t } from "@renderer/state/i18nSignals";
import {
  preferencesMapSignal,
  updatePreference,
} from "@renderer/state/preferencesSignals";
import {
  editableLayerIdsSignal,
  toggleLayerEditingAction,
  isLayerInEditMode,
} from "@renderer/state/gisSignals";
import { Dialog } from "./Dialog";
import { TabbedDialogShell, type TabbedDialogTabDef } from "./TabbedDialogShell";
import { ModalDialog } from "./ModalDialog";
import { StyleEditor } from "./StyleEditor";
import { crsCatalogueSignal, listCrsChooserEntries } from "@renderer/state/crsCatalogueSignals";
import { formatCrsEntryLabel } from "@shared/types/crs";
import {
  TableWidget,
  TableTextEditor,
  type TableCellEdit,
  type TableColumn,
  type TableRowId,
} from "@renderer/workbench/widgets/TableWidget";



/**
 * Raw style text editor history hook and its types/constants now live in {@link StyleEditor}; they are re-exported here for existing importers.
 */
export {
  useRawStyleTextEditorHistory,
  MAX_RAW_STYLE_HISTORY_SIZE,
  DEFAULT_RAW_STYLE_VALIDATION_DEBOUNCE_MS,
  type StyleTextHistoryEntry,
  type UseRawStyleTextEditorHistoryOptions,
  type UseRawStyleTextEditorHistoryResult,
} from "./StyleEditor";

/**
 * Names of well-known CRSs keyed by upper-cased `AUTH:code`, used to label the current CRS while the CRS Catalogue is still building.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {Record<string, string>}
 */
const POPULAR_CRS_NAMES: Record<string, string> = Object.fromEntries(
  POPULAR_CRS_OPTIONS.map((c) => [c.authId.toUpperCase(), c.name])
);

/**
 * @typedef {Object} SidebarTabDef
 * @description Static sidebar tab definition; resolved into a {@link TabbedDialogTabDef} (label translated) on every render.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-12
 * @since 0.1.0-dev
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
  {
    id: "information",
    labelKey: "layer_properties_tab_information",
    icon: mdiInformationOutline,
  },
  {
    id: "source",
    labelKey: "layer_properties_tab_source",
    icon: mdiTuneVariant,
  },
  {
    id: "styling",
    labelKey: "layer_properties_tab_styling",
    icon: mdiPaletteOutline,
  },
  { id: "fields", labelKey: "layer_properties_tab_fields", icon: mdiTable },
  {
    id: "time_filter",
    labelKey: "layer_properties_tab_time_filter",
    icon: mdiClockOutline,
  },
];

/**
 * @function resolveFieldIndex
 * @description Resolves the stable 0-based field index, anchoring physical GDAL slots and incrementing virtual fields.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field metadata.
 * @param {LayerFieldInfo[]} allFields - Full fields collection.
 * @param {number} fallbackIndex - Array index fallback.
 * @returns {number} Resolved 0-based integer index.
 */
export function resolveFieldIndex(
  field: LayerFieldInfo,
  allFields: LayerFieldInfo[],
  fallbackIndex: number
): number {
  if (typeof field.index === "number") {
    return field.index;
  }
  const physicalFields = allFields.filter((f) => !f.isVirtual);
  const physicalCount = physicalFields.length;
  if (!field.isVirtual) {
    const physIdx = physicalFields.indexOf(field);
    return physIdx >= 0 ? physIdx : fallbackIndex;
  }
  const virtualFields = allFields.filter((f) => f.isVirtual);
  const virtIdx = virtualFields.indexOf(field);
  return physicalCount + (virtIdx >= 0 ? virtIdx : 0);
}

/**
 * @typedef {'width' | 'precision' | 'comment'} EditableFieldColumn
 * @description Editable attribute schema column identifiers on the Fields tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 */
export type EditableFieldColumn = "width" | "precision" | "comment";

/**
 * @function resolveFieldColumnStringValue
 * @description Extracts the string representation of an editable column value for inline input initialization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field metadata.
 * @param {EditableFieldColumn} column - Target column to evaluate.
 * @returns {string} String representation of cell value.
 */
export function resolveFieldColumnStringValue(
  field: LayerFieldInfo,
  column: EditableFieldColumn
): string {
  if (column === "comment") {
    return field.comment || "";
  }
  const val = field[column];
  return val !== undefined && val > 0 ? String(val) : "";
}

/**
 * @function isFieldColumnEditable
 * @description Evaluates whether an attribute schema column is editable for the specified field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field info.
 * @param {EditableFieldColumn} column - Target column to evaluate.
 * @returns {boolean} True if the column is editable for this field type.
 */
export function isFieldColumnEditable(
  field: LayerFieldInfo,
  column: EditableFieldColumn
): boolean {
  const effectiveType = effectiveFieldType(field);

  switch (column) {
    case "width":
      return (
        effectiveType === "string" ||
        effectiveType === "integer" ||
        effectiveType === "real"
      );
    case "precision":
      return effectiveType === "real";
    case "comment":
      return true;
    default:
      return false;
  }
}

/**
 * @function getEditableColumnsForField
 * @description Returns the sequence of editable columns available for a given field type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Target layer field info.
 * @returns {EditableFieldColumn[]} Ordered array of editable column names.
 */
export function getEditableColumnsForField(
  field: LayerFieldInfo
): EditableFieldColumn[] {
  const columns: EditableFieldColumn[] = [];
  if (isFieldColumnEditable(field, "width")) {
    columns.push("width");
  }
  if (isFieldColumnEditable(field, "precision")) {
    columns.push("precision");
  }
  if (isFieldColumnEditable(field, "comment")) {
    columns.push("comment");
  }
  return columns;
}

/**
 * @function unsortable
 * @description Turns sorting off for every column of a LayerPropertiesDialog fields table: neither table sorts, so headers show no sort chevrons and header clicks do nothing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableColumn<LayerFieldInfo>[]} columns - Column definitions.
 * @returns {TableColumn<LayerFieldInfo>[]} The columns, each with `sortable: false`.
 */
function unsortable(columns: TableColumn<LayerFieldInfo>[]): TableColumn<LayerFieldInfo>[] {
  return columns.map((column) => ({ ...column, sortable: false }));
}

/**
 * @function isEditableFieldColumn
 * @description Whether a Fields tab table column key names one of the editable schema columns (Length, Precision, Comment).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string} key - Column key.
 * @returns {boolean} True for `width`, `precision` and `comment`.
 */
export function isEditableFieldColumn(key: string): key is EditableFieldColumn {
  return key === "width" || key === "precision" || key === "comment";
}

/**
 * @function effectiveFieldType
 * @description Returns a field's canonical data type: its inferred type, else one derived from its mapped type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Field metadata.
 * @returns {InferredFieldType} The field's data type.
 */
function effectiveFieldType(field: LayerFieldInfo): InferredFieldType {
  return (
    field.inferredType ??
    (field.mappedType === "number" ? "real"
    : field.mappedType === "boolean" ? "boolean"
    : "string")
  );
}

/**
 * @callback FieldTypeChangeHandler
 * @description Changes a field's data type.
 * @param {string} fieldName - Field name.
 * @param {InferredFieldType} newType - New data type.
 * @returns {void}
 */
type FieldTypeChangeHandler = (fieldName: string, newType: InferredFieldType) => void;

/**
 * @function stopTablePropagation
 * @description Keeps a click or key on a control inside a table cell from reaching the TableWidget, so using the control neither changes the row selection nor moves the Active Row.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {React.SyntheticEvent} event - The control's event.
 * @returns {void}
 */
function stopTablePropagation(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

/**
 * @component FieldTypeControls
 * @description The Fields tab Data Type cell: the field's data type select (enabled in Layer Edit Mode), the "User" badge on overridden fields, and the Reset Type button (enabled in Layer Edit Mode on an overridden field). Its clicks and keys stay in the cell.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {Object} props - Component properties.
 * @param {LayerFieldInfo} props.field - The cell's field.
 * @param {boolean} props.isEditing - Whether the layer is in Layer Edit Mode.
 * @param {FieldTypeChangeHandler} props.onTypeChange - Changes the field's data type.
 * @param {(fieldName: string) => void} props.onResetType - Resets the field's data type.
 * @returns {JSX.Element} The cell content.
 */
const FieldTypeControls: React.FC<{
  field: LayerFieldInfo;
  isEditing: boolean;
  onTypeChange: FieldTypeChangeHandler;
  onResetType: (fieldName: string) => void;
}> = ({ field, isEditing, onTypeChange, onResetType }) => {
  const isOverridden = Boolean(
    field.userOverridden ||
      (field.originalInferredType && field.inferredType !== field.originalInferredType)
  );
  return (
    <div
      className='layer-field-type-controls'
      style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <select
        className={`layer-field-type-select${field.userOverridden ? " is-overridden" : ""}`}
        aria-label={`Field type for ${field.name}`}
        disabled={!isEditing}
        value={effectiveFieldType(field)}
        onClick={stopTablePropagation}
        onDoubleClick={stopTablePropagation}
        onKeyDown={stopTablePropagation}
        onChange={(e) => onTypeChange(field.name, e.target.value as InferredFieldType)}>
        {CANONICAL_INFERRED_FIELD_TYPES.map((typeOption) => (
          <option key={typeOption} value={typeOption}>
            {typeOption}
          </option>
        ))}
      </select>
      {field.userOverridden && <FieldOverrideBadge />}
      <button
        type='button'
        className='layer-field-reset-type-btn'
        title={t("layer_properties_fields_reset_type")}
        aria-label={t("layer_properties_fields_reset_type")}
        disabled={!(isEditing && isOverridden)}
        onDoubleClick={stopTablePropagation}
        onKeyDown={stopTablePropagation}
        onClick={(e) => {
          e.stopPropagation();
          onResetType(field.name);
        }}>
        <Icon path={mdiUndo} size='1rem' />
      </button>
    </div>
  );
};

/**
 * @typedef {Object} FieldsTabColumnOptions
 * @property {boolean} showNativeType - Whether to show the Native Type column.
 * @property {boolean} isEditing - Whether the layer is in Layer Edit Mode.
 * @property {FieldTypeChangeHandler} onTypeChange - Changes a field's data type.
 * @property {(fieldName: string) => void} onResetType - Resets a field's data type.
 */
interface FieldsTabColumnOptions {
  showNativeType: boolean;
  isEditing: boolean;
  onTypeChange: FieldTypeChangeHandler;
  onResetType: (fieldName: string) => void;
}

/**
 * @function fieldsTabColumns
 * @description Column definitions of the Fields tab table (Ticket #331): Index (the field's stable 0-based slot), Field Name, Data Type (type select, badge and Reset Type button), Native Type when shown, and the editable Length, Precision and Comment columns, which use the text editor so a value can be cleared. No column sorts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {LayerFieldInfo[]} fields - The layer's fields, for resolving indices.
 * @param {FieldsTabColumnOptions} options - Column options.
 * @returns {TableColumn<LayerFieldInfo>[]} The columns.
 */
function fieldsTabColumns(
  fields: LayerFieldInfo[],
  { showNativeType, isEditing, onTypeChange, onResetType }: FieldsTabColumnOptions
): TableColumn<LayerFieldInfo>[] {
  const columns: TableColumn<LayerFieldInfo>[] = [
    {
      key: "index",
      header: t("layer_properties_field_col_index"),
      align: "right",
      readOnly: true,
      value: (field) => resolveFieldIndex(field, fields, fields.indexOf(field)),
    },
    { key: "name", header: t("layer_properties_field_col_name"), readOnly: true },
    {
      key: "dataType",
      header: t("layer_properties_fields_col_data_type"),
      readOnly: true,
      value: effectiveFieldType,
      display: (_value, field) => (
        <FieldTypeControls
          field={field}
          isEditing={isEditing}
          onTypeChange={onTypeChange}
          onResetType={onResetType}
        />
      ),
    },
  ];
  if (showNativeType) {
    columns.push({
      key: "nativeType",
      header: t("layer_properties_field_col_native_type"),
      readOnly: true,
    });
  }
  columns.push(
    {
      key: "width",
      header: t("layer_properties_field_col_length"),
      value: (field) => positiveOrUndefined(field.width),
      editor: TableTextEditor,
    },
    {
      key: "precision",
      header: t("layer_properties_field_col_precision"),
      value: (field) => positiveOrUndefined(field.precision),
      editor: TableTextEditor,
    },
    {
      key: "comment",
      header: t("layer_properties_fields_col_comment"),
      value: (field) => field.comment || "",
      editor: TableTextEditor,
    }
  );
  return unsortable(columns);
}

/**
 * @function fieldRowId
 * @description Returns a field's TableWidget row ID: its name, unique within a layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {LayerFieldInfo} field - Field metadata.
 * @returns {TableRowId} The field's row ID.
 */
export function fieldRowId(field: LayerFieldInfo): TableRowId {
  return field.name;
}

/**
 * @function positiveOrUndefined
 * @description Returns a Length or Precision value when it is set and above zero, otherwise undefined, so the cell shows empty for a missing or zero value.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {number | undefined} value - The field's width or precision.
 * @returns {number | undefined} The value, or undefined.
 */
function positiveOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

/**
 * @component FieldOverrideBadge
 * @description The "User" badge marking a field whose type or schema values the user has overridden.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @returns {JSX.Element} The badge.
 */
const FieldOverrideBadge: React.FC = () => (
  <span
    className='layer-field-override-badge'
    title='Field type manually overridden by user'>
    User
  </span>
);

/**
 * @function informationFieldColumns
 * @description Column definitions of the Information tab's read-only fields table (Ticket #331): Field Name, Native Type, Inferred Type (with the "User" badge on overridden fields), Length, Precision and Nullable. No column sorts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @returns {TableColumn<LayerFieldInfo>[]} The columns.
 */
function informationFieldColumns(): TableColumn<LayerFieldInfo>[] {
  return unsortable([
    { key: "name", header: t("layer_properties_field_col_name") },
    { key: "nativeType", header: t("layer_properties_field_col_native_type") },
    {
      key: "inferredType",
      header: t("layer_properties_field_col_inferred_type"),
      value: (field) => field.inferredType ?? field.mappedType,
      display: (value, field) => (
        <>
          <span className='layer-field-type-text'>{String(value ?? "")}</span>
          {field.userOverridden && <FieldOverrideBadge />}
        </>
      ),
    },
    {
      key: "width",
      header: t("layer_properties_field_col_length"),
      value: (field) => positiveOrUndefined(field.width),
    },
    {
      key: "precision",
      header: t("layer_properties_field_col_precision"),
      value: (field) => positiveOrUndefined(field.precision),
    },
    {
      key: "nullable",
      header: t("layer_properties_field_col_nullable"),
      value: (field) => Boolean(field.nullable),
      display: (value) =>
        value ? t("layer_properties_yes") : t("layer_properties_no"),
    },
  ]);
}

/**
 * @component LayerPropertiesDialog
 * @description Modeless detached child window component rendering comprehensive GIS layer metadata, vector fields, and source configuration controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-16
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

  const currentProjectLayer = activeId ? projectLayersSignal.value.find((l) => l.id === activeId) : undefined;
  const currentTreeLayer = activeId ? findLayerInTree(projectTreeSignal.value, activeId) : undefined;
  const layerFields: LayerFieldInfo[] =
    draft.fields ??
    currentProjectLayer?.fields ??
    (currentTreeLayer && 'fields' in currentTreeLayer ? (currentTreeLayer as any).fields : undefined) ??
    info?.fields ??
    [];

  const isEditing = isLayerInEditMode(activeId, editableLayerIdsSignal.value);
  const informationSelectedFieldNames = useSignal<Set<TableRowId>>(new Set());
  const informationActiveFieldName = useSignal<TableRowId | null>(null);
  const selectedFieldNames = useSignal<Set<TableRowId>>(new Set());
  const activeFieldName = useSignal<TableRowId | null>(null);
  const [isNewFieldOpen, setIsNewFieldOpen] = useState(false);

  /**
   * @function clearFieldSelection
   * @description Clears the Fields tab table's Selected Rows and Active Row.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @returns {void}
   */
  const clearFieldSelection = useCallback(() => {
    selectedFieldNames.value = new Set();
    activeFieldName.value = null;
  }, [selectedFieldNames, activeFieldName]);

  useEffect(() => {
    clearFieldSelection();
    setIsNewFieldOpen(false);
  }, [activeId, clearFieldSelection]);

  /**
   * @function handleDeleteSelectedField
   * @description Removes the fields selected in the Fields tab table from the draft layer fields collection and clears the row selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleDeleteSelectedField = useCallback(() => {
    const selected = selectedFieldNames.value;
    if (!isEditing || selected.size === 0 || !activeId) return;
    const updatedFields = layerFields.filter((f) => !selected.has(f.name));
    updateLayerPropertiesDraft({ fields: updatedFields });
    clearFieldSelection();
  }, [isEditing, selectedFieldNames, activeId, layerFields, clearFieldSelection]);

  /**
   * @function handleFieldTypeChange
   * @description Modifies a field's inferredType, marks userOverridden: true, and updates transactional draft state conforming to ADR 0024.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-02
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Name of the target field to modify.
   * @param {InferredFieldType} newType - New canonical field data type.
   * @returns {void}
   */
  const handleFieldTypeChange = useCallback(
    (fieldName: string, newType: InferredFieldType) => {
      if (!activeId) return;
      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          return {
            ...f,
            inferredType: newType,
            userOverridden: true,
          };
        }
        return f;
      });

      // Update draft state exclusively (conforming to ADR 0024)
      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [activeId, layerFields]
  );

  /**
   * @function handleResetFieldType
   * @description Resets the data type of the specified field to its original inferred type and clears user override.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Name of the target field to reset.
   * @returns {void}
   */
  const handleResetFieldType = useCallback(
    (fieldName: string) => {
      if (!activeId) return;
      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          const original = f.originalInferredType ?? f.inferredType;
          return {
            ...f,
            inferredType: original,
            userOverridden: false,
          };
        }
        return f;
      });

      // Update draft state exclusively (conforming to ADR 0024)
      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [activeId, layerFields]
  );

  useEffect(() => {
    if (!isEditing) {
      clearFieldSelection();
    }
  }, [isEditing, activeId, clearFieldSelection]);

  /**
   * @function commitCellEdit
   * @description Commits staged inline cell edits (width, precision, comment) to draft state and marks userOverridden: true.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-03
   * @updated 2026-11-03
   * @since 0.1.0-dev
   * @param {string} fieldName - Target field identifier.
   * @param {EditableFieldColumn} column - Column being edited.
   * @param {string} rawValue - Raw user-entered string value.
   * @returns {void}
   */
  const commitCellEdit = useCallback(
    (fieldName: string, column: EditableFieldColumn, rawValue: string) => {
      const field = layerFields.find((f) => f.name === fieldName);
      if (!field) return;

      const trimmed = rawValue.trim();
      let updatedValue: number | string | undefined;

      if (column === "width" || column === "precision") {
        if (!trimmed) {
          updatedValue = undefined;
        } else {
          const parsed = parseInt(trimmed, 10);
          if (isNaN(parsed) || parsed < 0) {
            updatedValue = field[column];
          } else {
            updatedValue = parsed;
          }
        }
      } else {
        updatedValue = rawValue;
      }

      const updatedFields: LayerFieldInfo[] = layerFields.map((f) => {
        if (f.name === fieldName) {
          return {
            ...f,
            [column]: updatedValue,
            userOverridden: true,
          };
        }
        return f;
      });

      updateLayerPropertiesDraft({ fields: updatedFields });
    },
    [layerFields]
  );

  /**
   * @function isFieldsTabCellReadOnly
   * @description Whether a Fields tab table cell is a Read-Only Cell for its field: Length, Precision and Comment are editable where the field's type allows them (see {@link isFieldColumnEditable}); the whole table is also read-only outside Layer Edit Mode.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {LayerFieldInfo} field - The cell's field.
   * @param {TableColumn<LayerFieldInfo>} column - The cell's column.
   * @returns {boolean} True when the cell cannot be edited.
   */
  const isFieldsTabCellReadOnly = useCallback(
    (field: LayerFieldInfo, column: TableColumn<LayerFieldInfo>): boolean =>
      !isEditableFieldColumn(column.key) || !isFieldColumnEditable(field, column.key),
    []
  );

  /**
   * @function handleFieldCellEdit
   * @description Stages a Fields tab table edit of a field's Length, Precision or Comment in the draft through {@link commitCellEdit}. An unchanged value is ignored, and a Length or Precision that is not a non-negative whole number is rejected so the old value keeps showing.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {TableCellEdit} edit - The committed cell edit.
   * @returns {boolean | void} False to reject the edit.
   */
  const handleFieldCellEdit = useCallback(
    (edit: TableCellEdit): boolean | void => {
      const column = edit.columnKey;
      const field = layerFields.find((f) => f.name === edit.rowId);
      if (!isEditing || !field || !isEditableFieldColumn(column) || !isFieldColumnEditable(field, column)) {
        return false;
      }
      const text = edit.newValue === null || edit.newValue === undefined ? "" : String(edit.newValue);
      if (text === resolveFieldColumnStringValue(field, column)) return;
      if (column !== "comment" && text.trim()) {
        const parsed = parseInt(text.trim(), 10);
        if (isNaN(parsed) || parsed < 0) return false;
      }
      commitCellEdit(field.name, column, text);
    },
    [isEditing, layerFields, commitCellEdit]
  );

  const showNativeType = Boolean(
    preferencesMapSignal.value["ui.layerProperties.fields.showNativeType"]?.value
  );

  /**
   * @function handleToggleShowNativeType
   * @description Toggles visibility of the Native Type column on the Fields tab and persists preference.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-02
   * @updated 2026-11-02
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleToggleShowNativeType = useCallback(() => {
    updatePreference(
      "ui.layerProperties.fields.showNativeType",
      !showNativeType
    ).catch(() => {});
  }, [showNativeType]);

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

  const dialogTitle = `${t("layer_properties_dialog_title")} — ${info?.name || draft.layerName || activeId}`;

  return (
    <>
      <Dialog
        name='layerPropertiesWindow'
      title={dialogTitle}
      icon='file:layers-cog-outline.svg'
      isOpen={Boolean(activeId)}
      onClose={handleClose}
      onCancel={handleCancel}
      defaultWidth={860}
      defaultHeight={620}
      footer={
        <div
          className='layer-properties-footer'
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.5rem",
          }}>
          <button
            type='button'
            className='layer-properties-btn cancel'
            onClick={handleCancel}>
            {t("layer_properties_btn_cancel")}
          </button>
          <button
            type='button'
            className='layer-properties-btn apply'
            onClick={handleApply}
            disabled={Boolean(draft.idValidationError || draft.styleValidationError)}>
            {t("layer_properties_btn_apply")}
          </button>
          <button
            type='button'
            className='layer-properties-btn ok'
            onClick={handleOk}
            disabled={Boolean(draft.idValidationError || draft.styleValidationError)}>
            {t("layer_properties_btn_ok")}
          </button>
        </div>
      }>
      <TabbedDialogShell
        classPrefix='layer-properties'
        tabs={SIDEBAR_TABS.map((tab) => ({
          id: tab.id,
          label: t(tab.labelKey),
          icon: tab.icon,
        }))}
        activeTabId={activeTab}
        onTabChange={(id) => {
          activeLayerPropertiesTabSignal.value = id;
        }}>
          {isLoading && (
            <div
              className='layer-properties-loading'
              style={{
                padding: "1rem",
                color: "#64748b",
                fontStyle: "italic",
              }}>
              {t("layer_properties_loading")}
            </div>
          )}

          {activeTab === "information" && (
            <div
              className='layer-properties-tab-pane information'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* General Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_general")}
                </legend>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_name")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.name || draft.layerName || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_id")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.layerId || activeId}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_source")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{
                      flex: 1,
                      color: "#000000",
                      wordBreak: "break-all",
                    }}>
                    {info?.source || "—"}
                  </span>
                </div>
              </fieldset>

              {/* Provider Information Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_provider")}
                </legend>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_driver")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.driverName || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_geometry")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.geometryKind || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_feature_count")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.featureCount !== undefined ?
                      info.featureCount.toLocaleString()
                    : "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_crs")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.crsDescription || "—"}
                  </span>
                </div>
                <div
                  className='layer-properties-row'
                  style={{ display: "flex", padding: "4px 0", gap: "1rem" }}>
                  <span
                    className='layer-properties-label'
                    style={{
                      width: "12rem",
                      fontWeight: 500,
                      color: "#334155",
                    }}>
                    {t("layer_properties_label_extent")}:
                  </span>
                  <span
                    className='layer-properties-value'
                    style={{ flex: 1, color: "#000000" }}>
                    {info?.extent ?
                      `[${info.extent.map((n: number) => Number(n).toFixed(4)).join(", ")}]`
                    : "—"}
                  </span>
                </div>
              </fieldset>

              {/* Fields Group */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_group_fields")}
                </legend>
                <TableWidget<LayerFieldInfo>
                  name='layer-properties-information-fields'
                  displayName={t("layer_properties_group_fields")}
                  className='layer-properties-information-fields-table'
                  showHeader={false}
                  padding={0}
                  minHeight={0}
                  maxHeight='18rem'
                  rows={layerFields}
                  getRowId={fieldRowId}
                  columns={informationFieldColumns()}
                  showRowNumberColumn={false}
                  readOnly
                  selectedRowIds={informationSelectedFieldNames}
                  activeRowId={informationActiveFieldName}
                />
              </fieldset>
            </div>
          )}

          {activeTab === "source" && (
            <div
              className='layer-properties-tab-pane source'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_source_group_general")}
                </legend>
                {/* Layer Name Input */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-name'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_layer_name")}
                  </label>
                  <input
                    id='layer-prop-name'
                    className='layer-prop-input'
                    type='text'
                    value={draft.layerName}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ layerName: e.target.value })
                    }
                  />
                </div>

                {/* Layer ID Input with Validation */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-id'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_layer_id")}
                  </label>
                  <input
                    id='layer-prop-id'
                    className='layer-prop-input'
                    type='text'
                    aria-invalid={Boolean(draft.idValidationError)}
                    value={draft.layerId}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ layerId: e.target.value })
                    }
                  />
                  {draft.idValidationError && (
                    <span
                      className='layer-prop-validation-error'
                      style={{
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                      }}>
                      {draft.idValidationError}
                    </span>
                  )}
                </div>

                {/* Assigned CRS Selector */}
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}>
                  <label
                    htmlFor='layer-prop-crs'
                    style={{
                      fontWeight: 500,
                      fontSize: "0.875rem",
                      color: "#334155",
                    }}>
                    {t("layer_properties_source_crs")}
                  </label>
                  <select
                    id='layer-prop-crs'
                    className='layer-prop-input'
                    value={draft.crsAuthId}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({ crsAuthId: e.target.value })
                    }>
                    {listCrsChooserEntries(draft.crsAuthId ? [draft.crsAuthId] : [], POPULAR_CRS_NAMES).map((crs) => (
                      <option key={crs.authId} value={crs.authId}>
                        {formatCrsEntryLabel(crs)}
                      </option>
                    ))}
                    {crsCatalogueSignal.value.status === "building" && (
                      <option value='' disabled className='crs-catalogue-building'>
                        {t("crs_catalogue_building")}
                      </option>
                    )}
                  </select>
                </div>
              </fieldset>

              {/* Provider Feature Filter Fieldset */}
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_source_group_filter")}
                </legend>
                <div
                  className='layer-properties-input-row'
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}>
                  <textarea
                    id='layer-prop-feature-filter'
                    className='layer-prop-input layer-prop-textarea'
                    rows={4}
                    value={draft.featureFilter}
                    placeholder={t(
                      "layer_properties_source_filter_placeholder"
                    )}
                    onChange={(e) =>
                      updateLayerPropertiesDraft({
                        featureFilter: e.target.value,
                      })
                    }
                  />
                  <span
                    className='layer-prop-dialect-caption'
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      fontStyle: "italic",
                    }}>
                    {info?.driverDialect === "ogr_sql" ?
                      t("layer_properties_dialect_ogr_sql")
                    : info?.driverDialect === "native_sql" ?
                      t("layer_properties_dialect_native_sql")
                    : info?.driverDialect === "nosql" ?
                      t("layer_properties_dialect_nosql")
                    : t("layer_properties_dialect_generic")}
                  </span>
                </div>
              </fieldset>
            </div>
          )}

          {activeTab === "styling" && (
            <div
              className='layer-properties-tab-pane styling'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_styling_group")}
                </legend>
                <StyleEditor
                  value={draft}
                  geometryKind={info?.geometryKind}
                  onChange={updateLayerPropertiesDraft}
                  idPrefix='layer-prop'
                  exportBaseName={draft.layerId || "style"}
                  historyResetKey={activeId}
                  opacity={draft.opacity ?? 1}
                  onOpacityChange={(opacity) =>
                    updateLayerPropertiesDraft({ opacity })
                  }
                />
              </fieldset>
            </div>
          )}

          {activeTab === "fields" && (
            <div
              className='layer-properties-tab-pane fields'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Appearance-only Action Toolbar */}
              <div
                className='layer-properties-fields-toolbar'
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "4px 8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                }}>
                <button
                  type='button'
                  className={`layer-prop-toolbar-btn toggle-edit ${isEditing ? "active toolbar-btn" : ""}`}
                  title={t("layer_properties_fields_toggle_edit")}
                  aria-label={t("layer_properties_fields_toggle_edit")}
                  aria-pressed={isEditing}
                  onClick={() => {
                    if (activeId) {
                      toggleLayerEditingAction(activeId);
                    }
                  }}>
                  <Icon path={mdiPencilOutline} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn new-field'
                  title={t("layer_properties_fields_new_field")}
                  aria-label={t("layer_properties_fields_new_field")}
                  disabled={!isEditing}
                  onClick={() => {
                    if (isEditing) {
                      setIsNewFieldOpen(true);
                    }
                  }}>
                  <Icon path={mdiTablePlus} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn delete-field'
                  title={t("layer_properties_fields_delete_field")}
                  aria-label={t("layer_properties_fields_delete_field")}
                  disabled={!isEditing || selectedFieldNames.value.size === 0}
                  onClick={handleDeleteSelectedField}>
                  <Icon path={mdiTrashCanOutline} size='14px' />
                </button>
                <button
                  type='button'
                  className='layer-prop-toolbar-btn calculate'
                  title={t("layer_properties_fields_calculate")}
                  aria-label={t("layer_properties_fields_calculate")}
                  disabled={!isEditing}>
                  <Icon path={mdiCalculator} size='14px' />
                </button>
                <button
                  type='button'
                  className={`layer-prop-toolbar-btn show-native-type ${showNativeType ? "active" : ""}`}
                  title={t("layer_properties_fields_show_native_type")}
                  aria-pressed={showNativeType}
                  onClick={handleToggleShowNativeType}>
                  <Icon path={mdiCodeTags} size='14px' />
                  <span>{t("layer_properties_fields_show_native_type")}</span>
                </button>
              </div>

              {/* Fields Data Table */}
              <TableWidget<LayerFieldInfo>
                name='layer-properties-fields'
                displayName={t("layer_properties_tab_fields")}
                className='layer-properties-fields-table'
                showHeader={false}
                padding={0}
                minHeight={0}
                rows={layerFields}
                getRowId={fieldRowId}
                columns={fieldsTabColumns(layerFields, {
                  showNativeType,
                  isEditing,
                  onTypeChange: handleFieldTypeChange,
                  onResetType: handleResetFieldType,
                })}
                showRowNumberColumn={false}
                readOnly={!isEditing}
                isCellReadOnly={isFieldsTabCellReadOnly}
                onCellEdit={handleFieldCellEdit}
                selectedRowIds={selectedFieldNames}
                activeRowId={activeFieldName}
              />
            </div>
          )}

          {activeTab === "time_filter" && (
            <div
              className='layer-properties-tab-pane time-filter'
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <fieldset className='preference-group-box'>
                <legend className='preference-group-legend'>
                  {t("layer_properties_tab_time_filter")}
                </legend>
                {(() => {
                  const isEnabled =
                    draft.temporal ?
                      draft.temporal.enabled
                    : (draft.temporalEnabled ?? false);
                  const temporalConfig: LayerTemporalConfig = {
                    enabled: isEnabled,
                    mode: draft.temporal?.mode || "start_end",
                    startField: draft.temporal?.startField,
                    startOp: draft.temporal?.startOp ?? ">=",
                    endField: draft.temporal?.endField,
                    endOp: draft.temporal?.endOp ?? "<=",
                  };
                  const isStartDisabled = temporalConfig.mode === "end";
                  const isEndDisabled = temporalConfig.mode === "start";
                  const temporalFields = layerFields.filter(
                    (f) =>
                      f.inferredType === "date"
                      || f.inferredType === "time"
                      || f.inferredType === "datetime"
                  );

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontWeight: 500,
                          fontSize: "0.875rem",
                          cursor: "pointer",
                        }}>
                        <input
                          id='layer-prop-time-enable'
                          type='checkbox'
                          checked={temporalConfig.enabled}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            updateLayerPropertiesDraft({
                              temporalEnabled: isChecked,
                              temporal: {
                                ...temporalConfig,
                                enabled: isChecked,
                              },
                            });
                          }}
                        />
                        <span>{t("layer_properties_time_enable")}</span>
                      </label>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                        }}>
                        <label
                          htmlFor='layer-prop-time-mode'
                          style={{
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            color: "#334155",
                          }}>
                          {t("layer_properties_time_mode")}
                        </label>
                        <select
                          id='layer-prop-time-mode'
                          className='layer-prop-input'
                          value={temporalConfig.mode || "start_end"}
                          onChange={(e) => {
                            const nextMode = e.target.value as
                              | "start"
                              | "end"
                              | "start_end";
                            updateLayerPropertiesDraft({
                              temporal: {
                                ...temporalConfig,
                                mode: nextMode,
                              },
                            });
                          }}>
                          <option value='start'>
                            {t("layer_properties_time_mode_start") || "Start Field"}
                          </option>
                          <option value='end'>
                            {t("layer_properties_time_mode_end") || "End Field"}
                          </option>
                          <option value='start_end'>
                            {t("layer_properties_time_mode_start_end") || "Start and End Fields"}
                          </option>
                        </select>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          opacity: isStartDisabled ? 0.5 : 1,
                        }}>
                        <label
                          htmlFor='layer-prop-time-start'
                          style={{
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            color: "#334155",
                          }}>
                          {t("layer_properties_time_start_field")}
                        </label>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}>
                          <button
                            id='layer-prop-time-start-op-toggle'
                            className='layer-prop-btn-secondary layer-prop-op-toggle'
                            type='button'
                            disabled={isStartDisabled}
                            aria-label='Toggle start comparison operator'
                            title={
                              (temporalConfig.startOp ?? ">=") === ">"
                                ? ">"
                                : ">="
                            }
                            onClick={() => {
                              const nextOp =
                                (temporalConfig.startOp ?? ">=") === ">"
                                  ? ">="
                                  : ">";
                              updateLayerPropertiesDraft({
                                temporal: {
                                  ...temporalConfig,
                                  startOp: nextOp,
                                },
                              });
                            }}>
                            <Icon
                              path={
                                (temporalConfig.startOp ?? ">=") === ">"
                                  ? mdiGreaterThan
                                  : mdiGreaterThanOrEqual
                              }
                              size='1rem'
                            />
                          </button>
                          <select
                            id='layer-prop-time-start'
                            className='layer-prop-input layer-prop-time-field-select'
                            disabled={isStartDisabled}
                            value={temporalConfig.startField ?? ""}
                            onChange={(e) => {
                              updateLayerPropertiesDraft({
                                temporal: {
                                  ...temporalConfig,
                                  startField: e.target.value || undefined,
                                },
                              });
                            }}>
                            <option value=''>—</option>
                            {temporalFields.map((f) => (
                              <option key={f.name} value={f.name}>
                                {f.name} ({f.inferredType})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          opacity: isEndDisabled ? 0.5 : 1,
                        }}>
                        <label
                          htmlFor='layer-prop-time-end'
                          style={{
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            color: "#334155",
                          }}>
                          {t("layer_properties_time_end_field")}
                        </label>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}>
                          <button
                            id='layer-prop-time-end-op-toggle'
                            className='layer-prop-btn-secondary layer-prop-op-toggle'
                            type='button'
                            disabled={isEndDisabled}
                            aria-label='Toggle end comparison operator'
                            title={
                              (temporalConfig.endOp ?? "<=") === "<"
                                ? "<"
                                : "<="
                            }
                            onClick={() => {
                              const nextOp =
                                (temporalConfig.endOp ?? "<=") === "<"
                                  ? "<="
                                  : "<";
                              updateLayerPropertiesDraft({
                                temporal: {
                                  ...temporalConfig,
                                  endOp: nextOp,
                                },
                              });
                            }}>
                            <Icon
                              path={
                                (temporalConfig.endOp ?? "<=") === "<"
                                  ? mdiLessThan
                                  : mdiLessThanOrEqual
                              }
                              size='1rem'
                            />
                          </button>
                          <select
                            id='layer-prop-time-end'
                            className='layer-prop-input layer-prop-time-field-select'
                            disabled={isEndDisabled}
                            value={temporalConfig.endField ?? ""}
                            onChange={(e) => {
                              updateLayerPropertiesDraft({
                                temporal: {
                                  ...temporalConfig,
                                  endField: e.target.value || undefined,
                                },
                              });
                            }}>
                            <option value=''>—</option>
                            {temporalFields.map((f) => (
                              <option key={f.name} value={f.name}>
                                {f.name} ({f.inferredType})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </fieldset>
            </div>
          )}
      </TabbedDialogShell>
    </Dialog>
    <Dialog
      name='newFieldWindow'
      title={t("layer_properties_fields_new_field")}
      icon={mdiTablePlus}
      isOpen={isNewFieldOpen}
      onClose={() => setIsNewFieldOpen(false)}
      defaultWidth={420}
      defaultHeight={320}
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
          }}>
          <button
            type='button'
            className='new-field-dialog-btn layer-prop-btn-secondary new-field-dialog-cancel-btn'
            onClick={() => setIsNewFieldOpen(false)}>
            {t("layer_properties_btn_cancel")}
          </button>
          <button
            type='button'
            className='new-field-dialog-btn layer-prop-btn-primary new-field-dialog-ok-btn'
            onClick={() => setIsNewFieldOpen(false)}>
            {t("layer_properties_btn_ok")}
          </button>
        </div>
      }>
      <div style={{ padding: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
        New field configuration placeholder.
      </div>
    </Dialog>
    {/* Confirmation ModalDialog for Discarding Unapplied Field Changes */}
    <ModalDialog
      isOpen={isDiscardFieldChangesModalOpenSignal.value}
      title={t("layer_properties_fields_discard_title") || "Discard Unapplied Field Changes?"}
      onClose={() => {
        isDiscardFieldChangesModalOpenSignal.value = false;
      }}
      buttons={[
        {
          label: t("dialog_cancel") || "Cancel",
          onClick: () => {
            isDiscardFieldChangesModalOpenSignal.value = false;
          },
        },
        {
          label: t("dialog_ok") || "OK",
          primary: true,
          onClick: () => {
            discardUnappliedFieldChanges();
            if (activeId) {
              toggleLayerEditingAction(activeId, { force: true });
            }
            clearFieldSelection();
            isDiscardFieldChangesModalOpenSignal.value = false;
          },
        },
      ]}>
      <p style={{ margin: 0 }}>
        {t("layer_properties_fields_discard_warning") ||
          "You have unapplied changes to attribute fields. Turning off Layer Edit Mode will discard these changes. Do you want to proceed?"}
      </p>
    </ModalDialog>
  </>
  );
};

export default LayerPropertiesDialog;
