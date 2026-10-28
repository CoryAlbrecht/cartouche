/**
 * @file SplitToolButton.tsx
 * @module renderer/components/common/SplitToolButton
 * @description Reusable composite split tool button joining an active tool mode trigger segment with an attached chevron trigger opening a modeless PopupMenu of alternative tool actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link PopupMenu}
 * @see {@link ToolbarZone}
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import Icon from './Icon';
import { PopupMenu } from './PopupMenu';
import type { PopupMenuItem } from '@renderer/state/projectSignals';
import type { ToolbarZone } from '@renderer/state/gisSignals';
import { getActionFormattedKey, getActionIcon } from '@renderer/state/actionSignals';
import { useTranslation } from '@renderer/hooks/useTranslation';
import { mdiMenuDown } from '@mdi/js';

/**
 * @typedef {Object} SplitToolOption
 * @description Action option item descriptor rendered inside the modeless PopupMenu.
 * @property {string} id - Unique action identifier.
 * @property {string} [label] - Optional custom display label text (defaults to localized action string).
 * @property {string} [icon] - Optional custom MDI icon SVG path (defaults to registered action icon).
 * @property {string} [formattedKey] - Optional formatted key combination string.
 * @property {boolean} [disabled] - Whether this specific option is disabled in the PopupMenu.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export interface SplitToolOption {
  id: string;
  label?: string;
  icon?: string;
  formattedKey?: string;
  disabled?: boolean;
}

/**
 * @typedef {string | SplitToolOption} SplitToolOptionItem
 * @description Union type representing either a plain action key string or a full SplitToolOption descriptor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export type SplitToolOptionItem = string | SplitToolOption;

/**
 * @typedef {Object} SplitToolButtonProps
 * @description Component properties for the SplitToolButton composite control.
 * @property {string} activeAction - Identifier of the currently active action mode.
 * @property {SplitToolOptionItem[]} options - Array of available action keys or option objects in the PopupMenu.
 * @property {ToolbarZone} [zone='top'] - Outer toolbar dock zone ('top' | 'bottom' | 'left' | 'right') determining layout orientation.
 * @property {boolean} [disabled=false] - Whether the composite split button is completely disabled.
 * @property {boolean} [active=false] - Whether the primary button is visually highlighted in an active/pressed state.
 * @property {(actionId: string) => void} [onSelect] - Callback invoked when an option is selected from the PopupMenu.
 * @property {(actionId: string) => void} [onExecute] - Callback invoked when the primary button is clicked or an option is chosen.
 * @property {string} [className=''] - Optional custom CSS class name applied to the outer split button container.
 * @property {string} [chevronIcon] - Optional MDI icon SVG path overriding the default chevron icon.
 * @property {string} [title] - Optional explicit tooltip text overriding the active action title and formattedKey.
 * @property {string} [ariaLabel] - Optional explicit accessibility aria-label override for the primary button.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export interface SplitToolButtonProps {
  activeAction: string;
  options: SplitToolOptionItem[];
  zone?: ToolbarZone;
  disabled?: boolean;
  active?: boolean;
  onSelect?: (actionId: string) => void;
  onExecute?: (actionId: string) => void;
  className?: string;
  chevronIcon?: string;
  title?: string;
  ariaLabel?: string;
}

/**
 * @component SplitToolButton
 * @description Composite toolbar split button component rendering an active action button and adjacent chevron PopupMenu trigger.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {SplitToolButtonProps} props - Component properties.
 * @returns {JSX.Element} SplitToolButton instance.
 */
export const SplitToolButton: React.FC<SplitToolButtonProps> = ({
  activeAction,
  options,
  zone = 'top',
  disabled = false,
  active = false,
  onSelect,
  onExecute,
  className = '',
  chevronIcon,
  title,
  ariaLabel
}) => {
  useSignals();
  const { t } = useTranslation();

  const [currentAction, setCurrentAction] = useState<string>(activeAction);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const chevronRef = useRef<HTMLButtonElement | null>(null);

  // Synchronize internal state with activeAction prop updates
  useEffect(() => {
    setCurrentAction(activeAction);
  }, [activeAction]);

  const isVertical = zone === 'left' || zone === 'right';
  const orientationClass = isVertical ? 'vertical' : 'horizontal';

  // Resolve active option details (icon, label, formatted key combination)
  const activeOpt = options.find((opt) => (typeof opt === 'string' ? opt : opt.id) === currentAction);
  const activeOptObj = typeof activeOpt === 'object' ? activeOpt : undefined;

  const activeLabel = activeOptObj?.label ?? t(currentAction);
  const activeIcon = activeOptObj?.icon ?? getActionIcon(currentAction);
  const activeFormattedKey = activeOptObj?.formattedKey ?? getActionFormattedKey(currentAction);

  const computedTitle = title ?? (activeFormattedKey ? `${activeLabel} (${activeFormattedKey})` : activeLabel);
  const computedAriaLabel = ariaLabel ?? activeLabel;

  /**
   * @function handlePrimaryClick
   * @description Handles click on the primary action button segment.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {React.MouseEvent} e - React mouse click event.
   * @returns {void}
   */
  const handlePrimaryClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (disabled) return;
    if (onExecute) {
      onExecute(currentAction);
    } else if (onSelect) {
      onSelect(currentAction);
    }
  };

  /**
   * @function handleChevronClick
   * @description Handles click on the chevron trigger button segment.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {React.MouseEvent} e - React mouse click event.
   * @returns {void}
   */
  const handleChevronClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (disabled) return;
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }

    if (chevronRef.current) {
      const rect = chevronRef.current.getBoundingClientRect?.() ?? {
        left: e.clientX,
        top: e.clientY,
        right: e.clientX,
        bottom: e.clientY
      };

      if (isVertical) {
        setMenuPos({
          x: zone === 'right' ? rect.left : rect.right,
          y: rect.top
        });
      } else {
        setMenuPos({
          x: rect.left,
          y: zone === 'bottom' ? rect.top : rect.bottom
        });
      }
    } else {
      setMenuPos({ x: e.clientX, y: e.clientY });
    }

    setIsMenuOpen(true);
  };

  /**
   * @function handleSelectOption
   * @description Handles selection of an option from the PopupMenu, updating state and immediately dispatching.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-27
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {string} actionId - Unique identifier of the selected action.
   * @returns {void}
   */
  const handleSelectOption = (actionId: string): void => {
    setCurrentAction(actionId);
    setIsMenuOpen(false);
    if (onSelect) {
      onSelect(actionId);
    }
    if (onExecute) {
      onExecute(actionId);
    }
  };

  // Convert options to PopupMenuItem array
  const menuItems: PopupMenuItem[] = options.map((opt) => {
    const item = typeof opt === 'string' ? { id: opt } : opt;
    const itemLabel = item.label ?? t(item.id);
    const itemIcon = item.icon ?? getActionIcon(item.id);
    const itemKey = item.formattedKey ?? getActionFormattedKey(item.id);

    return {
      id: item.id,
      label: itemLabel,
      icon: itemIcon || undefined,
      formattedKey: itemKey || undefined,
      disabled: Boolean(item.disabled),
      onClick: () => handleSelectOption(item.id)
    };
  });

  return (
    <div className={`split-tool-button ${orientationClass} ${className}`}>
      <button
        type='button'
        className={`toolbar-btn split-tool-primary ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        title={computedTitle}
        disabled={disabled}
        onClick={handlePrimaryClick}
        aria-label={computedAriaLabel}
      >
        <Icon path={activeIcon} />
      </button>
      <button
        ref={chevronRef}
        type='button'
        className={`toolbar-btn split-tool-chevron ${disabled ? 'disabled' : ''}`}
        title={t('more_options')}
        disabled={disabled}
        onClick={handleChevronClick}
        aria-label={t('more_options')}
      >
        <Icon path={chevronIcon ?? mdiMenuDown} size='calc(var(--cartouche-ui-icon-size, 24px) * 0.67)' />
      </button>

      <PopupMenu
        isOpen={isMenuOpen}
        position={menuPos}
        items={menuItems}
        onClose={() => setIsMenuOpen(false)}
      />
    </div>
  );
};
