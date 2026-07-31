import * as React from "react";

/* ==========================================================================
   Nexus ENS Design System — a11y hooks
   Used by Dialog / Sheet / Tooltip / Toast / Skeleton in v2.0.
   ========================================================================== */

/** Returns true when the user prefers reduced motion. SSR-safe. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Calls `handler` when the user presses Escape. SSR-safe.
 */
export function useEscapeKey(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/**
 * Focus trap: keeps Tab focus inside `ref` while `active` is true.
 * Saves and restores the previously focused element on enable/disable.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean): React.RefObject<T> {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside, or the root itself.
    const getFocusables = (): HTMLElement[] => {
      const sel =
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
      return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
      );
    };

    const focusables = getFocusables();
    const first = focusables[0] ?? root;
    first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === firstEl || !root.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (activeEl === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active]);
  return ref;
}

/**
 * Locks the body scroll while `active`. Restores the previous overflow
 * value on disable.
 */
export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    // Avoid layout shift when scrollbar disappears.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}
