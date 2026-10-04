/**
 * @file CartoucheXmlLoader.ts
 * @module main/project/loaders/CartoucheXmlLoader
 * @description Project loader implementation deserializing unbundled XML project documents conforming to project.xsd.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @see {@link IProjectLoader}
 * @see {@link ProjectModel}
 */

import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type { IProjectLoader } from './IProjectLoader';
import type {
  ProjectModel,
  ProjectMetadata,
  ProjectCrs,
  ProjectViewport,
  ProjectLayerItem,
  ProjectGroupItem,
  ProjectStyleItem
} from '@shared/types';

/**
 * @class CartoucheXmlLoader
 * @description Extensible project loader for native unbundled Cartouche XML project documents.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 */
export class CartoucheXmlLoader implements IProjectLoader {
  public readonly id = 'cartouche-xml';
  public readonly name = 'Cartouche Project (XML)';

  /**
   * @description Checks whether a given file path can be deserialized by this XML loader.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} filePath - Absolute path to candidate project file.
   * @returns {boolean} True if the file has a supported extension or XML root element.
   */
  public canLoad(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.cproj' || ext === '.cartouche') {
      return true;
    }
    if (ext === '.xml') {
      try {
        const header = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).slice(0, 500);
        return (
          header.includes('schemas/project') ||
          header.includes('<cartouche:project') ||
          header.includes('<project')
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * @description Reads and parses an XML project document from disk into a ProjectModel object.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} filePath - Path to XML document on disk.
   * @returns {Promise<ProjectModel>} Deserialized project model.
   */
  public async load(filePath: string): Promise<ProjectModel> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      cdataPropName: '__cdata',
      trimValues: true,
      isArray: (name) => ['layer', 'group', 'style'].includes(name)
    });

    const parsed = parser.parse(content);
    const root = parsed['cartouche:project'] || parsed['project'];

    if (!root) {
      throw new Error(`Malformed Cartouche project XML: Missing root <project> or <cartouche:project> in "${filePath}".`);
    }

    // Parse Metadata (Dublin Core + application tags)
    const rawMeta = root.metadata || {};
    const metadata: ProjectMetadata = {
      title: rawMeta['dc:title'] || rawMeta.title || path.basename(filePath, path.extname(filePath)),
      creator: rawMeta['dc:creator'] || rawMeta.creator,
      description: rawMeta['dc:description'] || rawMeta.description,
      date: rawMeta['dc:date'] || rawMeta.date,
      createdAt: rawMeta.createdAt,
      updatedAt: rawMeta.updatedAt,
      appVersion: rawMeta.appVersion
    };

    // Parse CRS (optional)
    let crs: ProjectCrs | undefined;
    if (root.crs) {
      crs = {
        authId: root.crs.authId || 'EPSG:4326',
        srid: root.crs.srid ? parseInt(root.crs.srid, 10) : undefined,
        description: root.crs.description,
        proj4: root.crs.proj4,
        wkt: root.crs.wkt
      };
    }

    // Parse Viewport (optional)
    let viewport: ProjectViewport | undefined;
    if (root.viewport) {
      const rawVp = root.viewport;
      viewport = {
        extent: rawVp.extent
          ? {
              xmin: parseFloat(rawVp.extent['@_xmin']),
              ymin: parseFloat(rawVp.extent['@_ymin']),
              xmax: parseFloat(rawVp.extent['@_xmax']),
              ymax: parseFloat(rawVp.extent['@_ymax'])
            }
          : undefined,
        center: rawVp.center
          ? {
              x: parseFloat(rawVp.center['@_x']),
              y: parseFloat(rawVp.center['@_y'])
            }
          : undefined,
        zoom: rawVp.zoom !== undefined ? parseFloat(rawVp.zoom) : undefined,
        scale: rawVp.scale !== undefined ? parseFloat(rawVp.scale) : undefined,
        rotation: rawVp.rotation !== undefined ? parseFloat(rawVp.rotation) : undefined
      };
    }

    // Recursive Layer & Group parsers
    const parseLayer = (raw: any): ProjectLayerItem => {
      let style: string | { href?: string; content?: string } | undefined;
      if (raw.style) {
        const s = Array.isArray(raw.style) ? raw.style[0] : raw.style;
        if (s['@_xlink:href']) {
          style = { href: s['@_xlink:href'] };
        } else if (s.__cdata) {
          style = { content: s.__cdata.trim() };
        } else if (typeof s === 'string') {
          style = { content: s.trim() };
        }
      }

      return {
        id: String(raw['@_id'] || `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
        name: raw.name || 'Unnamed Layer',
        type: raw.type || 'vector',
        source: raw.source || '',
        visible: raw['@_visible'] !== 'false' && raw['@_visible'] !== false,
        opacity: raw['@_opacity'] !== undefined ? parseFloat(raw['@_opacity']) : 1.0,
        selectable: raw['@_selectable'] !== 'false' && raw['@_selectable'] !== false,
        style
      };
    };

    const parseGroup = (raw: any): ProjectGroupItem => {
      const children: Array<ProjectLayerItem | ProjectGroupItem> = [];
      if (raw.layer && Array.isArray(raw.layer)) {
        for (const l of raw.layer) {
          children.push(parseLayer(l));
        }
      }
      if (raw.group && Array.isArray(raw.group)) {
        for (const g of raw.group) {
          children.push(parseGroup(g));
        }
      }
      return {
        id: raw['@_id'],
        name: raw.name || raw['@_name'] || 'Unnamed Group',
        visible: raw['@_visible'] !== 'false' && raw['@_visible'] !== false,
        expanded: raw['@_expanded'] !== 'false' && raw['@_expanded'] !== false,
        children
      };
    };

    const layers: Array<ProjectLayerItem | ProjectGroupItem> = [];
    if (root.layers) {
      if (root.layers.layer && Array.isArray(root.layers.layer)) {
        for (const l of root.layers.layer) {
          layers.push(parseLayer(l));
        }
      }
      if (root.layers.group && Array.isArray(root.layers.group)) {
        for (const g of root.layers.group) {
          layers.push(parseGroup(g));
        }
      }
    }

    // Parse Shared Styles (optional)
    const styles: ProjectStyleItem[] = [];
    if (root.styles && root.styles.style && Array.isArray(root.styles.style)) {
      for (const s of root.styles.style) {
        styles.push({
          id: String(s['@_id'] || ''),
          content: (s.__cdata || (typeof s === 'string' ? s : '')).trim()
        });
      }
    }

    return {
      format: this.id,
      filePath,
      metadata,
      crs,
      viewport,
      layers,
      styles
    };
  }
}
