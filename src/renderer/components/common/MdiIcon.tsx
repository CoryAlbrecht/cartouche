import React from "react";

export interface MdiIconProps {
  path: string;
  size?: string | number;
  color?: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<MdiIconProps> = ({
  path,
  size = "24px",
  color = "currentColor",
  className,
  title,
  style,
}) => {
  const dimension = typeof size === "number" ? `${size * 24}px` : size;

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
