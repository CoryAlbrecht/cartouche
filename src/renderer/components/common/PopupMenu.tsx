/**
 * @file PopupMenu.tsx
 * @module renderer/components/common/PopupMenu
 * @description Modeless floating context menu component rendered at cursor coordinates via React portal, supporting boundary collision avoidance, keyboard dismissal, and menubar submenu styling tokens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @see {@link PopupMenuItem}
 */

import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import type { PopupMenuItem } from '@renderer/state/projectSignals';

/**
 * @typedef {Object} PopupMenuProps
 * @property {boolean} isOpen - Whether the popup menu is currently visible.
 * @property {{ x: number; y: number } | null} position - Screen coordinates (clientX, clientY) for menu placement.
 * @property {PopupMenuItem[]} items - Action items and separators to render.
 * @property {() => void} onClose - Callback invoked when menu is dismissed by outside click, item selection, or Escape.
 * @property {string} [className] - Optional custom CSS class name.
 */
export interface PopupMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  items: PopupMenuItem[];
  onClose: () => void;
  className?: string;
}

/**
 * @component PopupMenu
 * @description Independent portal-based context popup menu component adhering to Cartouche design system tokens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {PopupMenuProps} props - Component properties.
 * @returns {React.ReactPortal | null} Portaled popup menu element or null when closed.
 */
export const PopupMenu: React.FC<PopupMenuProps> = ({
  isOpen,
  position,
  items,
  onClose,
  className = ''
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(position);

  // Measure and clamp within viewport boundaries
  useLayoutEffect(() => {
    if (!isOpen || !position) {
      setAdjustedPos(null);
      return;
    }

    let targetX = position.x;
    let targetY = position.y;

    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (targetX + rect.width > viewportWidth - padding) {
        targetX = Math.max(padding, viewportWidth - rect.width - padding);
      }
      if (targetY + rect.height > viewportHeight - padding) {
        targetY = Math.max(padding, viewportHeight - rect.height - padding);
      }
    }

    setAdjustedPos({ x: targetX, y: targetY });
  }, [isOpen, position, items]);

  // Click-outside and keyboard dismissal listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsidePointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsidePointer, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('mousedown', handleOutsidePointer, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position || !adjustedPos) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className={`menu-dropdown popup-menu ${className}`}
      style={{
        position: 'fixed',
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
        zIndex: 10000
      }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map(item => {
        if (item.separator) {
          return <div key={item.id} className='menu-dropdown-separator' />;
        }

        const isDisabled = Boolean(item.disabled);

        return (
          <div
            key={item.id}
            className={`menu-dropdown-item ${isDisabled ? 'disabled' : ''}`}
            onClick={e => {
              e.stopPropagation();
              if (isDisabled) return;
              if (item.onClick) {
                item.onClick();
              }
              onClose();
            }}
          >
            {item.checked !== undefined ? (
              <span className='menu-item-check-slot'>
                {item.checked ? '✓' : ''}
              </span>
            ) : item.icon ? (
              <span className='menu-item-icon-slot'>
                <Icon path={item.icon} size='16px' />
              </span>
            ) : (
              <span className='menu-item-icon-slot' />
            )}

            <span className='menu-item-label'>{item.label}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

