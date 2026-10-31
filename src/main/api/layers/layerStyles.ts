/**
 * @file layerStyles.ts
 * @module main/api/layers/layerStyles
 * @description Main Process API functions for reading, writing, and assigning vector layer styles (OpenLayers Flat Style and OGC SLD 1.0.0/1.1.0), promoting shared styles across multi-layer selections, and cleaning up orphaned shared styles in ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link FileTypeRegistry}
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';
import { projectStore } from '../../project/ProjectStore';
import { Layer } from '../../project/models/Layer';
import { LayerGroup } from '../../project/models/LayerGroup';
import { LayerTreeNode } from '../../project/models/LayerTreeNode';
import {
  broadcastProjectLayersTree,
  serializeProjectLayersTree
} from '../../project/ProjectBroadcaster';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import {
  resolveDialogDefaultPath,
  updateDialogLocation
} from '../dialog/dialogLocation';
import {
  isProjectLayerStyleWrapper,
  type ProjectLayerStyleItem,
  type ProjectStyleFormat,
  type SldStyleVersion
} from '../../../shared/types';

/**
 * @typedef {Object} OpenStyleDialogInvoker
 * @description Interface for invoking the native open style file dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @property {(options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>} showOpenDialog - Function invoking system open dialog.
 */
export interface OpenStyleDialogInvoker {
  showOpenDialog: (
    options: Electron.OpenDialogOptions
  ) => Promise<Electron.OpenDialogReturnValue>;
}

/**
 * @typedef {Object} SaveStyleDialogInvoker
 * @description Interface for invoking the native save style file dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @property {(options: Electron.SaveDialogOptions) => Promise<{ canceled: boolean; filePath?: string }>} showSaveDialog - Function invoking system save dialog.
 */
export interface SaveStyleDialogInvoker {
  showSaveDialog: (
    options: Electron.SaveDialogOptions
  ) => Promise<{ canceled: boolean; filePath?: string }>;
}

let sharedStyleCounter = 0;

/**
 * @description Recursively collects all leaf Layer instances from a LayerTreeNode hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {LayerTreeNode} node - Tree node to traverse.
 * @returns {Layer[]} Flattened array of leaf Layer instances.
 */
function collectLeafLayers(node: LayerTreeNode): Layer[] {
  const result: Layer[] = [];
  if (node instanceof Layer) {
    result.push(node);
  } else if (node instanceof LayerGroup) {
    for (const child of node.getAllChildren()) {
      result.push(...collectLeafLayers(child));
    }
  }
  return result;
}

/**
 * @description Removes any shared style entries in ProjectModel.styles that are no longer referenced by any layer in ProjectStore.
 * Also synchronizes ProjectModel.layers with the current serialized layer tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cleanupOrphanedSharedStyles(): void {
  const project = projectStore.getProject();
  if (!project) {
    return;
  }

  const allLayers = collectLeafLayers(projectStore.getRootGroup());
  const referencedIds = new Set<string>();

  for (const layer of allLayers) {
    if (layer.styleId) {
      referencedIds.add(layer.styleId);
    }
    if (isProjectLayerStyleWrapper(layer.style) && layer.style.href?.startsWith('#')) {
      referencedIds.add(layer.style.href.slice(1));
    }
  }

  if (Array.isArray(project.styles)) {
    project.styles = project.styles.filter((s) => referencedIds.has(s.id));
  }

  project.layers = serializeProjectLayersTree();
}

/**
 * @description Resolves the concrete style content, format, and optional SLD version from a ProjectLayerStyleItem, expanding `#id` shared style references if needed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {ProjectLayerStyleItem} style - Input style item.
 * @returns {{ content: string; format: ProjectStyleFormat; version?: SldStyleVersion }} Resolved concrete style fields.
 */
function resolveConcreteStyle(style: ProjectLayerStyleItem): {
  content: string;
  format: ProjectStyleFormat;
  version?: SldStyleVersion;
} {
  const project = projectStore.getProject();
  if (style.href?.startsWith('#') && Array.isArray(project?.styles)) {
    const targetId = style.href.slice(1);
    const matched = project.styles.find((s) => s.id === targetId);
    if (matched) {
      const format: ProjectStyleFormat = matched.format === 'sld' ? 'sld' : 'openlayers';
      const version: SldStyleVersion | undefined =
        matched.version === '1.0.0' || matched.version === '1.1.0'
          ? matched.version
          : format === 'sld'
            ? '1.0.0'
            : undefined;
      return {
        content: matched.content,
        format,
        ...(version ? { version } : {})
      };
    }
  }

  const format: ProjectStyleFormat = style.format === 'sld' ? 'sld' : 'openlayers';
  const version: SldStyleVersion | undefined =
    style.version === '1.0.0' || style.version === '1.1.0'
      ? style.version
      : format === 'sld'
        ? '1.0.0'
        : undefined;

  return {
    content: style.content ?? '',
    format,
    ...(version ? { version } : {})
  };
}

/**
 * @description Updates the style (and optional opacity) of one or more target vector layers in ProjectStore.
 * When applied to multiple layers simultaneously, promotes the style into `project.styles` (`ProjectStyleItem`) and sets `style.href = "#<id>"` and `styleId = "<id>"` on each target layer.
 * Cleans up orphaned shared styles, marks Project Dirty State as true, and broadcasts the updated layer tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {string[]} layerIds - Target layer identifiers.
 * @param {ProjectLayerStyleItem | undefined} style - Style container to assign, or undefined to clear.
 * @param {number} [opacity] - Optional layer opacity (0.0 to 1.0) to apply simultaneously.
 * @returns {Promise<void>}
 */
export async function setLayerStyle(
  layerIds: string[],
  style: ProjectLayerStyleItem | undefined,
  opacity?: number
): Promise<void> {
  if (!Array.isArray(layerIds) || layerIds.length === 0) {
    return;
  }

  const idSet = new Set(layerIds);
  const allLayers = collectLeafLayers(projectStore.getRootGroup());
  const targetLayers = allLayers.filter((l) => idSet.has(l.id));

  if (targetLayers.length === 0) {
    return;
  }

  const project = projectStore.getProject();
  if (project && !Array.isArray(project.styles)) {
    project.styles = [];
  }

  if (style === undefined) {
    for (const layer of targetLayers) {
      layer.style = undefined;
      layer.styleId = undefined;
      if (opacity !== undefined && Number.isFinite(opacity)) {
        layer.opacity = Math.max(0, Math.min(1, opacity));
      }
    }
  } else {
    const resolved = resolveConcreteStyle(style);

    if (targetLayers.length > 1 && project) {
      sharedStyleCounter += 1;
      const sharedId = `shared-style-${Date.now()}-${sharedStyleCounter}`;
      project.styles!.push({
        id: sharedId,
        content: resolved.content,
        format: resolved.format,
        ...(resolved.version ? { version: resolved.version } : {})
      });

      for (const layer of targetLayers) {
        layer.style = {
          href: `#${sharedId}`,
          content: resolved.content,
          format: resolved.format,
          ...(resolved.version ? { version: resolved.version } : {})
        };
        layer.styleId = sharedId;
        if (opacity !== undefined && Number.isFinite(opacity)) {
          layer.opacity = Math.max(0, Math.min(1, opacity));
        }
      }
    } else {
      for (const layer of targetLayers) {
        layer.style = {
          content: resolved.content,
          format: resolved.format,
          ...(resolved.version ? { version: resolved.version } : {})
        };
        layer.styleId = undefined;
        if (opacity !== undefined && Number.isFinite(opacity)) {
          layer.opacity = Math.max(0, Math.min(1, opacity));
        }
      }
    }
  }

  cleanupOrphanedSharedStyles();
  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();
}

/**
 * @description Parses and validates raw style file text from disk into a ProjectLayerStyleItem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {string} rawContent - Raw file text read from disk.
 * @param {string} filePath - Source file path used for extension hinting.
 * @returns {ProjectLayerStyleItem} Validated style container.
 * @throws {Error} When the file content is not valid SLD XML or OpenLayers Flat Style JSON.
 */
export function parseStyleFileContent(
  rawContent: string,
  filePath: string
): ProjectLayerStyleItem {
  const ext = path.extname(filePath).toLowerCase();
  const trimmed = rawContent.trim();

  if (ext === '.sld' || ext === '.se' || trimmed.startsWith('<')) {
    if (
      !trimmed.startsWith('<') ||
      !trimmed.endsWith('>') ||
      (!trimmed.includes('StyledLayerDescriptor') &&
        !trimmed.includes('FeatureTypeStyle') &&
        !trimmed.includes('UserStyle'))
    ) {
      throw new Error(`Invalid or malformed SLD XML style file: "${filePath}"`);
    }

    const is11 =
      /\bversion\s*=\s*["']1\.1\.0["']/i.test(rawContent) ||
      rawContent.includes('http://www.opengis.net/se');
    return {
      format: 'sld',
      version: is11 ? '1.1.0' : '1.0.0',
      content: rawContent
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`Invalid OpenLayers Flat Style JSON syntax in file: "${filePath}"`);
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    (Array.isArray(parsed) && parsed.length === 0) ||
    (!Array.isArray(parsed) &&
      ((parsed as Record<string, unknown>).type === 'FeatureCollection' ||
        (parsed as Record<string, unknown>).type === 'Feature'))
  ) {
    throw new Error(`Invalid OpenLayers Flat Style structure in file: "${filePath}"`);
  }

  return {
    format: 'openlayers',
    content: rawContent
  };
}

/**
 * @description Loads a layer style file (`.sld`, `.se`, or `.json`) from disk, presenting a native open file dialog filtered to `category: 'style'` when `filePath` is omitted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {string} [filePath] - Optional explicit file path to load.
 * @param {OpenStyleDialogInvoker} [dialogInvoker=dialog] - Optional dialog invoker override for testing.
 * @returns {Promise<ProjectLayerStyleItem | null>} Loaded ProjectLayerStyleItem or null if canceled.
 */
export async function loadStyleFile(
  filePath?: string,
  dialogInvoker: OpenStyleDialogInvoker = dialog
): Promise<ProjectLayerStyleItem | null> {
  let targetPath = filePath;

  if (!targetPath) {
    const filters = fileTypeRegistry.getFileFilters('style');
    const defaultPath = resolveDialogDefaultPath('open');
    const result = await dialogInvoker.showOpenDialog({
      title: 'Load Layer Style',
      ...(defaultPath ? { defaultPath } : {}),
      properties: ['openFile'],
      filters
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    targetPath = result.filePaths[0];
    updateDialogLocation('open', targetPath);
  }

  const rawContent = await fs.readFile(targetPath, 'utf-8');
  return parseStyleFileContent(rawContent, targetPath);
}

/**
 * @description Saves a ProjectLayerStyleItem to disk, presenting a native save file dialog filtered to `category: 'style'` when `defaultPath` is omitted, is a relative filename suggestion, or when `dialogInvoker` is explicitly supplied.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @param {ProjectLayerStyleItem} style - Style item to write to disk.
 * @param {string} [defaultPath] - Optional target file path or suggested filename.
 * @param {SaveStyleDialogInvoker} [dialogInvoker] - Optional dialog invoker override for testing.
 * @returns {Promise<string | null>} Saved file path, or null if canceled.
 */
export async function saveStyleFile(
  style: ProjectLayerStyleItem,
  defaultPath?: string,
  dialogInvoker?: SaveStyleDialogInvoker
): Promise<string | null> {
  const resolved = resolveConcreteStyle(style);
  let targetPath = defaultPath;

  const shouldPromptDialog =
    Boolean(dialogInvoker) ||
    !targetPath ||
    !path.isAbsolute(targetPath);

  if (shouldPromptDialog) {
    const invoker = dialogInvoker ?? dialog;
    const defaultExt = resolved.format === 'sld' ? 'sld' : 'json';
    const suggested = targetPath || `style.${defaultExt}`;
    const resolvedDefault = resolveDialogDefaultPath('save', suggested);
    const filters = fileTypeRegistry.getFileFilters('style');

    const result = await invoker.showSaveDialog({
      title: 'Export Layer Style',
      ...(resolvedDefault ? { defaultPath: resolvedDefault } : {}),
      filters
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    targetPath = result.filePath;
    updateDialogLocation('save', targetPath);
  }

  await fs.writeFile(targetPath!, resolved.content, 'utf-8');
  return targetPath!;
}
