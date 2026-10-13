/**
 * @file InlineRenameInput.tsx
 * @module renderer/components/common/InlineRenameInput
 * @description Reusable single-line text input control for inline renaming in tree views, tables, and lists with event bubbling suppression and imperative commit ref synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import React, { useRef, useCallback, useEffect } from 'react';

/**
 * @typedef {Object} InlineRenameInputProps
 * @property {string} initialValue - Initial name to populate in the text field.
 * @property {(trimmedName: string) => void} onSave - Callback invoked when the user commits an edit with a changed, non-empty value.
 * @property {() => void} onCancel - Callback invoked when the user cancels editing or submits an empty/unchanged value.
 * @property {string} [className] - Optional custom CSS class name (defaults to 'tree-inline-input').
 * @property {React.MutableRefObject<(() => void) | null>} [commitRef] - Optional mutable ref to receive the imperative commit handler.
 * @property {React.RefObject<HTMLInputElement | null>} [inputRef] - Optional external ref bound to the text input DOM node.
 */
export interface InlineRenameInputProps {
  initialValue: string;
  onSave: (trimmedName: string) => void;
  onCancel: () => void;
  className?: string;
  commitRef?: React.MutableRefObject<(() => void) | null>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * @component InlineRenameInput
 * @description Single-line text input control for inline renaming with keyboard event suppression, paste sanitization, and lifecycle management.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {InlineRenameInputProps} props - Component properties.
 * @returns {React.ReactElement} Inline input element.
 */
export const InlineRenameInput: React.FC<InlineRenameInputProps> = ({
  initialValue,
  onSave,
  onCancel,
  className = 'tree-inline-input',
  commitRef,
  inputRef: externalInputRef
}) => {
  const isCancelledRef = useRef(false);
  const localInputRef = useRef<HTMLInputElement>(null);
  const actualInputRef = externalInputRef || localInputRef;

  const handleCommit = useCallback(
    (rawVal: string) => {
      if (isCancelledRef.current) return;
      isCancelledRef.current = true;
      const sanitized = rawVal.replace(/[\r\n]+/g, ' ').trim();
      if (sanitized && sanitized !== initialValue) {
        onSave(sanitized);
      } else {
        onCancel();
      }
    },
    [initialValue, onSave, onCancel]
  );

  useEffect(() => {
    if (commitRef) {
      commitRef.current = () => {
        if (actualInputRef.current) {
          handleCommit(actualInputRef.current.value);
        } else {
          onCancel();
        }
      };
    }
    return () => {
      if (commitRef) {
        commitRef.current = null;
      }
    };
  }, [commitRef, handleCommit, onCancel, actualInputRef]);

  return (
    <input
      ref={actualInputRef}
      type='text'
      className={className}
      defaultValue={initialValue}
      autoFocus
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCommit(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          isCancelledRef.current = true;
          e.currentTarget.value = initialValue;
          onCancel();
        }
      }}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
      onPaste={(e) => {
        e.stopPropagation();
        const text = e.clipboardData.getData('text');
        if (/[\r\n]/.test(text)) {
          e.preventDefault();
          const sanitized = text.replace(/[\r\n]+/g, ' ');
          const target = e.currentTarget;
          const start = target.selectionStart ?? 0;
          const end = target.selectionEnd ?? 0;
          const currentVal = target.value;
          target.value = currentVal.substring(0, start) + sanitized + currentVal.substring(end);
          target.selectionStart = target.selectionEnd = start + sanitized.length;
        }
      }}
      onBlur={(e) => {
        if (!isCancelledRef.current) {
          handleCommit(e.currentTarget.value);
        }
      }}
    />
  );
};

export default InlineRenameInput;

