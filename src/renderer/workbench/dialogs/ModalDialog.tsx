/**
 * @file ModalDialog.tsx
 * @module renderer/workbench/dialogs/ModalDialog
 * @description Standardized React portal-based modal dialog to block interaction with parent window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @component ModalDialog
 */

import React from 'react';
import { createPortal } from 'react-dom';

/**
 * @typedef {Object} ModalDialogProps
 * @property {string} title - Title text of the modal.
 * @property {boolean} isOpen - Whether the modal is currently visible.
 * @property {() => void} onClose - Callback invoked when modal is dismissed (e.g. by 'Esc' key or 'X' button).
 * @property {React.ReactNode} children - Main content rendered inside the modal body.
 * @property {Array<{label: string, onClick: () => void, primary?: boolean}>} [buttons] - Action buttons for the modal footer.
 * @property {string} [width] - CSS width for the modal container (e.g. '400px').
 */
export interface ModalDialogProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  buttons?: Array<{ label: string; onClick: () => void; primary?: boolean }>;
  width?: string;
}

/**
 * @component ModalDialog
 * @description In-window centered modal dialog with backdrop overlay blocking interactions with background UI.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {ModalDialogProps} props - Component properties.
 * @returns {React.ReactPortal | null} Rendered portal or null when closed.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  title,
  isOpen,
  onClose,
  children,
  buttons,
  width = '400px',
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
      <div
        style={{
          width,
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#1b446c',
          color: '#ffffff',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{title}</span>
        </div>
        
        {/* Body */}
        <div style={{ padding: '16px', color: '#000000', fontSize: '1rem', lineHeight: 1.5 }}>
          {children}
        </div>

        {/* Footer */}
        {buttons && buttons.length > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}>
            {buttons.map((btn, i) => (
              <button
                key={i}
                type="button"
                onClick={btn.onClick}
                style={{
                  padding: '6px 16px',
                  borderRadius: '4px',
                  border: btn.primary ? '1px solid #1b446c' : '1px solid #cbd5e1',
                  backgroundColor: btn.primary ? '#1b446c' : '#ffffff',
                  color: btn.primary ? '#ffffff' : '#000000',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '1rem'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
