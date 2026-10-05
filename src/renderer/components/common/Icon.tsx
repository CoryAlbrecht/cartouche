/**
 * @file Icon.tsx
 * @module renderer/components/common/Icon
 * @description Standardized Material Design Icons (MDI) SVG renderer component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

import React, { useState, useEffect } from "react";

/**
 * @typedef {Object} IconProps
 * @property {string} [path] - MDI path data string (e.g. from `@mdi/js`).
 * @property {string} [name] - Filename or identifier. If starts with 'file:', imports from assets/svg/icons/.
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
 * @component Icon
 * @description Renders a Material Design Icon SVG vector paths or a dynamic SVG image.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @param {IconProps} props - Component properties.
 * @returns {React.ReactElement} Scalable Vector Graphics (SVG) element or img element.
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
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  const dimension =
    typeof size === "number" ?
      size <= 4 ?
        `${size * 24}px`
      : `${size}px`
    : size;

  // Determine if we should use name or path. The Action Registry might send 'file:...' into the 'path' prop.
  const targetStr = name || path || "";

  useEffect(() => {
    if (targetStr.startsWith("file:")) {
      const filename = targetStr.substring(5); // Remove "file:" prefix
      // Use dynamic import to Vite's asset pipeline
      const basename = filename.replace(/\.svg$/, "");
      import(`../../../../assets/svg/icons/${basename}.svg`)
        .then((module) => {
          setImgSrc(module.default || module);
        })
        .catch((err) => {
          console.error(`[Icon] Failed to load custom icon: ${filename}`, err);
        });
    }
  }, [targetStr]);

  const baseStyle: React.CSSProperties = {
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    ...style,
  };

  if (targetStr.startsWith("file:")) {
    if (!imgSrc) {
      return (
        <span style={{ width: dimension, height: dimension, ...baseStyle }} />
      );
    }
    return (
      <img
        src={imgSrc}
        width={dimension}
        height={dimension}
        className={className}
        style={baseStyle}
        alt={title || "Icon"}
        title={title}
      />
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
