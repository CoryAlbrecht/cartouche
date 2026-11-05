/**
 * @file layerPropertiesSignals.ts
 * @module renderer/state/layerPropertiesSignals
 * @description Reactive Preact signals and state management for LayerPropertiesDialog singleton window lifecycle, tab transitions, live OGR metadata hydration, and transactional editing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link LayerDetailedInfo}
 * @see {@link switchLayerPropertiesStyleFormat}
 * @see {@link isDiscardFieldChangesModalOpenSignal}
 * @see {@link hasUnappliedFieldChanges}
 * @see {@link discardUnappliedFieldChanges}
 */

import { signal, batch, type Signal } from "@preact/signals-react";
import type {
  LayerDetailedInfo,
  ProjectLayerItem,
  ProjectGroupItem,
  ProjectStyleFormat,
  SldStyleVersion,
  ProjectLayerStyleItem,
  LayerVisualSymbolizer,
  LayerFieldInfo,
} from "@shared/types";
import {
  parseStyleTextToGeoStyler,
  extractVisualSymbolizers,
  convertStyleFormat,
  validateStyleContent,
} from "../../shared/styles/flatStyleConverter";
import {
  createDefaultCartoucheLayerStyleJson,
  generateDefaultVectorStyleJson,
} from "../../shared/styles/defaultLayerStyles";
import {
  projectTreeSignal,
  projectLayersSignal,
  activeLayerIdSignal,
  isProjectDirtySignal,
  resolveLayerStyleItem,
  applyStyleToLayers,
  updateLayerFields,
} from "./projectSignals";
import { logging } from "../../shared/logging";

/**
 * @typedef {'information' | 'source' | 'fields' | 'time_filter' | 'styling'} LayerPropertiesTabId
 * @description Identifier for CategorySidebar navigation tabs in LayerPropertiesDialog.
 */
export type LayerPropertiesTabId =
  | "information"
  | "source"
  | "fields"
  | "time_filter"
  | "styling";

/**
 * @typedef {Object} LayerPropertiesDraft
 * @property {string} layerName - Draft display title of the layer.
 * @property {string} layerId - Draft unique system identifier.
 * @property {string} crsAuthId - Draft CRS authority identifier (e.g. "EPSG:4326").
 * @property {string} featureFilter - Draft provider subset filter expression.
 * @property {string | null} idValidationError - Validation error message for layer ID, or null if valid.
 * @property {ProjectStyleFormat} styleFormat - Active draft style serialization format.
 * @property {SldStyleVersion} sldVersion - Active draft SLD specification version.
 * @property {string} styleContent - Raw style markup or JSON text content.
 * @property {string | null} styleValidationError - Validation error message for style content, or null if valid.
 * @property {LayerVisualSymbolizer} visualSymbolizer - Active draft visual symbolizer control parameters.
 * @property {number} opacity - Draft layer opacity between 0.0 and 1.0.
 * @property {boolean} temporalEnabled - Whether dynamic temporal control is enabled on the layer.
 * @property {Record<string, string>} [formatCache] - In-memory style text cache indexed by format key across switches.
 * @property {LayerFieldInfo[]} [fields] - Draft array of layer attribute field definitions.
 */
export interface LayerPropertiesDraft {
  layerName: string;
  layerId: string;
  crsAuthId: string;
  featureFilter: string;
  idValidationError: string | null;
  styleFormat: ProjectStyleFormat;
  sldVersion: SldStyleVersion;
  styleContent: string;
  styleValidationError: string | null;
  visualSymbolizer: LayerVisualSymbolizer;
  opacity: number;
  temporalEnabled: boolean;
  formatCache?: Record<string, string>;
  fields?: LayerFieldInfo[];
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
 * @signal isDiscardFieldChangesModalOpenSignal
 * @description Controls visibility of the confirmation modal warning when disabling Layer Edit Mode with unapplied field changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isDiscardFieldChangesModalOpenSignal: Signal<boolean> =
  signal<boolean>(false);

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
 * @updated 2026-11-04
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
    styleFormat: "openlayers",
    sldVersion: "1.0.0",
    styleContent: "",
    styleValidationError: null,
    visualSymbolizer: {},
    opacity: 1,
    temporalEnabled: false,
    formatCache: {},
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
 * @description Opens or refocuses the modeless LayerPropertiesDialog for the specified layer, querying live metadata and synchronizing activeLayerIdSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier to inspect.
 * @returns {Promise<void>}
 */
export async function openLayerPropertiesDialog(
  layerId: string
): Promise<void> {
  activeLayerIdSignal.value = layerId;
  activeLayerPropertiesIdSignal.value = layerId;
  isLayerPropertiesLoadingSignal.value = true;

  const currentLayer = findLayerInTree(projectTreeSignal.value, layerId);
  const currentProjectLayer = projectLayersSignal.value.find((l) => l.id === layerId);
  const rawFields =
    currentProjectLayer?.fields
      ? currentProjectLayer.fields
      : (currentLayer && 'fields' in currentLayer && (currentLayer as any).fields)
        ? ((currentLayer as any).fields as LayerFieldInfo[])
        : undefined;

  let physicalCount = 0;
  const initialFields =
    rawFields ?
      rawFields.map((f) => {
        const isVirtual = Boolean(f.isVirtual);
        let assignedIndex = f.index;
        if (assignedIndex === undefined && !isVirtual) {
          assignedIndex = physicalCount;
        }
        if (!isVirtual) {
          physicalCount++;
        }
        return {
          ...f,
          index: assignedIndex,
          originalInferredType: f.originalInferredType ?? f.inferredType,
          isVirtual,
        };
      }).map((f, _, arr) => {
        if (f.index === undefined && f.isVirtual) {
          const virtualIdx = arr.filter((x) => x.isVirtual && x.index === undefined).indexOf(f);
          return { ...f, index: physicalCount + virtualIdx };
        }
        return f;
      })
    : undefined;
  const initialName = currentLayer?.name || layerId;
  const initialCrs = currentLayer?.crs?.authId || "EPSG:4326";
  const initialFilter =
    typeof currentLayer?.customProperties?.featureFilter === "string" ?
      (currentLayer.customProperties.featureFilter as string)
    : "";
  const initialOpacity =
    typeof currentLayer?.opacity === "number" ? currentLayer.opacity : 1;
  const initialTemporal =
    currentLayer?.temporalEnabled ?? currentProjectLayer?.temporalEnabled ?? false;

  const resolvedStyleItem = resolveLayerStyleItem(layerId);
  const initialFormat = resolvedStyleItem.format || "openlayers";
  const initialSldVersion = resolvedStyleItem.version || "1.0.0";
  let initialContent = resolvedStyleItem.content || "";

  if (!initialContent) {
    if (initialFormat === "cartouche") {
      initialContent = createDefaultCartoucheLayerStyleJson(currentLayer?.geometryKind);
    } else if (initialFormat === "openlayers") {
      initialContent = generateDefaultVectorStyleJson();
    }
  }

  const initialFormatKey =
    initialFormat === "cartouche"
      ? "cartouche"
      : initialFormat === "sld"
        ? initialSldVersion === "1.1.0"
          ? "sld-1.1.0"
          : "sld-1.0.0"
        : "openlayers";

  const initialCache: Record<string, string> = {
    [initialFormatKey]: initialContent,
  };

  let initialVisual: LayerVisualSymbolizer = {};
  if (initialContent) {
    try {
      const ast = await parseStyleTextToGeoStyler(
        initialContent,
        initialFormat,
        initialSldVersion
      );
      initialVisual = extractVisualSymbolizers(ast, currentLayer?.geometryKind);
    } catch {
      initialVisual = extractVisualSymbolizers(
        { name: "Default", rules: [] },
        currentLayer?.geometryKind
      );
    }
  } else {
    initialVisual = extractVisualSymbolizers(
      { name: "Default", rules: [] },
      currentLayer?.geometryKind
    );
  }

  layerPropertiesDraftSignal.value = {
    layerName: initialName,
    layerId: layerId,
    crsAuthId: initialCrs,
    featureFilter: initialFilter,
    idValidationError: null,
    styleFormat: initialFormat,
    sldVersion: initialSldVersion,
    styleContent: initialContent,
    styleValidationError: null,
    visualSymbolizer: initialVisual,
    opacity: initialOpacity,
    temporalEnabled: initialTemporal,
    formatCache: initialCache,
    fields: initialFields,
  };

  try {
    if (typeof window !== "undefined" && window.electronAPI?.getLayerInfo) {
      const info = await window.electronAPI.getLayerInfo(layerId);
      layerDetailedInfoSignal.value = info;
      if (
        info?.geometryKind &&
        (!currentLayer?.geometryKind || currentLayer.geometryKind === "Unknown")
      ) {
        try {
          const ast =
            initialContent ?
              await parseStyleTextToGeoStyler(
                initialContent,
                initialFormat,
                initialSldVersion
              )
            : { name: "Default", rules: [] };
          const updatedVisual = extractVisualSymbolizers(
            ast,
            info.geometryKind
          );
          updateLayerPropertiesDraft({ visualSymbolizer: updatedVisual });
        } catch {
          const updatedVisual = extractVisualSymbolizers(
            { name: "Default", rules: [] },
            info.geometryKind
          );
          updateLayerPropertiesDraft({ visualSymbolizer: updatedVisual });
        }
      }
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
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closeLayerPropertiesDialog(): void {
  activeLayerPropertiesIdSignal.value = null;
  layerDetailedInfoSignal.value = null;
  isLayerPropertiesLoadingSignal.value = false;
  isDiscardFieldChangesModalOpenSignal.value = false;
  layerPropertiesDraftSignal.value = {
    layerName: "",
    layerId: "",
    crsAuthId: "EPSG:4326",
    featureFilter: "",
    idValidationError: null,
    styleFormat: "openlayers",
    sldVersion: "1.0.0",
    styleContent: "",
    styleValidationError: null,
    visualSymbolizer: {},
    opacity: 1,
    temporalEnabled: false,
    formatCache: {},
    fields: undefined,
  };
}

/**
 * @description Resolves the baseline attribute field definitions for a target layer from projectLayersSignal, projectTreeSignal, or layerDetailedInfoSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @returns {LayerFieldInfo[]} Array of baseline field definitions.
 */
export function getBaselineLayerFields(layerId: string): LayerFieldInfo[] {
  const projectLayer = projectLayersSignal.value.find((l) => l.id === layerId);
  if (projectLayer?.fields) {
    return projectLayer.fields;
  }
  const treeLayer = findLayerInTree(projectTreeSignal.value, layerId);
  if (
    treeLayer &&
    "fields" in treeLayer &&
    Array.isArray((treeLayer as any).fields)
  ) {
    return (treeLayer as any).fields as LayerFieldInfo[];
  }
  if (
    layerDetailedInfoSignal.value?.layerId === layerId &&
    layerDetailedInfoSignal.value.fields
  ) {
    return layerDetailedInfoSignal.value.fields;
  }
  return [];
}

/**
 * @description Checks whether the active layer properties draft contains unapplied modifications to attribute fields compared to baseline definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @param {string | null} [layerId] - Optional layer identifier to check; defaults to activeLayerPropertiesIdSignal.value.
 * @returns {boolean} True if draft.fields has unapplied changes relative to baseline; otherwise false.
 */
export function hasUnappliedFieldChanges(layerId?: string | null): boolean {
  const targetId =
    layerId !== undefined && layerId !== null ?
      layerId
    : activeLayerPropertiesIdSignal.value;
  if (!targetId) return false;

  const draft = layerPropertiesDraftSignal.value;
  if (!draft.fields || draft.layerId !== targetId) return false;

  const baseline = getBaselineLayerFields(targetId);
  if (draft.fields.length !== baseline.length) return true;

  for (let i = 0; i < draft.fields.length; i++) {
    const df = draft.fields[i];
    const bf = baseline[i];
    if (!bf) return true;
    if (
      df.name !== bf.name ||
      df.inferredType !== bf.inferredType ||
      Boolean(df.userOverridden) !== Boolean(bf.userOverridden) ||
      (df.width ?? undefined) !== (bf.width ?? undefined) ||
      (df.precision ?? undefined) !== (bf.precision ?? undefined) ||
      (df.comment ?? "") !== (bf.comment ?? "")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @description Discards unapplied field modifications in layerPropertiesDraftSignal, resetting draft.fields to undefined while keeping other tab drafts intact.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-03
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @returns {void}
 */
export function discardUnappliedFieldChanges(): void {
  const draft = layerPropertiesDraftSignal.value;
  layerPropertiesDraftSignal.value = {
    ...draft,
    fields: undefined,
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
 * @description Switches active style format and SLD version in draft state, preserving pending edits in in-memory session cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {string} targetOption - Format selection key ('cartouche' | 'openlayers' | 'sld-1.0.0' | 'sld-1.1.0').
 * @param {string} [geometryKind] - Layer geometry kind for default template generation.
 * @returns {Promise<void>}
 */
export async function switchLayerPropertiesStyleFormat(
  targetOption: string,
  geometryKind?: string
): Promise<void> {
  const draft = layerPropertiesDraftSignal.value;
  const currentKey =
    draft.styleFormat === "cartouche" ?
      "cartouche"
    : draft.styleFormat === "sld" ?
      draft.sldVersion === "1.1.0" ?
        "sld-1.1.0"
      : "sld-1.0.0"
    : "openlayers";

  const targetKey = targetOption === "simple" ? "cartouche" : targetOption;
  if (targetKey === currentKey) return;

  const targetFormat: ProjectStyleFormat =
    targetKey === "cartouche" ? "cartouche"
    : targetKey.startsWith("sld") ? "sld"
    : "openlayers";
  const targetVersion: SldStyleVersion =
    targetKey === "sld-1.1.0" ? "1.1.0" : "1.0.0";

  const updatedCache = {
    ...(draft.formatCache || {}),
    [currentKey]: draft.styleContent,
  };

  let newContent = updatedCache[targetKey];
  if (newContent === undefined) {
    if (draft.styleContent && draft.styleContent.trim()) {
      try {
        newContent = await convertStyleFormat(draft.styleContent, {
          fromFormat: draft.styleFormat,
          fromVersion: draft.sldVersion,
          toFormat: targetFormat,
          toVersion: targetVersion,
          geometryKind,
        });
      } catch (err) {
        logging.warn("Style conversion failed; falling back to default style template", err, {
          fromFormat: draft.styleFormat,
          toFormat: targetFormat,
          scope: "layerPropertiesSignals",
        });
      }
    }

    if (!newContent) {
      if (targetFormat === "cartouche") {
        newContent = createDefaultCartoucheLayerStyleJson(geometryKind);
      } else if (targetFormat === "openlayers") {
        newContent = generateDefaultVectorStyleJson();
      } else if (targetFormat === "sld") {
        const def = generateDefaultVectorStyleJson();
        try {
          newContent = await convertStyleFormat(def, {
            fromFormat: "openlayers",
            toFormat: "sld",
            toVersion: targetVersion,
            geometryKind,
          });
        } catch {
          newContent = "";
        }
      }
    }
    updatedCache[targetKey] = newContent || "";
  }

  const validation = await validateStyleContent(
    newContent || "",
    targetFormat,
    targetVersion
  );

  updateLayerPropertiesDraft({
    styleFormat: targetFormat,
    sldVersion: targetVersion,
    styleContent: newContent || "",
    styleValidationError:
      validation.isValid ? null : validation.error || "Validation error",
    formatCache: updatedCache,
  });
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
 * @description Commits active draft modifications (name, ID, CRS, filter, temporalEnabled, style, opacity, fields) to the authoritative layer and registers re-keyed identifier across main and renderer processes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if changes were successfully committed.
 */
export async function applyLayerPropertiesEdits(): Promise<boolean> {
  const activeId = activeLayerPropertiesIdSignal.value;
  if (!activeId) return false;

  const draft = layerPropertiesDraftSignal.value;
  if (draft.idValidationError || draft.styleValidationError) {
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
      temporalEnabled: draft.temporalEnabled,
      customProperties: {
        ...(currentLayer.customProperties || {}),
        featureFilter: draft.featureFilter.trim(),
      },
    }
  );

  // Update active ID signal and draft state to reflect confirmed new layer ID
  batch(() => {
    activeLayerPropertiesIdSignal.value = trimmedId;
    projectTreeSignal.value = updatedTree;
    if (projectLayersSignal.value.some((l) => l.id === activeId)) {
      projectLayersSignal.value = projectLayersSignal.value.map((desc) =>
        desc.id === activeId
          ? {
              ...desc,
              id: trimmedId,
              name: trimmedName,
              crs: updatedCrs,
              temporalEnabled: draft.temporalEnabled,
              customProperties: {
                ...(desc.customProperties || {}),
                featureFilter: draft.featureFilter.trim(),
              },
            }
          : desc
      );
    }
    isProjectDirtySignal.value = true;
  });

  // 4. Apply transactional draft style and opacity to layer
  if (draft.styleContent) {
    const draftStyle: ProjectLayerStyleItem = {
      format: draft.styleFormat,
      ...(draft.styleFormat === "sld" ? { version: draft.sldVersion } : {}),
      content: draft.styleContent,
    };
    await applyStyleToLayers([trimmedId], draftStyle, draft.opacity);
  }

  // 5. Update layer fields if draft fields are present
  if (draft.fields) {
    updateLayerFields(trimmedId, draft.fields);
    if (window.electronAPI?.updateLayerFields) {
      await window.electronAPI.updateLayerFields(trimmedId, draft.fields);
    }
  }

  // Refresh detailed info if available
  if (layerDetailedInfoSignal.value) {
    layerDetailedInfoSignal.value = {
      ...layerDetailedInfoSignal.value,
      layerId: trimmedId,
      name: trimmedName,
      crsDescription: updatedCrs.description,
      ...(draft.fields ? { fields: draft.fields } : {}),
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
