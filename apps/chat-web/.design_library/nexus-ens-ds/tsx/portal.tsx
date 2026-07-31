import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Portal — renders children into document.body via React's createPortal.
 * SSR-safe: renders nothing on the server. Use to escape containers with
 * `overflow: hidden` or `transform` (which break `position: fixed`).
 */
export interface PortalProps {
  children: React.ReactNode;
  /** Optional container; defaults to `document.body`. */
  container?: HTMLElement | null;
}

export const Portal: React.FC<PortalProps> = ({ children, container }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;
  return createPortal(children, container ?? document.body);
};
Portal.displayName = "Portal";
