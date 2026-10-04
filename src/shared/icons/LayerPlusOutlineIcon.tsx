/**
 * @file LayerPlusOutlineIcon.tsx
 * @module shared/icons/LayerPlusOutlineIcon
 * @description Custom SVG vector icon component rendering a layers outline base with a plus badge.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 */

import React from "react";

/**
 * @typedef {Object} LayerPlusOutlineIconProps
 * @property {number | string} [size=20] - SVG width and height dimension in pixels or CSS length string.
 * @property {string} [className=''] - Optional CSS class name.
 * @property {React.CSSProperties} [style] - Optional inline CSS styles.
 */
export interface LayerPlusOutlineIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * @component LayerPlusOutlineIcon
 * @description Custom SVG icon rendering a layers outline base with a plus badge corner overlay.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @param {LayerPlusOutlineIconProps} props - Component properties.
 * @returns {React.ReactElement} Scalable Vector Graphics (SVG) element.
 */
export const LayerPlusOutlineIcon: React.FC<LayerPlusOutlineIconProps> = ({
  size = 20,
  className = "",
  style,
}) => {
  const dimension = typeof size === "number" ? `${size}px` : size;

  return (
    <svg
      viewBox='0 0 24 24'
      width={dimension}
      height={dimension}
      fill='currentColor'
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}>
      <path d='m12 16-9-7 9-7 9 7z' />
      <path d='m12 4.53-5.74 4.47 5.74 4.47 5.74-4.47z' fill='#ffffff' />
      <g fill='currentColor' strokeWidth='0'>
        <path d='m4.62 12.81-1.62 1.26 9 7 1.30266-1.01318c-.592306-.503527-.74919-1.25497-.418178-2.23061l-.884483.713793z' />
        <path d='m19.1845 14.4434v2.7h2.7v1.78448h-2.7v2.7h-1.78448v-2.7h-2.7v-1.78448h2.7v-2.7z' />
      </g>
    </svg>
  );
};
