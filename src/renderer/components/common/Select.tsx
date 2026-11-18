/**
 * @file Select.tsx
 * @module renderer/components/common/Select
 * @description The shared single-choice dropdown control. Every dropdown in the Workbench, its dialogs and its widgets renders through {@link Select}, so all of them look, size, focus and behave identically. It renders a native `<select>` styled as a customizable select (`appearance: base-select`): the trigger and the drop-down list are ordinary page content styled only through Theme Component Tokens, while keyboard handling, type-ahead and accessibility semantics stay native. Options can carry rich content (an adornment after the label), which the trigger mirrors through `<selectedcontent>`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link Select}
 */

import React from "react";
import { mdiMenuDown } from "@mdi/js";
import Icon from "@renderer/components/common/Icon";

/**
 * @description Size of the trigger caret: two thirds of the `ui.icon.size` preference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @type {string}
 */
const CARET_SIZE = "calc(var(--cartouche-ui-icon-size, 24px) * 0.67)";

/**
 * @description Most options for which the trigger renders its invisible sizer. A longer list, such as the CRS Catalogue, would double a large DOM for little gain; such a Select takes its width from its layout and shows the selected value truncated when needed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @type {number}
 */
export const SELECT_SIZER_OPTION_LIMIT = 100;

/**
 * @typedef {Object} SelectOption
 * @description One choice in a {@link Select}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template V
 * @property {V} value - Value reported when the option is chosen.
 * @property {React.ReactNode} label - Text shown for the option, truncated with an ellipsis when too long.
 * @property {React.ReactNode} [adornment] - Rich content shown after the label, such as a stroke sample. The trigger mirrors it for the selected option.
 * @property {boolean} [disabled] - Whether the option cannot be chosen.
 */
export interface SelectOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  adornment?: React.ReactNode;
  disabled?: boolean;
}

/**
 * @typedef {'normal' | 'compact'} SelectDensity
 * @description Size variant of a {@link Select}: `normal` for dialog forms, `compact` for tables, footers and dense toolbars.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
export type SelectDensity = "normal" | "compact";

/**
 * @callback SelectChangeCallback
 * @description Receives the chosen option's value and the native change event.
 * @template V
 * @param {V} value - Chosen value.
 * @param {React.ChangeEvent<HTMLSelectElement>} event - Native change event.
 * @returns {void}
 */
export type SelectChangeCallback<V extends string> = (
  value: V,
  event: React.ChangeEvent<HTMLSelectElement>
) => void;

/**
 * @typedef {Object} SelectProps
 * @description Properties of {@link Select}. Every other native `<select>` attribute (`id`, `disabled`, `aria-*`, `title`, event handlers) passes through to the element.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template V
 * @property {V} value - Value of the selected option.
 * @property {readonly SelectOption<V>[]} options - Choices, in display order.
 * @property {SelectChangeCallback<V>} onChange - Receives the newly chosen value.
 * @property {SelectDensity} [density='normal'] - Size variant.
 * @property {string} [className] - Extra classes, for layout (width, flex placement) and documented semantic state modifiers only.
 * @property {React.Ref<HTMLSelectElement>} [ref] - Ref to the native select element.
 */
export type SelectProps<V extends string = string> = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange" | "children" | "multiple" | "size"
> & {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: SelectChangeCallback<V>;
  density?: SelectDensity;
  ref?: React.Ref<HTMLSelectElement>;
};

/**
 * @function selectChangeHandler
 * @description Adapts a {@link SelectChangeCallback} to the native `onChange` handler, reading the chosen value from the event target.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template V
 * @param {SelectChangeCallback<V>} onChange - Callback to receive the typed value.
 * @returns {React.ChangeEventHandler<HTMLSelectElement>} The native change handler.
 */
export function selectChangeHandler<V extends string>(
  onChange: SelectChangeCallback<V>
): React.ChangeEventHandler<HTMLSelectElement> {
  return (event) => onChange(event.target.value as V, event);
}

/**
 * @function isWithinOpenSelect
 * @description Tells whether an event target sits inside a `<select>` whose drop-down list is open. While the list is open its options hold keyboard focus and keystrokes belong to the list: Escape closes the list, Enter chooses an option. Window-level key handlers (dialog Escape dismissal, global shortcuts) call this to leave those keys to the list.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {EventTarget | null} target - Event target, from any window.
 * @returns {boolean} True when the target is inside an open select.
 */
export function isWithinOpenSelect(target: EventTarget | null): boolean {
  const closest = (target as Element | null)?.closest;
  if (typeof closest !== "function") return false;
  const select = closest.call(target, "select") as Element | null;
  if (!select) return false;
  try {
    return select.matches(":open");
  } catch {
    return false;
  }
}

/**
 * @function selectKeyDownHandler
 * @description Wraps a caller's `onKeyDown` so that, while the drop-down list is open, keystrokes stay with the list: they neither reach the caller's handler nor propagate to ancestors. With the list closed the caller's handler runs as usual.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {React.KeyboardEventHandler<HTMLSelectElement>} [onKeyDown] - Caller's key handler.
 * @returns {React.KeyboardEventHandler<HTMLSelectElement>} The wrapped handler.
 */
export function selectKeyDownHandler(
  onKeyDown?: React.KeyboardEventHandler<HTMLSelectElement>
): React.KeyboardEventHandler<HTMLSelectElement> {
  return (event) => {
    if (isWithinOpenSelect(event.target)) {
      event.stopPropagation();
      return;
    }
    onKeyDown?.(event);
  };
}

/**
 * @component Select
 * @description The shared single-choice dropdown. Renders a native customizable `<select>` with the `cartouche-select` class, a trigger button that mirrors the selected option through `<selectedcontent>` beside an MDI caret, and one `<option>` per entry holding its label and optional adornment. An invisible sizer stacks every option's content under the selected one, so the trigger is as wide as its widest option, as a native select is, and does not change width when the value changes; lists longer than {@link SELECT_SIZER_OPTION_LIMIT} skip it and take their width from the layout. While its list is open, keystrokes stay with the list (see {@link selectKeyDownHandler}).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template V
 * @param {SelectProps<V>} props - Component properties.
 * @returns {React.ReactElement} The select.
 */
export function Select<V extends string = string>({
  value,
  options,
  onChange,
  density = "normal",
  className,
  onKeyDown,
  ...rest
}: SelectProps<V>): React.ReactElement {
  const classes = [
    "cartouche-select",
    density === "compact" ? "is-compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <select
      className={classes}
      {...rest}
      value={value}
      onChange={selectChangeHandler(onChange)}
      onKeyDown={selectKeyDownHandler(onKeyDown)}>
      <button className='cartouche-select-trigger'>
        <span className='cartouche-select-face'>
          {React.createElement("selectedcontent", {
            className: "cartouche-select-value",
          })}
          {options.length <= SELECT_SIZER_OPTION_LIMIT && (
            <span className='cartouche-select-sizer' aria-hidden='true'>
              {options.map((option) => (
                <span
                  key={option.value}
                  className='cartouche-select-sizer-item'>
                  <span className='cartouche-select-option-label'>
                    {option.label}
                  </span>
                  {option.adornment}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className='cartouche-select-caret' aria-hidden='true'>
          <Icon path={mdiMenuDown} size={CARET_SIZE} />
        </span>
      </button>
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}>
          <span className='cartouche-select-option-label'>{option.label}</span>
          {option.adornment}
        </option>
      ))}
    </select>
  );
}

export default Select;
