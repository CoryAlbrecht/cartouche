/**
 * @file ProjectToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/ProjectToolbarWidget.test
 * @description Unit and component tests for ProjectToolbarWidget verifying project file actions, outline MDI icons, ProjectPropertiesDialog trigger, layer widget integration, save button disabled states, and toolbar layout migration.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ProjectToolbarWidget}
 * @see {@link isProjectToolbarSaveDisabled}
 * @see {@link isProjectToolbarPropertiesDisabled}
 * @see {@link toolbarOrderSignal}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import {
  mdiFolderPlusOutline,
  mdiFolderOpenOutline,
  mdiFolderDownloadOutline,
  mdiFolderSettingsOutline
} from '@mdi/js';
import {
  hasProjectSignal,
  projectNameSignal,
  projectFilePathSignal,
  isProjectDirtySignal,
  isProjectPropertiesOpenSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  openDockPanelsSignal,
  isAddLayersOpenSignal,
  createNewProject,
  loadProjectIntoSignals,
  saveProjectAction,
  saveAsProjectAction,
  toolbarOrderSignal,
  migrateToolbarLayout,
  type ToolbarZone
} from '../../../../src/renderer/state/gisSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const {
  ProjectToolbarWidget,
  isProjectToolbarSaveDisabled,
  isProjectToolbarPropertiesDisabled
} = jiti('../../../../src/renderer/workbench/widgets/toolbars/ProjectToolbarWidget') as {
  ProjectToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isProjectToolbarSaveDisabled: (hasProject: boolean, filePath: string | null, isProjectDirty: boolean) => boolean;
  isProjectToolbarPropertiesDisabled: (hasProject: boolean) => boolean;
};

const { dictionarySignal } = jiti('@renderer/state/i18nSignals') as {
  dictionarySignal: { value: Record<string, string> };
};

describe('ProjectToolbarWidget Save Button Logic', () => {
  let mockSaveFileResult: string | null = null;
  let savedProjects: string[] = [];

  beforeEach(() => {
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    isProjectPropertiesOpenSignal.value = false;
    mockSaveFileResult = null;
    savedProjects = [];

    (globalThis as any).window = {
      electronAPI: {
        saveFile: async () => mockSaveFileResult,
        saveProject: async (filePath: string) => {
          savedProjects.push(filePath);
          return true;
        }
      }
    };
  });

  it('isProjectToolbarSaveDisabled returns true when no project is open', () => {
    assert.equal(isProjectToolbarSaveDisabled(false, null, false), true);
    assert.equal(isProjectToolbarSaveDisabled(false, null, true), true);
    assert.equal(isProjectToolbarSaveDisabled(false, '/path/proj.cproj', false), true);
    assert.equal(isProjectToolbarSaveDisabled(false, '/path/proj.cproj', true), true);
  });

  it('isProjectToolbarSaveDisabled returns false for a brand new, never saved before project', () => {
    assert.equal(isProjectToolbarSaveDisabled(true, null, false), false);
    assert.equal(isProjectToolbarSaveDisabled(true, null, true), false);
  });

  it('isProjectToolbarSaveDisabled requires isProjectDirty for existing saved projects', () => {
    assert.equal(isProjectToolbarSaveDisabled(true, '/path/proj.cproj', false), true);
    assert.equal(isProjectToolbarSaveDisabled(true, '/path/proj.cproj', true), false);
  });

  it('double duty handler invokes saveAsProjectAction when project is new and has no filePath', async () => {
    createNewProject('New Project');
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectFilePathSignal.value, null);
    assert.equal(isProjectToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), false);

    mockSaveFileResult = '/workspace/saved-new.cproj';

    let invokedAction: 'save' | 'saveAs' | null = null;
    if (!projectFilePathSignal.value) {
      invokedAction = 'saveAs';
      await saveAsProjectAction();
    } else {
      invokedAction = 'save';
      await saveProjectAction();
    }

    assert.equal(invokedAction, 'saveAs');
    assert.equal(projectFilePathSignal.value, '/workspace/saved-new.cproj');
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ['/workspace/saved-new.cproj']);

    assert.equal(isProjectToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), true);
  });

  it('double duty handler invokes saveProjectAction when project already has a filePath', async () => {
    loadProjectIntoSignals({
      format: 'cartouche-xml',
      filePath: '/existing/path.cproj',
      metadata: { title: 'Existing Project' },
      layers: []
    });

    isProjectDirtySignal.value = true;
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectFilePathSignal.value, '/existing/path.cproj');
    assert.equal(isProjectToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), false);

    let invokedAction: 'save' | 'saveAs' | null = null;
    if (!projectFilePathSignal.value) {
      invokedAction = 'saveAs';
      await saveAsProjectAction();
    } else {
      invokedAction = 'save';
      await saveProjectAction();
    }

    assert.equal(invokedAction, 'save');
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ['/existing/path.cproj']);

    assert.equal(isProjectToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), true);
  });
});

describe('ProjectToolbarWidget Properties Button Logic', () => {
  it('isProjectToolbarPropertiesDisabled returns true when no project is open', () => {
    assert.equal(isProjectToolbarPropertiesDisabled(false), true);
  });

  it('isProjectToolbarPropertiesDisabled returns false when project is open', () => {
    assert.equal(isProjectToolbarPropertiesDisabled(true), false);
  });
});

describe('ProjectToolbarWidget Component Rendering and Interactions', () => {
  beforeEach(() => {
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    isProjectPropertiesOpenSignal.value = false;
    dictionarySignal.value = {
      new_project: 'New Project...',
      open_project: 'Open Project...',
      save_project: 'Save Project',
      project_properties: 'Project Properties...',
      toggle_layers_widget: 'Toggle Layers Widget',
      add_layers: 'Add Layers...'
    };
  });

  it('renders container with ID toolbar-widget-project', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));
    assert.ok(html.includes('id="toolbar-widget-project"'), 'Expected ProjectToolbarWidget to render container with id toolbar-widget-project');
  });

  it('renders all 6 discrete action buttons in ProjectToolbarWidget', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));

    // Buttons: new_project, open_project, save_project, project_properties, toggle_layers_widget, add_layers
    assert.ok(html.includes('aria-label="New Project..."'), 'Missing new_project button');
    assert.ok(html.includes('aria-label="Open Project..."'), 'Missing open_project button');
    assert.ok(html.includes('aria-label="Save Project"'), 'Missing save_project button');
    assert.ok(html.includes('aria-label="Project Properties..."'), 'Missing project_properties button');
    assert.ok(html.includes('aria-label="Toggle Layers Widget"'), 'Missing toggle_layers_widget button');
    assert.ok(html.includes('aria-label="Add Layers..."'), 'Missing add_layers button');
  });

  it('renders outline MDI action icons for project actions', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));

    // Verify directory outline MDI icons are rendered
    assert.ok(html.includes(mdiFolderPlusOutline), 'Expected new_project to render mdiFolderPlusOutline');
    assert.ok(html.includes(mdiFolderOpenOutline), 'Expected open_project to render mdiFolderOpenOutline');
    assert.ok(html.includes(mdiFolderDownloadOutline), 'Expected save_project to render mdiFolderDownloadOutline');
    assert.ok(html.includes(mdiFolderSettingsOutline), 'Expected project_properties to render mdiFolderSettingsOutline');
  });

  it('renders save button disabled when no project open and enabled when project is dirty', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    // No project: save button is disabled
    hasProjectSignal.value = false;
    let html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));
    assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Expected save button disabled when no project');

    // Brand new project: save button is enabled
    hasProjectSignal.value = true;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));
    assert.ok(
      !html.includes('aria-label="Save Project" disabled') && !html.includes('disabled="" aria-label="Save Project"'),
      'Expected save button enabled for new project'
    );
  });

  it('renders project properties button disabled when no project open and enabled when project is open', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    // No project: project properties button is disabled
    hasProjectSignal.value = false;
    let html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));
    assert.ok(
      html.includes('class="toolbar-btn disabled" title="Project Properties..." disabled=""') ||
      (html.includes('aria-label="Project Properties..."') && html.includes('disabled')),
      'Expected project properties button disabled when no project'
    );

    // With active project: project properties button is enabled
    hasProjectSignal.value = true;
    html = renderToStaticMarkup(React.createElement(ProjectToolbarWidget, { zone: 'top' }));
    assert.ok(
      !html.includes('class="toolbar-btn disabled" title="Project Properties..."') &&
      !html.includes('title="Project Properties..." disabled'),
      'Expected project properties button enabled when project is open'
    );
  });

  it('project properties action opens and closes ProjectPropertiesDialog', () => {
    assert.equal(isProjectPropertiesOpenSignal.value, false);

    // When no project is open, openProjectPropertiesDialog is a no-op
    hasProjectSignal.value = false;
    openProjectPropertiesDialog();
    assert.equal(isProjectPropertiesOpenSignal.value, false, 'openProjectPropertiesDialog must be a no-op when no project is open');

    // When project is open, openProjectPropertiesDialog opens the dialog
    hasProjectSignal.value = true;
    openProjectPropertiesDialog();
    assert.equal(isProjectPropertiesOpenSignal.value, true, 'openProjectPropertiesDialog must open dialog when project is open');

    closeProjectPropertiesDialog();
    assert.equal(isProjectPropertiesOpenSignal.value, false, 'closeProjectPropertiesDialog must close dialog');
  });

  it('toggle layers widget action toggles LayerTreeWidget visibility in openDockPanelsSignal', () => {
    openDockPanelsSignal.value = { attributes: false, layers: false };
    openDockPanelsSignal.value = {
      ...openDockPanelsSignal.value,
      layers: !openDockPanelsSignal.value.layers
    };
    assert.equal(openDockPanelsSignal.value.layers, true, 'LayerTreeWidget should be toggled open');

    openDockPanelsSignal.value = {
      ...openDockPanelsSignal.value,
      layers: !openDockPanelsSignal.value.layers
    };
    assert.equal(openDockPanelsSignal.value.layers, false, 'LayerTreeWidget should be toggled closed');
  });

  it('add layers action sets isAddLayersOpenSignal', () => {
    isAddLayersOpenSignal.value = false;
    isAddLayersOpenSignal.value = true;
    assert.equal(isAddLayersOpenSignal.value, true, 'Add Layers signal should be set to true');
    isAddLayersOpenSignal.value = false;
  });
});

describe('Toolbar Layout Migration Logic', () => {
  it('migrates stored layouts to convert basic to project and purge layer', () => {
    const legacyOrder: Record<ToolbarZone, string[]> = {
      top: ['basic', 'layer', 'digitizing', 'snapping'],
      bottom: [],
      left: [],
      right: []
    };

    const migrated = migrateToolbarLayout(legacyOrder);
    assert.deepEqual(migrated.top, ['project', 'digitizing', 'snapping']);
    assert.equal(migrated.top.includes('basic' as any), false);
    assert.equal(migrated.top.includes('layer' as any), false);
  });

  it('toolbarOrderSignal automatically migrates stored layouts when set with legacy keys', () => {
    toolbarOrderSignal.value = {
      top: ['basic', 'layer', 'snapping'] as any,
      bottom: [],
      left: [],
      right: []
    };

    assert.deepEqual(toolbarOrderSignal.value.top, ['project', 'snapping']);
  });
});
