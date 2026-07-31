import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib";
import { Portal } from "./portal";
import { useEscapeKey, useFocusTrap, useScrollLock } from "./hooks";

/**
 * Sheet — accessible controlled drawer (v2.0). Same a11y improvements as Dialog.
 */
const sheetVariants = cva("nexus-sheet", {
  variants: {
    side: {
      right:  "nexus-sheet--right",
      left:   "nexus-sheet--left",
      top:    "nexus-sheet--top",
      bottom: "nexus-sheet--bottom",
    },
  },
  defaultVariants: { side: "right" },
});

export interface SheetProps
  extends VariantProps<typeof sheetVariants> {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  side = "right",
  title,
  children,
  dismissible = true,
  className,
}) => {
  const titleId = React.useId();
  const trapRef = useFocusTrap<HTMLElement>(open);
  useScrollLock(open);
  useEscapeKey(() => onClose(), open && dismissible);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="nexus-sheet-overlay"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <aside
        ref={trapRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(sheetVariants({ side }), className)}
      >
        {title ? (
          <header className="nexus-sheet__header">
            <h2 id={titleId} className="nexus-sheet__title">{title}</h2>
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
          </header>
        ) : null}
        <div className="nexus-sheet__body">{children}</div>
      </aside>
    </Portal>
  );
};
Sheet.displayName = "Sheet";
