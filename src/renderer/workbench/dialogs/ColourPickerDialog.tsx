/**
 * @file ColourPickerDialog.tsx
 * @module renderer/workbench/dialogs/ColourPickerDialog
 * @description Modal dialog shell wrapping ColourPickerWidget with Apply and Cancel actions, keyboard dismissal, and outside click cancellation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link ColourPickerWidget}
 * @see {@link ModalDialog}
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ColourPickerWidget } from '@renderer/workbench/widgets/ColourPickerWidget';
import type { ColorFormat } from '@shared/colors';

/**
 * @typedef {Object} ColourPickerDialogProps
 * @property {boolean} isOpen - Whether the color picker modal is visible.
 * @property {string} [initialColor='#00ff00ff'] - Starting color string.
 * @property {ColorFormat} [format] - Starting color model format.
 * @property {string} [title='Colour Picker'] - Modal header title string.
 * @property {(color: string) => void} onApply - Callback invoked with selected color when Apply is clicked.
 * @property {() => void} onCancel - Callback invoked when dismissed or cancelled.
 */
export interface ColourPickerDialogProps {
  isOpen: boolean;
  initialColor?: string;
  format?: ColorFormat;
  title?: string;
  onApply: (color: string) => void;
  onCancel: () => void;
}

/**
 * @component ColourPickerDialog
 * @description Centered in-window modal dialog hosting ColourPickerWidget with Apply and Cancel controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @param {ColourPickerDialogProps} props - Component properties.
 * @returns {React.ReactPortal | null} Rendered portal or null when closed.
 */
export const ColourPickerDialog: React.FC<ColourPickerDialogProps> = ({
  isOpen,
  initialColor = '#00ff00ff',
  format,
  title = 'Colour Picker',
  onApply,
  onCancel
}) => {
  const [draftColor, setDraftColor] = useState<string>(initialColor);
  const dialogBoxRef = useRef<HTMLDivElement>(null);

  // Synchronize draft color whenever dialog opens or initialColor changes
  useEffect(() => {
    if (isOpen) {
      setDraftColor(initialColor);
    }
  }, [isOpen, initialColor]);

  // Keyboard Escape dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dialogBoxRef.current && !dialogBoxRef.current.contains(e.target as Node)) {
      onCancel();
    }
  };

  const handleApply = () => {
    onApply(draftColor);
  };

  const portalContent = (
    <div
      className='colour-picker-dialog-backdrop'
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        ref={dialogBoxRef}
        className='colour-picker-dialog-box'
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '380px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--cartouche-theme-surface, #ffffff)',
          color: 'var(--cartouche-theme-fg, #000000)',
          borderRadius: '6px',
          boxShadow: '0 8px 24px var(--cartouche-theme-shadow-strong, rgba(0, 0, 0, 0.3))',
          border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Bar */}
        <div
          className='colour-picker-dialog-header'
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--cartouche-menubar-bg, #1b446c)',
            color: 'var(--cartouche-menubar-fg, #ffffff)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}
        >
          <span>{title}</span>
          <button
            type='button'
            className='colour-picker-dialog-close-btn'
            title='Cancel'
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1.125rem',
              lineHeight: 1,
              padding: '2px 4px',
              opacity: 0.85
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Embedded ColourPickerWidget */}
        <div
          className='colour-picker-dialog-body'
          style={{
            padding: '8px',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <ColourPickerWidget
            showHeader={false}
            initialColor={draftColor}
            format={format}
            onChange={(c) => setDraftColor(c)}
            style={{
              border: 'none',
              background: 'transparent',
              minHeight: '280px',
              boxShadow: 'none'
            }}
          />
        </div>

        {/* Footer Actions: Cancel & Apply */}
        <div
          className='colour-picker-dialog-footer'
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--cartouche-theme-surface-alt, #f8fafc)',
            borderTop: '1px solid var(--cartouche-theme-border, #cbd5e1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type='button'
            className='colour-picker-dialog-btn colour-picker-dialog-cancel-btn'
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
              backgroundColor: 'var(--cartouche-theme-surface, #ffffff)',
              color: 'var(--cartouche-theme-fg, #000000)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            type='button'
            className='colour-picker-dialog-btn colour-picker-dialog-apply-btn'
            onClick={handleApply}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid var(--cartouche-theme-primary, #1b446c)',
              backgroundColor: 'var(--cartouche-theme-primary, #1b446c)',
              color: 'var(--cartouche-theme-fg-inverted, #ffffff)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(portalContent, document.body) : portalContent;
};

export default ColourPickerDialog;
