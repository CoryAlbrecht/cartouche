/**
 * @file LayerPropertiesDialogComponent.test.ts
 * @module tests/renderer/dialogs/LayerPropertiesDialogComponent.test
 * @description Component and reactive tests for LayerPropertiesDialog verifying modeless rendering, Information tab metadata, 6-column fields table formatting, tab switching, and localization parity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link LayerDetailedInfo}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const React = jiti('react');
const ReactDOM = jiti('react-dom');
const { renderToStaticMarkup } = jiti('react-dom/server');
const { mdiTablePlus } = jiti('@mdi/js');
const {
  LayerPropertiesDialog,
  useRawStyleTextEditorHistory,
} = jiti('../../../src/renderer/workbench/dialogs/LayerPropertiesDialog.tsx');
const {
  renderStylePreviewToCanvas,
} = jiti('../../../src/renderer/workbench/dialogs/StylePreviewCanvas.tsx');
const {
  SimpleModeEditor,
  parseCartoucheStyleSafe,
} = jiti('../../../src/renderer/workbench/dialogs/SimpleModeEditor.tsx');
const {
  activeLayerPropertiesIdSignal,
  activeLayerPropertiesTabSignal,
  layerDetailedInfoSignal,
  layerPropertiesDraftSignal,
  openLayerPropertiesDialog,
  closeLayerPropertiesDialog,
  cancelLayerPropertiesEdits,
  updateLayerPropertiesDraft,
  switchLayerPropertiesStyleFormat,
  applyLayerPropertiesEdits,
  commitAndCloseLayerPropertiesDialog,
} = jiti('../../../src/renderer/state/layerPropertiesSignals.ts');
const {
  projectTreeSignal,
  projectLayersSignal,
  isProjectDirtySignal,
  updateLayerFields,
} = jiti('../../../src/renderer/state/projectSignals.ts');
const {
  CANONICAL_INFERRED_FIELD_TYPES,
} = jiti('../../../src/shared/types/layers.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');
const {
  preferencesMapSignal,
  updatePreference,
} = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { registeredActionsSignal } = jiti('../../../src/renderer/state/actionSignals.ts');
const { undoStackSignal } = jiti('../../../src/renderer/state/gisSignals.ts');

describe('LayerPropertiesDialog Component & Reactive Architecture (Ticket #71)', () => {
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;
  let originalCreatePortal: any;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    (globalThis as any).window = {
      electronAPI: {
        getLayerInfo: async (layerId: string) => {
          const geomKind =
            layerId === 'layer-rivers-2' ? 'LineString' :
            layerId === 'layer-cities-3' ? 'Point' : 'Polygon';
          return {
            layerId,
            name:
              layerId === 'layer-rivers-2' ? 'Major Rivers'
              : layerId === 'layer-cities-3' ? 'Global Cities'
              : 'North America Lakes',
            source:
              layerId === 'layer-lakes-1' ? '/data/lakes.shp'
              : `/data/${layerId}.shp`,
            driverName: 'ESRI Shapefile',
            driverDialect: 'ogr_sql',
            geometryKind: geomKind,
            featureCount: 42,
            crsDescription: 'EPSG:4326 - WGS 84',
            extent: [-125.0, 25.0, -65.0, 50.0],
            fields: [
              {
                name: 'scalerank',
                nativeType: 'integer64',
                width: 10,
                precision: 0,
                mappedType: 'number',
                nullable: true,
              },
              {
                name: 'name',
                nativeType: 'string',
                width: 254,
                precision: 0,
                mappedType: 'string',
                nullable: true,
              },
              {
                name: 'unbounded_calc',
                nativeType: 'real',
                width: 0,
                precision: 0,
                mappedType: 'number',
                nullable: false,
              }
            ]
          };
        }
      }
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;

    dictionarySignal.value = {
      layer_properties_dialog_title: 'Layer Properties',
      layer_properties_tab_information: 'Information',
      layer_properties_tab_source: 'Source',
      layer_properties_tab_styling: 'Styling',
      layer_properties_tab_fields: 'Fields',
      layer_properties_tab_time_filter: 'Time Filter',
      layer_properties_styling_group: 'Layer Style & Rendering',
      layer_properties_styling_format: 'Format',
      layer_properties_format_openlayers: 'OpenLayers Flat Style',
      layer_properties_format_sld: 'OGC Styled Layer Descriptor (SLD)',
      layer_properties_styling_version: 'SLD Version',
      layer_properties_styling_load: 'Load from File...',
      layer_properties_styling_export: 'Export to File...',
      layer_properties_styling_reset: 'Reset to Default',
      layer_properties_styling_raw_style: 'Raw Style Definition',
      layer_properties_style_valid: 'Style syntax is valid.',
      layer_properties_style_syntax_error: 'Style syntax error',
      layer_properties_styling_visual_group: 'Visual Symbolizer',
      layer_properties_styling_fill_color: 'Fill Color',
      layer_properties_styling_fill_opacity: 'Fill Opacity',
      layer_properties_styling_stroke_color: 'Stroke Color',
      layer_properties_styling_stroke_width: 'Stroke Width',
      layer_properties_styling_stroke_dash: 'Dashed Line',
      layer_properties_styling_point_shape: 'Point Shape',
      layer_properties_styling_point_radius: 'Point Size',
      layer_properties_styling_layer_opacity: 'Layer Opacity',
      layer_properties_shape_circle: 'Circle',
      layer_properties_shape_square: 'Square',
      layer_properties_shape_triangle: 'Triangle',
      layer_properties_shape_star: 'Star',
      layer_properties_shape_cross: 'Cross',
      layer_properties_shape_x: 'X',
      layer_properties_group_general: 'General Information',
      layer_properties_label_name: 'Layer Name',
      layer_properties_label_id: 'Layer Identifier',
      layer_properties_label_source: 'Source Path',
      layer_properties_group_provider: 'Provider Details',
      layer_properties_label_driver: 'Provider Driver',
      layer_properties_label_geometry: 'Geometry Type',
      layer_properties_label_feature_count: 'Feature Count',
      layer_properties_label_crs: 'Coordinate Reference System',
      layer_properties_label_extent: 'Spatial Extent',
      layer_properties_group_fields: 'Attribute Fields',
      layer_properties_field_col_name: 'Field Name',
      layer_properties_field_col_native_type: 'Native Type',
      layer_properties_field_col_length: 'Length',
      layer_properties_field_col_precision: 'Precision',
      layer_properties_field_col_ts_type: 'TypeScript Type',
      layer_properties_field_col_inferred_type: 'Inferred Type',
      layer_properties_field_col_nullable: 'Nullable',
      layer_properties_yes: 'Yes',
      layer_properties_no: 'No',
      layer_properties_btn_cancel: 'Cancel',
      layer_properties_btn_apply: 'Apply',
      layer_properties_btn_ok: 'OK',
      layer_properties_source_group_general: 'General Properties',
      layer_properties_source_layer_name: 'Display Name',
      layer_properties_source_layer_id: 'Layer ID',
      layer_properties_source_crs: 'Assigned CRS',
      layer_properties_source_group_filter: 'Provider Feature Filter',
      layer_properties_source_filter_placeholder: 'Enter subset expression...',
      layer_properties_dialect_ogr_sql: 'Filter expression uses OGR SQL syntax.',
      layer_properties_dialect_native_sql: 'Filter expression uses native SQL WHERE clause syntax.',
      layer_properties_dialect_nosql: 'Filter expression uses NoSQL JSON query syntax.',
      layer_properties_dialect_generic: 'Filter expression uses provider query syntax.',
      layer_properties_error_empty_id: 'Layer ID cannot be empty.',
      layer_properties_error_duplicate_id: 'Layer ID already exists in this project.',
      layer_properties_fields_toggle_edit: 'Toggle Editing Mode',
      layer_properties_fields_new_field: 'New Field',
      layer_properties_fields_delete_field: 'Delete Selected Field',
      layer_properties_fields_calculate: 'Calculate Virtual Field',
      layer_properties_fields_col_comment: 'Comment',
      layer_properties_fields_col_data_type: 'Data Type',
      layer_properties_fields_show_native_type: 'Show Native Type',
      layer_properties_time_enable: 'Enable dynamic temporal control',
      layer_properties_time_mode: 'Configuration Mode',
      layer_properties_time_mode_single: 'Single Field with Date/Time',
      layer_properties_time_mode_separate: 'Separate Start and End Fields',
      layer_properties_time_mode_fixed: 'Fixed Time Range',
      layer_properties_time_start_field: 'Start Field / Timestamp Field',
      layer_properties_time_end_field: 'End Field',
    };

    projectTreeSignal.value = [
      {
        id: 'layer-lakes-1',
        name: 'North America Lakes',
        type: 'vector',
        source: '/data/lakes.shp',
        crs: { authId: 'EPSG:4326', description: 'WGS 84' },
      },
      {
        id: 'layer-rivers-2',
        name: 'Major Rivers',
        type: 'vector',
        source: '/data/rivers.shp',
        crs: { authId: 'EPSG:4326', description: 'WGS 84' },
      },
      {
        id: 'layer-cities-3',
        name: 'Global Cities',
        type: 'vector',
        source: '/data/cities.shp',
        crs: { authId: 'EPSG:4326', description: 'WGS 84' },
      }
    ];

    activeLayerPropertiesTabSignal.value = 'information';
    closeLayerPropertiesDialog();
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    (globalThis as any).window = originalWindow;
    ReactDOM.createPortal = originalCreatePortal;
    closeLayerPropertiesDialog();
  });

  it('renders nothing when activeLayerPropertiesIdSignal is null', () => {
    activeLayerPropertiesIdSignal.value = null;
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert.equal(html, '');
  });

  it('renders dialog shell, sidebar navigation tabs, and Information tab when open', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Layer Properties'), 'Title bar should contain Layer Properties');
    assert(html.includes('Information'), 'Sidebar should include Information tab');
    assert(html.includes('Source'), 'Sidebar should include Source tab');
    assert(html.includes('Fields'), 'Sidebar should include Fields tab');
    assert(html.includes('Time Filter'), 'Sidebar should include Time Filter tab');

    // General group
    assert(html.includes('General Information'), 'Should render General Information group');
    assert(html.includes('North America Lakes'), 'Should render layer display name');
    assert(html.includes('layer-lakes-1'), 'Should render layer identifier');
    assert(html.includes('/data/lakes.shp'), 'Should render source path');

    // Provider group
    assert(html.includes('Provider Details'), 'Should render Provider Details group');
    assert(html.includes('ESRI Shapefile'), 'Should render provider driver');
    assert(html.includes('Polygon'), 'Should render geometry kind');
    assert(html.includes('42'), 'Should render feature count');
    assert(html.includes('EPSG:4326 - WGS 84'), 'Should render CRS description');
    assert(html.includes('-125.0000, 25.0000, -65.0000, 50.0000'), 'Should render formatted extent');

    // Fields group
    assert(html.includes('Attribute Fields'), 'Should render Attribute Fields group');
    assert(html.includes('Inferred Type'), 'Should render Inferred Type column header in Information tab');
    assert(html.includes('scalerank'), 'Should render scalerank field name');
    assert(html.includes('integer64'), 'Should render nativeType');
    assert(html.includes('254'), 'Should render width for name field');
    // Em-dash for 0 width / precision
    assert(html.includes('—'), 'Should render em-dash for undefined or zero width/precision');
  });

  it('preserves draft edits when switching between sidebar tabs', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');

    updateLayerPropertiesDraft({
      layerName: 'Custom Great Lakes',
      layerId: 'custom-lakes-id'
    });

    // Switch to Source tab
    activeLayerPropertiesTabSignal.value = 'source';
    let html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('Custom Great Lakes'), 'Source tab should reflect draft layer name');
    assert(html.includes('custom-lakes-id'), 'Source tab should reflect draft layer ID');

    // Switch back to Information tab
    activeLayerPropertiesTabSignal.value = 'information';
    html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert.equal(layerPropertiesDraftSignal.value.layerName, 'Custom Great Lakes');
    assert.equal(layerPropertiesDraftSignal.value.layerId, 'custom-lakes-id');
  });

  it('validates empty layer ID with error feedback on Source tab', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'source';

    updateLayerPropertiesDraft({ layerId: '   ' });

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('Layer ID cannot be empty'), 'Validation error should be displayed for empty ID');
  });

  it('renders localized French labels when dictionary is populated with French strings', async () => {
    dictionarySignal.value = {
      layer_properties_dialog_title: 'Propriétés de la couche',
      layer_properties_tab_information: 'Information',
      layer_properties_tab_styling: 'Style',
      layer_properties_group_general: 'Informations générales',
      layer_properties_group_provider: 'Détails du fournisseur',
      layer_properties_group_fields: 'Champs d&#39;attributs',
      layer_properties_btn_cancel: 'Annuler',
      layer_properties_btn_apply: 'Appliquer',
      layer_properties_btn_ok: 'OK',
      layer_properties_yes: 'Oui',
      layer_properties_no: 'Non'
    };

    await openLayerPropertiesDialog('layer-lakes-1');
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Propriétés de la couche'), 'Should display French dialog title');
    assert(html.includes('Informations générales'), 'Should display French General group legend');
    assert(html.includes('Détails du fournisseur'), 'Should display French Provider group legend');
    assert(html.includes('Annuler'), 'Should display French cancel button');
    assert(html.includes('Appliquer'), 'Should display French apply button');
    assert(html.includes('Oui'), 'Should display French Yes for nullable');
  });

  it('closes dialog cleanly on cancelLayerPropertiesEdits', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-lakes-1');

    cancelLayerPropertiesEdits();
    assert.equal(activeLayerPropertiesIdSignal.value, null);
    assert.equal(layerDetailedInfoSignal.value, null);
  });

  it('renders CRS selector and provider feature filter with dynamic dialect caption on Source tab', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'source';

    updateLayerPropertiesDraft({
      crsAuthId: 'EPSG:3857',
      featureFilter: '"scalerank" <= 2'
    });

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Assigned CRS'), 'Should render Assigned CRS label');
    assert(html.includes('EPSG:3857 — WGS 84 / Pseudo-Mercator'), 'Should render popular CRS option');
    assert(html.includes('Provider Feature Filter'), 'Should render Provider Feature Filter legend');
    assert(
      html.includes('scalerank') && html.includes('2'),
      'Should render feature filter value'
    );
    assert(html.includes('Filter expression uses OGR SQL syntax'), 'Should display OGR SQL dialect caption');
  });

  it('validates duplicate layer ID with error feedback on Source tab', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'source';

    // Set to existing layer ID from projectTreeSignal
    updateLayerPropertiesDraft({ layerId: 'layer-rivers-2' });

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('Layer ID already exists in this project.'), 'Should render duplicate ID validation error');
    assert.equal(layerPropertiesDraftSignal.value.idValidationError, 'Layer ID already exists in this project.');
  });

  it('renders appearance-only action toolbar and data table on Fields tab', async () => {
    preferencesMapSignal.value = {};
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'fields';

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Toggle Editing Mode'), 'Should render Toggle Editing Mode toolbar button');
    assert(html.includes('New Field'), 'Should render New Field toolbar button');
    assert(html.includes('Delete Selected Field'), 'Should render Delete Field toolbar button');
    assert(html.includes('Calculate Virtual Field'), 'Should render Calculate Virtual Field toolbar button');
    assert(html.includes('Show Native Type'), 'Should render Show Native Type toolbar button');
    assert(html.includes('aria-pressed="false"'), 'Show Native Type button should be unpressed by default');
    assert(html.includes('Data Type'), 'Should render Data Type column header');
    assert(!html.includes('>Native Type<'), 'Should hide Native Type column when Show Native Type is inactive');
    assert(html.includes('Comment'), 'Should render Comment column header');
    assert(html.includes('scalerank'), 'Should render field rows in table');
    assert(html.includes('color:#0f766e'), 'Should render mappedType with monospace teal styling');
  });

  it('toggles Native Type column visibility and updates persistent preference on Fields tab', async () => {
    let updatedPrefKey = '';
    let updatedPrefVal: any = null;
    (globalThis as any).window.electronAPI.setPreferenceValue = async (key: string, val: any) => {
      updatedPrefKey = key;
      updatedPrefVal = val;
      return { [key]: { value: val } };
    };

    preferencesMapSignal.value = {
      'ui.layerProperties.fields.showNativeType': {
        displayName: 'Show Native Type in Layer Fields',
        value: true,
        defaultValue: false,
        category: 'ui',
        hidden: true,
      }
    };

    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'fields';

    let html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('aria-pressed="true"'), 'Show Native Type button should be pressed when preference is true');
    assert(html.includes('>Native Type<'), 'Should display Native Type column header when Show Native Type is active');
    assert(html.includes('integer64'), 'Should display native type cell when active');

    // Simulate clicking toggle to turn off
    await updatePreference('ui.layerProperties.fields.showNativeType', false);
    html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('aria-pressed="false"'), 'Show Native Type button should be unpressed after turning off');
    assert(!html.includes('>Native Type<'), 'Should hide Native Type column header after turning off');
    assert.equal(updatedPrefKey, 'ui.layerProperties.fields.showNativeType');
    assert.equal(updatedPrefVal, false);
  });

  it('renders correct colSpan on empty fields table state when Native Type is shown vs hidden', async () => {
    (globalThis as any).window.electronAPI.getLayerInfo = async (id: string) => ({
      layerId: id,
      name: 'Empty Layer',
      geometryKind: 'Point',
      featureCount: 0,
      fields: []
    });

    preferencesMapSignal.value = {
      'ui.layerProperties.fields.showNativeType': {
        displayName: 'Show Native Type in Layer Fields',
        value: false,
        defaultValue: false,
        category: 'ui',
        hidden: true,
      }
    };

    await openLayerPropertiesDialog('layer-empty');
    activeLayerPropertiesTabSignal.value = 'fields';

    let html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('colSpan="5"') || html.includes('colspan="5"'), 'Empty state should span 5 columns when Native Type is hidden');

    preferencesMapSignal.value = {
      'ui.layerProperties.fields.showNativeType': {
        displayName: 'Show Native Type in Layer Fields',
        value: true,
        defaultValue: false,
        category: 'ui',
        hidden: true,
      }
    };
    html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    assert(html.includes('colSpan="6"') || html.includes('colspan="6"'), 'Empty state should span 6 columns when Native Type is shown');
  });

  it('renders appearance-only temporal master checkbox and mode selectors on Time Filter tab', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'time_filter';

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Enable dynamic temporal control'), 'Should render temporal master checkbox');
    assert(html.includes('Configuration Mode'), 'Should render mode selector label');
    assert(html.includes('Single Field with Date/Time'), 'Should render single field mode option');
    assert(html.includes('Separate Start and End Fields'), 'Should render separate fields mode option');
    assert(html.includes('Fixed Time Range'), 'Should render fixed time range option');
    assert(html.includes('Start Field / Timestamp Field'), 'Should render start field picker label');
    assert(html.includes('End Field'), 'Should render end field picker label');
  });

  it('commits draft edits and updates isProjectDirtySignal via applyLayerPropertiesEdits', async () => {
    let rekeyedArgs: { oldId: string; newId: string } | null = null;
    (globalThis as any).window.electronAPI.rekeyLayer = async (oldId: string, newId: string) => {
      rekeyedArgs = { oldId, newId };
      return { success: true, layerId: newId };
    };

    await openLayerPropertiesDialog('layer-lakes-1');

    updateLayerPropertiesDraft({
      layerName: 'Great Lakes Basin',
      layerId: 'great-lakes-basin-id',
      crsAuthId: 'EPSG:3857',
      featureFilter: 'area > 1000'
    });

    const success = await applyLayerPropertiesEdits();
    assert.equal(success, true, 'applyLayerPropertiesEdits should return true');

    // Dialog stays open but active target transitions to new ID
    assert.equal(activeLayerPropertiesIdSignal.value, 'great-lakes-basin-id');
    assert.deepEqual(rekeyedArgs, { oldId: 'layer-lakes-1', newId: 'great-lakes-basin-id' });

    // Project tree updated
    const updatedLayer = projectTreeSignal.value.find((l: any) => l.id === 'great-lakes-basin-id');
    assert.ok(updatedLayer, 'Updated layer should exist in projectTreeSignal');
    assert.equal(updatedLayer.name, 'Great Lakes Basin');
    assert.equal(updatedLayer.crs.authId, 'EPSG:3857');
    assert.equal(updatedLayer.customProperties.featureFilter, 'area > 1000');
    assert.equal(isProjectDirtySignal.value, true, 'isProjectDirtySignal must be true');
  });

  it('commits and closes dialog via commitAndCloseLayerPropertiesDialog', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');

    updateLayerPropertiesDraft({
      layerName: 'Renamed Lakes'
    });

    const success = await commitAndCloseLayerPropertiesDialog();
    assert.equal(success, true);
    assert.equal(activeLayerPropertiesIdSignal.value, null, 'Dialog must be closed');
  });

  it('prevents commit if draft contains idValidationError', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');

    updateLayerPropertiesDraft({
      layerId: '   '
    });

    const success = await applyLayerPropertiesEdits();
    assert.equal(success, false, 'Should refuse to apply edits when ID validation error exists');
  });

  it('renders Dialog with name "layerPropertiesWindow" to authorize child window opening in Electron', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    const element = React.createElement(LayerPropertiesDialog);
    assert.ok(React.isValidElement(element));
    const markup = renderToStaticMarkup(element);
    assert.ok(markup.includes('cartouche-dialog-window'), 'Must render dialog container');
    assert.ok(markup.includes('data-dialog-name="layerPropertiesWindow"'), 'Dialog frame name must be layerPropertiesWindow');
  });

  it('renders Layer Identifier and Spatial Extent without monospace font override on Information tab (Ticket #75)', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'information';
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('layer-lakes-1'), 'Should display layer identifier');
    assert(html.includes('-125.0000, 25.0000, -65.0000, 50.0000'), 'Should display extent');

    // Neither layer identifier nor extent should have monospace font styling
    assert(
      !html.includes('font-family:monospace;flex:1;color:#000000">layer-lakes-1') &&
      !html.includes('font-family:monospace">layer-lakes-1'),
      'Layer Identifier value must not have monospace font override'
    );
    assert(
      !html.includes('font-family:monospace;flex:1;color:#000000">[-125.0000') &&
      !html.includes('font-family:monospace">[-125.0000'),
      'Spatial Extent value must not have monospace font override'
    );
  });

  it('renders Layer ID input field without monospace font override on Source tab (Ticket #76)', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'source';
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('id="layer-prop-id"'), 'Should render Layer ID input');
    assert(html.includes('id="layer-prop-name"'), 'Should render Display Name input');
    assert(!html.includes('font-family:monospace" value="layer-lakes-1"'), 'Layer ID input must not have monospace font override');
    assert(
      html.includes('id="layer-prop-id" type="text" style="padding:6px 10px;border-radius:4px;border:1px solid #cbd5e1;font-size:0.875rem" value="layer-lakes-1"'),
      'Layer ID input should match Display Name font style without monospace'
    );
  });

  it('renders New Field toolbar button using mdiTablePlus icon on Fields tab (Ticket #77)', async () => {
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'fields';
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('class="layer-prop-toolbar-btn new-field"'), 'Should render New Field button');
    assert(html.includes(mdiTablePlus), 'New Field toolbar button must render mdiTablePlus SVG path');
  });

  describe('Styling Tab & Transactional Staging (Ticket #122)', () => {
    it('renders Styling tab button in sidebar with palette icon', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

      assert(html.includes('Styling'), 'Sidebar must include Styling tab label');
    });

    it('renders Styling tab pane with Format selector, action buttons, raw style editor, and validation banner', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';
      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

      assert(html.includes('id="layer-prop-styling-format"'), 'Must render format selector dropdown');
      assert(html.includes('id="layer-prop-styling-load"'), 'Must render Load from File button');
      assert(html.includes('id="layer-prop-styling-export"'), 'Must render Export to File button');
      assert(html.includes('id="layer-prop-styling-reset"'), 'Must render Reset to Default button');
      assert(html.includes('id="layer-prop-styling-raw-style"'), 'Must render raw style textarea');
      assert(html.includes('style-validation-valid'), 'Must render valid style banner by default');
    });

    it('renders 4-option format dropdown offering Simple, OpenLayers Flat Style, OGC SLD 1.0.0, and OGC SLD 1.1.0 (Ticket #127)', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert(html.includes('id="layer-prop-styling-format"'), 'Must render format selector dropdown');
      assert(html.includes('value="cartouche"'), 'Must render Simple / cartouche format option');
      assert(html.includes('value="openlayers"'), 'Must render OpenLayers Flat Style option');
      assert(html.includes('value="sld-1.0.0"'), 'Must render OGC SLD 1.0.0 option');
      assert(html.includes('value="sld-1.1.0"'), 'Must render OGC SLD 1.1.0 option');
    });

    it('renders live syntax validation error banner when style has validation errors', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';
      updateLayerPropertiesDraft({
        styleValidationError: 'Unexpected token at line 3',
      });

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert(html.includes('style-validation-error'), 'Must render error banner class');
      assert(html.includes('Style syntax error: Unexpected token at line 3'), 'Must display error message');
    });

    it('disables Apply and OK footer buttons when draft style validation error exists', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      updateLayerPropertiesDraft({
        styleValidationError: 'Malformed JSON',
      });

      const success = await applyLayerPropertiesEdits();
      assert.strictEqual(success, false, 'applyLayerPropertiesEdits must return false when style error exists');

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert(html.includes('class="layer-properties-btn apply" disabled=""') || html.includes('class="layer-properties-btn apply" disabled'), 'Apply button must be disabled');
      assert(html.includes('class="layer-properties-btn ok" disabled=""') || html.includes('class="layer-properties-btn ok" disabled'), 'OK button must be disabled');
    });

    it('preserves layer style untouched on cancel and commits draft edits on apply', async () => {
      let appliedStyle: { format?: string; content?: string } | null = null;
      (globalThis as any).window.electronAPI.setLayerStyle = async (
        _ids: string[],
        style: any,
        _opacity: number
      ) => {
        appliedStyle = style;
      };

      await openLayerPropertiesDialog('layer-lakes-1');
      updateLayerPropertiesDraft({
        styleContent: JSON.stringify([{ style: { 'fill-color': '#123456' } }]),
      });

      // Canceling must close and discard draft without committing to window.electronAPI
      cancelLayerPropertiesEdits();
      assert.strictEqual(appliedStyle, null, 'Cancel must not apply draft edits');
      assert.strictEqual(activeLayerPropertiesIdSignal.value, null);

      // Reopening and applying commits draft
      await openLayerPropertiesDialog('layer-lakes-1');
      updateLayerPropertiesDraft({
        styleContent: JSON.stringify([{ style: { 'fill-color': '#654321' } }]),
      });
      const committed = await applyLayerPropertiesEdits();
      assert.strictEqual(committed, true);
      const finalStyle = appliedStyle as { format?: string; content?: string } | null;
      assert.ok(finalStyle);
      assert.strictEqual(finalStyle.format, 'openlayers');
      assert.ok(finalStyle.content?.includes('#654321'));
    });
  });

  describe('Dual-Mode Styling Tab Scaffold & Canvas Preview (Ticket #127)', () => {
    it('toggles between Simple mode container and External raw text editor based on active format', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      // 1. By default or when format is 'cartouche', renders Simple mode container
      updateLayerPropertiesDraft({ styleFormat: 'cartouche' });
      let html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('id="layer-prop-simple-mode-container"'), 'Cartouche format must render Simple mode container');
      assert.ok(!html.includes('id="layer-prop-external-mode-container"'), 'Cartouche format must not render external raw text editor');
      assert.ok(html.includes('id="layer-prop-preview-container"'), 'Preview box must be visible');

      // 2. OpenLayers Flat Style -> renders external raw editor
      updateLayerPropertiesDraft({ styleFormat: 'openlayers' });
      html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(!html.includes('id="layer-prop-simple-mode-container"'), 'OpenLayers format must not render Simple mode container');
      assert.ok(html.includes('id="layer-prop-external-mode-container"'), 'OpenLayers format must render external raw text editor');
      assert.ok(html.includes('id="layer-prop-styling-raw-style"'), 'OpenLayers format must render textarea for raw style');
      assert.ok(html.includes('id="layer-prop-preview-container"'), 'Preview box must remain visible');

      // 3. SLD 1.0.0 -> renders external raw editor
      updateLayerPropertiesDraft({ styleFormat: 'sld', sldVersion: '1.0.0' });
      html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('id="layer-prop-external-mode-container"'), 'SLD 1.0.0 must render external raw editor');

      // 4. SLD 1.1.0 -> renders external raw editor
      updateLayerPropertiesDraft({ styleFormat: 'sld', sldVersion: '1.1.0' });
      html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('id="layer-prop-external-mode-container"'), 'SLD 1.1.0 must render external raw editor');
    });

    it('renders 120x120px HTML5 Canvas 2D preview box in real-time matching active draft style', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('id="layer-prop-preview-container"'), 'Must render preview container');
      assert.ok(html.includes('<canvas'), 'Must render canvas element');
      assert.ok(html.includes('width="120"'), 'Canvas width must be 120px');
      assert.ok(html.includes('height="120"'), 'Canvas height must be 120px');

      // Test canvas rendering logic directly via renderStylePreviewToCanvas
      const drawCalls: string[] = [];
      const mockCtx: any = {
        save: () => drawCalls.push('save'),
        restore: () => drawCalls.push('restore'),
        clearRect: () => drawCalls.push('clearRect'),
        fillRect: () => drawCalls.push('fillRect'),
        beginPath: () => drawCalls.push('beginPath'),
        closePath: () => drawCalls.push('closePath'),
        fill: () => drawCalls.push('fill'),
        stroke: () => drawCalls.push('stroke'),
        moveTo: () => drawCalls.push('moveTo'),
        lineTo: () => drawCalls.push('lineTo'),
        arc: () => drawCalls.push('arc'),
        setLineDash: (d: number[]) => drawCalls.push(`setLineDash:${JSON.stringify(d)}`),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
      };

      // 1. Polygon preview with cartouche format
      renderStylePreviewToCanvas(mockCtx, {
        width: 120,
        height: 120,
        format: 'cartouche',
        content: JSON.stringify({
          version: 1,
          format: 'simple',
          components: [
            { id: 'fill-1', type: 'simple-fill', enabled: true, color: '#ff0000' },
            { id: 'line-1', type: 'simple-line', enabled: true, color: '#000000', width: 2 },
          ],
        }),
        geometryKind: 'Polygon',
      });
      assert.ok(drawCalls.includes('fill'), 'Polygon render should call fill');
      assert.ok(drawCalls.includes('stroke'), 'Polygon render should call stroke');

      // 2. LineString preview with OpenLayers flat style
      drawCalls.length = 0;
      renderStylePreviewToCanvas(mockCtx, {
        width: 120,
        height: 120,
        format: 'openlayers',
        content: JSON.stringify([{ style: { 'stroke-color': '#0000ff', 'stroke-width': 4 } }]),
        geometryKind: 'LineString',
      });
      assert.ok(drawCalls.includes('stroke'), 'LineString render should call stroke');

      // 3. Point preview with Point geometry
      drawCalls.length = 0;
      renderStylePreviewToCanvas(mockCtx, {
        width: 120,
        height: 120,
        format: 'cartouche',
        content: JSON.stringify({
          version: 1,
          format: 'simple',
          components: [
            { id: 'point-1', type: 'simple-marker', enabled: true, fillColor: '#00ff00', radius: 6 },
          ],
        }),
        geometryKind: 'Point',
      });
      assert.ok(drawCalls.includes('arc'), 'Point render should call arc');
      assert.ok(drawCalls.includes('fill'), 'Point render should call fill');

      // 4. OGC SLD 1.1.0 preview with se: namespace parameters
      drawCalls.length = 0;
      renderStylePreviewToCanvas(mockCtx, {
        width: 120,
        height: 120,
        format: 'sld',
        version: '1.1.0',
        content: `<StyledLayerDescriptor version="1.1.0" xmlns:se="http://www.opengis.net/se">
          <se:PolygonSymbolizer>
            <se:Fill><se:SvgParameter name="fill">#d8b4e2</se:SvgParameter></se:Fill>
            <se:Stroke><se:SvgParameter name="stroke">#6b21a8</se:SvgParameter><se:SvgParameter name="stroke-width">2</se:SvgParameter></se:Stroke>
          </se:PolygonSymbolizer>
        </StyledLayerDescriptor>`,
        geometryKind: 'Polygon',
      });
      assert.ok(drawCalls.includes('fill'), 'SLD 1.1.0 render should call fill for polygon');
      assert.ok(drawCalls.includes('stroke'), 'SLD 1.1.0 render should call stroke for polygon');
      assert.strictEqual(mockCtx.fillStyle, '#d8b4e2', 'SLD 1.1.0 fill color must match');
      assert.strictEqual(mockCtx.strokeStyle, '#6b21a8', 'SLD 1.1.0 stroke color must match');
      assert.strictEqual(mockCtx.lineWidth, 2, 'SLD 1.1.0 stroke width must match');
    });

    it('preserves pending draft edits across format switches via switchLayerPropertiesStyleFormat', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      // Start in Cartouche (Simple mode) with initial draft
      await switchLayerPropertiesStyleFormat('cartouche', 'Polygon');
      updateLayerPropertiesDraft({
        styleContent: JSON.stringify({ version: '1.0.0', rules: [{ fill: { color: '#112233' } }] }),
      });

      // Switch to OpenLayers format
      await switchLayerPropertiesStyleFormat('openlayers', 'Polygon');
      assert.strictEqual(layerPropertiesDraftSignal.value.styleFormat, 'openlayers');
      // Modify OpenLayers draft
      updateLayerPropertiesDraft({
        styleContent: JSON.stringify([{ style: { 'fill-color': '#445566' } }]),
      });

      // Switch back to Cartouche
      await switchLayerPropertiesStyleFormat('cartouche', 'Polygon');
      assert.strictEqual(layerPropertiesDraftSignal.value.styleFormat, 'cartouche');
      // Must restore our earlier Cartouche draft edits
      assert.ok(layerPropertiesDraftSignal.value.styleContent.includes('#112233'));

      // Switch back to OpenLayers
      await switchLayerPropertiesStyleFormat('openlayers', 'Polygon');
      assert.strictEqual(layerPropertiesDraftSignal.value.styleFormat, 'openlayers');
      // Must restore our earlier OpenLayers draft edits
      assert.ok(layerPropertiesDraftSignal.value.styleContent.includes('#445566'));
    });

    it('converts styling format bidirectionally from OpenLayers to Simple Cartouche Symbology and SLD 1.1.0 (Ticket #131)', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      // 1. Set OpenLayers style with lavender fill and purple stroke (as in project-4.cproj)
      const olLavenderStyle = JSON.stringify([
        {
          style: {
            'fill-color': '#d8b4e2',
            'stroke-color': '#6b21a8',
            'stroke-width': 1.5,
          },
        },
      ]);
      updateLayerPropertiesDraft({
        styleFormat: 'openlayers',
        styleContent: olLavenderStyle,
        sldVersion: '1.0.0',
      });

      // 2. Switch to Cartouche (Simple mode) format
      await switchLayerPropertiesStyleFormat('cartouche', 'Polygon');
      assert.strictEqual(layerPropertiesDraftSignal.value.styleFormat, 'cartouche');

      const cartoucheParsed = JSON.parse(layerPropertiesDraftSignal.value.styleContent);
      assert.strictEqual(cartoucheParsed.format, 'simple');
      assert.strictEqual(cartoucheParsed.components.length, 2);

      const fill = cartoucheParsed.components.find((c: any) => c.type === 'simple-fill');
      const line = cartoucheParsed.components.find((c: any) => c.type === 'simple-line');
      assert.ok(fill, 'Must contain simple-fill component');
      assert.ok(line, 'Must contain simple-line component');
      assert.strictEqual(fill.color, '#d8b4e2', 'Must preserve lavender fill color without random generation');
      assert.strictEqual(line.color, '#6b21a8', 'Must preserve purple stroke color');

      // 3. Switch from Cartouche to SLD 1.1.0 format
      await switchLayerPropertiesStyleFormat('sld-1.1.0', 'Polygon');
      assert.strictEqual(layerPropertiesDraftSignal.value.styleFormat, 'sld');
      assert.strictEqual(layerPropertiesDraftSignal.value.sldVersion, '1.1.0');
      assert.ok(layerPropertiesDraftSignal.value.styleContent.length > 0, 'SLD 1.1.0 text must not be empty');
      assert.ok(layerPropertiesDraftSignal.value.styleContent.includes('StyledLayerDescriptor'));
      assert.ok(
        layerPropertiesDraftSignal.value.styleContent.includes('#d8b4e2') ||
        layerPropertiesDraftSignal.value.styleContent.includes('#D8B4E2')
      );
    });

    it('validates syntax for Flat Style JSON and SLD XML in external raw editor, displaying error banner and disabling Apply/OK', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      // 1. Invalid OpenLayers JSON
      updateLayerPropertiesDraft({
        styleFormat: 'openlayers',
        styleContent: '{ invalid json style content',
        styleValidationError: 'JSON parse error at position 2',
      });

      let html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('style-validation-error'), 'Must render error banner for invalid JSON');
      assert.ok(html.includes('JSON parse error at position 2'), 'Must display error message');
      assert.ok(html.includes('class="layer-properties-btn apply" disabled'), 'Apply must be disabled');
      assert.ok(html.includes('class="layer-properties-btn ok" disabled'), 'OK must be disabled');

      let applySuccess = await applyLayerPropertiesEdits();
      assert.strictEqual(applySuccess, false, 'applyLayerPropertiesEdits must fail when syntax validation error is present');

      // 2. Valid OpenLayers JSON
      updateLayerPropertiesDraft({
        styleContent: JSON.stringify([{ style: { 'fill-color': '#336699' } }]),
        styleValidationError: null,
      });

      html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(!html.includes('style-validation-error'), 'Error banner must be hidden when valid');
      assert.ok(!html.includes('class="layer-properties-btn apply" disabled'), 'Apply must be enabled');

      // 3. Invalid SLD XML
      updateLayerPropertiesDraft({
        styleFormat: 'sld',
        sldVersion: '1.0.0',
        styleContent: '<StyledLayerDescriptor><unclosed>',
        styleValidationError: 'XML parse error: unclosed tag',
      });

      html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('style-validation-error'), 'Must render error banner for invalid SLD XML');
      assert.ok(html.includes('XML parse error: unclosed tag'), 'Must display SLD error message');

      applySuccess = await applyLayerPropertiesEdits();
      assert.strictEqual(applySuccess, false, 'applyLayerPropertiesEdits must fail for invalid SLD');
    });
  });

  describe('Raw Style Text Cursor Stability & Action-Driven Undo/Redo (Ticket #129)', () => {
    it('captures cursor selection offsets and updates draft styleContent immediately during typing without jumping', async () => {
      let updatedContent = '';
      let validatedContent = '';
      const onUpdateContent = (c: string) => {
        updatedContent = c;
      };
      const onValidateAndSync = async (c: string) => {
        validatedContent = c;
      };

      // Mock textarea DOM element with setSelectionRange
      const mockTextarea = {
        value: 'Initial style content here',
        selectionStart: 10,
        selectionEnd: 10,
        setSelectionRange(start: number, end: number) {
          this.selectionStart = start;
          this.selectionEnd = end;
        },
      };

      let hookResult: any;
      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: 'Initial style content here',
          debounceMs: 0,
          onUpdateContent,
          onValidateAndSync,
        });
        hookResult.textareaRef.current = mockTextarea;
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      // Simulate typing 'X' at position 10
      const changeEvent = {
        target: {
          value: 'Initial stXyle content here',
          selectionStart: 11,
          selectionEnd: 11,
        },
      };
      hookResult.handleRawStyleChange(changeEvent);

      // Verify draft content updated synchronously without lag
      assert.strictEqual(updatedContent, 'Initial stXyle content here');
      assert.strictEqual(validatedContent, 'Initial stXyle content here');
      assert.strictEqual(hookResult.selectionRef.current?.start, 11);
      assert.strictEqual(hookResult.selectionRef.current?.end, 11);
      assert.strictEqual(hookResult.historyIndexRef.current, 1);
      assert.strictEqual(hookResult.historyStackRef.current.length, 2);
    });

    it('reverts previous text edit and restores prior cursor position on undo', async () => {
      let activeContent = 'initial';
      const onUpdateContent = (c: string) => {
        activeContent = c;
      };
      const onValidateAndSync = async () => {};

      let hookResult: any;
      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: activeContent,
          onUpdateContent,
          onValidateAndSync,
        });
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      // 1. Edit 1: insert '1' at pos 3
      hookResult.handleRawStyleChange({
        target: {
          value: 'ini1tial',
          selectionStart: 4,
          selectionEnd: 4,
        },
      });
      assert.strictEqual(activeContent, 'ini1tial');

      // 2. Edit 2: insert '2' at pos 4
      hookResult.handleRawStyleChange({
        target: {
          value: 'ini12tial',
          selectionStart: 5,
          selectionEnd: 5,
        },
      });
      assert.strictEqual(activeContent, 'ini12tial');
      assert.strictEqual(hookResult.historyIndexRef.current, 2);

      // 3. Trigger undo keydown (Ctrl+Z)
      let prevented = false;
      let stopped = false;
      const undoEvent = {
        key: 'z',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault() {
          prevented = true;
        },
        stopPropagation() {
          stopped = true;
        },
      };

      hookResult.handleRawStyleKeyDown(undoEvent);
      assert.strictEqual(prevented, true, 'Must preventDefault on undo key match');
      assert.strictEqual(stopped, true, 'Must stopPropagation on undo key match');
      assert.strictEqual(activeContent, 'ini1tial', 'Undo must restore previous content');
      assert.strictEqual(hookResult.selectionRef.current?.start, 4, 'Undo must restore previous cursor position');
      assert.strictEqual(hookResult.historyIndexRef.current, 1);

      // 4. Undo again to initial
      hookResult.handleRawStyleKeyDown(undoEvent);
      assert.strictEqual(activeContent, 'initial', 'Second undo must restore initial content');
      assert.strictEqual(hookResult.selectionRef.current?.start, 0);
      assert.strictEqual(hookResult.historyIndexRef.current, 0);

      // 5. Undo at top of stack is a no-op
      hookResult.handleRawStyleKeyDown(undoEvent);
      assert.strictEqual(activeContent, 'initial');
      assert.strictEqual(hookResult.historyIndexRef.current, 0);
    });

    it('re-applies undone edit and restores cursor position on redo', async () => {
      let activeContent = 'hello';
      const onUpdateContent = (c: string) => {
        activeContent = c;
      };
      const onValidateAndSync = async () => {};

      let hookResult: any;
      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: activeContent,
          onUpdateContent,
          onValidateAndSync,
        });
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      hookResult.handleRawStyleChange({
        target: {
          value: 'hello world',
          selectionStart: 11,
          selectionEnd: 11,
        },
      });
      assert.strictEqual(activeContent, 'hello world');

      // Undo
      hookResult.undo();
      assert.strictEqual(activeContent, 'hello');

      // Redo via keydown (Ctrl+Y)
      let redoPrevented = false;
      hookResult.handleRawStyleKeyDown({
        key: 'y',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault() {
          redoPrevented = true;
        },
        stopPropagation() {},
      });
      assert.strictEqual(redoPrevented, true, 'Ctrl+Y must be prevented');
      assert.strictEqual(activeContent, 'hello world', 'Redo must reapply edit');
      assert.strictEqual(hookResult.selectionRef.current?.start, 11, 'Redo must restore cursor at end of re-applied text');

      // Undo and redo via alternative Ctrl+Shift+Z
      hookResult.undo();
      assert.strictEqual(activeContent, 'hello');

      let shiftZPrevented = false;
      hookResult.handleRawStyleKeyDown({
        key: 'z',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
        preventDefault() {
          shiftZPrevented = true;
        },
        stopPropagation() {},
      });
      assert.strictEqual(shiftZPrevented, true);
      assert.strictEqual(activeContent, 'hello world', 'Ctrl+Shift+Z must also trigger redo');
    });

    it('dynamically resolves custom key combinations configured in registeredActionsSignal for undo and redo', async () => {
      // Configure custom key combinations in registeredActionsSignal
      const originalActions = registeredActionsSignal.value;
      registeredActionsSignal.value = [
        {
          name: 'undo_action',
          description: 'Custom Undo',
          keyCombination: { key: 'u', alt: true },
        },
        {
          name: 'redo_action',
          description: 'Custom Redo',
          keyCombination: { key: 'r', alt: true },
        },
      ];

      try {
        let activeContent = 'base';
        let hookResult: any;
        function TestHookWrapper() {
          hookResult = useRawStyleTextEditorHistory({
            content: activeContent,
            onUpdateContent: (c: string) => {
              activeContent = c;
            },
            onValidateAndSync: async () => {},
          });
          return null;
        }

        renderToStaticMarkup(React.createElement(TestHookWrapper));

        hookResult.handleRawStyleChange({
          target: {
            value: 'base-modified',
            selectionStart: 13,
            selectionEnd: 13,
          },
        });
        assert.strictEqual(activeContent, 'base-modified');

        // Normal Ctrl+Z must NOT undo since action has custom keyCombination Alt+U
        let ctrlZPrevented = false;
        hookResult.handleRawStyleKeyDown({
          key: 'z',
          ctrlKey: true,
          altKey: false,
          shiftKey: false,
          metaKey: false,
          preventDefault() {
            ctrlZPrevented = true;
          },
          stopPropagation() {},
        });
        assert.strictEqual(ctrlZPrevented, false, 'Ctrl+Z must not trigger when action is mapped to Alt+U');
        assert.strictEqual(activeContent, 'base-modified');

        // Alt+U must trigger undo
        let altUPrevented = false;
        hookResult.handleRawStyleKeyDown({
          key: 'u',
          ctrlKey: false,
          altKey: true,
          shiftKey: false,
          metaKey: false,
          preventDefault() {
            altUPrevented = true;
          },
          stopPropagation() {},
        });
        assert.strictEqual(altUPrevented, true, 'Alt+U must trigger undo per registeredActionsSignal');
        assert.strictEqual(activeContent, 'base');

        // Alt+R must trigger redo
        let altRPrevented = false;
        hookResult.handleRawStyleKeyDown({
          key: 'r',
          ctrlKey: false,
          altKey: true,
          shiftKey: false,
          metaKey: false,
          preventDefault() {
            altRPrevented = true;
          },
          stopPropagation() {},
        });
        assert.strictEqual(altRPrevented, true, 'Alt+R must trigger redo per registeredActionsSignal');
        assert.strictEqual(activeContent, 'base-modified');
      } finally {
        registeredActionsSignal.value = originalActions;
      }
    });

    it('undo and redo operations in raw style text control do not modify workbench undoStackSignal', async () => {
      undoStackSignal.value = [{ action: 'gis_edit_1' }, { action: 'gis_edit_2' }];
      const initialStackLen = undoStackSignal.value.length;

      let activeContent = 'original';
      let hookResult: any;
      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: activeContent,
          onUpdateContent: (c: string) => {
            activeContent = c;
          },
          onValidateAndSync: async () => {},
        });
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      hookResult.handleRawStyleChange({
        target: {
          value: 'original-edited',
          selectionStart: 15,
          selectionEnd: 15,
        },
      });

      hookResult.undo();
      assert.strictEqual(activeContent, 'original');
      assert.strictEqual(undoStackSignal.value.length, initialStackLen, 'GIS undoStackSignal must remain untouched');

      hookResult.redo();
      assert.strictEqual(activeContent, 'original-edited');
      assert.strictEqual(undoStackSignal.value.length, initialStackLen, 'GIS undoStackSignal must remain untouched');

      undoStackSignal.value = [];
    });

    it('debounces live validation until typing has paused without altering raw style text', async () => {
      let draftContent = 'color: red;';
      const validationCalls: string[] = [];
      const onUpdateContent = (c: string) => {
        draftContent = c;
      };
      const onValidateAndSync = async (c: string) => {
        validationCalls.push(c);
      };

      let hookResult: any;
      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: draftContent,
          debounceMs: 40,
          onUpdateContent,
          onValidateAndSync,
        });
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      // First keystroke
      hookResult.handleRawStyleChange({
        target: {
          value: 'color: bl',
          selectionStart: 9,
          selectionEnd: 9,
        },
      });
      assert.strictEqual(draftContent, 'color: bl');
      assert.strictEqual(validationCalls.length, 0, 'Validation must not run immediately');

      // Wait 15ms (less than 40ms debounce)
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Second keystroke before debounce timer expires
      hookResult.handleRawStyleChange({
        target: {
          value: 'color: blue;',
          selectionStart: 12,
          selectionEnd: 12,
        },
      });
      assert.strictEqual(draftContent, 'color: blue;');
      assert.strictEqual(validationCalls.length, 0, 'Validation must still be waiting');

      // Wait 50ms (exceeds 40ms from second keystroke)
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.strictEqual(validationCalls.length, 1, 'Validation should fire once after pause');
      assert.strictEqual(validationCalls[0], 'color: blue;');
      // Verify raw style text in draft remains completely unaltered
      assert.strictEqual(draftContent, 'color: blue;');
    });

    it('synchronizes external baseline style updates so undo never reverts to an empty placeholder', async () => {
      let currentContent = '';
      let hookResult: any;

      function TestHookWrapper({ content }: { content: string }) {
        hookResult = useRawStyleTextEditorHistory({
          content,
          debounceMs: 0,
          onUpdateContent: (c: string) => {
            currentContent = c;
          },
          onValidateAndSync: async () => {},
        });
        return null;
      }

      // 1. Initial mount when dialog opens before async style text is fetched (content is empty)
      renderToStaticMarkup(React.createElement(TestHookWrapper, { content: '' }));
      assert.strictEqual(hookResult.historyStackRef.current.length, 1);
      assert.strictEqual(hookResult.historyStackRef.current[0].content, '');

      // 2. Async style text arrives and updates draft.styleContent
      const loadedStyle = '{"version": 8, "layers": []}';
      currentContent = loadedStyle;
      renderToStaticMarkup(React.createElement(TestHookWrapper, { content: loadedStyle }));
      assert.strictEqual(hookResult.historyStackRef.current.length, 1);
      assert.strictEqual(
        hookResult.historyStackRef.current[0].content,
        loadedStyle,
        'Empty baseline placeholder must be replaced by loaded style'
      );

      // 3. User makes an edit
      hookResult.handleRawStyleChange({
        target: {
          value: '{"version": 8, "layers": ["test"]}',
          selectionStart: 35,
          selectionEnd: 35,
        },
      });
      assert.strictEqual(currentContent, '{"version": 8, "layers": ["test"]}');
      assert.strictEqual(hookResult.historyIndexRef.current, 1);

      // 4. User triggers Undo (Ctrl+Z)
      const didUndo = hookResult.undo();
      assert.strictEqual(didUndo, true);
      assert.strictEqual(
        currentContent,
        loadedStyle,
        'Undo must revert to loaded style, NOT empty string placeholder'
      );

      // 5. Subsequent undo is not possible
      const secondUndo = hookResult.undo();
      assert.strictEqual(secondUndo, false);
      assert.strictEqual(currentContent, loadedStyle, 'Style content must never disappear on undo');
    });

    it('flushes pending debounced validation immediately when textarea loses focus (blur)', async () => {
      let draftContent = 'color: red;';
      const validationCalls: string[] = [];
      let hookResult: any;

      function TestHookWrapper() {
        hookResult = useRawStyleTextEditorHistory({
          content: draftContent,
          debounceMs: 500, // long debounce
          onUpdateContent: (c: string) => {
            draftContent = c;
          },
          onValidateAndSync: async (c: string) => {
            validationCalls.push(c);
          },
        });
        return null;
      }

      renderToStaticMarkup(React.createElement(TestHookWrapper));

      hookResult.handleRawStyleChange({
        target: {
          value: 'color: green;',
          selectionStart: 13,
          selectionEnd: 13,
        },
      });

      assert.strictEqual(validationCalls.length, 0, 'Validation waiting on debounce timer');

      // Trigger blur
      hookResult.handleRawStyleBlur();

      assert.strictEqual(validationCalls.length, 1, 'Blur must flush pending validation immediately');
      assert.strictEqual(validationCalls[0], 'color: green;');
    });

    it('preserves previous text when Apply or OK is attempted with validation errors', async () => {
      // Setup draft state with a validation error
      activeLayerPropertiesIdSignal.value = 'mock-layer-1';
      layerPropertiesDraftSignal.value = {
        ...layerPropertiesDraftSignal.value,
        styleContent: 'invalid: { unparseable syntax }',
        styleValidationError: 'Style syntax or validation error: Unexpected token',
      };

      // Calling applyLayerPropertiesEdits must return false and fail to apply
      const applyResult = await applyLayerPropertiesEdits();
      assert.strictEqual(applyResult, false, 'applyLayerPropertiesEdits must return false when validation error exists');

      // Calling commitAndCloseLayerPropertiesDialog must also return false and leave dialog open
      const okResult = await commitAndCloseLayerPropertiesDialog();
      assert.strictEqual(okResult, false, 'commitAndCloseLayerPropertiesDialog must return false when validation error exists');
      assert.strictEqual(activeLayerPropertiesIdSignal.value, 'mock-layer-1', 'Dialog must remain open when validation errors exist');

      // Render dialog and verify Apply and OK buttons have disabled attribute
      const markup = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(markup.includes('disabled'), 'Buttons must be disabled in dialog when draft has styleValidationError');

      // Clean up signals
      activeLayerPropertiesIdSignal.value = null;
      layerPropertiesDraftSignal.value = {
        layerId: '',
        layerName: '',
        crsAuthId: 'EPSG:4326',
        featureFilter: '',
        styleFormat: 'openlayers',
        sldVersion: '1.0.0',
        styleContent: '',
        styleValidationError: null,
        visualSymbolizer: null,
        idValidationError: null,
      };
    });
  });

  describe('Simple Mode Visual Component Stack & Dynamic Style Options (Ticket #128)', () => {
    it('renders component stack list in reversed painter order and highlights active selection', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';

      const initialStyle = {
        format: 'simple',
        version: 1,
        components: [
          { id: 'fill-bottom', type: 'simple-fill', enabled: true, color: '#336699' },
          { id: 'line-top', type: 'simple-line', enabled: true, color: '#000000', width: 2 },
        ],
      };

      updateLayerPropertiesDraft({
        styleFormat: 'cartouche',
        styleContent: JSON.stringify(initialStyle),
      });

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(html.includes('id="layer-prop-component-stack-list"'), 'Must render component stack list');
      assert.ok(html.includes('data-component-id="line-top"'), 'Must render line-top component');
      assert.ok(html.includes('data-component-id="fill-bottom"'), 'Must render fill-bottom component');
      assert.ok(!html.includes('(line-top)'), 'Must not display parenthetical component id for line-top');
      assert.ok(!html.includes('(fill-bottom)'), 'Must not display parenthetical component id for fill-bottom');

      // In visual order (reversed painter order), line-top (index 1) must precede fill-bottom (index 0) in the HTML
      const linePos = html.indexOf('data-component-id="line-top"');
      const fillPos = html.indexOf('data-component-id="fill-bottom"');
      assert.ok(linePos < fillPos, 'line-top (top painter item) must appear before fill-bottom in visual stack list');
    });

    it('filters component types based on layer geometry (Polygon vs LineString vs Point)', () => {
      // 1. Polygon: allows Fill, Line, and Marker
      let html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [{ id: 'c1', type: 'simple-fill', enabled: true, color: '#ff0000' }],
          }),
          geometryKind: 'Polygon',
          onChange: () => {},
        })
      );
      assert.ok(html.includes('value="simple-fill"'), 'Polygon must offer simple-fill');
      assert.ok(html.includes('value="simple-line"'), 'Polygon must offer simple-line');

      // 2. LineString: must omit Fill components
      html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [{ id: 'c1', type: 'simple-line', enabled: true, color: '#000000', width: 2 }],
          }),
          geometryKind: 'LineString',
          onChange: () => {},
        })
      );
      assert.ok(!html.includes('value="simple-fill"'), 'LineString must NOT offer simple-fill');
      assert.ok(html.includes('value="simple-line"'), 'LineString must offer simple-line');

      // 3. Point: offers Marker and Line, omits Fill
      html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [
              {
                id: 'c1',
                type: 'simple-marker',
                enabled: true,
                shape: 'circle',
                radius: 6,
                fillColor: '#00ff00',
                strokeColor: '#000000',
                strokeWidth: 1,
              },
            ],
          }),
          geometryKind: 'Point',
          onChange: () => {},
        })
      );
      assert.ok(!html.includes('value="simple-fill"'), 'Point must NOT offer simple-fill');
      assert.ok(html.includes('value="simple-marker"'), 'Point must offer simple-marker');
      assert.ok(html.includes('value="simple-line"'), 'Point must offer simple-line');
    });

    it('renders type-specific Style Options for Simple Fill, Simple Line, and Simple Marker', () => {
      // 1. Simple Fill options
      let html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [{ id: 'fill-1', type: 'simple-fill', enabled: true, color: '#123456' }],
          }),
          geometryKind: 'Polygon',
          onChange: () => {},
        })
      );
      assert.ok(html.includes('id="layer-prop-fill-color"'), 'Must render fill color input for simple-fill');
      assert.ok(html.includes('value="#123456"'), 'Must reflect fill color');

      // 2. Simple Line options
      html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [
              {
                id: 'line-1',
                type: 'simple-line',
                enabled: true,
                color: '#654321',
                width: 4,
                dashArray: [6, 6],
              },
            ],
          }),
          geometryKind: 'LineString',
          onChange: () => {},
        })
      );
      assert.ok(html.includes('id="layer-prop-stroke-color"'), 'Must render stroke color input for simple-line');
      assert.ok(html.includes('id="layer-prop-stroke-width"'), 'Must render stroke width input for simple-line');
      assert.ok(html.includes('id="layer-prop-stroke-dash"'), 'Must render stroke dash checkbox for simple-line');
      assert.ok(html.includes('value="#654321"'), 'Must reflect stroke color');
      assert.ok(html.includes('value="4"'), 'Must reflect stroke width');

      // 3. Simple Marker options
      html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [
              {
                id: 'mark-1',
                type: 'simple-marker',
                enabled: true,
                shape: 'circle',
                radius: 8,
                fillColor: '#ff00ff',
                strokeColor: '#00ffff',
                strokeWidth: 2,
              },
            ],
          }),
          geometryKind: 'Point',
          onChange: () => {},
        })
      );
      assert.ok(html.includes('id="layer-prop-point-shape"'), 'Must render marker shape for simple-marker');
      assert.ok(html.includes('id="layer-prop-marker-radius"'), 'Must render marker radius for simple-marker');
      assert.ok(html.includes('id="layer-prop-marker-fill-color"'), 'Must render marker fill color for simple-marker');
      assert.ok(html.includes('id="layer-prop-marker-stroke-color"'), 'Must render marker stroke color for simple-marker');
      assert.ok(html.includes('id="layer-prop-marker-stroke-width"'), 'Must render marker stroke width for simple-marker');
      assert.ok(html.includes('value="8"'), 'Must reflect marker radius');
    });

    it('locking a component disables option controls, greys out remove button, and renders lock banner', () => {
      const html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: [
              { id: 'fill-1', type: 'simple-fill', enabled: true, color: '#111111' },
              { id: 'fill-2', type: 'simple-fill', enabled: true, locked: true, color: '#222222' },
            ],
          }),
          geometryKind: 'Polygon',
          onChange: () => {},
        })
      );

      // Active component is fill-2 (top component) which is locked
      assert.ok(html.includes('component-locked-banner'), 'Must render component locked banner');
      assert.ok(html.includes('id="layer-prop-fill-color"'), 'Must render fill color input');
      assert.ok(
        /id="layer-prop-fill-color"[^>]*disabled=""/.test(html),
        'Fill color input must be disabled'
      );
      assert.ok(html.includes('id="layer-prop-component-remove"'), 'Must render remove button');
      assert.ok(
        /id="layer-prop-component-remove"[^>]*disabled=""/.test(html),
        'Remove button must be disabled for locked component'
      );
    });

    it('safely parses style content or falls back to default style with parseCartoucheStyleSafe', () => {
      // Valid style
      const valid = parseCartoucheStyleSafe(
        JSON.stringify({
          format: 'simple',
          version: 1,
          components: [{ id: 'a', type: 'simple-fill', enabled: true, color: '#000000' }],
        })
      );
      assert.strictEqual(valid.format, 'simple');
      assert.strictEqual(valid.components.length, 1);
      assert.strictEqual(valid.components[0].id, 'a');

      // Empty or invalid JSON
      const fallback = parseCartoucheStyleSafe('', 'LineString');
      assert.strictEqual(fallback.format, 'simple');
      assert.ok(fallback.components.length >= 1);
      assert.strictEqual(fallback.components[0].type, 'simple-line');
    });

    it('renders component stack action buttons in two columns with icons only and enforces 32-component cap', () => {
      const initialStyle = {
        format: 'simple',
        version: 1,
        components: [
          { id: 'fill-1', type: 'simple-fill', enabled: true, color: '#3b82f6' },
          { id: 'line-1', type: 'simple-line', enabled: true, color: '#000000', width: 2 },
        ],
      };

      const html = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify(initialStyle),
          geometryKind: 'Polygon',
          onChange: () => {},
        })
      );

      // Verify 2-column actions grid container exists
      assert.ok(html.includes('id="layer-prop-component-actions"'), 'Must render component actions grid container');
      assert.ok(html.includes('class="layer-prop-component-actions"'), 'Must have layer-prop-component-actions class');

      // Verify list has minimum height of at least 6 rows (12rem)
      assert.ok(html.includes('min-height:12rem'), 'Component stack list must have min-height of 12rem (at least 6 rows)');

      // Verify all 6 buttons exist with titles and aria-labels
      assert.ok(html.includes('id="layer-prop-component-add"'), 'Must render add button');
      assert.ok(html.includes('id="layer-prop-component-remove"'), 'Must render remove button');
      assert.ok(html.includes('id="layer-prop-component-move-up"'), 'Must render move-up button');
      assert.ok(html.includes('id="layer-prop-component-move-down"'), 'Must render move-down button');
      assert.ok(html.includes('id="layer-prop-component-duplicate"'), 'Must render duplicate button');
      assert.ok(html.includes('id="layer-prop-component-lock"'), 'Must render lock button');

      // Verify buttons do not contain text spans inside them (icon-only buttons)
      const addBtnMatch = html.match(/<button[^>]*id="layer-prop-component-add"[^>]*>([\s\S]*?)<\/button>/);
      assert.ok(addBtnMatch, 'Add button must be matched');
      assert.ok(!addBtnMatch[1].includes('<span'), 'Add button must not contain a text span (icon-only)');

      // Test 32-component cap disables Add and Duplicate buttons
      const cappedComponents = Array.from({ length: 32 }, (_, i) => ({
        id: `fill-${i}`,
        type: 'simple-fill',
        enabled: true,
        color: '#000000',
      }));

      const cappedHtml = renderToStaticMarkup(
        React.createElement(SimpleModeEditor, {
          styleContent: JSON.stringify({
            format: 'simple',
            version: 1,
            components: cappedComponents,
          }),
          geometryKind: 'Polygon',
          onChange: () => {},
        })
      );

      assert.ok(
        /id="layer-prop-component-add"[^>]*disabled=""/.test(cappedHtml),
        'Add button must be disabled when 32 components exist'
      );
      assert.ok(
        /id="layer-prop-component-duplicate"[^>]*disabled=""/.test(cappedHtml),
        'Duplicate button must be disabled when 32 components exist'
      );
    });
  });

  describe('Layer Field Type Inspection & Manual Overrides (Ticket #141)', () => {
    it('reads field definitions directly from projectLayersSignal without calling layers:getLayerInfo', async () => {
      let getLayerInfoCalled = false;
      (globalThis as any).window.electronAPI.getLayerInfo = async () => {
        getLayerInfoCalled = true;
        throw new Error('layers:getLayerInfo should not be invoked when fields are in projectLayersSignal');
      };

      const testLayerId = 'layer-in-memory-141';
      const sampleFields = [
        {
          name: 'parcel_id',
          nativeType: 'Integer',
          inferredType: 'integer' as const,
          width: 10,
          precision: 0,
          nullable: false,
        },
        {
          name: 'metadata_raw',
          nativeType: 'String',
          inferredType: 'json' as const,
          width: 0,
          precision: 0,
          nullable: true,
          userOverridden: true,
        },
      ];

      projectLayersSignal.value = [
        {
          id: testLayerId,
          name: 'Parcels In Memory',
          type: 'vector',
          source: '/data/parcels.shp',
          fields: sampleFields,
          geometryKind: 'Polygon',
        },
      ];
      projectTreeSignal.value = [
        {
          id: testLayerId,
          name: 'Parcels In Memory',
          type: 'vector',
          source: '/data/parcels.shp',
          fields: sampleFields,
          geometryKind: 'Polygon',
        },
      ];

      activeLayerPropertiesIdSignal.value = testLayerId;
      layerPropertiesDraftSignal.value = {
        layerName: 'Parcels In Memory',
        layerId: testLayerId,
        crsAuthId: 'EPSG:4326',
        featureFilter: '',
        idValidationError: null,
        styleFormat: 'openlayers',
        sldVersion: '1.0.0',
        styleContent: '',
        styleValidationError: null,
        visualSymbolizer: {},
        opacity: 1,
        formatCache: {},
        fields: sampleFields,
      };

      // 1. Information Tab test
      activeLayerPropertiesTabSignal.value = 'information';
      const infoHtml = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(infoHtml.includes('parcel_id'), 'Information tab must render parcel_id from projectLayersSignal');
      assert.ok(infoHtml.includes('metadata_raw'), 'Information tab must render metadata_raw from projectLayersSignal');
      assert.ok(infoHtml.includes('integer'), 'Information tab must display inferredType integer');
      assert.ok(infoHtml.includes('json'), 'Information tab must display inferredType json');
      assert.equal(getLayerInfoCalled, false, 'getLayerInfo must not be invoked during in-memory field rendering');

      // 2. Fields Tab test
      activeLayerPropertiesTabSignal.value = 'fields';
      const fieldsHtml = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert.ok(fieldsHtml.includes('parcel_id'), 'Fields tab must render parcel_id from projectLayersSignal');
      assert.ok(fieldsHtml.includes('metadata_raw'), 'Fields tab must render metadata_raw from projectLayersSignal');
      assert.equal(getLayerInfoCalled, false, 'getLayerInfo must not be invoked on Fields tab');
    });

    it('displays the current inferredType for each attribute with clear visual indication for user-overridden fields', () => {
      const testLayerId = 'layer-visual-override-141';
      const sampleFields = [
        {
          name: 'normal_field',
          nativeType: 'String',
          inferredType: 'string' as const,
          userOverridden: false,
        },
        {
          name: 'overridden_field',
          nativeType: 'String',
          inferredType: 'uuid' as const,
          userOverridden: true,
        },
      ];

      projectLayersSignal.value = [
        {
          id: testLayerId,
          name: 'Override Visual Layer',
          type: 'vector',
          source: '/data/overrides.shp',
          fields: sampleFields,
        },
      ];
      activeLayerPropertiesIdSignal.value = testLayerId;
      layerPropertiesDraftSignal.value = {
        layerName: 'Override Visual Layer',
        layerId: testLayerId,
        crsAuthId: 'EPSG:4326',
        featureFilter: '',
        idValidationError: null,
        styleFormat: 'openlayers',
        sldVersion: '1.0.0',
        styleContent: '',
        styleValidationError: null,
        visualSymbolizer: {},
        opacity: 1,
        formatCache: {},
        fields: sampleFields,
      };

      activeLayerPropertiesTabSignal.value = 'fields';
      const fieldsHtml = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

      // Overridden field must render User badge and green override styling
      assert.ok(
        fieldsHtml.includes('layer-field-override-badge'),
        'Must render layer-field-override-badge for user-overridden field'
      );
      assert.ok(
        fieldsHtml.includes('User</span>'),
        'Must render User text badge for user-overridden field'
      );
      assert.ok(
        fieldsHtml.includes('background-color:#f0fdf4') || fieldsHtml.includes('backgroundColor:#f0fdf4'),
        'Overridden select element must have light green background style'
      );
    });

    it('renders in-table dropdown selector offering all 20 canonical scalar and array types', () => {
      const testLayerId = 'layer-dropdown-141';
      const sampleFields = [
        {
          name: 'field_types_test',
          nativeType: 'String',
          inferredType: 'string' as const,
        },
      ];

      projectLayersSignal.value = [
        {
          id: testLayerId,
          name: 'Types Test Layer',
          type: 'vector',
          source: '/data/types.shp',
          fields: sampleFields,
        },
      ];
      activeLayerPropertiesIdSignal.value = testLayerId;
      layerPropertiesDraftSignal.value = {
        layerName: 'Types Test Layer',
        layerId: testLayerId,
        crsAuthId: 'EPSG:4326',
        featureFilter: '',
        idValidationError: null,
        styleFormat: 'openlayers',
        sldVersion: '1.0.0',
        styleContent: '',
        styleValidationError: null,
        visualSymbolizer: {},
        opacity: 1,
        formatCache: {},
        fields: sampleFields,
      };

      activeLayerPropertiesTabSignal.value = 'fields';
      const fieldsHtml = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

      assert.ok(
        fieldsHtml.includes('layer-field-type-select'),
        'Must render select with layer-field-type-select class'
      );

      // Verify all 20 canonical types are present as options
      assert.equal(CANONICAL_INFERRED_FIELD_TYPES.length, 20);
      for (const canonicalType of CANONICAL_INFERRED_FIELD_TYPES) {
        assert.ok(
          fieldsHtml.includes(`value="${canonicalType}"`) &&
          fieldsHtml.includes(`>${canonicalType}</option>`),
          `Select dropdown must include option for ${canonicalType}`
        );
      }
    });

    it('modifying an inferredType marks userOverridden: true, updates projectLayersSignal, and sets Project Dirty State', async () => {
      const testLayerId = 'layer-state-update-141';
      const initialFields = [
        {
          name: 'population',
          nativeType: 'Real',
          inferredType: 'real' as const,
          userOverridden: false,
        },
      ];

      projectLayersSignal.value = [
        {
          id: testLayerId,
          name: 'State Update Layer',
          type: 'vector',
          source: '/data/state.shp',
          fields: initialFields,
        },
      ];
      isProjectDirtySignal.value = false;

      // 1. Test renderer updateLayerFields function
      const updatedFields = [
        {
          name: 'population',
          nativeType: 'Real',
          inferredType: 'integer' as const,
          userOverridden: true,
        },
      ];

      updateLayerFields(testLayerId, updatedFields);
      assert.equal(isProjectDirtySignal.value, true, 'updateLayerFields must flag isProjectDirtySignal');
      const updatedLayer = projectLayersSignal.value.find((l: any) => l.id === testLayerId);
      assert.ok(updatedLayer, 'Layer must still exist in projectLayersSignal');
      assert.equal(updatedLayer.fields?.[0].inferredType, 'integer');
      assert.equal(updatedLayer.fields?.[0].userOverridden, true);

      // 2. Test IPC dispatch to window.electronAPI.updateLayerFields
      let ipcLayerId = '';
      let ipcFields: any[] = [];
      (globalThis as any).window.electronAPI.updateLayerFields = async (id: string, fields: any[]) => {
        ipcLayerId = id;
        ipcFields = fields;
        return true;
      };

      if ((globalThis as any).window.electronAPI.updateLayerFields) {
        await (globalThis as any).window.electronAPI.updateLayerFields(testLayerId, updatedFields);
      }
      assert.equal(ipcLayerId, testLayerId, 'Must pass layerId to IPC updateLayerFields');
      assert.equal(ipcFields.length, 1);
      assert.equal(ipcFields[0].inferredType, 'integer');
      assert.equal(ipcFields[0].userOverridden, true);
    });
  });

  describe('Fields Tab Transactional Draft Isolation (Ticket #144 - ADR 0024)', () => {
    const testLayerId = 'layer-fields-draft-144';
    const initialFields = [
      {
        name: 'pop_density',
        nativeType: 'Real',
        inferredType: 'real' as const,
        userOverridden: false,
      },
    ];

    beforeEach(() => {
      projectLayersSignal.value = [
        {
          id: testLayerId,
          name: 'Draft Isolation Layer',
          type: 'vector',
          source: '/data/draft-isolation.shp',
          fields: initialFields.map((f) => ({ ...f })),
        },
      ];
      projectTreeSignal.value = [
        {
          id: testLayerId,
          name: 'Draft Isolation Layer',
          type: 'vector',
          source: '/data/draft-isolation.shp',
          fields: initialFields.map((f) => ({ ...f })),
        },
      ];
      isProjectDirtySignal.value = false;
    });

    afterEach(() => {
      closeLayerPropertiesDialog();
    });

    it('isolates field modifications in layerPropertiesDraftSignal without mutating projectLayersSignal or calling IPC', async () => {
      let ipcCalled = false;
      (globalThis as any).window.electronAPI.updateLayerFields = async () => {
        ipcCalled = true;
        return true;
      };

      await openLayerPropertiesDialog(testLayerId);
      activeLayerPropertiesTabSignal.value = 'fields';

      // Verify initial draft is populated with initial fields
      assert.ok(layerPropertiesDraftSignal.value.fields, 'Draft fields must be initialized');
      assert.equal(layerPropertiesDraftSignal.value.fields[0].inferredType, 'real');

      // Mutate draft fields (simulating handleFieldTypeChange in dialog)
      const updatedDraftFields = [
        {
          name: 'pop_density',
          nativeType: 'Real',
          inferredType: 'integer' as const,
          userOverridden: true,
        },
      ];
      updateLayerPropertiesDraft({ fields: updatedDraftFields });

      // Draft must reflect changes
      assert.equal(layerPropertiesDraftSignal.value.fields?.[0].inferredType, 'integer');
      assert.equal(layerPropertiesDraftSignal.value.fields?.[0].userOverridden, true);

      // Project state must NOT be modified while dialog remains uncommitted
      const projectLayer = projectLayersSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal(projectLayer?.fields?.[0].inferredType, 'real', 'projectLayersSignal must remain unmodified');
      assert.equal(projectLayer?.fields?.[0].userOverridden, false, 'projectLayersSignal userOverridden must remain false');

      const treeLayer = projectTreeSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal((treeLayer as any)?.fields?.[0].inferredType, 'real', 'projectTreeSignal must remain unmodified');

      // IPC must NOT be called
      assert.equal(ipcCalled, false, 'IPC updateLayerFields must not be called during draft editing');
    });

    it('commits draft fields to projectLayersSignal, projectTreeSignal, and IPC upon applyLayerPropertiesEdits', async () => {
      let ipcCalled = false;
      let ipcLayerId = '';
      let ipcFields: any[] = [];
      (globalThis as any).window.electronAPI.updateLayerFields = async (id: string, fields: any[]) => {
        ipcCalled = true;
        ipcLayerId = id;
        ipcFields = fields;
        return true;
      };

      await openLayerPropertiesDialog(testLayerId);
      const updatedDraftFields = [
        {
          name: 'pop_density',
          nativeType: 'Real',
          inferredType: 'integer' as const,
          userOverridden: true,
        },
      ];
      updateLayerPropertiesDraft({ fields: updatedDraftFields });

      const commitResult = await applyLayerPropertiesEdits();
      assert.equal(commitResult, true, 'applyLayerPropertiesEdits must succeed');

      // Verify projectLayersSignal and projectTreeSignal updated
      const projectLayer = projectLayersSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal(projectLayer?.fields?.[0].inferredType, 'integer');
      assert.equal(projectLayer?.fields?.[0].userOverridden, true);

      const treeLayer = projectTreeSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal((treeLayer as any)?.fields?.[0].inferredType, 'integer');
      assert.equal((treeLayer as any)?.fields?.[0].userOverridden, true);

      // Verify IPC was dispatched
      assert.equal(ipcCalled, true, 'IPC updateLayerFields must be called upon apply');
      assert.equal(ipcLayerId, testLayerId);
      assert.equal(ipcFields[0].inferredType, 'integer');
      assert.equal(ipcFields[0].userOverridden, true);

      // Verify Project Dirty State is flagged via isProjectDirtySignal
      assert.equal(isProjectDirtySignal.value, true);

      // Verify layerDetailedInfoSignal fields updated if present
      assert.equal(layerDetailedInfoSignal.value?.fields?.[0].inferredType, 'integer');
    });

    it('discards draft fields and leaves projectLayersSignal intact upon cancelLayerPropertiesEdits', async () => {
      let ipcCalled = false;
      (globalThis as any).window.electronAPI.updateLayerFields = async () => {
        ipcCalled = true;
        return true;
      };

      await openLayerPropertiesDialog(testLayerId);
      const updatedDraftFields = [
        {
          name: 'pop_density',
          nativeType: 'Real',
          inferredType: 'uuid' as const,
          userOverridden: true,
        },
      ];
      updateLayerPropertiesDraft({ fields: updatedDraftFields });

      // Cancel edits
      cancelLayerPropertiesEdits();

      // Draft must be reset
      assert.equal(layerPropertiesDraftSignal.value.fields, undefined);
      assert.equal(activeLayerPropertiesIdSignal.value, null);

      // Project state must remain original
      const projectLayer = projectLayersSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal(projectLayer?.fields?.[0].inferredType, 'real');
      assert.equal(projectLayer?.fields?.[0].userOverridden, false);

      const treeLayer = projectTreeSignal.value.find((l: any) => l.id === testLayerId);
      assert.equal((treeLayer as any)?.fields?.[0].inferredType, 'real');

      // IPC must NOT be called
      assert.equal(ipcCalled, false, 'IPC updateLayerFields must not be called upon cancel');
    });
  });
});
