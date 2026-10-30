/**
 * @file CartoucheXmlLoader.ts
 * @module main/project/loaders/CartoucheXmlLoader
 * @description Project loader implementation deserializing and serializing unbundled XML project documents conforming to project.xsd.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link IProjectLoader}
 * @see {@link ProjectModel}
 */

import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { IProjectLoader } from "./IProjectLoader";
import {
  isProjectLayerStyleWrapper,
  type ProjectModel,
  type ProjectMetadata,
  type ProjectCrs,
  type ProjectViewport,
  type ProjectLayerItem,
  type ProjectGroupItem,
  type ProjectStyleItem,
  type ProjectLayerStyleItem,
} from "../../../shared/types";

/**
 * @description Escapes special XML characters in string values to prevent XML syntax errors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {string} unsafe - Raw string value to escape.
 * @returns {string} XML-safe escaped string.
 */
function escapeXml(unsafe: string): string {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * @class CartoucheXmlLoader
 * @description Extensible project loader for native unbundled Cartouche XML project documents.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export class CartoucheXmlLoader implements IProjectLoader {
  public readonly id = "cartouche-xml";
  public readonly name = "Cartouche Project (XML)";

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
    if (ext === ".cproj" || ext === ".cartouche") {
      return true;
    }
    if (ext === ".xml") {
      try {
        const header = fs
          .readFileSync(filePath, { encoding: "utf-8", flag: "r" })
          .slice(0, 500);
        return (
          header.includes("schemas/project")
          || header.includes("<cartouche:project")
          || header.includes("<project")
        );
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * @description Checks whether a target file path can be serialized by this XML loader.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {string} target - Destination candidate path.
   * @returns {boolean} True if target extension is .cproj, .cartouche, or .xml.
   */
  public canSave(target: string): boolean {
    const ext = path.extname(target).toLowerCase();
    return ext === ".cproj" || ext === ".cartouche" || ext === ".xml";
  }

  /**
   * @description Reads and parses an XML project document from disk into a ProjectModel object.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {string} filePath - Path to XML document on disk.
   * @returns {Promise<ProjectModel>} Deserialized project model.
   */
  public async load(filePath: string): Promise<ProjectModel> {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      cdataPropName: "__cdata",
      trimValues: true,
      isArray: (name) => ["layer", "group", "style", "property"].includes(name),
    });

    const parsed = parser.parse(content);
    const root = parsed["cartouche:project"] || parsed["project"];

    if (!root) {
      throw new Error(
        `Malformed Cartouche project XML: Missing root <project> or <cartouche:project> in "${filePath}".`
      );
    }

    // Parse Metadata (Dublin Core + application tags)
    const rawMeta = root.metadata || {};
    const metadata: ProjectMetadata = {
      title:
        rawMeta["dc:title"]
        || rawMeta.title
        || path.basename(filePath, path.extname(filePath)),
      creator: rawMeta["dc:creator"] || rawMeta.creator,
      description: rawMeta["dc:description"] || rawMeta.description,
      date: rawMeta["dc:date"] || rawMeta.date,
      createdAt: rawMeta.createdAt,
      updatedAt: rawMeta.updatedAt,
      appVersion: rawMeta.appVersion,
    };

    // Parse CRS (optional)
    let crs: ProjectCrs | undefined;
    if (root.crs) {
      crs = {
        authId: root.crs.authId || "EPSG:4326",
        srid: root.crs.srid ? parseInt(root.crs.srid, 10) : undefined,
        description: root.crs.description,
        proj4: root.crs.proj4,
        wkt: root.crs.wkt,
      };
    }

    // Parse Viewport (optional)
    let viewport: ProjectViewport | undefined;
    if (root.viewport) {
      const rawVp = root.viewport;
      viewport = {
        extent:
          rawVp.extent ?
            {
              xmin: parseFloat(rawVp.extent["@_xmin"]),
              ymin: parseFloat(rawVp.extent["@_ymin"]),
              xmax: parseFloat(rawVp.extent["@_xmax"]),
              ymax: parseFloat(rawVp.extent["@_ymax"]),
            }
          : undefined,
        center:
          rawVp.center ?
            {
              x: parseFloat(rawVp.center["@_x"]),
              y: parseFloat(rawVp.center["@_y"]),
            }
          : undefined,
        scale: rawVp.scale !== undefined ? parseFloat(rawVp.scale) : undefined,
        rotation:
          rawVp.rotation !== undefined ? parseFloat(rawVp.rotation) : undefined,
      };
    }

    // Helper for custom properties
    const parseCustomProps = (
      rawProps: any
    ): Record<string, unknown> | undefined => {
      if (!rawProps || !rawProps.property) return undefined;
      const propList =
        Array.isArray(rawProps.property) ?
          rawProps.property
        : [rawProps.property];
      const result: Record<string, unknown> = {};
      for (const p of propList) {
        const key = p["@_key"];
        if (key) {
          const type = p["@_type"] || "string";
          const val =
            p["#text"] !== undefined ? p["#text"]
            : typeof p === "string" ? p
            : "";
          if (type === "number") {
            result[key] = typeof val === "number" ? val : parseFloat(val);
          } else if (type === "boolean") {
            result[key] = val === true || val === "true";
          } else {
            result[key] = String(val);
          }
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    };

    // Recursive Layer & Group parsers
    const parseLayer = (raw: any): ProjectLayerItem => {
      let style: ProjectLayerStyleItem | undefined;
      if (raw.style) {
        const s = Array.isArray(raw.style) ? raw.style[0] : raw.style;
        // legacy xlink:href support
        const href = s["@_href"] || s["@_xlink:href"];
        const format = (s["@_format"] === "sld" ? "sld" : "openlayers") as
          | "openlayers"
          | "sld";
        const rawVersion = s["@_version"];
        const version =
          rawVersion === "1.0.0" || rawVersion === "1.1.0" ?
            rawVersion
          : undefined;
        const inlineText =
          s.__cdata !== undefined ? String(s.__cdata).trim()
          : typeof s === "string" ? s.trim()
          : s["#text"] !== undefined ? String(s["#text"]).trim()
          : "";

        if (href) {
          let resolvedContent = inlineText || undefined;
          if (!resolvedContent && !String(href).startsWith("#")) {
            try {
              const cleanHref = String(href).replace(/^file:\/\//i, "");
              const extStylePath =
                path.isAbsolute(cleanHref) ? cleanHref : (
                  path.resolve(path.dirname(filePath), cleanHref)
                );
              if (fs.existsSync(extStylePath)) {
                resolvedContent = fs
                  .readFileSync(extStylePath, "utf-8")
                  .trim();
              }
            } catch {
              // Ignore external style file read failures; fallback handled downstream
            }
          }
          style = {
            href,
            format,
            ...(resolvedContent ? { content: resolvedContent } : {}),
            ...(version ? { version } : {}),
          };
        } else if (
          s.__cdata !== undefined
          || typeof s === "string"
          || s["#text"] !== undefined
        ) {
          style = {
            content: inlineText,
            format,
            ...(version ? { version } : {}),
          };
        }
      }

      let layerCrs: ProjectCrs | undefined;
      if (raw.crs) {
        layerCrs = {
          authId: raw.crs.authId || "EPSG:4326",
          srid: raw.crs.srid ? parseInt(raw.crs.srid, 10) : undefined,
          description: raw.crs.description,
          proj4: raw.crs.proj4,
          wkt: raw.crs.wkt,
        };
      }

      let resolvedSource = raw.source || "";
      if (resolvedSource && !path.isAbsolute(resolvedSource)) {
        resolvedSource = path.resolve(path.dirname(filePath), resolvedSource);
      }

      return {
        id: String(
          raw["@_id"]
            || `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        ),
        name: raw.name || "Unnamed Layer",
        type: raw.type || "vector",
        source: resolvedSource,
        visible: raw["@_visible"] !== "false" && raw["@_visible"] !== false,
        opacity:
          raw["@_opacity"] !== undefined ? parseFloat(raw["@_opacity"]) : 1.0,
        selectable:
          raw["@_selectable"] !== "false" && raw["@_selectable"] !== false,
        readOnly: raw["@_readOnly"] === "true" || raw["@_readOnly"] === true,
        layerKind: raw["@_layerKind"] || undefined,
        geometryKind: raw["@_geometryKind"] || undefined,
        style,
        crs: layerCrs,
        customProperties: parseCustomProps(raw.customProperties),
      };
    };

    const orderedParser = new XMLParser({ preserveOrder: true });
    const orderedParsed = orderedParser.parse(content);
    const orderedRootObj =
      Array.isArray(orderedParsed) ?
        orderedParsed.find(
          (el: any) => el && ("cartouche:project" in el || "project" in el)
        )
      : undefined;
    const orderedRootChildren: any[] =
      orderedRootObj?.["cartouche:project"]
      || orderedRootObj?.["project"]
      || [];
    const orderedLayersObj =
      Array.isArray(orderedRootChildren) ?
        orderedRootChildren.find((el: any) => el && "layers" in el)
      : undefined;
    const orderedRootLayerNodes: any[] | undefined =
      Array.isArray(orderedLayersObj?.layers) ?
        orderedLayersObj.layers
      : undefined;

    const parseContainerChildren = (
      rawContainer: any,
      orderedChildNodes?: any[]
    ): Array<ProjectLayerItem | ProjectGroupItem> => {
      const children: Array<ProjectLayerItem | ProjectGroupItem> = [];
      if (!rawContainer) return children;
      const layerList =
        rawContainer.layer ?
          Array.isArray(rawContainer.layer) ?
            rawContainer.layer
          : [rawContainer.layer]
        : [];
      const groupList =
        rawContainer.group ?
          Array.isArray(rawContainer.group) ?
            rawContainer.group
          : [rawContainer.group]
        : [];

      if (Array.isArray(orderedChildNodes)) {
        let layerIdx = 0;
        let groupIdx = 0;
        for (const childNode of orderedChildNodes) {
          if (!childNode || typeof childNode !== "object") continue;
          if ("layer" in childNode && layerIdx < layerList.length) {
            children.push(parseLayer(layerList[layerIdx++]));
          } else if ("group" in childNode && groupIdx < groupList.length) {
            const orderedSubNodes =
              Array.isArray(childNode.group) ? childNode.group : undefined;
            children.push(parseGroup(groupList[groupIdx++], orderedSubNodes));
          }
        }
        while (layerIdx < layerList.length) {
          children.push(parseLayer(layerList[layerIdx++]));
        }
        while (groupIdx < groupList.length) {
          children.push(parseGroup(groupList[groupIdx++]));
        }
      } else {
        for (const l of layerList) {
          children.push(parseLayer(l));
        }
        for (const g of groupList) {
          children.push(parseGroup(g));
        }
      }
      return children;
    };

    const parseGroup = (
      raw: any,
      orderedChildNodes?: any[]
    ): ProjectGroupItem => {
      const children = parseContainerChildren(raw, orderedChildNodes);
      return {
        id: raw["@_id"],
        name: raw.name || raw["@_name"] || "Unnamed Group",
        visible: raw["@_visible"] !== "false" && raw["@_visible"] !== false,
        expanded: raw["@_expanded"] !== "false" && raw["@_expanded"] !== false,
        children,
      };
    };

    const layers: Array<ProjectLayerItem | ProjectGroupItem> =
      parseContainerChildren(root.layers, orderedRootLayerNodes);

    // Parse Shared Styles (optional)
    const styles: ProjectStyleItem[] = [];
    const catalogStyles = new Map<
      string,
      {
        id: string;
        href?: string;
        format?: "openlayers" | "sld";
        content?: string;
      }
    >();

    if (root.styles && root.styles.style) {
      const styleList =
        Array.isArray(root.styles.style) ?
          root.styles.style
        : [root.styles.style];
      for (const s of styleList) {
        const styleId = String(s["@_id"] || "");
        const href = s["@_href"] || s["@_xlink:href"];
        if (href) {
          throw new Error(
            `Invalid shared style "${styleId}": shared styles in <styles> cannot reference another style via href.`
          );
        }
        const format = (s["@_format"] === "sld" ? "sld" : "openlayers") as
          | "openlayers"
          | "sld";
        const rawVersion = s["@_version"];
        const version =
          rawVersion === "1.0.0" || rawVersion === "1.1.0" ?
            rawVersion
          : undefined;
        const content = (
          s.__cdata !== undefined ? s.__cdata
          : typeof s === "string" ? s
          : s["#text"] || "").trim();

        if (styleId) {
          catalogStyles.set(styleId, { id: styleId, format, content });
        }

        styles.push({
          id: styleId,
          format,
          content,
          ...(version ? { version } : {}),
        });
      }
    }

    // Validate that no layer style references a target style that itself redirects via href
    const validateNonRedirection = (
      items: Array<ProjectLayerItem | ProjectGroupItem>
    ) => {
      for (const item of items) {
        if (
          "children" in item
          && Array.isArray((item as ProjectGroupItem).children)
        ) {
          validateNonRedirection((item as ProjectGroupItem).children);
        } else {
          const l = item as ProjectLayerItem;
          if (l.style && isProjectLayerStyleWrapper(l.style) && l.style.href) {
            const rawHref = l.style.href;
            const targetId =
              rawHref.startsWith("#") ? rawHref.slice(1) : rawHref;
            const target = catalogStyles.get(targetId);
            if (target && target.href) {
              throw new Error(
                `Invalid style reference "${rawHref}": target style "${targetId}" is itself an href redirection.`
              );
            }
          }
        }
      }
    };
    validateNonRedirection(layers);

    const customProperties = parseCustomProps(root.customProperties);

    return {
      format: this.id,
      filePath,
      metadata,
      crs,
      viewport,
      layers,
      styles,
      customProperties,
    };
  }

  /**
   * @description Serializes an in-memory ProjectModel to an XML project document on disk conforming to project.xsd.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {ProjectModel} project - In-memory project model to serialize.
   * @param {string} target - Destination file path.
   * @returns {Promise<void>}
   */
  public async save(project: ProjectModel, target: string): Promise<void> {
    const xmlContent = this.serializeToXml(project);
    const resolvedPath = path.resolve(target);
    await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.promises.writeFile(resolvedPath, xmlContent, "utf-8");
    project.filePath = resolvedPath;
  }

  /**
   * @description Generates valid XML text from a ProjectModel strictly conforming to project.xsd schema.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {ProjectModel} project - In-memory project model.
   * @returns {string} XML project document string.
   */
  public serializeToXml(project: ProjectModel): string {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(
      '<cartouche:project xmlns="http://maps.hanfastolfe.com/cartouche/schemas/project/1.0"'
    );
    lines.push(
      '  xmlns:cartouche="http://maps.hanfastolfe.com/cartouche/schemas/project/1.0"'
    );
    lines.push('  xmlns:dc="http://purl.org/dc/elements/1.1/">');

    // 1. Metadata
    lines.push("  <metadata>");
    lines.push(`    <dc:title>${escapeXml(project.metadata.title)}</dc:title>`);
    if (project.metadata.creator) {
      lines.push(
        `    <dc:creator>${escapeXml(project.metadata.creator)}</dc:creator>`
      );
    }
    if (project.metadata.description) {
      lines.push(
        `    <dc:description>${escapeXml(project.metadata.description)}</dc:description>`
      );
    }
    if (project.metadata.date) {
      lines.push(`    <dc:date>${escapeXml(project.metadata.date)}</dc:date>`);
    }
    if (project.metadata.createdAt) {
      lines.push(
        `    <createdAt>${escapeXml(project.metadata.createdAt)}</createdAt>`
      );
    }
    const updatedAt = project.metadata.updatedAt || new Date().toISOString();
    lines.push(`    <updatedAt>${escapeXml(updatedAt)}</updatedAt>`);
    const appVersion = project.metadata.appVersion || "0.1.0-dev";
    lines.push(`    <appVersion>${escapeXml(appVersion)}</appVersion>`);
    lines.push("  </metadata>");

    // 2. CRS (optional)
    if (project.crs) {
      lines.push("  <crs>");
      lines.push(
        `    <authId>${escapeXml(project.crs.authId || "EPSG:4326")}</authId>`
      );
      if (project.crs.srid !== undefined) {
        lines.push(`    <srid>${project.crs.srid}</srid>`);
      }
      if (project.crs.description) {
        lines.push(
          `    <description>${escapeXml(project.crs.description)}</description>`
        );
      }
      if (project.crs.proj4) {
        lines.push(`    <proj4>${escapeXml(project.crs.proj4)}</proj4>`);
      }
      if (project.crs.wkt) {
        lines.push(`    <wkt>${escapeXml(project.crs.wkt)}</wkt>`);
      }
      lines.push("  </crs>");
    }

    // 3. Viewport (optional)
    if (project.viewport) {
      const vp = project.viewport;
      lines.push("  <viewport>");
      if (vp.extent) {
        lines.push(
          `    <extent xmin="${vp.extent.xmin}" ymin="${vp.extent.ymin}" xmax="${vp.extent.xmax}" ymax="${vp.extent.ymax}" />`
        );
      }
      if (vp.center) {
        lines.push(`    <center x="${vp.center.x}" y="${vp.center.y}" />`);
      }
      if (vp.scale !== undefined) {
        lines.push(`    <scale>${vp.scale}</scale>`);
      }
      if (vp.rotation !== undefined) {
        lines.push(`    <rotation>${vp.rotation}</rotation>`);
      }
      lines.push("  </viewport>");
    }

    // Helper to serialize item
    const isGroupItem = (
      item: ProjectLayerItem | ProjectGroupItem
    ): item is ProjectGroupItem => {
      return (
        "children" in item && Array.isArray((item as ProjectGroupItem).children)
      );
    };

    const serializeLayerItem = (
      layer: ProjectLayerItem,
      indent: number
    ): string[] => {
      const pad = " ".repeat(indent);
      const res: string[] = [];
      const attrs: string[] = [`id="${escapeXml(layer.id)}"`];
      if (layer.visible !== undefined) {
        attrs.push(`visible="${layer.visible !== false}"`);
      }
      if (layer.readOnly !== undefined) {
        attrs.push(`readOnly="${layer.readOnly === true}"`);
      }
      if (layer.layerKind) {
        attrs.push(`layerKind="${escapeXml(layer.layerKind)}"`);
      }
      if (layer.geometryKind) {
        attrs.push(`geometryKind="${escapeXml(layer.geometryKind)}"`);
      }
      if (layer.opacity !== undefined) {
        attrs.push(`opacity="${layer.opacity}"`);
      }
      if (layer.selectable !== undefined) {
        attrs.push(`selectable="${layer.selectable !== false}"`);
      }

      res.push(`${pad}<layer ${attrs.join(" ")}>`);
      res.push(`${pad}  <name>${escapeXml(layer.name)}</name>`);
      res.push(`${pad}  <type>${escapeXml(layer.type || "vector")}</type>`);
      res.push(`${pad}  <source>${escapeXml(layer.source || "")}</source>`);

      if (layer.style) {
        if (typeof layer.style === "string") {
          if (layer.style.startsWith("#")) {
            res.push(`${pad}  <style href="${escapeXml(layer.style)}" />`);
          } else {
            res.push(
              `${pad}  <style format="openlayers"><![CDATA[${layer.style}]]></style>`
            );
          }
        } else if (isProjectLayerStyleWrapper(layer.style)) {
          const versionAttr =
            layer.style.version ?
              ` version="${escapeXml(layer.style.version)}"`
            : "";
          if (layer.style.href) {
            const formatAttr =
              layer.style.format ? ` format="${layer.style.format}"` : "";
            res.push(
              `${pad}  <style href="${escapeXml(layer.style.href)}"${formatAttr}${versionAttr} />`
            );
          } else if (layer.style.content) {
            const formatAttr =
              layer.style.format ?
                ` format="${layer.style.format}"`
              : ' format="openlayers"';
            res.push(
              `${pad}  <style${formatAttr}${versionAttr}><![CDATA[${layer.style.content}]]></style>`
            );
          }
        } else if (typeof layer.style === "object" && layer.style !== null) {
          res.push(
            `${pad}  <style format="openlayers"><![CDATA[${JSON.stringify(layer.style, null, 2)}]]></style>`
          );
        }
      }

      if (layer.crs) {
        res.push(`${pad}  <crs>`);
        res.push(
          `${pad}    <authId>${escapeXml(layer.crs.authId || "EPSG:4326")}</authId>`
        );
        if (layer.crs.srid !== undefined) {
          res.push(`${pad}    <srid>${layer.crs.srid}</srid>`);
        }
        if (layer.crs.description) {
          res.push(
            `${pad}    <description>${escapeXml(layer.crs.description)}</description>`
          );
        }
        if (layer.crs.proj4) {
          res.push(`${pad}    <proj4>${escapeXml(layer.crs.proj4)}</proj4>`);
        }
        if (layer.crs.wkt) {
          res.push(`${pad}    <wkt>${escapeXml(layer.crs.wkt)}</wkt>`);
        }
        res.push(`${pad}  </crs>`);
      }

      if (
        layer.customProperties
        && Object.keys(layer.customProperties).length > 0
      ) {
        res.push(`${pad}  <customProperties>`);
        for (const [key, val] of Object.entries(layer.customProperties)) {
          const type =
            typeof val === "number" ? "number"
            : typeof val === "boolean" ? "boolean"
            : "string";
          res.push(
            `${pad}    <property key="${escapeXml(key)}" type="${type}">${escapeXml(String(val))}</property>`
          );
        }
        res.push(`${pad}  </customProperties>`);
      }

      res.push(`${pad}</layer>`);
      return res;
    };

    const serializeGroupItem = (
      group: ProjectGroupItem,
      indent: number
    ): string[] => {
      const pad = " ".repeat(indent);
      const res: string[] = [];
      const attrs: string[] = [];
      if (group.id) {
        attrs.push(`id="${escapeXml(group.id)}"`);
      }
      attrs.push(`name="${escapeXml(group.name)}"`);
      if (group.visible !== undefined) {
        attrs.push(`visible="${group.visible !== false}"`);
      }
      if (group.expanded !== undefined) {
        attrs.push(`expanded="${group.expanded !== false}"`);
      }

      res.push(`${pad}<group ${attrs.join(" ")}>`);
      res.push(`${pad}  <name>${escapeXml(group.name)}</name>`);
      for (const child of group.children) {
        if (isGroupItem(child)) {
          res.push(...serializeGroupItem(child, indent + 2));
        } else {
          res.push(...serializeLayerItem(child, indent + 2));
        }
      }
      res.push(`${pad}</group>`);
      return res;
    };

    // 4. Layers
    if (project.layers) {
      lines.push("  <layers>");
      for (const item of project.layers) {
        if (isGroupItem(item)) {
          lines.push(...serializeGroupItem(item, 4));
        } else {
          lines.push(...serializeLayerItem(item, 4));
        }
      }
      lines.push("  </layers>");
    }

    // 5. Styles
    if (project.styles && project.styles.length > 0) {
      lines.push("  <styles>");
      for (const style of project.styles) {
        const formatAttr =
          style.format ? ` format="${style.format}"` : ' format="openlayers"';
        const versionAttr =
          style.version ? ` version="${escapeXml(style.version)}"` : "";
        lines.push(
          `    <style id="${escapeXml(style.id)}"${formatAttr}${versionAttr}><![CDATA[${style.content}]]></style>`
        );
      }
      lines.push("  </styles>");
    } else {
      lines.push("  <styles />");
    }

    // 6. Custom Properties (optional)
    if (
      project.customProperties
      && Object.keys(project.customProperties).length > 0
    ) {
      lines.push("  <customProperties>");
      for (const [key, val] of Object.entries(project.customProperties)) {
        const type =
          typeof val === "number" ? "number"
          : typeof val === "boolean" ? "boolean"
          : "string";
        lines.push(
          `    <property key="${escapeXml(key)}" type="${type}">${escapeXml(String(val))}</property>`
        );
      }
      lines.push("  </customProperties>");
    }

    lines.push("</cartouche:project>");
    lines.push("");
    return lines.join("\n");
  }
}
