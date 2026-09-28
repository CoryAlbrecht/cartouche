import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

interface DetachedWindowPortalProps {
  title?: string;
  frameName?: string;
  features?: string;
  onClose: () => void;
  children: React.ReactNode;
}

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
