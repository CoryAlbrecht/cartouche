/**
 * @file usePendingDigits.ts
 * @module renderer/hooks/usePendingDigits
 * @description Pending-digits model for segmented numeric inputs such as the Timestamp Spinner. Typed digits are held exactly as typed, unchecked, and handed to the owner to check, limit and save only after a pause or an explicit commit (Tab, arrow, Enter, blur); Escape-style discard throws them away.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link usePendingDigits}
 * @see {@link appendPendingDigit}
 * @see {@link TimestampSpinner}
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @description Milliseconds without typing after which pending digits are committed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
export const PENDING_DIGITS_COMMIT_DELAY_MS = 1000;

/**
 * @typedef {Object} PendingDigits
 * @template K
 * @property {K} key - Field (segment) the digits were typed into.
 * @property {string} digits - Digits exactly as typed; never padded or limited.
 */
export interface PendingDigits<K extends string> {
  key: K;
  digits: string;
}

/**
 * @typedef {Object} PendingDigitsController
 * @template K
 * @property {PendingDigits<K> | null} pending - Unsaved digits for display, or `null` when the saved value shows.
 * @property {(key: K, digit: string, maxLength: number) => string} append - Adds a typed character to `key`'s pending digits (committing another field's first) and restarts the pause timer; returns the new digits.
 * @property {() => void} commit - Hands pending digits to the commit callback now and clears them; does nothing when none are pending.
 * @property {() => PendingDigits<K> | null} take - Clears and returns pending digits without calling the commit callback, so the caller can fold them into its own update.
 * @property {() => boolean} discard - Throws pending digits away; returns whether there were any.
 */
export interface PendingDigitsController<K extends string> {
  pending: PendingDigits<K> | null;
  append: (key: K, digit: string, maxLength: number) => string;
  commit: () => void;
  take: () => PendingDigits<K> | null;
  discard: () => boolean;
}

/**
 * @function appendPendingDigit
 * @description Appends a typed character to pending digits exactly as typed; once the field is already full, starts over with the new character.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} digits - Digits typed so far ("" when none).
 * @param {string} digit - Newly typed character.
 * @param {number} maxLength - Most characters the field holds (`Infinity` for unbounded fields).
 * @returns {string} The new pending digits.
 */
export function appendPendingDigit(
  digits: string,
  digit: string,
  maxLength: number
): string {
  return digits.length >= maxLength ? digit : digits + digit;
}

/**
 * Holds typed digits per field until they are committed by the pause timer or by the owner
 * (Tab, arrows, Enter, blur, auto-advance). State lives in a ref as well as React state so a
 * burst of key events inside one render sees each previous keystroke.
 * @function usePendingDigits
 * @description React hook managing unsaved typed digits and their delayed commit.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @template K
 * @param {(key: K, digits: string) => void} onCommit - Checks, limits and saves the digits typed into `key`.
 * @param {number} [delayMs=PENDING_DIGITS_COMMIT_DELAY_MS] - Pause after the last keystroke before committing.
 * @returns {PendingDigitsController<K>} Pending digits and the operations on them.
 */
export function usePendingDigits<K extends string>(
  onCommit: (key: K, digits: string) => void,
  delayMs: number = PENDING_DIGITS_COMMIT_DELAY_MS
): PendingDigitsController<K> {
  const [pending, setPending] = useState<PendingDigits<K> | null>(null);
  const pendingRef = useRef<PendingDigits<K> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const take = useCallback((): PendingDigits<K> | null => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = pendingRef.current;
    if (current) {
      pendingRef.current = null;
      setPending(null);
    }
    return current;
  }, []);

  const commit = useCallback((): void => {
    const current = take();
    if (current && current.digits.length > 0) {
      onCommitRef.current(current.key, current.digits);
    }
  }, [take]);

  const discard = useCallback((): boolean => take() !== null, [take]);

  const append = useCallback(
    (key: K, digit: string, maxLength: number): string => {
      if (pendingRef.current && pendingRef.current.key !== key) commit();
      const digits = appendPendingDigit(
        pendingRef.current?.digits ?? "",
        digit,
        maxLength
      );
      const next = { key, digits };
      pendingRef.current = next;
      setPending(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(commit, delayMs);
      return digits;
    },
    [commit, delayMs]
  );

  return { pending, append, commit, take, discard };
}
