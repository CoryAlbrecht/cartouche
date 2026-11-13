/**
 * @file ProjectPropertiesDialogComponent.test.ts
 * @module tests/renderer/dialogs/ProjectPropertiesDialogComponent.test
 * @description Component tests for ProjectPropertiesDialog modelled on the Layer Properties component tests: shared tabbed shell with a General tab, read-only Project File showing the full path or "(unsaved)", the Project Title bound to the draft, Cancel / Apply / OK footer, and Save As from the dialog applying the draft before saving and refreshing the file field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link saveAsProjectFromPropertiesDialogAction}
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
const { ProjectPropertiesDialog } = jiti('../../../src/renderer/workbench/dialogs/ProjectPropertiesDialog.tsx');
const {
  isProjectPropertiesOpenSignal,
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
} = jiti('../../../src/renderer/state/projectPropertiesSignals.ts');
const {
  hasProjectSignal,
  isProjectDirtySignal,
  projectTitleSignal,
  projectNameSignal,
  projectFilePathSignal,
  currentProjectSignal,
  setProjectTitle,
} = jiti('../../../src/renderer/state/projectSignals.ts');
const { saveAsProjectFromPropertiesDialogAction } = jiti('../../../src/renderer/state/gisSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

/**
 * @function render
 * @description Renders the dialog to static markup.
 * @returns {string} Static HTML.
 */
function render(): string {
  return renderToStaticMarkup(React.createElement(ProjectPropertiesDialog));
}

describe('ProjectPropertiesDialog component (Ticket #271)', () => {
  let originalDocument: any;
  let originalWindow: any;
  let originalCreatePortal: any;
  let patches: any[];
  let savedPaths: string[];
  let mockSaveFileResult: string | null;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = (globalThis as any).window;
    patches = [];
    savedPaths = [];
    mockSaveFileResult = '/projects/renamed/atlas-v2.cproj';

    (globalThis as any).document = { createElement: () => ({ style: {} }) };
    (globalThis as any).window = {
      electronAPI: {
        updateProjectProperties: async (patch: any) => {
          patches.push(patch);
          return true;
        },
        saveFile: async () => mockSaveFileResult,
        saveProject: async (filePath: string) => {
          savedPaths.push(filePath);
          return true;
        },
      },
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;

    dictionarySignal.value = {
      project_properties_dialog_title: 'Project Properties',
      project_properties_tab_general: 'General',
      project_properties_group_general: 'General',
      project_properties_label_file: 'Project File',
      project_properties_file_unsaved: '(unsaved)',
      project_properties_btn_save_as: 'Save As...',
      project_properties_label_title: 'Project Title',
      project_properties_btn_ok: 'OK',
      project_properties_btn_apply: 'Apply',
      project_properties_btn_cancel: 'Cancel',
    };

    closeProjectPropertiesDialog();
    currentProjectSignal.value = { format: 'cartouche-xml', metadata: { title: 'World Atlas' }, layers: [] };
    hasProjectSignal.value = true;
    projectFilePathSignal.value = '/projects/atlas.cproj';
    setProjectTitle('World Atlas');
    isProjectDirtySignal.value = false;
    activeProjectPropertiesTabSignal.value = 'general';
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    projectFilePathSignal.value = null;
    setProjectTitle('');
    ReactDOM.createPortal = originalCreatePortal;
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it('renders nothing while closed', () => {
    assert.equal(isProjectPropertiesOpenSignal.value, false);
    assert.equal(render(), '');
  });

  it('renders the shared tabbed shell with a General tab and the Cancel / Apply / OK footer', () => {
    openProjectPropertiesDialog();
    const html = render();
    assert.ok(html.includes('class="project-properties-container"'), 'uses TabbedDialogShell with the project-properties prefix');
    assert.ok(html.includes('class="project-properties-sidebar"'));
    assert.ok(/data-tab-id="general" class="project-properties-tab-btn active"/.test(html));
    assert.ok(html.includes('<span>General</span>'));
    assert.ok(html.includes('project-properties-tab-pane general'));
    assert.ok(html.includes('Project Properties'), 'dialog title');
    assert.ok(html.includes('class="project-properties-btn cancel"'));
    assert.ok(html.includes('class="project-properties-btn apply"'));
    assert.ok(html.includes('class="project-properties-btn ok"'));
  });

  it('shows the full project file path read-only, with a Save As button beside it', () => {
    openProjectPropertiesDialog();
    const html = render();
    const fileInput = html.match(/<input[^>]*id="project-prop-file"[^>]*>/)?.[0];
    assert.ok(fileInput, 'Project File input rendered');
    assert.ok(/readonly=""/i.test(fileInput), "Project File is read-only");
    assert.ok(fileInput.includes('value="/projects/atlas.cproj"'));
    assert.ok(html.includes('id="project-prop-save-as"'));
    assert.ok(html.includes('Save As...'));
  });

  it('shows "(unsaved)" for a project that has never been saved', () => {
    projectFilePathSignal.value = null;
    setProjectTitle('World Atlas');
    openProjectPropertiesDialog();
    const html = render();
    const fileInput = html.match(/<input[^>]*id="project-prop-file"[^>]*>/)?.[0];
    assert.ok(fileInput);
    assert.ok(fileInput.includes('value="(unsaved)"'));
  });

  it('binds the Project Title input to the draft, not the committed title', () => {
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(html.match(/<input[^>]*id="project-prop-title"[^>]*value="World Atlas"/), 'seeded from committed title');

    updateProjectPropertiesDraft({ title: 'Draft Atlas' });
    html = render();
    assert.ok(html.match(/<input[^>]*id="project-prop-title"[^>]*value="Draft Atlas"/));
    assert.equal(projectTitleSignal.value, 'World Atlas', 'committed title untouched until Apply');
    assert.equal(isProjectDirtySignal.value, false);
  });

  it('Apply commits the draft through the Project Store and sets the Project Dirty State', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Applied Atlas' });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.deepEqual(patches, [{ title: 'Applied Atlas' }]);
    assert.equal(projectTitleSignal.value, 'Applied Atlas');
    assert.equal(projectNameSignal.value, 'Applied Atlas');
    assert.equal(isProjectDirtySignal.value, true);
    assert.equal(isProjectPropertiesOpenSignal.value, true);
  });

  it('Save As from the dialog applies the draft first, saves, and updates the Project File field', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Saved Atlas' });

    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, true);
    assert.deepEqual(patches, [{ title: 'Saved Atlas' }], 'draft applied before saving');
    assert.deepEqual(savedPaths, ['/projects/renamed/atlas-v2.cproj']);
    assert.equal(projectFilePathSignal.value, '/projects/renamed/atlas-v2.cproj');
    assert.equal(projectTitleSignal.value, 'Saved Atlas', 'explicit title survives Save As');
    assert.equal(projectPropertiesDraftSignal.value.title, 'Saved Atlas', 'draft re-baselined after save');

    const html = render();
    const fileInput = html.match(/<input[^>]*id="project-prop-file"[^>]*>/)?.[0];
    assert.ok(fileInput?.includes('value="/projects/renamed/atlas-v2.cproj"'), 'Project File field shows the new path');
  });

  it('Save As that is cancelled keeps the applied draft and the old path', async () => {
    mockSaveFileResult = null;
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Still Applied' });
    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, false);
    assert.equal(projectTitleSignal.value, 'Still Applied');
    assert.deepEqual(savedPaths, []);
    assert.equal(projectFilePathSignal.value, '/projects/atlas.cproj');
  });
});
