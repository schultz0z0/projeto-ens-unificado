import * as React from "react";
import { X } from "lucide-react";
import { cn } from "./lib";
import { Portal } from "./portal";
import { useEscapeKey, useFocusTrap, useScrollLock } from "./hooks";

/**
 * Dialog — accessible controlled modal (v2.0).
 *
 * Improvements over v1.3:
 *  - Rendered via Portal to escape `overflow: hidden` ancestors.
 *  - Focus trap while open (restores focus on close).
 *  - Body scroll lock while open (preserves scrollbar width).
 *  - ESC to close (handled by `useEscapeKey`).
 *  - Click outside on overlay closes when `dismissible`.
 *  - `aria-describedby` and `aria-labelledby` are wired to title/desc.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  /** Rendered in the footer, right-aligned. */
  actions?: React.ReactNode;
  /** When false, ESC and overlay-click are ignored. */
  dismissible?: boolean;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  dismissible = true,
  className,
}) => {
  const titleId = React.useId();
  const descId = React.useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  useScrollLock(open);
  useEscapeKey(() => onClose(), open && dismissible);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="nexus-dialog-overlay"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={cn("nexus-dialog", className)}
      >
        {dismissible ? (
          <button
            type="button"
            className="nexus-dialog__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
        {(title || description) ? (
          <header className="nexus-dialog__header">
            {title ? <h2 id={titleId} className="nexus-dialog__title">{title}</h2> : null}
            {description ? <p id={descId} className="nexus-dialog__desc">{description}</p> : null}
          </header>
        ) : null}
        {children ? <div className="nexus-dialog__body">{children}</div> : null}
        {actions ? <footer className="nexus-dialog__footer">{actions}</footer> : null}
      </div>
    </Portal>
  );
};
Dialog.displayName = "Dialog";
