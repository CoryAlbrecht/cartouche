/**
 * @file layerPropertiesSignals.ts
 * @module renderer/state/layerPropertiesSignals
 * @description Reactive Preact signals and state management for LayerPropertiesDialog singleton window lifecycle, tab transitions, live OGR metadata hydration, and transactional editing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link LayerDetailedInfo}
 */

import { signal, type Signal } from "@preact/signals-react";
import type {
  LayerDetailedInfo,
  ProjectLayerItem,
  ProjectGroupItem,
} from "@shared/types";
import { projectTreeSignal, isProjectDirtySignal } from "./projectSignals";
import { logging } from "../../shared/logging";

/**
 * @typedef {'information' | 'source' | 'fields' | 'time_filter'} LayerPropertiesTabId
 * @description Identifier for CategorySidebar navigation tabs in LayerPropertiesDialog.
 */
export type LayerPropertiesTabId =
  | "information"
  | "source"
  | "fields"
  | "time_filter";

/**
 * @typedef {Object} LayerPropertiesDraft
 * @property {string} layerName - Draft display title of the layer.
 * @property {string} layerId - Draft unique system identifier.
 * @property {string} crsAuthId - Draft CRS authority identifier (e.g. "EPSG:4326").
 * @property {string} featureFilter - Draft provider subset filter expression.
 * @property {string | null} idValidationError - Validation error message for layer ID, or null if valid.
 */
export interface LayerPropertiesDraft {
  layerName: string;
  layerId: string;
  crsAuthId: string;
  featureFilter: string;
  idValidationError: string | null;
}

/**
 * @typedef {Object} PopularCrsOption
 * @property {string} authId - EPSG authority identifier.
 * @property {string} name - Common geographic or projected name.
 */
export interface PopularCrsOption {
  authId: string;
  name: string;
}

/**
 * @description Ten popular coordinate reference systems for desktop GIS selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {PopularCrsOption[]}
 */
export const POPULAR_CRS_OPTIONS: PopularCrsOption[] = [
  { authId: "EPSG:4326", name: "WGS 84" },
  { authId: "EPSG:3857", name: "WGS 84 / Pseudo-Mercator" },
  { authId: "EPSG:32632", name: "WGS 84 / UTM zone 32N" },
  { authId: "EPSG:32633", name: "WGS 84 / UTM zone 33N" },
  { authId: "EPSG:32618", name: "WGS 84 / UTM zone 18N" },
  { authId: "EPSG:2154", name: "RGF93 / Lambert-93" },
  { authId: "EPSG:27700", name: "OSGB36 / British National Grid" },
  { authId: "EPSG:25832", name: "ETRS89 / UTM zone 32N" },
  { authId: "EPSG:3006", name: "SWEREF99 TM" },
  { authId: "EPSG:4269", name: "NAD83" },
];

/**
 * @signal activeLayerPropertiesIdSignal
 * @description Tracks the active layer identifier targeted by LayerPropertiesDialog, or null if dialog is closed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const activeLayerPropertiesIdSignal: Signal<string | null> = signal<
  string | null
>(null);

/**
 * @signal activeLayerPropertiesTabSignal
 * @description Currently active category tab identifier within LayerPropertiesDialog sidebar.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {Signal<LayerPropertiesTabId>}
 */
export const activeLayerPropertiesTabSignal: Signal<LayerPropertiesTabId> =
  signal<LayerPropertiesTabId>("information");

/**
 * @signal layerDetailedInfoSignal
 * @description Authoritative OGR metadata and field schemas retrieved from GeospatialEngine via IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {Signal<LayerDetailedInfo | null>}
 */
export const layerDetailedInfoSignal: Signal<LayerDetailedInfo | null> =
  signal<LayerDetailedInfo | null>(null);

/**
 * @signal isLayerPropertiesLoadingSignal
 * @description Indicates whether a live layer metadata query is actively in progress.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isLayerPropertiesLoadingSignal: Signal<boolean> =
  signal<boolean>(false);

/**
 * @signal layerPropertiesDraftSignal
 * @description Holds uncommitted draft modifications for the active layer properties session across tab transitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {Signal<LayerPropertiesDraft>}
 */
export const layerPropertiesDraftSignal: Signal<LayerPropertiesDraft> =
  signal<LayerPropertiesDraft>({
    layerName: "",
    layerId: "",
    crsAuthId: "EPSG:4326",
    featureFilter: "",
    idValidationError: null,
  });

/**
 * @description Recursively searches the project tree for a layer matching the specified layer ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} nodes - Project layer nodes collection.
 * @param {string} layerId - Target layer identifier.
 * @returns {ProjectLayerItem | null} The matched layer or null.
 */
export function findLayerInTree(
  nodes: Array<ProjectLayerItem | ProjectGroupItem>,
  layerId: string
): ProjectLayerItem | null {
  for (const node of nodes) {
    if (
      "children" in node
      && Array.isArray((node as ProjectGroupItem).children)
    ) {
      const found = findLayerInTree(
        (node as ProjectGroupItem).children,
        layerId
      );
      if (found) {
        return found;
      }
    } else if (node.id === layerId) {
      return node as ProjectLayerItem;
    }
  }
  return null;
}

/**
 * @description Recursively collects all registered layer IDs in the project tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} nodes - Project layer nodes collection.
 * @returns {Set<string>} Set of all existing layer IDs.
 */
export function collectAllLayerIds(
  nodes: Array<ProjectLayerItem | ProjectGroupItem>
): Set<string> {
  const ids = new Set<string>();
  function traverse(list: Array<ProjectLayerItem | ProjectGroupItem>) {
    for (const item of list) {
      if (item.id) {
        ids.add(item.id);
      }
      if (
        "children" in item
        && Array.isArray((item as ProjectGroupItem).children)
      ) {
        traverse((item as ProjectGroupItem).children);
      }
    }
  }
  traverse(nodes);
  return ids;
}

/**
 * @description Opens or refocuses the modeless LayerPropertiesDialog for the specified layer, querying live metadata.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier to inspect.
 * @returns {Promise<void>}
 */
export async function openLayerPropertiesDialog(
  layerId: string
): Promise<void> {
  activeLayerPropertiesIdSignal.value = layerId;
  isLayerPropertiesLoadingSignal.value = true;

  const currentLayer = findLayerInTree(projectTreeSignal.value, layerId);
  const initialName = currentLayer?.name || layerId;
  const initialCrs = currentLayer?.crs?.authId || "EPSG:4326";
  const initialFilter =
    typeof currentLayer?.customProperties?.featureFilter === "string" ?
      (currentLayer.customProperties.featureFilter as string)
    : "";

  layerPropertiesDraftSignal.value = {
    layerName: initialName,
    layerId: layerId,
    crsAuthId: initialCrs,
    featureFilter: initialFilter,
    idValidationError: null,
  };

  try {
    if (typeof window !== "undefined" && window.electronAPI?.getLayerInfo) {
      const info = await window.electronAPI.getLayerInfo(layerId);
      layerDetailedInfoSignal.value = info;
    } else {
      // Fallback mock information if window.electronAPI is unavailable (e.g. test environment)
      layerDetailedInfoSignal.value = {
        layerId,
        name: initialName,
        source: currentLayer?.source || "",
        driverName: "ESRI Shapefile",
        driverDialect: "ogr_sql",
        geometryKind: currentLayer?.geometryKind || "Unknown",
        featureCount: currentLayer?.featureCount || 0,
        crsDescription: initialCrs,
        extent: currentLayer?.extent || [0, 0, 0, 0],
        fields: [],
      };
    }
  } catch (err) {
    logging.error("Failed to load detailed layer properties via IPC", err, {
      layerId,
      scope: "layerPropertiesSignals",
    });
  } finally {
    isLayerPropertiesLoadingSignal.value = false;
  }
}

/**
 * @description Closes the LayerPropertiesDialog and resets session state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closeLayerPropertiesDialog(): void {
  activeLayerPropertiesIdSignal.value = null;
  layerDetailedInfoSignal.value = null;
  isLayerPropertiesLoadingSignal.value = false;
  layerPropertiesDraftSignal.value = {
    layerName: "",
    layerId: "",
    crsAuthId: "EPSG:4326",
    featureFilter: "",
    idValidationError: null,
  };
}

/**
 * @description Discards all uncommitted draft edits and closes LayerPropertiesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cancelLayerPropertiesEdits(): void {
  closeLayerPropertiesDialog();
}

/**
 * @description Updates a draft property in the active layer properties session.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {Partial<LayerPropertiesDraft>} updates - Changed draft properties.
 * @returns {void}
 */
export function updateLayerPropertiesDraft(
  updates: Partial<LayerPropertiesDraft>
): void {
  const current = layerPropertiesDraftSignal.value;
  let idValidationError = current.idValidationError;

  if (updates.layerId !== undefined) {
    const trimmed = updates.layerId.trim();
    if (!trimmed) {
      idValidationError = "Layer ID cannot be empty.";
    } else {
      const activeId = activeLayerPropertiesIdSignal.value;
      if (trimmed !== activeId) {
        const allIds = collectAllLayerIds(projectTreeSignal.value);
        if (allIds.has(trimmed)) {
          idValidationError = "Layer ID already exists in this project.";
        } else {
          idValidationError = null;
        }
      } else {
        idValidationError = null;
      }
    }
  }

  layerPropertiesDraftSignal.value = {
    ...current,
    ...updates,
    idValidationError:
      updates.idValidationError !== undefined ?
        updates.idValidationError
      : idValidationError,
  };
}

/**
 * @description Recursively updates properties of a target layer within the hierarchical project tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} nodes - Project tree nodes.
 * @param {string} layerId - Target layer identifier.
 * @param {Partial<ProjectLayerItem>} updates - Properties to merge into target layer.
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Updated project tree nodes array.
 */
export function updateLayerPropertiesInTree(
  nodes: Array<ProjectLayerItem | ProjectGroupItem>,
  layerId: string,
  updates: Partial<ProjectLayerItem>
): Array<ProjectLayerItem | ProjectGroupItem> {
  return nodes.map((node) => {
    if (node.id === layerId && !("children" in node)) {
      return { ...node, ...updates } as ProjectLayerItem;
    }
    if (
      "children" in node
      && Array.isArray((node as ProjectGroupItem).children)
    ) {
      return {
        ...node,
        children: updateLayerPropertiesInTree(
          (node as ProjectGroupItem).children,
          layerId,
          updates
        ),
      } as ProjectGroupItem;
    }
    return node;
  });
}

/**
 * @description Commits active draft modifications (name, ID, CRS, filter) to the authoritative layer and registers re-keyed identifier across main and renderer processes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if changes were successfully committed.
 */
export async function applyLayerPropertiesEdits(): Promise<boolean> {
  const activeId = activeLayerPropertiesIdSignal.value;
  if (!activeId) return false;

  const draft = layerPropertiesDraftSignal.value;
  if (draft.idValidationError) {
    return false;
  }

  const currentLayer = findLayerInTree(projectTreeSignal.value, activeId);
  if (!currentLayer) return false;

  const trimmedName = draft.layerName.trim() || currentLayer.name;
  const trimmedId = draft.layerId.trim() || activeId;

  // 1. If layerId has changed, execute atomic re-keying across main & renderer
  if (trimmedId !== activeId) {
    if (window.electronAPI?.rekeyLayer) {
      try {
        await window.electronAPI.rekeyLayer(activeId, trimmedId);
      } catch (err: any) {
        logging.error("Failed to rekey layer ID via IPC", err, {
          scope: "layerPropertiesSignals",
          activeId,
          trimmedId,
        });
        updateLayerPropertiesDraft({
          idValidationError: String(err?.message || err),
        });
        return false;
      }
    }
  }

  // 2. If name has changed, rename layer
  if (trimmedName !== currentLayer.name) {
    if (window.electronAPI?.renameLayerTreeNode) {
      await window.electronAPI.renameLayerTreeNode(trimmedId, trimmedName);
    } else if (window.electronAPI?.renameNode) {
      await window.electronAPI.renameNode(trimmedId, trimmedName);
    }
  }

  // 3. Update CRS and custom feature filter on local layer and set isProjectDirtySignal
  const crsMatch = POPULAR_CRS_OPTIONS.find(
    (c) => c.authId === draft.crsAuthId
  );
  const updatedCrs = {
    authId: draft.crsAuthId,
    description: crsMatch?.name || draft.crsAuthId,
  };

  const updatedTree = updateLayerPropertiesInTree(
    projectTreeSignal.value,
    activeId,
    {
      id: trimmedId,
      name: trimmedName,
      crs: updatedCrs,
      customProperties: {
        ...(currentLayer.customProperties || {}),
        featureFilter: draft.featureFilter.trim(),
      },
    }
  );

  // Update active ID signal and draft state to reflect confirmed new layer ID
  activeLayerPropertiesIdSignal.value = trimmedId;
  projectTreeSignal.value = updatedTree;
  isProjectDirtySignal.value = true;

  // Refresh detailed info if available
  if (layerDetailedInfoSignal.value) {
    layerDetailedInfoSignal.value = {
      ...layerDetailedInfoSignal.value,
      layerId: trimmedId,
      name: trimmedName,
      crsDescription: updatedCrs.description,
    };
  }

  return true;
}

/**
 * @description Commits active draft edits and closes LayerPropertiesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if committed and closed.
 */
export async function commitAndCloseLayerPropertiesDialog(): Promise<boolean> {
  const success = await applyLayerPropertiesEdits();
  if (success) {
    closeLayerPropertiesDialog();
  }
  return success;
}
