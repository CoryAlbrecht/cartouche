/**
 * @file Icon.tsx
 * @module renderer/components/common/Icon
 * @description Standardized Material Design Icons (MDI) and custom SVG file icon renderer component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */

import React, { useState, useEffect } from "react";
import { logging } from "../../../shared/logging";

/**
 * @typedef {Object} IconProps
 * @property {string} [path] - MDI path data string (e.g. from `@mdi/js`) or `file:` icon identifier.
 * @property {string} [name] - Filename or identifier. If starts with 'file:', loads from assets/svg/icons/.
 * @property {string | number} [size='24px'] - Width and height dimension string or multiplier.
 * @property {string} [color='currentColor'] - Fill color hex or CSS color string.
 * @property {string} [className] - Optional CSS class name.
 * @property {string} [title] - Accessibility title tag string for tooltips and screen readers.
 * @property {React.CSSProperties} [style] - Inline CSS style overrides.
 */
export interface IconProps {
  path?: string;
  name?: string;
  size?: string | number;
  color?: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * @typedef {Object} ParsedSvgIcon
 * @property {string} viewBox - SVG viewBox coordinate space attribute.
 * @property {string[]} paths - Extracted SVG `<path d="..." />` geometry strings.
 */
interface ParsedSvgIcon {
  viewBox: string;
  paths: string[];
}

/**
 * @description Pre-parsed custom SVG icon definitions from `assets/svg/icons/` for immediate synchronous rendering without async layout shifts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @type {Record<string, ParsedSvgIcon>}
 */
const BUILTIN_CUSTOM_SVG_ICONS: Record<string, ParsedSvgIcon> = {
  "layers-plus-outline": {
    viewBox: "0 0 24 24",
    paths: [
      "m19.1845 14.4434v2.7h2.7v1.78448h-2.7v2.7h-1.78448v-2.7h-2.7v-1.78448h2.7v-2.7zm-14.5645-1.6334-1.62 1.26 9 7 1.30266-1.01318c-.592306-.503527-.74919-1.25497-.418178-2.23061l-.884483.713793zm7.38-10.81-9 7 9 7 9-7zm0 2.5293 5.74023 4.4707-5.74023 4.4707-5.74023-4.4707z",
    ],
  },
};

/**
 * @description In-memory cache of parsed SVG icons keyed by icon basename.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @type {Map<string, ParsedSvgIcon>}
 */
const parsedSvgCache = new Map<string, ParsedSvgIcon>(
  Object.entries(BUILTIN_CUSTOM_SVG_ICONS)
);

/**
 * @description Extracts the `viewBox` attribute and `<path d="...">` strings from raw SVG markup.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} svgMarkup - Raw XML/SVG file content string.
 * @returns {ParsedSvgIcon} Parsed viewBox and path data array.
 */
function parseSvgMarkup(svgMarkup: string): ParsedSvgIcon {
  const viewBoxMatch = svgMarkup.match(/<svg[^>]*\bviewBox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch?.[1] || "0 0 24 24";
  const paths: string[] = [];
  const pathRegex = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null = pathRegex.exec(svgMarkup);
  while (match !== null) {
    paths.push(match[1]);
    match = pathRegex.exec(svgMarkup);
  }
  return { viewBox, paths };
}

/**
 * @description Synchronously resolves a custom SVG icon from cache or local filesystem (when running in Node test environments).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} basename - Icon filename without `.svg` extension.
 * @returns {ParsedSvgIcon | null} Parsed SVG icon data or null if not yet cached.
 */
function resolveCustomSvgIconSync(basename: string): ParsedSvgIcon | null {
  const cached = parsedSvgCache.get(basename);
  if (cached) {
    return cached;
  }

  const nodeProcess = (
    globalThis as {
      process?: { cwd?: () => string; getBuiltinModule?: (id: string) => any };
    }
  ).process;
  const fsModule = nodeProcess?.getBuiltinModule?.("node:fs");
  const pathModule = nodeProcess?.getBuiltinModule?.("node:path");
  if (fsModule && pathModule && typeof nodeProcess?.cwd === "function") {
    try {
      const svgPath = pathModule.resolve(
        nodeProcess.cwd(),
        "assets/svg/icons",
        `${basename}.svg`
      );
      const rawSvg = fsModule.readFileSync(svgPath, "utf8");
      const parsed = parseSvgMarkup(rawSvg);
      parsedSvgCache.set(basename, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * @component Icon
 * @description Renders a Material Design Icon or custom `file:` SVG asset as an inline Scalable Vector Graphics (`<svg>`) element supporting `currentColor` and explicit `color` fills.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {IconProps} props - Component properties.
 * @returns {React.ReactElement} Scalable Vector Graphics (SVG) element.
 */
export const Icon: React.FC<IconProps> = ({
  path,
  name,
  size = "24px",
  color = "currentColor",
  className,
  title,
  style,
}) => {
  const dimension =
    typeof size === "number" ?
      size <= 4 ?
        `${size * 24}px`
      : `${size}px`
    : size;

  // Determine if we should use name or path. The Action Registry might send 'file:...' into the 'path' prop.
  const targetStr = name || path || "";
  const isFileIcon = targetStr.startsWith("file:");
  const basename =
    isFileIcon ? targetStr.substring(5).replace(/\.svg$/, "") : "";

  const [asyncSvg, setAsyncSvg] = useState<ParsedSvgIcon | null>(() =>
    isFileIcon ? resolveCustomSvgIconSync(basename) : null
  );

  useEffect(() => {
    if (!isFileIcon) return;
    const syncResolved = resolveCustomSvgIconSync(basename);
    if (syncResolved) {
      setAsyncSvg(syncResolved);
      return;
    }
    import(`../../../../assets/svg/icons/${basename}.svg?raw`)
      .then((module) => {
        const raw = typeof module === "string" ? module : module.default;
        if (typeof raw === "string") {
          const parsed = parseSvgMarkup(raw);
          parsedSvgCache.set(basename, parsed);
          setAsyncSvg(parsed);
        }
      })
      .catch((err) => {
        logging.warn('Failed to load custom icon', err, { icon: `${basename}.svg`, scope: 'Icon' });
      });
  }, [isFileIcon, basename]);

  const baseStyle: React.CSSProperties = {
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    ...style,
  };

  if (isFileIcon) {
    const parsedSvg = resolveCustomSvgIconSync(basename) || asyncSvg;

    return (
      <svg
        viewBox={parsedSvg?.viewBox || "0 0 24 24"}
        width={dimension}
        height={dimension}
        fill={color}
        className={className}
        style={baseStyle}
        aria-hidden={!title}>
        {title && <title>{title}</title>}
        {parsedSvg?.paths.map((d, idx) => (
          <path key={idx} d={d} />
        ))}
      </svg>
    );
  }

  return (
    <svg
      viewBox='0 0 24 24'
      width={dimension}
      height={dimension}
      fill={color}
      className={className}
      style={baseStyle}
      aria-hidden={!title}>
      {title && <title>{title}</title>}
      {path && <path d={path} />}
    </svg>
  );
};

export default Icon;
