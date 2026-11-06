/**
 * @file projectLifecycleSignals.test.ts
 * @module tests/renderer/state/projectLifecycleSignals.test
 * @description Unit tests for Renderer project lifecycle actions (saveProjectAction, saveAsProjectAction, closeProjectAction, openProjectAction).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-06
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { effect } from "@preact/signals-react";
import * as gisSignals from "../../../src/renderer/state/gisSignals";
import {
  hasProjectSignal,
  projectNameSignal,
  projectFilePathSignal,
  isProjectDirtySignal,
  isProjectPropertiesOpenSignal,
  layersSignal,
  layerGroupsSignal,
  projectTreeSignal,
  activeLayerIdSignal,
  viewportExtentSignal,
  scaleDenominatorSignal,
  mapActionSignal,
  createNewProject,
  newProjectAction,
  loadProjectIntoSignals,
  saveProjectAction,
  saveAsProjectAction,
  closeProjectAction,
  openProjectAction,
  projectLayersSignal,
  layerStylesSignal,
} from "../../../src/renderer/state/gisSignals";
import type { ProjectModel } from "../../../src/shared/types";

describe("Project Lifecycle Signals & Actions", () => {
  let mockSaveFileResult: string | null = null;
  let mockOpenFilesResult: string[] = [];
  let savedProjects: string[] = [];
  let executedActions: string[] = [];

  let savedViewports: any[] = [];

  beforeEach(() => {
    // Reset signals to blank slate
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    isProjectPropertiesOpenSignal.value = false;
    layersSignal.value = [];
    layerGroupsSignal.value = [];
    projectTreeSignal.value = [];
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    activeLayerIdSignal.value = null;
    viewportExtentSignal.value = [-180, -90, 180, 90];
    scaleDenominatorSignal.value = 50000000;
    mapActionSignal.value = null;

    mockSaveFileResult = null;
    mockOpenFilesResult = [];
    savedProjects = [];
    savedViewports = [];
    executedActions = [];

    // Mock electronAPI on global window
    (globalThis as any).window = {
      electronAPI: {
        saveFile: async () => mockSaveFileResult,
        openFiles: async () => mockOpenFilesResult,
        saveProject: async (filePath: string, viewport?: any) => {
          savedProjects.push(filePath);
          savedViewports.push(viewport);
          return true;
        },
        openProject: async (filePath: string): Promise<ProjectModel> => ({
          format: "cartouche-xml",
          filePath,
          metadata: { title: "Opened Project" },
          layers: [],
        }),
        executeAction: async (name: string) => {
          executedActions.push(name);
        },
      },
    };
  });

  it("saveProjectAction is a no-op when no project is loaded", async () => {
    assert.equal(hasProjectSignal.value, false);
    const result = await saveProjectAction();
    assert.equal(result, false);
    assert.equal(savedProjects.length, 0);
  });

  it("saveProjectAction on an existing project writes directly to path and resets isDirty", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/to/my-project.cproj",
      metadata: { title: "My Project" },
      layers: [],
    });

    isProjectDirtySignal.value = true;
    assert.equal(isProjectDirtySignal.value, true);
    assert.equal(projectFilePathSignal.value, "/path/to/my-project.cproj");

    const result = await saveProjectAction();
    assert.equal(result, true);
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ["/path/to/my-project.cproj"]);
  });

  it("saveProjectAction on an untitled project prompts with saveFile; aborts if canceled", async () => {
    createNewProject("Untitled Project");
    isProjectDirtySignal.value = true;
    assert.equal(projectFilePathSignal.value, null);

    // Simulate user canceling save dialog
    mockSaveFileResult = null;

    const result = await saveProjectAction();
    assert.equal(result, false);
    assert.equal(isProjectDirtySignal.value, true); // Retains dirty flag!
    assert.equal(projectFilePathSignal.value, null);
    assert.equal(savedProjects.length, 0);
  });

  it("saveProjectAction on an untitled project saves, updates path/title, and resets dirty flag", async () => {
    createNewProject("Untitled Project");
    isProjectDirtySignal.value = true;

    // Simulate user choosing path in save dialog
    mockSaveFileResult = "/workspace/saved-project.cproj";

    const result = await saveProjectAction();
    assert.equal(result, true);
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(projectFilePathSignal.value, "/workspace/saved-project.cproj");
    assert.equal(projectNameSignal.value, "saved-project");
    assert.deepEqual(savedProjects, ["/workspace/saved-project.cproj"]);
  });

  it("saveAsProjectAction prompts with existing path prefilled, saves, and updates project title", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/old/path.cproj",
      metadata: { title: "Old Project" },
      layers: [],
    });

    mockSaveFileResult = "/new/path/renamed-project.cproj";

    const result = await saveAsProjectAction();
    assert.equal(result, true);
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(
      projectFilePathSignal.value,
      "/new/path/renamed-project.cproj"
    );
    assert.equal(projectNameSignal.value, "renamed-project");
    assert.deepEqual(savedProjects, ["/new/path/renamed-project.cproj"]);
  });

  it("closeProjectAction is a safe no-op when no project is loaded", async () => {
    const result = await closeProjectAction();
    assert.equal(result, true);
    assert.equal(executedActions.length, 0);
  });

  it("closeProjectAction on a clean project closes immediately without prompting", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/test.cproj",
      metadata: { title: "Clean Project" },
      layers: [
        { id: "l1", name: "Layer 1", type: "vector", source: "/data/l1.shp" },
      ],
    });

    assert.equal(hasProjectSignal.value, true);
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(layersSignal.value.length, 1);

    const result = await closeProjectAction();
    assert.equal(result, true);
    assert.equal(hasProjectSignal.value, false);
    assert.equal(projectNameSignal.value, null);
    assert.equal(projectFilePathSignal.value, null);
    assert.equal(layersSignal.value.length, 0);
    assert.deepEqual(viewportExtentSignal.value, [-180, -90, 180, 90]);
    assert.deepEqual(executedActions, ["close_project"]);
  });

  it("closeProjectAction closes ProjectPropertiesDialog if open", async () => {
    createNewProject("Test Project");
    assert.equal(hasProjectSignal.value, true);

    isProjectPropertiesOpenSignal.value = true;
    assert.equal(isProjectPropertiesOpenSignal.value, true);

    const result = await closeProjectAction();
    assert.equal(result, true);
    assert.equal(hasProjectSignal.value, false);
    assert.equal(isProjectPropertiesOpenSignal.value, false, "ProjectPropertiesDialog must be closed when project closes");
  });

  it("closeProjectAction on a dirty project triggers save; aborts if save is canceled", async () => {
    createNewProject("Dirty Project");
    isProjectDirtySignal.value = true;

    // Simulate save dialog cancellation
    mockSaveFileResult = null;

    const closePromise = closeProjectAction();
    await Promise.resolve();
    (gisSignals as any).resolveUnsavedChangesModal?.("save");
    const result = await closePromise;
    assert.equal(result, false); // Close aborted!
    assert.equal(hasProjectSignal.value, true); // Project remains open!
    assert.equal(isProjectDirtySignal.value, true);
    assert.equal(executedActions.length, 0); // close_project was NOT dispatched!
  });

  it("closeProjectAction on a dirty project saves and proceeds to close when save succeeds", async () => {
    createNewProject("Dirty Project");
    isProjectDirtySignal.value = true;

    // Simulate user completing save dialog
    mockSaveFileResult = "/path/saved.cproj";

    const closePromise = closeProjectAction();
    await Promise.resolve();
    (gisSignals as any).resolveUnsavedChangesModal?.("save");
    const result = await closePromise;
    assert.equal(result, true);
    assert.equal(hasProjectSignal.value, false); // Project closed!
    assert.equal(projectNameSignal.value, null);
    assert.deepEqual(executedActions, ["close_project"]);
  });

  it("openProjectAction cancels cleanly when file picker is canceled", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/keep/existing.cproj",
      metadata: { title: "Keep Open" },
      layers: [],
    });

    mockOpenFilesResult = []; // Canceled picker

    await openProjectAction();
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectNameSignal.value, "Keep Open");
  });

  it("openProjectAction closes existing project and loads newly selected project", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/existing.cproj",
      metadata: { title: "Old Project" },
      layers: [],
    });

    mockOpenFilesResult = ["/new-project.cproj"];

    await openProjectAction();
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectNameSignal.value, "Opened Project");
    assert.equal(projectFilePathSignal.value, "/new-project.cproj");
    assert.deepEqual(executedActions, ["close_project"]);
  });

  it("saveProjectAction passes structured viewport extent, center, and scale to electronAPI.saveProject", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/viewport-test.cproj",
      metadata: { title: "Viewport Action Test" },
      layers: [],
    });

    viewportExtentSignal.value = [-122.5, 37.7, -122.3, 37.9];
    scaleDenominatorSignal.value = 15000;
    isProjectDirtySignal.value = true;

    const result = await saveProjectAction();
    assert.equal(result, true);
    assert.equal(savedProjects.length, 1);
    assert.equal(savedViewports.length, 1);

    const vp = savedViewports[0];
    assert.ok(vp, "Viewport object must be passed to saveProject");
    assert.deepEqual(vp.extent, {
      xmin: -122.5,
      ymin: 37.7,
      xmax: -122.3,
      ymax: 37.9,
    });
    assert.deepEqual(vp.center, { x: -122.4, y: 37.8 });
    assert.equal(vp.scale, 15000);
  });

  it("saveAsProjectAction passes structured viewport extent, center, and scale to electronAPI.saveProject", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/initial.cproj",
      metadata: { title: "Save As Viewport" },
      layers: [],
    });

    viewportExtentSignal.value = [10.5, 45.2, 12.8, 46.9];
    scaleDenominatorSignal.value = 250000;
    mockSaveFileResult = "/path/new-destination.cproj";

    const result = await saveAsProjectAction();
    assert.equal(result, true);
    assert.equal(savedProjects.length, 1);
    assert.equal(savedViewports.length, 1);

    const vp = savedViewports[0];
    assert.ok(vp, "Viewport object must be passed on saveAsProjectAction");
    assert.deepEqual(vp.extent, {
      xmin: 10.5,
      ymin: 45.2,
      xmax: 12.8,
      ymax: 46.9,
    });
    assert.equal(vp.scale, 250000);
  });

  it("loadProjectIntoSignals restores viewport extent, scale, and dispatches setViewport mapActionSignal", () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      metadata: { title: "Restored Viewport Project" },
      viewport: {
        extent: { xmin: -75.5, ymin: 40.0, xmax: -73.0, ymax: 41.5 },
        center: { x: -74.25, y: 40.75 },
        scale: 100000,
        rotation: 0.1,
      },
      layers: [],
    });

    assert.deepEqual(viewportExtentSignal.value, [-75.5, 40.0, -73.0, 41.5]);
    assert.equal(scaleDenominatorSignal.value, 100000);
    assert.ok(mapActionSignal.value);
    assert.equal(mapActionSignal.value?.action, "setViewport");
    assert.deepEqual(mapActionSignal.value?.extent, [-75.5, 40.0, -73.0, 41.5]);
    assert.deepEqual(mapActionSignal.value?.center, { x: -74.25, y: 40.75 });
    assert.equal(mapActionSignal.value?.rotation, 0.1);
  });

  it("loadProjectIntoSignals populates projectLayersSignal and layerStylesSignal for map viewport", () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      metadata: { title: "Viewport Layer Ingestion Project" },
      layers: [
        {
          id: "proj-layer-1",
          name: "Hydro Lake",
          type: "shp",
          source: "/data/lakes.shp",
          visible: true,
          layerKind: "vector",
          geometryKind: "Polygon",
          style: JSON.stringify({ "fill-color": "#00f" }),
          featureCount: 42,
          extent: [-100, 40, -80, 50],
        },
      ],
    });

    assert.equal(projectLayersSignal.value.length, 1);
    const desc = projectLayersSignal.value[0];
    assert.equal(desc.id, "proj-layer-1");
    assert.equal(desc.name, "Hydro Lake");
    assert.equal(desc.geometryKind, "Polygon");
    assert.deepEqual(desc.extent, [-100, 40, -80, 50]);
    assert.equal(desc.featureCount, 42);

    assert.ok(layerStylesSignal.value["proj-layer-1"]);
    assert.equal(layerStylesSignal.value["proj-layer-1"]["fill-color"], "#00f");
  });

  it("newProjectAction initializes a new project in Main and Renderer and sets currentProjectSignal", async () => {
    assert.equal(hasProjectSignal.value, false);

    const success = await newProjectAction();
    assert.equal(success, true);
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectNameSignal.value, "New Project");
    assert.equal(projectFilePathSignal.value, null);
    assert.ok(executedActions.includes("new_project"));
    assert.deepEqual(layersSignal.value, []);
  });

  it("newProjectAction prompts to save when existing project is dirty and aborts if canceled", async () => {
    createNewProject("Existing Dirty Project");
    isProjectDirtySignal.value = true;
    mockSaveFileResult = null; // User cancels save dialog

    const newPromise = newProjectAction();
    await Promise.resolve();
    (gisSignals as any).resolveUnsavedChangesModal?.("save");
    const success = await newPromise;
    assert.equal(success, false);
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectNameSignal.value, "Existing Dirty Project");
    assert.equal(isProjectDirtySignal.value, true);
  });

  it("saving a new project created via newProjectAction prompts for saveFile and saves empty layers project", async () => {
    await newProjectAction();
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectFilePathSignal.value, null);

    mockSaveFileResult = "/path/my-saved-new-template.cproj";

    const saved = await saveProjectAction();
    assert.equal(saved, true);
    assert.equal(
      projectFilePathSignal.value,
      "/path/my-saved-new-template.cproj"
    );
    assert.equal(projectNameSignal.value, "my-saved-new-template");
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ["/path/my-saved-new-template.cproj"]);
  });

  it("loadProjectIntoSignals batches multi-signal updates atomically so subscribers observe complete state", () => {
    let callCount = 0;
    let seenWithIncompleteState = 0;

    const dispose = effect(() => {
      const projLayers = projectLayersSignal.value;
      const styles = layerStylesSignal.value;
      const activeId = activeLayerIdSignal.value;
      const hasProj = hasProjectSignal.value;
      const tree = projectTreeSignal.value;
      callCount++;

      if (projLayers.length > 0) {
        for (const l of projLayers) {
          if (!styles[l.id] || activeId !== null || !hasProj || tree.length === 0) {
            seenWithIncompleteState++;
          }
        }
      }
    });

    try {
      const project: ProjectModel = {
        format: "cartouche-xml",
        filePath: "/test/batched.cproj",
        metadata: { title: "Batched Project" },
        layers: [
          {
            id: "batch-layer-1",
            name: "Layer One",
            type: "vector",
            source: "/data/l1.shp",
            visible: true,
          },
        ],
      };

      loadProjectIntoSignals(project);

      assert.equal(
        seenWithIncompleteState,
        0,
        "No intermediate subscriber execution with partial state"
      );
      assert.equal(
        callCount,
        2,
        "Subscriber effect must only fire once for the batched update (plus initial run)"
      );
    } finally {
      dispose();
    }
  });
});

describe("Sequential Per-Layer and Project Unsaved Changes Modals (Ticket #185)", () => {
  let clearedLayers: string[] = [];
  let dirtyLayersInMain: string[] = [];
  let confirmedCloseCount = 0;
  let savedProjects: string[] = [];

  async function waitForModal() {
    for (let i = 0; i < 10; i++) {
      if ((gisSignals as any).unsavedChangesModalSignal?.value) {
        return (gisSignals as any).unsavedChangesModalSignal.value;
      }
      await Promise.resolve();
    }
    return (gisSignals as any).unsavedChangesModalSignal?.value ?? null;
  }

  beforeEach(() => {
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    layersSignal.value = [];
    activeLayerIdSignal.value = null;
    if ((gisSignals as any).dirtyLayerIdsSignal) {
      (gisSignals as any).dirtyLayerIdsSignal.value = new Set();
    }
    if ((gisSignals as any).unsavedChangesModalSignal) {
      (gisSignals as any).unsavedChangesModalSignal.value = null;
    }

    clearedLayers = [];
    dirtyLayersInMain = [];
    confirmedCloseCount = 0;
    savedProjects = [];

    (globalThis as any).window = {
      electronAPI: {
        getDirtyLayerIds: async () => [...dirtyLayersInMain],
        clearLayerEdits: async (layerId: string) => {
          clearedLayers.push(layerId);
          dirtyLayersInMain = dirtyLayersInMain.filter((id) => id !== layerId);
        },
        saveProject: async (filePath: string) => {
          savedProjects.push(filePath);
          return true;
        },
        executeAction: async () => {},
        confirmCloseWindow: () => {
          confirmedCloseCount++;
        },
      },
    };
  });

  it("presents sequential modals for each dirty layer followed by the dirty project on closeProjectAction", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/multi-dirty.cproj",
      metadata: { title: "Multi Dirty Project" },
      layers: [
        { id: "layer-a", name: "Roads Layer", type: "vector", source: "/data/roads.shp" },
        { id: "layer-b", name: "Parcels Layer", type: "vector", source: "/data/parcels.shp" },
      ],
    });
    dirtyLayersInMain = ["layer-a", "layer-b"];
    isProjectDirtySignal.value = true;

    const closePromise = closeProjectAction();

    // 1st modal: layer-a ("Roads Layer") -> Choose Don't Save Changes ('discard')
    const modal1 = await waitForModal();
    assert.ok(modal1, "First modal must be open for layer-a");
    assert.equal(modal1.targetType, "layer");
    assert.equal(modal1.layerId, "layer-a");
    assert.equal(modal1.targetName, "Roads Layer");

    (gisSignals as any).resolveUnsavedChangesModal("discard");

    // 2nd modal: layer-b ("Parcels Layer") -> Choose Save Changes ('save')
    const modal2 = await waitForModal();
    assert.deepEqual(clearedLayers, ["layer-a"]);
    assert.ok(modal2, "Second modal must be open for layer-b");
    assert.equal(modal2.targetType, "layer");
    assert.equal(modal2.layerId, "layer-b");
    assert.equal(modal2.targetName, "Parcels Layer");

    (gisSignals as any).resolveUnsavedChangesModal("save");

    // 3rd modal: project ("Multi Dirty Project") -> Choose Save Changes ('save')
    const modal3 = await waitForModal();
    assert.deepEqual(clearedLayers, ["layer-a", "layer-b"]);
    assert.ok(modal3, "Third modal must be open for the dirty project");
    assert.equal(modal3.targetType, "project");
    assert.equal(modal3.targetName, "Multi Dirty Project");

    (gisSignals as any).resolveUnsavedChangesModal("save");
    const closed = await closePromise;

    assert.equal(closed, true);
    assert.equal(hasProjectSignal.value, false);
    assert.deepEqual(savedProjects, ["/path/multi-dirty.cproj"]);
  });

  it("aborts immediately when Cancel is selected on any layer or project modal", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/cancel-test.cproj",
      metadata: { title: "Cancel Test Project" },
      layers: [
        { id: "layer-1", name: "Rivers", type: "vector", source: "/data/rivers.shp" },
        { id: "layer-2", name: "Lakes", type: "vector", source: "/data/lakes.shp" },
      ],
    });
    dirtyLayersInMain = ["layer-1", "layer-2"];
    isProjectDirtySignal.value = true;

    const closePromise = closeProjectAction();

    const modal1 = await waitForModal();
    assert.ok(modal1);
    assert.equal(modal1.layerId, "layer-1");

    // Select Cancel on the first layer modal
    (gisSignals as any).resolveUnsavedChangesModal("cancel");
    const closed = await closePromise;

    assert.equal(closed, false, "closeProjectAction must return false when canceled");
    assert.equal(hasProjectSignal.value, true, "Project must remain open");
    assert.deepEqual(clearedLayers, [], "No layer edits should be cleared on cancel");
    assert.equal((gisSignals as any).unsavedChangesModalSignal.value, null);
  });

  it("intercepts application exit via requestAppExitAction, processes Don't Save Changes on project, and invokes confirmCloseWindow", async () => {
    loadProjectIntoSignals({
      format: "cartouche-xml",
      filePath: "/path/exit-test.cproj",
      metadata: { title: "Exit Test Project" },
      layers: [
        { id: "layer-x", name: "Points Layer", type: "vector", source: "/data/pts.shp" },
      ],
    });
    dirtyLayersInMain = ["layer-x"];
    isProjectDirtySignal.value = true;

    const exitPromise = (gisSignals as any).requestAppExitAction();

    // 1. Layer modal -> Save Changes
    const layerModal = await waitForModal();
    assert.ok(layerModal);
    assert.equal(layerModal.targetType, "layer");
    assert.equal(layerModal.targetName, "Points Layer");
    (gisSignals as any).resolveUnsavedChangesModal("save");

    // 2. Project modal -> Don't Save Changes ('discard')
    const projModal = await waitForModal();
    assert.ok(projModal);
    assert.equal(projModal.targetType, "project");
    assert.equal(projModal.targetName, "Exit Test Project");
    (gisSignals as any).resolveUnsavedChangesModal("discard");

    const exited = await exitPromise;
    assert.equal(exited, true);
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(savedProjects.length, 0, "Project must not be saved when Don't Save Changes is chosen");
    assert.equal(confirmedCloseCount, 1, "confirmCloseWindow must be invoked after all prompts succeed");
  });

  it("defines all 6 Unsaved Changes modal localization strings in en.xml and fr.xml", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const enXml = fs.readFileSync(path.resolve(process.cwd(), "assets/xml/i18n/en.xml"), "utf-8");
    const frXml = fs.readFileSync(path.resolve(process.cwd(), "assets/xml/i18n/fr.xml"), "utf-8");

    const requiredKeys = [
      "unsaved_changes_title",
      "unsaved_layer_changes_prompt",
      "unsaved_project_changes_prompt",
      "unsaved_changes_cancel",
      "unsaved_changes_dont_save",
      "unsaved_changes_save",
    ];

    for (const key of requiredKeys) {
      assert.ok(enXml.includes(`name="${key}"`), `en.xml must contain ${key}`);
      assert.ok(frXml.includes(`name="${key}"`), `fr.xml must contain ${key}`);
    }
  });
});
