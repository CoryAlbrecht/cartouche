/**
 * @file LayerPropertiesDialogComponent.test.ts
 * @module tests/renderer/dialogs/LayerPropertiesDialogComponent.test
 * @description Component and reactive tests for LayerPropertiesDialog verifying modeless rendering, Information tab metadata, 6-column fields table formatting, tab switching, and localization parity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-31
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
const { LayerPropertiesDialog } = jiti('../../../src/renderer/workbench/dialogs/LayerPropertiesDialog.tsx');
const {
  activeLayerPropertiesIdSignal,
  activeLayerPropertiesTabSignal,
  layerDetailedInfoSignal,
  layerPropertiesDraftSignal,
  openLayerPropertiesDialog,
  closeLayerPropertiesDialog,
  cancelLayerPropertiesEdits,
  updateLayerPropertiesDraft,
  applyLayerPropertiesEdits,
  commitAndCloseLayerPropertiesDialog,
} = jiti('../../../src/renderer/state/layerPropertiesSignals.ts');
const { projectTreeSignal, isProjectDirtySignal } = jiti('../../../src/renderer/state/projectSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

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
        getLayerInfo: async (layerId: string) => ({
          layerId,
          name: 'North America Lakes',
          source: '/data/lakes.shp',
          driverName: 'ESRI Shapefile',
          driverDialect: 'ogr_sql',
          geometryKind: 'Polygon',
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
        })
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
    await openLayerPropertiesDialog('layer-lakes-1');
    activeLayerPropertiesTabSignal.value = 'fields';

    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));

    assert(html.includes('Toggle Editing Mode'), 'Should render Toggle Editing Mode toolbar button');
    assert(html.includes('New Field'), 'Should render New Field toolbar button');
    assert(html.includes('Delete Selected Field'), 'Should render Delete Field toolbar button');
    assert(html.includes('Calculate Virtual Field'), 'Should render Calculate Virtual Field toolbar button');
    assert(html.includes('Comment'), 'Should render Comment column header');
    assert(html.includes('scalerank'), 'Should render field rows in table');
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

    it('renders conditional SLD Version selector when format is SLD', async () => {
      await openLayerPropertiesDialog('layer-lakes-1');
      activeLayerPropertiesTabSignal.value = 'styling';
      updateLayerPropertiesDraft({ styleFormat: 'sld', sldVersion: '1.0.0' });

      const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
      assert(html.includes('id="layer-prop-styling-version"'), 'Must render SLD version selector when format is sld');
      assert(html.includes('value="1.0.0"'));
      assert(html.includes('value="1.1.0"'));
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
});
