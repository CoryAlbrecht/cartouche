/**
 * @file PickerDialogFrame.tsx
 * @module renderer/workbench/dialogs/PickerDialogFrame
 * @description Shared modal frame for the picker dialogs (ColourPickerDialog, GradientPickerDialog): a backdrop portaled into a target container, a titled header with a close button, a scrolling body for the hosted picker widget, and localized Cancel / Apply footer buttons. Escape on the container's window and clicks on the backdrop cancel.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link ColourPickerDialog}
 * @see {@link GradientPickerDialog}
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { isWithinOpenSelect } from "@renderer/components/common/Select";

/**
 * @typedef {Object} PickerDialogFrameProps
 * @property {string} title - Header title.
 * @property {string} classPrefix - Class name prefix for the frame's parts, e.g. `colour-picker-dialog` gives `colour-picker-dialog-backdrop`, `-box`, `-header`, `-close-btn`, `-body`, `-footer`, `-btn`, `-cancel-btn` and `-apply-btn`.
 * @property {string} [width='380px'] - Width of the dialog box.
 * @property {HTMLElement | null} [container] - DOM container the frame is portaled into (defaults to document.body).
 * @property {() => void} onApply - Called when Apply is clicked.
 * @property {() => void} onCancel - Called on Cancel, the close button, Escape, or a backdrop click.
 * @property {React.ReactNode} children - The hosted picker widget.
 */
export interface PickerDialogFrameProps {
  title: string;
  classPrefix: string;
  width?: string;
  container?: HTMLElement | null;
  onApply: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

/**
 * @description Resolves the host Window object for a target container DOM node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {HTMLElement | null} [targetContainer] - Target DOM container node.
 * @returns {Window | null} Resolved Window context or fallback window.
 */
function resolveWindowContext(
  targetContainer?: HTMLElement | null
): Window | null {
  return (
    targetContainer?.ownerDocument?.defaultView
    ?? (typeof window !== "undefined" ? window : null)
  );
}

/**
 * @component PickerDialogFrame
 * @description Centered in-window modal frame hosting a picker widget, with a title, localized Cancel and Apply buttons (`dialog_cancel`, `dialog_apply`), Escape and backdrop-click cancellation, and ownerDocument container targeting. Render it only while the dialog is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {PickerDialogFrameProps} props - Component properties.
 * @returns {React.ReactElement} Rendered portal (or inline content when no container is available).
 */
export const PickerDialogFrame: React.FC<PickerDialogFrameProps> = ({
  title,
  classPrefix,
  width = "380px",
  container,
  onApply,
  onCancel,
  children,
}) => {
  const { t } = useTranslation();
  const dialogBoxRef = useRef<HTMLDivElement>(null);
  const targetContainer =
    container ?? (typeof document !== "undefined" ? document.body : null);
  const targetWindow = resolveWindowContext(targetContainer);

  // Keyboard Escape dismissal bound to the target container's window context
  useEffect(() => {
    if (!targetWindow) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isWithinOpenSelect(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault?.();
        e.stopPropagation?.();
        onCancel();
      }
    };
    targetWindow.addEventListener("keydown", handleKeyDown);
    return () => targetWindow.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, targetWindow]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      dialogBoxRef.current
      && !dialogBoxRef.current.contains(e.target as Node)
    ) {
      onCancel();
    }
  };

  const portalContent = (
    <div
      className={`${classPrefix}-backdrop dialog-backdrop`}
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: "blur(2px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}>
      <div
        ref={dialogBoxRef}
        className={`${classPrefix}-box picker-dialog-box`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "95vw",
          maxHeight: "90vh",
          borderRadius: "6px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}>
        {/* Header Bar */}
        <div className={`${classPrefix}-header picker-dialog-header`}>
          <span>{title}</span>
          <button
            type='button'
            className={`${classPrefix}-close-btn`}
            title={t("dialog_cancel")}
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.125rem",
              lineHeight: 1,
              padding: "2px 4px",
              opacity: 0.85,
            }}>
            ✕
          </button>
        </div>

        {/* Modal Body: the hosted picker widget */}
        <div
          className={`${classPrefix}-body`}
          style={{
            padding: "8px",
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}>
          {children}
        </div>

        {/* Footer Actions: Cancel & Apply */}
        <div
          className={`${classPrefix}-footer picker-dialog-footer`}
          style={{
            padding: "10px 14px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}>
          <button
            type='button'
            className={`${classPrefix}-btn ${classPrefix}-cancel-btn dialog-btn dialog-btn-secondary`}
            onClick={onCancel}>
            {t("dialog_cancel")}
          </button>
          <button
            type='button'
            className={`${classPrefix}-btn ${classPrefix}-apply-btn dialog-btn dialog-btn-primary`}
            onClick={onApply}>
            {t("dialog_apply")}
          </button>
        </div>
      </div>
    </div>
  );

  return targetContainer ?
      createPortal(portalContent, targetContainer)
    : portalContent;
};

export default PickerDialogFrame;
