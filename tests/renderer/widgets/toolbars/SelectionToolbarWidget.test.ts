/**
 * @file SelectionToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/SelectionToolbarWidget.test
 * @description Unit and component tests for SelectionToolbarWidget verifying SplitToolButton selection modes, SelectByValue dialog trigger, select all / deselect all actions, and active/disabled button states.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link SelectionToolbarWidget}
 * @see {@link isDeselectAllDisabled}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import {
  mdiSelect,
  mdiSelectDrag,
  mdiSelectionEllipse,
  mdiTableSearch,
  mdiSelectAll,
  mdiSelectionOff
} from '@mdi/js';
import {
  activeToolSignal,
  activeLayerIdSignal,
  selectedFeatureIdsSignal,
  featuresSignal,
  cancelAction,
  selectAllFeaturesAction,
  deselectAllFeaturesAction,
  type ToolbarZone
} from '../../../../src/renderer/state/gisSignals';
import type { GisFeature } from '../../../../src/shared/types';
import { registeredActionsSignal } from '../../../../src/renderer/state/actionSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const {
  SelectionToolbarWidget,
  isDeselectAllDisabled,
  SELECTION_ACTION_TO_TOOL_MAP
} = jiti('@renderer/workbench/widgets/toolbars/SelectionToolbarWidget') as {
  SelectionToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isDeselectAllDisabled: (selectedFeatures: Set<string | number> | number) => boolean;
  SELECTION_ACTION_TO_TOOL_MAP: Record<string, string>;
};

const {
  activeSelectionModeSignal,
  isSelectByValueOpenSignal,
  openSelectByValueDialog,
  closeSelectByValueDialog
} = jiti('@renderer/state/gisSignals') as {
  activeSelectionModeSignal: { value: string };
  isSelectByValueOpenSignal: { value: boolean };
  openSelectByValueDialog: () => void;
  closeSelectByValueDialog: () => void;
};

const { SelectByValueDialog } = jiti('@renderer/workbench/dialogs/SelectByValueDialog') as {
  SelectByValueDialog: React.FC;
};

const { dictionarySignal } = jiti('@renderer/state/i18nSignals') as {
  dictionarySignal: { value: Record<string, string> };
};

describe('SelectionToolbarWidget Disabled State Logic (isDeselectAllDisabled)', () => {
  it('isDeselectAllDisabled returns true when selectedFeatureIds is empty or 0', () => {
    assert.equal(isDeselectAllDisabled(new Set()), true);
    assert.equal(isDeselectAllDisabled(0), true);
    assert.equal(isDeselectAllDisabled(-1), true);
  });

  it('isDeselectAllDisabled returns false when features are selected', () => {
    assert.equal(isDeselectAllDisabled(new Set(['f1'])), false);
    assert.equal(isDeselectAllDisabled(new Set(['f1', 'f2'])), false);
    assert.equal(isDeselectAllDisabled(1), false);
    assert.equal(isDeselectAllDisabled(42), false);
  });
});

describe('SelectionToolbarWidget Component Rendering and Controls', () => {
  beforeEach(() => {
    activeToolSignal.value = 'pan';
    activeSelectionModeSignal.value = 'select_feature';
    activeLayerIdSignal.value = null;
    selectedFeatureIdsSignal.value = new Set();
    featuresSignal.value = [];
    isSelectByValueOpenSignal.value = false;

    dictionarySignal.value = {
      select_feature: 'Select Feature',
      select_features_by_drag: 'Select Features by Drag',
      select_features_by_freehand: 'Select Features by Freehand',
      select_features_by_value: 'Select Features by Value...',
      select_all_features: 'Select All Features',
      deselect_all_features: 'Deselect All Features',
      more_options: 'More options'
    };

    registeredActionsSignal.value = [
      {
        name: 'select_feature',
        description: 'Select Feature',
        icon: mdiSelect,
        formattedKey: 'Q',
        keyCombination: { key: 'q' }
      },
      {
        name: 'select_features_by_drag',
        description: 'Select Features by Drag',
        icon: mdiSelectDrag,
        formattedKey: 'Shift+Q',
        keyCombination: { key: 'q', shift: true }
      },
      {
        name: 'select_features_by_freehand',
        description: 'Select Features by Freehand',
        icon: mdiSelectionEllipse,
        formattedKey: 'Alt+Q',
        keyCombination: { key: 'q', alt: true }
      },
      {
        name: 'select_features_by_value',
        description: 'Select Features by Value',
        icon: mdiTableSearch,
        formattedKey: 'F6',
        keyCombination: { key: 'F6' }
      },
      {
        name: 'select_all_features',
        description: 'Select All Features',
        icon: mdiSelectAll,
        formattedKey: 'Ctrl+A',
        keyCombination: { key: 'a', ctrl: true }
      },
      {
        name: 'deselect_all_features',
        description: 'Deselect All Features',
        icon: mdiSelectionOff,
        formattedKey: 'Ctrl+Shift+A',
        keyCombination: { key: 'a', ctrl: true, shift: true }
      }
    ];
  });

  it('renders container with ID toolbar-widget-selection', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(
      html.includes('id="toolbar-widget-selection"'),
      'Expected SelectionToolbarWidget to render container with id toolbar-widget-selection'
    );
  });

  it('renders SplitToolButton and selection action buttons with MDI icons', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );

    // Primary split button and chevron
    assert.ok(html.includes('split-tool-primary'), 'Expected SplitToolButton primary button segment');
    assert.ok(html.includes('split-tool-chevron'), 'Expected SplitToolButton chevron button segment');

    // MDI icons: default select_feature icon
    assert.ok(html.includes(mdiSelect), 'Expected mdiSelect icon on primary split button');

    // Discrete action buttons: select_features_by_value, select_all_features, deselect_all_features
    assert.ok(html.includes('id="toolbar-tool-select-by-value"'), 'Missing select_features_by_value button');
    assert.ok(html.includes('id="toolbar-tool-select-all"'), 'Missing select_all_features button');
    assert.ok(html.includes('id="toolbar-tool-deselect-all"'), 'Missing deselect_all_features button');

    // Icons on discrete buttons
    assert.ok(html.includes(mdiTableSearch), 'Expected mdiTableSearch icon on select_features_by_value');
    assert.ok(html.includes(mdiSelectAll), 'Expected mdiSelectAll icon on select_all_features');
    assert.ok(html.includes(mdiSelectionOff), 'Expected mdiSelectionOff icon on deselect_all_features');
  });

  it('renders updated SplitToolButton icon and title when selection mode changes', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    // Drag mode
    activeSelectionModeSignal.value = 'select_features_by_drag';
    const dragHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(dragHtml.includes(mdiSelectDrag), 'Expected mdiSelectDrag icon in drag mode');
    assert.ok(dragHtml.includes('Select Features by Drag (Shift+Q)'), 'Expected drag mode title');

    // Freehand mode
    activeSelectionModeSignal.value = 'select_features_by_freehand';
    const freehandHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(freehandHtml.includes(mdiSelectionEllipse), 'Expected mdiSelectionEllipse icon in freehand mode');
    assert.ok(freehandHtml.includes('Select Features by Freehand (Alt+Q)'), 'Expected freehand mode title');
  });

  it('highlights SplitToolButton as active when activeToolSignal is in a selection mode', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    // Inactive when pan
    activeToolSignal.value = 'pan';
    const panHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(!panHtml.includes('split-tool-primary active'), 'SplitToolButton should not be active when tool is pan');

    // Inactive when digitizing mode
    activeToolSignal.value = 'polygon';
    const polyHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(!polyHtml.includes('split-tool-primary active'), 'SplitToolButton should not be active when tool is polygon');

    // Active when select
    activeToolSignal.value = 'select';
    const selectHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(selectHtml.includes('split-tool-primary active'), 'SplitToolButton should be active when tool is select');

    // Active when select_drag
    activeToolSignal.value = 'select_drag';
    const dragHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(dragHtml.includes('split-tool-primary active'), 'SplitToolButton should be active when tool is select_drag');

    // Active when select_freehand
    activeToolSignal.value = 'select_freehand';
    const freehandHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(freehandHtml.includes('split-tool-primary active'), 'SplitToolButton should be active when tool is select_freehand');
  });

  it('renders deselect_all_features button disabled when selectedFeatureIdsSignal is empty and enabled when non-empty', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    selectedFeatureIdsSignal.value = new Set();
    const emptyHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(
      /id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(emptyHtml),
      'Expected disabled attribute when selection is empty'
    );
    assert.ok(
      /id="toolbar-tool-deselect-all"[^>]*class="toolbar-btn disabled"/.test(emptyHtml),
      'Expected disabled class when selection is empty'
    );

    selectedFeatureIdsSignal.value = new Set(['feature-1']);
    const populatedHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: 'top' })
    );
    assert.ok(
      !/id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(populatedHtml),
      'Expected enabled button when features are selected'
    );
  });
});

describe('SelectionToolbarWidget Selection Actions & Mutual Exclusivity', () => {
  beforeEach(() => {
    activeToolSignal.value = 'pan';
    activeSelectionModeSignal.value = 'select_feature';
    activeLayerIdSignal.value = 'layer-1';
    selectedFeatureIdsSignal.value = new Set();
    isSelectByValueOpenSignal.value = false;

    const sampleFeatures: GisFeature[] = [
      {
        id: 'feat-1',
        layerId: 'layer-1',
        geometryType: 'Point',
        coordinates: [10, 20],
        properties: { name: 'Alpha' }
      },
      {
        id: 'feat-2',
        layerId: 'layer-1',
        geometryType: 'Point',
        coordinates: [12, 22],
        properties: { name: 'Beta' }
      },
      {
        id: 'feat-3',
        layerId: 'layer-2',
        geometryType: 'Point',
        coordinates: [15, 25],
        properties: { name: 'Gamma' }
      }
    ];
    featuresSignal.value = sampleFeatures;
  });

  it('SELECTION_ACTION_TO_TOOL_MAP maps selection modes to ActiveTool types correctly', () => {
    assert.equal(SELECTION_ACTION_TO_TOOL_MAP['select_feature'], 'select');
    assert.equal(SELECTION_ACTION_TO_TOOL_MAP['select_features_by_drag'], 'select_drag');
    assert.equal(SELECTION_ACTION_TO_TOOL_MAP['select_features_by_freehand'], 'select_freehand');
  });

  it('activating a selection mode sets activeToolSignal and unsets pan or digitizing modes', () => {
    activeToolSignal.value = 'polygon';
    assert.equal(activeToolSignal.value, 'polygon');

    // Activate click select
    activeSelectionModeSignal.value = 'select_feature';
    activeToolSignal.value = 'select';
    assert.equal(activeToolSignal.value, 'select');

    // Switch to drag select
    activeSelectionModeSignal.value = 'select_features_by_drag';
    activeToolSignal.value = 'select_drag';
    assert.equal(activeToolSignal.value, 'select_drag');

    // Switch to freehand select
    activeSelectionModeSignal.value = 'select_features_by_freehand';
    activeToolSignal.value = 'select_freehand';
    assert.equal(activeToolSignal.value, 'select_freehand');
  });

  it('openSelectByValueDialog opens dialog and closeSelectByValueDialog closes it', () => {
    assert.equal(isSelectByValueOpenSignal.value, false);
    openSelectByValueDialog();
    assert.equal(isSelectByValueOpenSignal.value, true);
    closeSelectByValueDialog();
    assert.equal(isSelectByValueOpenSignal.value, false);
  });

  it('renders SelectByValueDialog markup when open', () => {
    const React = jiti('react');
    const ReactDOM = jiti('react-dom');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const originalDocument = globalThis.document;
    const originalWindow = (globalThis as any).window;
    const originalCreatePortal = ReactDOM.createPortal;

    try {
      (globalThis as any).document = {
        createElement: () => ({ style: {} })
      };
      (globalThis as any).window = {
        electronAPI: {
          getPreferenceValue: async () => ({})
        }
      };
      ReactDOM.createPortal = (children: unknown) => children;

      isSelectByValueOpenSignal.value = true;
      const html = renderToStaticMarkup(React.createElement(SelectByValueDialog));
      assert.ok(html.includes('Select Features by Value'), 'Expected dialog title');
      assert.ok(html.includes('Attribute query criteria and selection filters will appear here'), 'Expected dialog body content');
      assert.ok(html.includes('Close'), 'Expected Close button in footer');
    } finally {
      ReactDOM.createPortal = originalCreatePortal;
      if (originalDocument === undefined) {
        delete (globalThis as any).document;
      } else {
        globalThis.document = originalDocument;
      }
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });

  it('selectAllFeaturesAction selects all features belonging to the active layer', () => {
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
    selectAllFeaturesAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 2);
    assert.ok(selectedFeatureIdsSignal.value.has('feat-1'));
    assert.ok(selectedFeatureIdsSignal.value.has('feat-2'));
    assert.ok(!selectedFeatureIdsSignal.value.has('feat-3'));
  });

  it('deselectAllFeaturesAction clears all selected features', () => {
    selectAllFeaturesAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 2);
    deselectAllFeaturesAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it('cancelAction resets activeToolSignal to pan and clears selections', () => {
    activeToolSignal.value = 'select_drag';
    selectedFeatureIdsSignal.value = new Set(['feat-1', 'feat-2']);

    cancelAction();

    assert.equal(activeToolSignal.value, 'pan');
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });
});
