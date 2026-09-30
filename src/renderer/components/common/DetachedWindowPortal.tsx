/**
 * @file DetachedWindowPortal.tsx
 * @module renderer/components/common/DetachedWindowPortal
 * @description React Portal component rendering React child elements into an isolated detached browser window pop-out (e.g. non-modal preferences window).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-28
 * @updated 2026-09-28
 * @since 0.1.0-dev
 */

import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

/**
 * @typedef {Object} DetachedWindowPortalProps
 * @property {string} [title='Preferences'] - Window title bar text string.
 * @property {string} [frameName='preferencesWindow'] - Unique target frame window name identifier.
 * @property {string} [features='width=720,height=520'] - Native window features and initial geometry bounds.
 * @property {() => void} onClose - Callback function invoked when child window is closed.
 * @property {React.ReactNode} children - React elements rendered inside the detached window portal body.
 */
interface DetachedWindowPortalProps {
  title?: string;
  frameName?: string;
  features?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * @component DetachedWindowPortal
 * @description Renders child components into an isolated secondary window using React Portals and synchronizes parent document CSS stylesheets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-28
 * @updated 2026-09-28
 * @since 0.1.0-dev
 * @param {DetachedWindowPortalProps} props - Component properties.
 * @returns {React.ReactElement} React Portal mounting container element into child window body.
 */
export const DetachedWindowPortal: React.FC<DetachedWindowPortalProps> = ({
  title = "Preferences",
  frameName = "preferencesWindow",
  features = "width=720,height=520",
  onClose,
  children,
}) => {
  const [containerEl] = useState(() => document.createElement("div"));
  const childWindowRef = useRef<Window | null>(null);
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const initialFeaturesRef = useRef(features);
  const initialFrameNameRef = useRef(frameName);

  useEffect(() => {
    containerEl.className = "detached-portal-container";
    containerEl.style.height = "100vh";
    containerEl.style.width = "100vw";
    containerEl.style.display = "flex";
    containerEl.style.flexDirection = "column";

    const childWindow = window.open(
      "",
      initialFrameNameRef.current,
      initialFeaturesRef.current
    );
    if (!childWindow) {
      console.error("[DetachedWindowPortal] Failed to open child window");
      onCloseRef.current();
      return;
    }

    childWindowRef.current = childWindow;
    childWindow.document.title = title;
    childWindow.document.body.appendChild(containerEl);
    childWindow.document.body.style.margin = "0";
    childWindow.document.body.style.padding = "0";
    childWindow.document.body.style.background = "#ffffff";
    childWindow.document.body.style.overflow = "hidden";

    // Copy parent document stylesheets to child window
    const syncStyles = () => {
      if (!childWindow || childWindow.closed) return;

      const existingCopied = childWindow.document.head.querySelectorAll(
        "[data-detached-style]"
      );
      existingCopied.forEach((el) => el.remove());

      Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style')
      ).forEach((node) => {
        const clonedNode = node.cloneNode(true) as HTMLElement;
        clonedNode.setAttribute("data-detached-style", "true");
        childWindow.document.head.appendChild(clonedNode);
      });
    };

    syncStyles();

    // Observe head changes for dynamic dev styles (e.g., Vite HMR)
    const observer = new MutationObserver(() => syncStyles());
    observer.observe(document.head, { childList: true, subtree: true });

    // Sync window closing from OS window close button
    const handleUnload = () => {
      if (!isClosingRef.current) {
        isClosingRef.current = true;
        onCloseRef.current();
      }
    };

    childWindow.addEventListener("unload", handleUnload);

    return () => {
      observer.disconnect();
      childWindow.removeEventListener("unload", handleUnload);
      if (!isClosingRef.current && !childWindow.closed) {
        isClosingRef.current = true;
        childWindow.close();
      }
    };
  }, [containerEl]); // Runs ONCE on mount!

  useEffect(() => {
    if (childWindowRef.current && !childWindowRef.current.closed) {
      childWindowRef.current.document.title = title;
    }
  }, [title]);

  return ReactDOM.createPortal(children, containerEl);
};
