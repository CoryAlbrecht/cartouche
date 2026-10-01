/**
 * @file MdiIcon.tsx
 * @module renderer/components/common/MdiIcon
 * @description Standardized Material Design Icons (MDI) SVG renderer component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 */

import React from "react";

/**
 * @typedef {Object} MdiIconProps
 * @property {string} path - MDI path data string (e.g. from `@mdi/js`).
 * @property {string | number} [size='24px'] - Width and height dimension string or multiplier.
 * @property {string} [color='currentColor'] - Fill color hex or CSS color string.
 * @property {string} [className] - Optional CSS class name.
 * @property {string} [title] - Accessibility title tag string for tooltips and screen readers.
 * @property {React.CSSProperties} [style] - Inline CSS style overrides.
 */
export interface MdiIconProps {
  path: string;
  size?: string | number;
  color?: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * @component Icon
 * @description Renders a Material Design Icon SVG vector paths with standard viewbox and theme dimensions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {MdiIconProps} props - Component properties.
 * @returns {React.ReactElement} Scalable Vector Graphics (SVG) element.
 */
export const Icon: React.FC<MdiIconProps> = ({
  path,
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

  return (
    <svg
      viewBox='0 0 24 24'
      width={dimension}
      height={dimension}
      fill={color}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
      aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d={path} />
    </svg>
  );
};

export default Icon;
