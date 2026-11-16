/**
 * @file ColourPickerDialog.tsx
 * @module renderer/workbench/dialogs/ColourPickerDialog
 * @description Reusable modal dialog wrapping ColourPickerWidget with a settable (localized by default) title, optional opaque-only mode, Apply and Cancel actions, keyboard dismissal, outside click cancellation, and ownerDocument container targeting. The chosen colour is committed only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link ColourPickerWidget}
 * @see {@link ModalDialog}
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ColourPickerWidget } from '@renderer/workbench/widgets/ColourPickerWidget';
import { formatCssColor, parseCssColor, type ColorFormat } from '@shared/colors';
import { useTranslation } from '@renderer/hooks/useTranslation';

/**
 * @typedef {Object} ColourPickerDialogProps
 * @property {boolean} isOpen - Whether the color picker modal is visible.
 * @property {string} [initialColor='#00ff00ff'] - Starting color string.
 * @property {ColorFormat} [format] - Starting color model format.
 * @property {string} [title] - Modal header title string. Defaults to the localized "Pick Colour" string (`colour_picker_dialog_title`).
 * @property {boolean} [allowAlpha=true] - Whether the hosted picker offers transparency. When false the alpha strip is hidden and Apply always returns an opaque colour.
 * @property {HTMLElement | null} [container] - Optional DOM container element into which the modal dialog is portaled (defaults to document.body).
 * @property {(color: string) => void} onApply - Callback invoked with selected color when Apply is clicked.
 * @property {() => void} onCancel - Callback invoked when dismissed or cancelled.
 */
export interface ColourPickerDialogProps {
  isOpen: boolean;
  initialColor?: string;
  format?: ColorFormat;
  title?: string;
  allowAlpha?: boolean;
  container?: HTMLElement | null;
  onApply: (color: string) => void;
  onCancel: () => void;
}

/**
 * @description Resolves the host Window object for a target container DOM node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @param {HTMLElement | null} [targetContainer] - Target DOM container node.
 * @returns {Window | null} Resolved Window context or fallback window.
 */
function resolveWindowContext(targetContainer?: HTMLElement | null): Window | null {
  return targetContainer?.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);
}

/**
 * @description Forces a CSS colour string to full opacity, keeping its format (or the given format). Unparseable input is returned unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {string} color - CSS colour string, possibly translucent.
 * @param {ColorFormat} [format] - Output format; defaults to the input's own format.
 * @returns {string} The same colour with alpha 1.
 */
function toOpaqueColor(color: string, format?: ColorFormat): string {
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  return formatCssColor({ ...parsed.srgb, alpha: 1 }, format ?? parsed.format);
}

/**
 * @component ColourPickerDialog
 * @description Centered in-window modal dialog hosting ColourPickerWidget with Apply and Cancel controls, a settable title, and an optional opaque-only mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ColourPickerDialogProps} props - Component properties.
 * @returns {React.ReactPortal | null} Rendered portal or null when closed.
 */
export const ColourPickerDialog: React.FC<ColourPickerDialogProps> = ({
  isOpen,
  initialColor = '#00ff00ff',
  format,
  title,
  allowAlpha = true,
  container,
  onApply,
  onCancel
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('colour_picker_dialog_title');
  // Opaque-only dialogs normalise the starting colour once, so the preview and an
  // untouched Apply are both opaque; the hosted widget keeps later edits opaque.
  const startColor = allowAlpha ? initialColor : toOpaqueColor(initialColor, format);
  const [draftColor, setDraftColor] = useState<string>(startColor);
  const dialogBoxRef = useRef<HTMLDivElement>(null);

  const targetContainer = container ?? (typeof document !== 'undefined' ? document.body : null);
  const targetWindow = resolveWindowContext(targetContainer);

  // Synchronize draft color whenever dialog opens or initialColor changes
  useEffect(() => {
    if (isOpen) {
      setDraftColor(startColor);
    }
  }, [isOpen, startColor]);

  // Keyboard Escape dismissal bound to target container's window context
  useEffect(() => {
    if (!isOpen || !targetWindow) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault?.();
        e.stopPropagation?.();
        onCancel();
      }
    };
    targetWindow.addEventListener('keydown', handleKeyDown);
    return () => targetWindow.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, targetWindow]);

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
          <span>{resolvedTitle}</span>
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
            allowAlpha={allowAlpha}
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

  return targetContainer ? createPortal(portalContent, targetContainer) : portalContent;
};

export default ColourPickerDialog;
