/**
 * @file ProjectPropertiesDialogComponent.test.ts
 * @module tests/renderer/dialogs/ProjectPropertiesDialogComponent.test
 * @description Component tests for ProjectPropertiesDialog modelled on the Layer Properties component tests: shared tabbed shell with a General tab, read-only Project File showing the full path or "(unsaved)", the Project Title bound to the draft, Cancel / Apply / OK footer, and Save As from the dialog applying the draft before saving and refreshing the file field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link saveAsProjectFromPropertiesDialogAction}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRendererJiti } from "../rendererJiti";

const jiti = createRendererJiti(import.meta.url);

const React = jiti("react");
const ReactDOM = jiti("react-dom");
const { renderToStaticMarkup } = jiti("react-dom/server");
const { ProjectPropertiesDialog } = jiti(
  "../../../src/renderer/workbench/dialogs/ProjectPropertiesDialog.tsx"
);
const {
  isProjectPropertiesOpenSignal,
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  setDraftUseApplicationDefault,
  updateDraftDefaultStyle,
  cancelProjectPropertiesEdits,
} = jiti("../../../src/renderer/state/projectPropertiesSignals.ts");
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
} = jiti("../../../src/renderer/state/projectSignals.ts");
const { saveAsProjectFromPropertiesDialogAction } = jiti(
  "../../../src/renderer/state/gisSignals.ts"
);
const { dictionarySignal } = jiti("../../../src/renderer/state/i18nSignals.ts");

/**
 * @function render
 * @description Renders the dialog to static markup.
 * @returns {string} Static HTML.
 */
function render(): string {
  return renderToStaticMarkup(React.createElement(ProjectPropertiesDialog));
}

describe("ProjectPropertiesDialog component (Ticket #271)", () => {
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
    mockSaveFileResult = "/projects/renamed/atlas-v2.cproj";

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
      project_properties_dialog_title: "Project Properties",
      project_properties_tab_general: "General",
      project_properties_group_general: "General",
      project_properties_label_file: "Project File",
      project_properties_file_unsaved: "(unsaved)",
      project_properties_btn_save_as: "Save As...",
      project_properties_label_title: "Project Title",
      project_properties_label_background_colour: "Map Background Colour",
      project_properties_label_selection_colour: "Selection Colour",
      project_properties_label_home: "Project Home",
      project_properties_btn_browse_home: "Choose Project Home directory...",
      project_properties_label_path_mode: "Save Path",
      project_properties_path_mode_absolute: "Absolute",
      project_properties_path_mode_relative: "Relative",
      project_properties_tab_measurements: "Measurements",
      project_properties_tab_time_filter: "Time Filter",
      project_properties_tab_default_styles: "Default Styles",
      project_properties_default_style_point: "Point",
      project_properties_default_style_line: "Line",
      project_properties_default_style_polygon: "Polygon",
      project_properties_default_style_use_app: "Use application default",
      project_properties_group_time_filter: "Project Time Filter",
      project_properties_group_measurements: "Measurements",
      project_properties_label_distance_unit: "Units for Distance",
      project_properties_label_area_unit: "Units for Area",
      project_properties_label_scale_method: "Scale Calculation",
      project_properties_distance_unit_degrees: "Degrees",
      project_properties_distance_unit_metres: "Metres",
      project_properties_distance_unit_kilometres: "Kilometres",
      project_properties_area_unit_square_degrees: "Square Degrees",
      project_properties_area_unit_square_kilometres: "Square Kilometres",
      project_properties_scale_method_middle: "Middle of Map",
      project_properties_scale_method_average:
        "Average of Top, Middle, and Bottom Scales",
      project_properties_btn_ok: "OK",
      project_properties_btn_apply: "Apply",
      project_properties_btn_cancel: "Cancel",
    };

    closeProjectPropertiesDialog();
    currentProjectSignal.value = {
      format: "cartouche-xml",
      metadata: { title: "World Atlas" },
      layers: [],
    };
    hasProjectSignal.value = true;
    projectFilePathSignal.value = "/projects/atlas.cproj";
    setProjectTitle("World Atlas");
    isProjectDirtySignal.value = false;
    activeProjectPropertiesTabSignal.value = "general";
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    projectFilePathSignal.value = null;
    setProjectTitle("");
    ReactDOM.createPortal = originalCreatePortal;
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it("renders nothing while closed", () => {
    assert.equal(isProjectPropertiesOpenSignal.value, false);
    assert.equal(render(), "");
  });

  it("renders the shared tabbed shell with a General tab and the Cancel / Apply / OK footer", () => {
    openProjectPropertiesDialog();
    const html = render();
    assert.ok(
      html.includes('class="dialog-tabbed-shell project-properties-container"'),
      "uses TabbedDialogShell with the project-properties prefix"
    );
    assert.ok(
      html.includes('class="dialog-sidebar project-properties-sidebar"')
    );
    assert.ok(
      /data-tab-id="general" class="dialog-sidebar-tab project-properties-tab-btn active"/.test(
        html
      )
    );
    assert.ok(html.includes("<span>General</span>"));
    assert.ok(html.includes("project-properties-tab-pane general"));
    assert.ok(html.includes("Project Properties"), "dialog title");
    assert.ok(
      html.includes(
        'class="dialog-btn dialog-btn-secondary project-properties-btn cancel"'
      )
    );
    assert.ok(
      html.includes(
        'class="dialog-btn dialog-btn-secondary project-properties-btn apply"'
      )
    );
    assert.ok(
      html.includes(
        'class="dialog-btn dialog-btn-wide dialog-btn-strong dialog-btn-primary project-properties-btn ok"'
      )
    );
  });

  it("shows the full project file path read-only, with a Save As button beside it", () => {
    openProjectPropertiesDialog();
    const html = render();
    const fileInput = html.match(
      /<input[^>]*id="project-prop-file"[^>]*>/
    )?.[0];
    assert.ok(fileInput, "Project File input rendered");
    assert.ok(/readonly=""/i.test(fileInput), "Project File is read-only");
    assert.ok(fileInput.includes('value="/projects/atlas.cproj"'));
    assert.ok(html.includes('id="project-prop-save-as"'));
    assert.ok(html.includes("Save As..."));
  });

  it('shows "(unsaved)" for a project that has never been saved', () => {
    projectFilePathSignal.value = null;
    setProjectTitle("World Atlas");
    openProjectPropertiesDialog();
    const html = render();
    const fileInput = html.match(
      /<input[^>]*id="project-prop-file"[^>]*>/
    )?.[0];
    assert.ok(fileInput);
    assert.ok(fileInput.includes('value="(unsaved)"'));
  });

  it("binds the Project Title input to the draft, not the committed title", () => {
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(
      html.match(/<input[^>]*id="project-prop-title"[^>]*value="World Atlas"/),
      "seeded from committed title"
    );

    updateProjectPropertiesDraft({ title: "Draft Atlas" });
    html = render();
    assert.ok(
      html.match(/<input[^>]*id="project-prop-title"[^>]*value="Draft Atlas"/)
    );
    assert.equal(
      projectTitleSignal.value,
      "World Atlas",
      "committed title untouched until Apply"
    );
    assert.equal(isProjectDirtySignal.value, false);
  });

  it("renders the Project Home field defaulting to the project file directory, with a directory picker button (Ticket #274)", () => {
    setProjectHome(null);
    openProjectPropertiesDialog();
    const html = render();
    assert.ok(html.includes("Project Home"));
    const homeInput = html.match(
      /<input[^>]*id="project-prop-home"[^>]*>/
    )?.[0];
    assert.ok(homeInput, "Project Home input rendered");
    assert.ok(
      homeInput.includes('value="/projects"'),
      "defaults to the project file directory"
    );
    const browse = html.match(
      /<button[^>]*id="project-prop-home-browse"[^>]*>[\s\S]*?<\/button>/
    )?.[0];
    assert.ok(browse, "directory picker button rendered");
    assert.ok(
      browse.includes("<svg"),
      "picker button shows the dots-horizontal icon"
    );
  });

  it("renders Absolute / Relative Save Path radios reflecting the draft (Ticket #274)", () => {
    setProjectPathMode("relative");
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(html.includes("Save Path"));
    assert.ok(
      /id="project-prop-path-mode-relative"[^>]*checked=""/.test(html)
        || /checked=""[^>]*id="project-prop-path-mode-relative"/.test(html),
      "Relative checked by default for new projects"
    );
    updateProjectPropertiesDraft({ pathMode: "absolute" });
    html = render();
    assert.ok(
      /id="project-prop-path-mode-absolute"[^>]*checked=""/.test(html)
        || /checked=""[^>]*id="project-prop-path-mode-absolute"/.test(html),
      "Absolute checked after draft change"
    );
  });

  it("Project Home refreshes after Save As when it was still the default (Ticket #274)", async () => {
    setProjectHome(null);
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.home, "/projects");
    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, true);
    assert.equal(
      projectPropertiesDraftSignal.value.home,
      "/projects/renamed",
      "default home follows the new file location"
    );
  });

  it("renders a Measurements tab with the three dropdowns using Canadian spelling and the draft values (Ticket #275)", () => {
    openProjectPropertiesDialog();
    let html = render();
    assert.ok(
      /data-tab-id="measurements" class="dialog-sidebar-tab project-properties-tab-btn /.test(
        html
      ),
      "Measurements tab button in the sidebar"
    );
    assert.ok(
      !html.includes('id="project-prop-distance-unit"'),
      "General tab does not show the dropdowns"
    );

    activeProjectPropertiesTabSignal.value = "measurements";
    updateProjectPropertiesDraft({
      distanceUnit: "kilometres",
      areaUnit: "square-kilometres",
      scaleMethod: "average",
    });
    html = render();
    assert.ok(html.includes("project-properties-tab-pane measurements"));
    assert.ok(
      html.includes("Units for Distance")
        && html.includes("Units for Area")
        && html.includes("Scale Calculation")
    );
    assert.ok(
      html.includes('id="project-prop-distance-unit"')
        && html.includes('id="project-prop-area-unit"')
        && html.includes('id="project-prop-scale-method"')
    );
    assert.ok(
      html.includes(
        '<option value="metres"><span class="cartouche-select-option-label">Metres</span></option>'
      ),
      "Canadian spelling Metres"
    );
    assert.ok(
      html.includes(
        '<option value="kilometres" selected=""><span class="cartouche-select-option-label">Kilometres</span></option>'
      ),
      "draft distance unit selected, Canadian spelling"
    );
    assert.ok(
      html.includes(
        '<option value="square-kilometres" selected=""><span class="cartouche-select-option-label">Square Kilometres</span></option>'
      )
    );
    assert.ok(
      html.includes(
        '<option value="average" selected=""><span class="cartouche-select-option-label">Average of Top, Middle, and Bottom Scales</span></option>'
      )
    );
    assert.equal(
      (html.match(/<option value="/g) || []).length,
      10 + 12 + 5,
      "ten distance units, twelve area units, five scale methods"
    );
    activeProjectPropertiesTabSignal.value = "general";
  });

  it("renders a Time Filter tab with the shared controls bound to the draft and no playhead (Ticket #276)", () => {
    openProjectPropertiesDialog();
    activeProjectPropertiesTabSignal.value = "time_filter";
    updateProjectPropertiesDraft({
      timeFilterEnabled: true,
      timeFilterStep: 2.5,
      timeFilterUnit: "Hours",
    });
    const html = render();
    assert.ok(
      /data-tab-id="time_filter" class="dialog-sidebar-tab project-properties-tab-btn active"/.test(
        html
      ),
      "Time Filter tab button active"
    );
    assert.ok(html.includes("project-properties-tab-pane time-filter"));
    assert.ok(
      html.includes('class="time-filter-controls"'),
      "uses the shared TimeFilterControls component"
    );
    assert.ok(
      html.includes('class="toolbar-btn active"'),
      "Enabled toggle reflects the draft"
    );
    assert.ok(
      html.includes("From:") && html.includes("To:") && html.includes("Step:")
    );
    assert.ok(html.includes('value="2.5"'), "step from the draft");
    assert.ok(
      html.includes('<option value="Hours" selected=""'),
      "unit from the draft"
    );
    assert.ok(
      !html.includes("Frame:") && !html.includes("time-filter-slider"),
      "no playhead or scrubber in the dialog"
    );
    activeProjectPropertiesTabSignal.value = "general";
  });

  it("Default Styles tab: checkboxes checked with no default, unchecking seeds an editor, Apply stores and Cancel discards (Ticket #282)", async () => {
    openProjectPropertiesDialog();
    activeProjectPropertiesTabSignal.value = "default_styles";
    let html = render();
    for (const slot of ["point", "line", "polygon"]) {
      assert.ok(
        new RegExp(
          `id="project-prop-default-style-${slot}-app"[^>]*checked=""|checked=""[^>]*id="project-prop-default-style-${slot}-app"`
        ).test(html),
        `${slot} uses the application default`
      );
      assert.ok(
        !html.includes(`id="project-default-${slot}-styling-format"`),
        `${slot} editor hidden while checked`
      );
    }

    setDraftUseApplicationDefault("point", false);
    html = render();
    assert.ok(
      html.includes('id="project-default-point-styling-format"'),
      "Point editor shown after unchecking"
    );
    const seeded = JSON.parse(
      projectPropertiesDraftSignal.value.defaultStyles.point.styleContent
    );
    assert.equal(
      seeded.components[0].type,
      "simple-marker",
      "seeded with a generated point default"
    );

    updateDraftDefaultStyle("point", {
      styleContent: '{"format":"simple","version":1,"components":[]}',
    });
    assert.equal(await applyProjectPropertiesEdits(), true);
    const sent = patches[patches.length - 1].defaultStyles;
    assert.equal(sent.point, '{"format":"simple","version":1,"components":[]}');
    assert.equal(sent.line, null);
    assert.ok(
      currentProjectSignal.value.styles.some(
        (s: any) => s.id === "_project_default_point"
      ),
      "mirrored into the project model"
    );

    setDraftUseApplicationDefault("point", true);
    cancelProjectPropertiesEdits();
    openProjectPropertiesDialog();
    assert.ok(
      projectPropertiesDraftSignal.value.defaultStyles.point,
      "Cancel kept the committed default"
    );

    setDraftUseApplicationDefault("point", true);
    await applyProjectPropertiesEdits();
    assert.equal(
      patches[patches.length - 1].defaultStyles.point,
      null,
      "checking again clears the default on Apply"
    );
    assert.ok(
      !currentProjectSignal.value.styles.some(
        (s: any) => s.id === "_project_default_point"
      )
    );
    activeProjectPropertiesTabSignal.value = "general";
  });

  it("renders Selection Colour and Map Background Colour as 4rem × 2rem ColourButtons bound to the draft (Tickets #273, #272, #304)", () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({
      selectionColour: "rgba(0,128,255,0.4)",
      backgroundColour: "#336699",
    });
    const html = render();
    assert.ok(
      !html.includes("colour-picker-widget"),
      "No embedded ColourPickerWidget on the General tab"
    );

    const selStart = html.indexOf('id="project-prop-selection-colour-row"');
    const bgStart = html.indexOf('id="project-prop-background-colour-row"');
    assert.ok(
      selStart > 0 && bgStart > selStart,
      "Both colour rows rendered, Selection first"
    );
    const selHtml = html.slice(selStart, bgStart);
    const bgHtml = html.slice(bgStart);

    assert.ok(selHtml.includes("Selection Colour"), "Selection label");
    assert.ok(
      /class="picker-button colour-button"[^>]*style="width:4rem;height:2rem"/.test(
        selHtml
      ),
      "Selection button is 4rem × 2rem"
    );
    assert.ok(
      selHtml.includes('style="background-color:#0080ff66"'),
      "Selection swatch keeps its transparency"
    );

    assert.ok(bgHtml.includes("Map Background Colour"), "Background label");
    assert.ok(
      /class="picker-button colour-button"[^>]*style="width:4rem;height:2rem"/.test(
        bgHtml
      ),
      "Background button is 4rem × 2rem"
    );
    assert.ok(
      bgHtml.includes('style="background-color:#336699"'),
      "Background swatch seeded from the draft"
    );
  });

  it("Apply commits the draft through the Project Store and sets the Project Dirty State", async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: "Applied Atlas" });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].title, "Applied Atlas");
    assert.equal(projectTitleSignal.value, "Applied Atlas");
    assert.equal(projectNameSignal.value, "Applied Atlas");
    assert.equal(isProjectDirtySignal.value, true);
    assert.equal(isProjectPropertiesOpenSignal.value, true);
  });

  it("Save As from the dialog applies the draft first, saves, and updates the Project File field", async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: "Saved Atlas" });

    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, true);
    assert.equal(patches.length, 1, "draft applied before saving");
    assert.equal(patches[0].title, "Saved Atlas");
    assert.deepEqual(savedPaths, ["/projects/renamed/atlas-v2.cproj"]);
    assert.equal(
      projectFilePathSignal.value,
      "/projects/renamed/atlas-v2.cproj"
    );
    assert.equal(
      projectTitleSignal.value,
      "Saved Atlas",
      "explicit title survives Save As"
    );
    assert.equal(
      projectPropertiesDraftSignal.value.title,
      "Saved Atlas",
      "draft re-baselined after save"
    );

    const html = render();
    const fileInput = html.match(
      /<input[^>]*id="project-prop-file"[^>]*>/
    )?.[0];
    assert.ok(
      fileInput?.includes('value="/projects/renamed/atlas-v2.cproj"'),
      "Project File field shows the new path"
    );
  });

  it("Save As that is cancelled keeps the applied draft and the old path", async () => {
    mockSaveFileResult = null;
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: "Still Applied" });
    const ok = await saveAsProjectFromPropertiesDialogAction();
    assert.equal(ok, false);
    assert.equal(projectTitleSignal.value, "Still Applied");
    assert.deepEqual(savedPaths, []);
    assert.equal(projectFilePathSignal.value, "/projects/atlas.cproj");
  });
});
