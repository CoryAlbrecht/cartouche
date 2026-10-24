/**
 * @file Dialog.tsx
 * @module renderer/workbench/dialogs/Dialog
 * @description Base non-modal, resizable dialog container component wrapping DetachedWindowPortal for standardized window portals, title bars, and key handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link DetachedWindowPortal}
 * @see {@link PreferencesDialog}
 * @see {@link AddLayersDialog}
 * @see {@link LayerPropertiesDialog}
 */

import React, { useEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import { mdiClose } from "@mdi/js";
import { DetachedWindowPortal } from "@renderer/components/common/DetachedWindowPortal";

/**
 * @typedef {Object} DialogProps
 * @property {string} name - Unique frame name identifier for the detached window.
 * @property {string} title - Title text displayed in OS window frame and dialog header bar.
 * @property {string | React.ReactNode} [icon] - Optional MDI SVG path string or custom icon node for title bar branding icon.
 * @property {boolean} isOpen - Signal or boolean flag controlling dialog window visibility.
 * @property {() => void} onClose - Callback invoked when closing dialog or clicking close.
 * @property {() => void} [onCancel] - Optional callback invoked specifically when cancelling via Escape key.
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
  icon?: string | React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
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
 * @updated 2026-10-24
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
  onCancel,
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
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (onCancel) {
          onCancel();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onCancel]);

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
        data-dialog-name={name}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          color: "#000000",
          fontSize: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
          boxSizing: "border-box",
        }}>
        {/* Standardized Frameless Dialog Header Bar */}
        <div className='cartouche-dialog-header'>
          <div className='cartouche-dialog-title-container'>
            {icon
              && (typeof icon === "string" ?
                <Icon path={icon} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.75)' style={{ flexShrink: 0 }} />
              : icon)}
            <span className='cartouche-dialog-title'>{title}</span>
          </div>

          <div className='cartouche-dialog-header-actions'>
            {headerActions}
            <button
              type='button'
              className='cartouche-dialog-close-btn'
              onClick={() => onClose()}
              title='Close (Esc)'>
              <Icon path={mdiClose} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.75)' />
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
              gap: "0.625rem",
              padding: "0.625rem 1rem",
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
