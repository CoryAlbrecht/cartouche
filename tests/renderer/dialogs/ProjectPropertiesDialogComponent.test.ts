/**
 * @file ProjectPropertiesDialogComponent.test.ts
 * @module tests/renderer/dialogs/ProjectPropertiesDialogComponent.test
 * @description Component tests for ProjectPropertiesDialog modelled on the Layer Properties component tests: shared tabbed shell with a General tab, read-only Project File showing the full path or "(unsaved)", the Project Title bound to the draft, Cancel / Apply / OK footer, and Save As from the dialog applying the draft before saving and refreshing the file field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-13
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
  setProjectHome,
  setProjectPathMode,
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
      project_properties_label_background_colour: 'Map Background Colour',
      project_properties_label_selection_colour: 'Selection Colour',
      project_properties_label_home: 'Project Home',
      project_properties_btn_browse_home: 'Choose Project Home directory...',
      project_properties_label_path_mode: 'Save Path',
      project_properties_path_mode_absolute: 'Absolute',
      project_properties_path_mode_relative: 'Relative',
      project_properties_tab_measurements: 'Measurements',
      project_properties_group_measurements: 'Measurements',
      project_properties_label_distance_unit: 'Units for Distance',
      project_properties_label_area_unit: 'Units for Area',
      project_properties_label_scale_method: 'Scale Calculation',
      project_properties_distance_unit_degrees: 'Degrees',
      project_properties_distance_unit_metres: 'Metres',
      project_properties_distance_unit_kilometres: 'Kilometres',
      project_properties_area_unit_square_degrees: 'Square Degrees',
      project_properties_area_unit_square_kilometres: 'Square Kilometres',
      project_properties_scale_method_middle: 'Middle of Map',
      project_properties_scale_method_average: 'Average of Top, Middle, and Bottom Scales',
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

  it('renders the Project Home field defaulting to the project file directory, with a directory picker button (Ticket #274)', () => {
    setProjectHome(null);
    openProjectPropertiesDialog();
    const html = render();
    assert.ok(html.includes('Project Home'));
    const homeInput = html.match(/<input[^>]*id="project-prop-home"[^>]*>/)?.[0];
    assert.ok(homeInput, 'Project Home input rendered');
    assert.ok(homeInput.includes('value="/projects"'), 'defaults to the project file directory');
    const browse = html.match(/<button[^>]*id="project-prop-home-browse"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(browse, 'directory picker button rendered');
    assert.ok(browse.includes('<svg'), 'picker button shows the dots-horizontal icon');
  });

  it('renders Absolute / Relative Save Path radios reflecting the draft (Ticket #274)', () => {
    setProjectPathMode('relative');
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(html.includes('Save Path'));
    assert.ok(/id="project-prop-path-mode-relative"[^>]*checked=""/.test(html) || /checked=""[^>]*id="project-prop-path-mode-relative"/.test(html), 'Relative checked by default for new projects');
    updateProjectPropertiesDraft({ pathMode: 'absolute' });
    html = render();
    assert.ok(/id="project-prop-path-mode-absolute"[^>]*checked=""/.test(html) || /checked=""[^>]*id="project-prop-path-mode-absolute"/.test(html), 'Absolute checked after draft change');
  });

  it('Project Home refreshes after Save As when it was still the default (Ticket #274)', async () => {
    setProjectHome(null);
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.home, '/projects');
    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, true);
    assert.equal(projectPropertiesDraftSignal.value.home, '/projects/renamed', 'default home follows the new file location');
  });

  it('renders a Measurements tab with the three dropdowns using Canadian spelling and the draft values (Ticket #275)', () => {
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(/data-tab-id="measurements" class="project-properties-tab-btn /.test(html), 'Measurements tab button in the sidebar');
    assert.ok(!html.includes('id="project-prop-distance-unit"'), 'General tab does not show the dropdowns');

    activeProjectPropertiesTabSignal.value = 'measurements';
    updateProjectPropertiesDraft({ distanceUnit: 'kilometres', areaUnit: 'square-kilometres', scaleMethod: 'average' });
    html = render();
    assert.ok(html.includes('project-properties-tab-pane measurements'));
    assert.ok(html.includes('Units for Distance') && html.includes('Units for Area') && html.includes('Scale Calculation'));
    assert.ok(html.includes('id="project-prop-distance-unit"') && html.includes('id="project-prop-area-unit"') && html.includes('id="project-prop-scale-method"'));
    assert.ok(html.includes('<option value="metres">Metres</option>'), 'Canadian spelling Metres');
    assert.ok(html.includes('<option value="kilometres" selected="">Kilometres</option>'), 'draft distance unit selected, Canadian spelling');
    assert.ok(html.includes('<option value="square-kilometres" selected="">Square Kilometres</option>'));
    assert.ok(html.includes('<option value="average" selected="">Average of Top, Middle, and Bottom Scales</option>'));
    assert.equal((html.match(/<option value="/g) || []).length, 10 + 12 + 5, 'ten distance units, twelve area units, five scale methods');
    activeProjectPropertiesTabSignal.value = 'general';
  });

  it('renders an embedded Selection Colour picker with transparency bound to the draft (Ticket #273)', () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ selectionColour: 'rgba(0,128,255,0.4)' });
    const html = render();
    assert.ok(html.includes('Selection Colour'));
    const pickerStart = html.indexOf('id="project-prop-selection-colour-picker"');
    assert.ok(pickerStart > 0);
    const pickerHtml = html.slice(pickerStart, html.indexOf('id="project-prop-background-colour-picker"'));
    assert.ok(pickerHtml.includes('colour-picker-widget'), 'embeds ColourPickerWidget');
    assert.ok(pickerHtml.includes('colour-picker-alpha-strip'), 'selection picker allows transparency');
  });

  it('renders an embedded opaque Map Background Colour picker bound to the draft (Ticket #272)', () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ backgroundColour: '#336699' });
    const html = render();
    assert.ok(html.includes('Map Background Colour'));
    const bgStart = html.indexOf('id="project-prop-background-colour-picker"');
    assert.ok(bgStart > 0);
    const bgHtml = html.slice(bgStart);
    assert.ok(bgHtml.includes('colour-picker-widget'), 'embeds ColourPickerWidget');
    assert.ok(!bgHtml.includes('colour-picker-alpha-strip'), 'opaque-only picker hides the transparency strip');
    assert.ok(html.includes('#336699') || html.includes('336699'), 'picker seeded from the draft colour');
  });

  it('Apply commits the draft through the Project Store and sets the Project Dirty State', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Applied Atlas' });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].title, 'Applied Atlas');
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
    assert.equal(patches.length, 1, 'draft applied before saving');
    assert.equal(patches[0].title, 'Saved Atlas');
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
