/**
 * @file DashPatternSelect.tsx
 * @module renderer/workbench/dialogs/DashPatternSelect
 * @description Custom accessible dropdown selector for Simple Line dash patterns rendering localized text labels on the left and 128px horizontal stroke samples on the right.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link DashPatternSelect}
 * @see {@link DashPatternSample}
 * @see {@link DASH_PATTERN_PRESETS}
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@renderer/components/common/Icon";
import { mdiMenuDown } from "@mdi/js";
import {
  DASH_PATTERN_PRESETS,
  type DashPatternPreset,
} from "@shared/types/styling";

/**
 * @typedef {Object} DashPatternOption
 * @property {DashPatternPreset} value - Pattern preset identifier.
 * @property {string} labelKey - Localization key for the pattern name.
 */
interface DashPatternOption {
  value: DashPatternPreset;
  labelKey: string;
}

/**
 * Standard ordered list of dash pattern options available in Simple Line styling.
 *
 * @constant {DashPatternOption[]} PATTERN_OPTIONS
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export const PATTERN_OPTIONS: DashPatternOption[] = [
  { value: "solid", labelKey: "layer_properties_dash_pattern_solid" },
  { value: "no-line", labelKey: "layer_properties_dash_pattern_no_line" },
  { value: "dash", labelKey: "layer_properties_dash_pattern_dash" },
  { value: "dot", labelKey: "layer_properties_dash_pattern_dot" },
  { value: "dash-dot", labelKey: "layer_properties_dash_pattern_dash_dot" },
  {
    value: "dash-dot-dot",
    labelKey: "layer_properties_dash_pattern_dash_dot_dot",
  },
  { value: "long-dash", labelKey: "layer_properties_dash_pattern_long_dash" },
  {
    value: "long-dash-dot",
    labelKey: "layer_properties_dash_pattern_long_dash_dot",
  },
  { value: "sparse-dot", labelKey: "layer_properties_dash_pattern_sparse_dot" },
  { value: "custom", labelKey: "layer_properties_dash_pattern_custom" },
];

/**
 * @typedef {Object} DashPatternSampleProps
 * @property {string} pattern - Dash pattern identifier or preset token.
 * @property {number[]} [dashArray] - Active alternating line and gap lengths array for custom patterns.
 * @property {string} [className] - Optional custom CSS class name.
 */
export interface DashPatternSampleProps {
  pattern: string;
  dashArray?: number[];
  className?: string;
}

/**
 * Visual SVG stroke sample component rendering a ~128px horizontal line preview.
 *
 * @component DashPatternSample
 * @description Renders a 128px horizontal line using fixed neutral 2px black stroke, displaying solid lines, repeating preset dash intervals, blank spaces for no-line, or custom dash arrays.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {DashPatternSampleProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const DashPatternSample: React.FC<DashPatternSampleProps> = ({
  pattern,
  dashArray,
  className,
}) => {
  if (pattern === "no-line") {
    return (
      <div
        data-testid='dash-sample-no-line'
        style={{
          width: "128px",
          height: "14px",
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
        }}
      />
    );
  }

  let strokeDasharray = "none";
  if (pattern === "custom" && dashArray && dashArray.length > 0) {
    strokeDasharray = dashArray.join(" ");
  } else if (pattern in DASH_PATTERN_PRESETS) {
    const arr = DASH_PATTERN_PRESETS[pattern];
    strokeDasharray = arr && arr.length > 0 ? arr.join(" ") : "none";
  }

  return (
    <svg
      width={128}
      height={14}
      viewBox='0 0 128 14'
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      className={className}
      aria-hidden='true'>
      <line
        x1={0}
        y1={7}
        x2={128}
        y2={7}
        stroke='#000000'
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        strokeLinecap='butt'
      />
    </svg>
  );
};

/**
 * @typedef {Object} DashPatternSelectProps
 * @property {string} id - HTML element identifier for accessibility and form association.
 * @property {string} value - Currently selected dash pattern preset identifier.
 * @property {number[]} [dashArray] - Active alternating line/gap lengths for custom patterns.
 * @property {boolean} [disabled=false] - Whether the dropdown is disabled against user interaction.
 * @property {boolean} [initialOpen=false] - Whether the dropdown starts open (primarily for testing).
 * @property {(pattern: DashPatternPreset) => void} onChange - Callback invoked when a pattern is chosen.
 * @property {(key: string) => string} t - Translation helper function.
 */
export interface DashPatternSelectProps {
  id: string;
  value: string;
  dashArray?: number[];
  disabled?: boolean;
  initialOpen?: boolean;
  onChange: (pattern: DashPatternPreset) => void;
  t: (key: string) => string;
}

/**
 * Custom accessible dropdown selector for Dash Patterns featuring labels and 128px stroke samples.
 *
 * @component DashPatternSelect
 * @description Provides a custom select dropdown where the closed trigger button and every item in the dropdown display localized text labels on the left and 128px stroke samples on the right.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {DashPatternSelectProps} props - Component properties.
 * @returns {JSX.Element}
 */
export const DashPatternSelect: React.FC<DashPatternSelectProps> = ({
  id,
  value,
  dashArray,
  disabled = false,
  initialOpen = false,
  onChange,
  t,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedIndex = PATTERN_OPTIONS.findIndex((opt) => opt.value === value);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0
  );

  // Sync highlighted index when value changes
  useEffect(() => {
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex);
    }
  }, [selectedIndex]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (pattern: DashPatternPreset) => {
      onChange(pattern);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  /**
   * Keyboard event handler enabling arrow navigation, selection, and dismissal.
   *
   * @param {React.KeyboardEvent<HTMLButtonElement>} e - Keyboard event.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < PATTERN_OPTIONS.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : PATTERN_OPTIONS.length - 1
        );
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const target = PATTERN_OPTIONS[highlightedIndex];
        if (target) {
          handleSelect(target.value);
        }
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
      }
    }
  };

  /**
   * Resolves the localized display name for a given pattern token.
   *
   * @param {string} pat - Pattern preset token.
   * @returns {string} Localized pattern label.
   */
  const getPatternLabel = (pat: string): string => {
    const opt = PATTERN_OPTIONS.find((o) => o.value === pat);
    if (opt) {
      return t(opt.labelKey);
    }
    return pat;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-block",
        width: "20rem",
      }}>
      <button
        type='button'
        id={id}
        data-value={value}
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-listbox` : undefined}
        aria-activedescendant={
          isOpen ? `${id}-option-${highlightedIndex}` : undefined
        }
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.25rem 0.5rem",
          border: "1px solid #cbd5e1",
          borderRadius: "0.25rem",
          backgroundColor: disabled ? "#f1f5f9" : "#ffffff",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "0.8125rem",
          color: "#1e293b",
          textAlign: "left",
          boxSizing: "border-box",
        }}>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          {getPatternLabel(value)}
        </span>
        <DashPatternSample pattern={value} dashArray={dashArray} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: "0.25rem",
            userSelect: "none",
          }}>
          <Icon path={mdiMenuDown} size='1rem' color='#64748b' />
        </span>
      </button>

      {isOpen && (
        <ul
          role='listbox'
          id={`${id}-listbox`}
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            width: "100%",
            maxHeight: "16rem",
            overflowY: "auto",
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "0.25rem",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            zIndex: 50,
            margin: 0,
            padding: "0.25rem 0",
            listStyle: "none",
            boxSizing: "border-box",
          }}>
          {PATTERN_OPTIONS.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <li
                key={opt.value}
                id={`${id}-option-${idx}`}
                role='option'
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.375rem 0.5rem",
                  backgroundColor: isHighlighted
                    ? "#e2e8f0"
                    : isSelected
                    ? "#f1f5f9"
                    : "transparent",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  fontWeight: isSelected ? 600 : 400,
                  color: "#1e293b",
                }}>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                  {t(opt.labelKey)}
                </span>
                <DashPatternSample pattern={opt.value} dashArray={dashArray} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
