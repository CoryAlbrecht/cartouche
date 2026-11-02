/**
 * @file StylePreviewCanvas.tsx
 * @module renderer/workbench/dialogs/StylePreviewCanvas
 * @description Real-time 120×120px HTML5 Canvas 2D preview renderer displaying sample geometries styled with Cartouche Symbology, OpenLayers Flat Style, or OGC SLD rules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @see {@link StylePreviewCanvas}
 * @see {@link renderStylePreviewToCanvas}
 */

import React, { useEffect, useRef } from "react";
import type { ProjectStyleFormat, SldStyleVersion } from "@shared/types";

/**
 * @typedef {Object} StylePreviewOptions
 * @property {number} [width=120] - Canvas viewport width in pixels.
 * @property {number} [height=120] - Canvas viewport height in pixels.
 * @property {string} content - Raw style serialization string (Cartouche JSON, Flat Style JSON, or SLD XML).
 * @property {ProjectStyleFormat} format - Style format ('cartouche' | 'openlayers' | 'sld').
 * @property {SldStyleVersion} [version='1.0.0'] - SLD version if format is 'sld'.
 * @property {number} [opacity=1.0] - Layer opacity between 0.0 and 1.0.
 * @property {string} [geometryKind='Unknown'] - Layer geometry kind (Polygon, LineString, Point).
 */
export interface StylePreviewOptions {
  width?: number;
  height?: number;
  content: string;
  format: ProjectStyleFormat;
  version?: SldStyleVersion;
  opacity?: number;
  geometryKind?: string;
}

/**
 * Renders sample geometry styled according to the provided style specification onto a 2D canvas context.
 *
 * @function renderStylePreviewToCanvas
 * @description Draws a representative polygon, line, or point marker on the provided CanvasRenderingContext2D.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {CanvasRenderingContext2D} ctx - HTML5 Canvas 2D rendering context.
 * @param {StylePreviewOptions} options - Style preview parameters and active style definition.
 * @returns {void}
 */
export function renderStylePreviewToCanvas(
  ctx: CanvasRenderingContext2D,
  options: StylePreviewOptions
): void {
  const width = options.width ?? 120;
  const height = options.height ?? 120;
  const opacity = options.opacity ?? 1.0;
  const geometryKind = options.geometryKind || "Unknown";
  const content = (options.content || "").trim();

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Background fill
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const isLine = geometryKind.includes("Line");
  const isPoint = geometryKind.includes("Point");

  // Geometry trace helpers
  const tracePolygon = () => {
    const poly: [number, number][] = [
      [22, 28],
      [98, 22],
      [104, 76],
      [60, 104],
      [16, 78],
    ];
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
  };

  const traceLine = () => {
    const line: [number, number][] = [
      [16, 96],
      [38, 36],
      [76, 84],
      [104, 24],
    ];
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(line[i][0], line[i][1]);
    }
  };

  const tracePoint = (radius: number) => {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  };

  if (!content) {
    return;
  }

  // 1. Cartouche Symbology
  if (options.format === "cartouche") {
    try {
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.components)) {
        for (const comp of parsed.components) {
          if (comp.enabled === false) continue;
          ctx.save();
          ctx.globalAlpha = opacity;

          if (comp.type === "simple-fill") {
            tracePolygon();
            ctx.fillStyle = comp.color || "#3388ff";
            ctx.fill();
          } else if (comp.type === "simple-line") {
            if (isLine) {
              traceLine();
            } else {
              tracePolygon();
            }
            ctx.strokeStyle = comp.color || "#000000";
            ctx.lineWidth = comp.width ?? 1;
            if (Array.isArray(comp.dashArray) && comp.dashArray.length > 0) {
              ctx.setLineDash(comp.dashArray);
            } else {
              ctx.setLineDash([]);
            }
            ctx.stroke();
          } else if (comp.type === "simple-marker") {
            const r = comp.radius ?? 6;
            tracePoint(r);
            if (comp.fillColor) {
              ctx.fillStyle = comp.fillColor;
              ctx.fill();
            }
            if (comp.strokeColor && (comp.strokeWidth ?? 1) > 0) {
              ctx.strokeStyle = comp.strokeColor;
              ctx.lineWidth = comp.strokeWidth ?? 1;
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
    } catch {
      // Ignore JSON parsing errors during user input
    }
    return;
  }

  // 2. OpenLayers Flat Style
  if (options.format === "openlayers") {
    try {
      const parsed = JSON.parse(content);
      const rules = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of rules) {
        if (!item || typeof item !== "object") continue;
        const rule = (item.style && typeof item.style === "object" ? item.style : item) as Record<string, any>;
        ctx.save();
        ctx.globalAlpha = opacity;

        if (rule["fill-color"]) {
          tracePolygon();
          ctx.fillStyle = String(rule["fill-color"]);
          ctx.fill();
        }

        if (rule["stroke-color"]) {
          if (isLine) {
            traceLine();
          } else {
            tracePolygon();
          }
          ctx.strokeStyle = String(rule["stroke-color"]);
          ctx.lineWidth = Number(rule["stroke-width"] ?? 1);
          if (Array.isArray(rule["stroke-line-dash"])) {
            ctx.setLineDash(rule["stroke-line-dash"]);
          }
          ctx.stroke();
        }

        if (rule["circle-radius"] || rule["circle-fill-color"]) {
          const r = Number(rule["circle-radius"] ?? 6);
          tracePoint(r);
          if (rule["circle-fill-color"]) {
            ctx.fillStyle = String(rule["circle-fill-color"]);
            ctx.fill();
          }
          if (rule["circle-stroke-color"]) {
            ctx.strokeStyle = String(rule["circle-stroke-color"]);
            ctx.lineWidth = Number(rule["circle-stroke-width"] ?? 1);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    } catch {
      // Ignore JSON parsing errors during user input
    }
    return;
  }

  // 3. OGC SLD XML
  if (options.format === "sld") {
    try {
      const fillMatch = content.match(
        /<(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)\s+name=['"]fill['"][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)>/i
      );
      const strokeMatch = content.match(
        /<(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)\s+name=['"]stroke['"][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)>/i
      );
      const strokeWidthMatch = content.match(
        /<(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)\s+name=['"]stroke-width['"][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)>/i
      );
      const strokeDashMatch = content.match(
        /<(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)\s+name=['"]stroke-dasharray['"][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:CssParameter|SvgParameter)>/i
      );
      const sizeMatch = content.match(
        /<(?:[a-zA-Z0-9_-]+:)?Size[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?Size>/i
      );

      const fillColor = fillMatch ? fillMatch[1].replace(/<[^>]+>/g, "").trim() : null;
      const strokeColor = strokeMatch ? strokeMatch[1].replace(/<[^>]+>/g, "").trim() : null;
      const strokeWidth = strokeWidthMatch
        ? parseFloat(strokeWidthMatch[1].replace(/<[^>]+>/g, "").trim()) || 1
        : 1;
      const sizeVal = sizeMatch
        ? parseFloat(sizeMatch[1].replace(/<[^>]+>/g, "").trim())
        : null;

      ctx.save();
      ctx.globalAlpha = opacity;

      if (isPoint) {
        const r = (sizeVal !== null && !isNaN(sizeVal) ? sizeVal : 12) / 2;
        tracePoint(r);
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        if (strokeColor && strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
      } else {
        if (fillColor && !isLine) {
          tracePolygon();
          ctx.fillStyle = fillColor;
          ctx.fill();
        }

        if (strokeColor) {
          if (isLine) {
            traceLine();
          } else {
            tracePolygon();
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          if (strokeDashMatch) {
            const rawDash = strokeDashMatch[1].replace(/<[^>]+>/g, "").trim();
            const dashes = rawDash
              .split(/[\s,]+/)
              .map(Number)
              .filter((n) => !isNaN(n));
            if (dashes.length > 0) {
              ctx.setLineDash(dashes);
            }
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    } catch {
      // Ignore SLD extraction errors during user input
    }
  }
}

/**
 * @typedef {Object} StylePreviewCanvasProps
 * @property {string} content - Raw style serialization content.
 * @property {ProjectStyleFormat} format - Active draft style format.
 * @property {SldStyleVersion} [version='1.0.0'] - Active draft SLD specification version.
 * @property {number} [opacity=1.0] - Active draft layer opacity.
 * @property {string} [geometryKind='Unknown'] - Active layer geometry kind.
 */
export interface StylePreviewCanvasProps {
  content: string;
  format: ProjectStyleFormat;
  version?: SldStyleVersion;
  opacity?: number;
  geometryKind?: string;
}

/**
 * HTML5 Canvas 2D Example Preview Box rendering sample layer geometry in real-time.
 *
 * @component StylePreviewCanvas
 * @description Displays a 120×120px real-time preview of the active draft style on sample geometry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {StylePreviewCanvasProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const StylePreviewCanvas: React.FC<StylePreviewCanvasProps> = ({
  content,
  format,
  version = "1.0.0",
  opacity = 1.0,
  geometryKind = "Unknown",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderStylePreviewToCanvas(ctx, {
      width: 120,
      height: 120,
      content,
      format,
      version,
      opacity,
      geometryKind,
    });
  }, [content, format, version, opacity, geometryKind]);

  return (
    <canvas
      ref={canvasRef}
      id='layer-prop-styling-preview-canvas'
      className='layer-prop-styling-preview-canvas'
      width={120}
      height={120}
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "0.25rem",
        border: "1px solid #cbd5e1",
        backgroundColor: "#ffffff",
        display: "block",
      }}
    />
  );
};

export default StylePreviewCanvas;
