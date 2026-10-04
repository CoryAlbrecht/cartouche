/**
 * @file useTranslation.ts
 * @module renderer/hooks/useTranslation
 * @description React hook for integrating the reactive i18n subsystem into functional components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

import { useSignals } from '@preact/signals-react/runtime';
import { activeLocaleSignal, t } from '../state/i18nSignals';

/**
 * @description Provides the core translation function and current locale, reacting automatically to language changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @returns {{ t: typeof t, locale: string }} Translation object.
 */
export function useTranslation() {
  // Opt into tracking signals used in the rendering of the component
  useSignals();
  
  // By reading activeLocaleSignal.value, the component will re-render when the locale changes.
  const locale = activeLocaleSignal.value;

  return { t, locale };
}
