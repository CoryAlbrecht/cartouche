/**
 * @file Trans.tsx
 * @module renderer/components/common/Trans
 * @description Rich-text translation component that safely parses embedded XML tags and maps them to React nodes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

import React, { ReactNode } from "react";
import { useTranslation } from "../../hooks/useTranslation";

export interface TransProps {
  i18nKey: string;
  values?: Record<string, string | number>;
  components?: Record<string, React.ReactElement>;
}

/**
 * @component Trans
 * @description Renders localized strings with embedded rich-text markup safely.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @param {TransProps} props
 * @returns {React.ReactElement | null}
 */
export const Trans: React.FC<TransProps> = ({
  i18nKey,
  values,
  components,
}) => {
  const { t } = useTranslation();
  const text = t(i18nKey, values);

  if (!components || Object.keys(components).length === 0) {
    return <>{text}</>;
  }

  // Tokenize the string by tags
  // This simple regex parser assumes well-formed, non-nested tags like <kbd>...</kbd>
  const tagRegex = /<([^>]+)>(.*?)<\/\1>/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before the tag
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const tagName = match[1];
    const innerText = match[2];
    const mappedComponent = components[tagName];

    if (mappedComponent) {
      // Clone the element and inject the inner text as children
      nodes.push(
        React.cloneElement(mappedComponent, { key: match.index }, innerText)
      );
    } else {
      // Fallback if tag is not mapped
      nodes.push(match[0]);
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return <>{nodes}</>;
};
