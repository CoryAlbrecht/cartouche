/**
 * @file Dialog.tsx
 * @module renderer/workbench/dialogs/Dialog
 * @description Base non-modal, resizable dialog container component wrapping DetachedWindowPortal for standardized window portals, title bars, and key handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link DetachedWindowPortal}
 * @see {@link PreferencesDialog}
 * @see {@link AddLayerDialog}
 */

import React, { useEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiClose } from "@mdi/js";
import { DetachedWindowPortal } from "@renderer/components/common/DetachedWindowPortal";

/**
 * @typedef {Object} DialogProps
 * @property {string} name - Unique frame name identifier for the detached window.
 * @property {string} title - Title text displayed in OS window frame and dialog header bar.
 * @property {string} [icon] - Optional MDI SVG path string for title bar branding icon.
 * @property {boolean} isOpen - Signal or boolean flag controlling dialog window visibility.
 * @property {() => void} onClose - Callback invoked when closing dialog or pressing Escape.
 * @property {number} [defaultWidth=640] - Default window width in pixels.
 * @property {number} [defaultHeight=480] - Default window height in pixels.
 * @property {number} [x=-1] - Optional left window position in pixels.
 * @property {number} [y=-1] - Optional top window position in pixels.
 * @property {React.ReactNode} children - Main content elements rendered inside dialog body.
 * @property {React.ReactNode} [headerActions] - Optional control elements rendered in right side of header bar.
 * @property {React.ReactNode} [footer] - Optional action button bar rendered at bottom of dialog.
 * @property {string} [className] - Custom CSS class string.
 * @property {React.CSSProperties} [style] - Inline style overrides for dialog body container.
 */
export interface DialogProps {
  name: string;
  title: string;
  icon?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultWidth?: number;
  defaultHeight?: number;
  x?: number;
  y?: number;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * @component Dialog
 * @description Base container component for all non-modal, resizable dialog windows in Cartouche, standardizing title headers, portals, and Escape key dismissal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {DialogProps} props - Component properties.
 * @returns {React.ReactElement | null} Rendered detached portal dialog window or null if closed.
 */
export const Dialog: React.FC<DialogProps> = ({
  name,
  title,
  icon,
  isOpen,
  onClose,
  defaultWidth = 640,
  defaultHeight = 480,
  x = -1,
  y = -1,
  children,
  headerActions,
  footer,
  className = "",
  style = {},
}) => {
  useSignals();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let windowFeatures = `width=${defaultWidth},height=${defaultHeight}`;
  if (x >= 0 && y >= 0) {
    windowFeatures += `,left=${x},top=${y}`;
  }

  return (
    <DetachedWindowPortal
      frameName={name}
      title={title}
      features={windowFeatures}
      onClose={onClose}>
      <div
        className={`cartouche-dialog-window ${className}`}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          color: "#000000",
          fontSize: "12pt",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
          boxSizing: "border-box",
        }}>
        {/* Standardized Dialog Header Bar */}
        <div
          className='cartouche-dialog-header'
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#1b446c",
            color: "#ffffff",
            padding: "8px 14px",
            fontWeight: 600,
            fontSize: "1rem",
            userSelect: "none",
            flexShrink: 0,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {icon && <Icon path={icon} size='18px' />}
            <span>{title}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {headerActions}
            <button
              type='button'
              onClick={() => onClose()}
              title='Close (Esc)'
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                borderRadius: "3px",
                opacity: 0.85,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}>
              <Icon path={mdiClose} size='18px' />
            </button>
          </div>
        </div>

        {/* Dialog Main Content Body */}
        <div
          className='cartouche-dialog-body'
          style={{
            flex: 1,
            overflow: "auto",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            ...style,
          }}>
          {children}
        </div>

        {/* Optional Dialog Action Footer */}
        {footer && (
          <div
            className='cartouche-dialog-footer'
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px",
              padding: "10px 16px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #cbd5e1",
              flexShrink: 0,
            }}>
            {footer}
          </div>
        )}
      </div>
    </DetachedWindowPortal>
  );
};
