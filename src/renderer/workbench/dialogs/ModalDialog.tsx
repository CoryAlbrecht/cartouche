/**
 * @file ModalDialog.tsx
 * @module renderer/workbench/dialogs/ModalDialog
 * @description Standardized React portal-based modal dialog to block interaction with parent window, plus the sequential UnsavedChangesModal confirmation component. Its colours come from the shared Dialog classes in workbench.css (backdrop, title bar, body and footer), so it follows the Theme.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @component ModalDialog
 * @see {@link UnsavedChangesModal}
 */

import React from "react";
import { createPortal } from "react-dom";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { isWithinOpenSelect } from "@renderer/components/common/Select";
import {
  openInWindowModal,
  type InWindowModalHandle,
} from "./inWindowModalStack";
import {
  unsavedChangesModalSignal,
  resolveUnsavedChangesModal,
} from "@renderer/state/gisSignals";

/**
 * @typedef {Object} ModalDialogProps
 * @property {string} title - Title text of the modal.
 * @property {boolean} isOpen - Whether the modal is currently visible.
 * @property {() => void} onClose - Callback invoked when modal is dismissed (e.g. by 'Esc' key or 'X' button).
 * @property {React.ReactNode} children - Main content rendered inside the modal body.
 * @property {Array<{label: string, onClick: () => void, primary?: boolean}>} [buttons] - Action buttons for the modal footer.
 * @property {string} [width] - CSS width for the modal container (e.g. '400px').
 * @property {HTMLElement | null} [container] - Element to render into, e.g. a detached Dialog window's `body`, so the modal shows over that window. Its window then takes the modal's Escape key, and the modal sits on that window's in-window modal stack so the Dialog defers Escape to it. Defaults to the Workbench's `document.body`.
 */
export interface ModalDialogProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  buttons?: Array<{ label: string; onClick: () => void; primary?: boolean }>;
  width?: string;
  container?: HTMLElement | null;
}

/**
 * @component ModalDialog
 * @description In-window centered modal dialog with backdrop overlay blocking interactions with background UI, rendered over the Workbench or, given `container`, over a detached Dialog window. It reads the Theme's Dialog title bar, body and footer colours through workbench.css classes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {ModalDialogProps} props - Component properties.
 * @returns {React.ReactNode} Rendered portal (inline content when no container is available), or null when closed.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  title,
  isOpen,
  onClose,
  children,
  buttons,
  width = "400px",
  container,
}) => {
  const targetContainer =
    container ?? (typeof document !== "undefined" ? document.body : null);
  const targetWindow =
    targetContainer?.ownerDocument?.defaultView
    ?? (typeof window !== "undefined" ? window : null);
  const modalHandleRef = React.useRef<InWindowModalHandle | null>(null);

  // Over a detached Dialog window, sit on its in-window modal stack so the Dialog defers Escape
  React.useEffect(() => {
    if (!isOpen || !container || !targetWindow) return;
    const handle = openInWindowModal(targetWindow);
    modalHandleRef.current = handle;
    return () => {
      handle.release();
      if (modalHandleRef.current === handle) modalHandleRef.current = null;
    };
  }, [isOpen, container, targetWindow]);

  React.useEffect(() => {
    if (!isOpen || !targetWindow) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isWithinOpenSelect(e.target)) return;
      if (modalHandleRef.current && !modalHandleRef.current.isTopmost()) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    targetWindow.addEventListener("keydown", handleKeyDown);
    return () => targetWindow.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, targetWindow]);

  if (!isOpen) return null;

  const content = (
    <div
      className='dialog-backdrop'
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: "blur(2px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <div
        className='cartouche-dialog-window modal-dialog-box'
        style={{
          width,
          borderRadius: "6px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
        {/* Header */}
        <div
          className='cartouche-dialog-header'
          style={{
            padding: "12px 16px",
            fontSize: "1rem",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <span>{title}</span>
        </div>

        {/* Body */}
        <div
          className='cartouche-dialog-body'
          style={{ padding: "16px", fontSize: "1rem", lineHeight: 1.5 }}>
          {children}
        </div>

        {/* Footer */}
        {buttons && buttons.length > 0 && (
          <div
            className='cartouche-dialog-footer'
            style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}>
            {buttons.map((btn, i) => (
              <button
                key={i}
                type='button'
                className={`dialog-btn dialog-btn-wide modal-dialog-btn ${btn.primary ? "dialog-btn-primary" : "dialog-btn-secondary"}`}
                onClick={btn.onClick}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  return targetContainer ? createPortal(content, targetContainer) : content;
};

/**
 * @component UnsavedChangesModal
 * @description Sequential confirmation modal dialog rendered for each individual dirty layer and dirty project before project close or application exit.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @returns {JSX.Element | null} Rendered modal dialog or null when inactive.
 */
export const UnsavedChangesModal: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const promptState = unsavedChangesModalSignal.value;

  if (!promptState) {
    return null;
  }

  const message =
    promptState.targetType === "layer" ?
      t("unsaved_layer_changes_prompt", { name: promptState.targetName })
    : t("unsaved_project_changes_prompt", { name: promptState.targetName });

  return (
    <ModalDialog
      title={t("unsaved_changes_title")}
      isOpen={true}
      width='480px'
      onClose={() => resolveUnsavedChangesModal("cancel")}
      buttons={[
        {
          label: t("unsaved_changes_cancel"),
          onClick: () => resolveUnsavedChangesModal("cancel"),
        },
        {
          label: t("unsaved_changes_dont_save"),
          onClick: () => resolveUnsavedChangesModal("discard"),
        },
        {
          label: t("unsaved_changes_save"),
          primary: true,
          onClick: () => resolveUnsavedChangesModal("save"),
        },
      ]}>
      <p
        className='unsaved-changes-modal-message'
        style={{ margin: 0, fontSize: "1rem" }}>
        {message}
      </p>
    </ModalDialog>
  );
};
