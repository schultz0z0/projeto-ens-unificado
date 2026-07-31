import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib";
import { Portal } from "./portal";
import { useReducedMotion } from "./hooks";

/**
 * Toast — single notification unit (v2.0).
 *
 * Improvements over v1.3:
 *  - Rendered via Portal so the stack sits at the document root.
 *  - Honors `prefers-reduced-motion: reduce` to skip the entry animation.
 *  - `role="status"` + `aria-live="polite"` (default) keeps screen readers
 *    informed without being intrusive.
 */
export type ToastTone = "default" | "success" | "warning" | "danger";

const TONE_ICONS: Record<ToastTone, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger:  AlertCircle,
};

const toastVariants = cva("nexus-toast", {
  variants: {
    tone: {
      default: "",
      success: "success",
      warning: "warning",
      danger:  "danger",
    },
  },
  defaultVariants: { tone: "default" },
});

export interface ToastProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "id">,
    VariantProps<typeof toastVariants> {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  duration?: number;
  onDismiss?: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  title,
  description,
  icon,
  tone = "default",
  duration = 4000,
  onDismiss,
  className,
  ...props
}) => {
  React.useEffect(() => {
    if (!duration || !onDismiss) return;
    const t = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(t);
  }, [id, duration, onDismiss]);

  const Icon = icon ?? TONE_ICONS[tone ?? "default"];

  return (
    <article
      role="status"
      aria-live="polite"
      className={cn(toastVariants({ tone }), className)}
      {...props}
    >
      <div className="nexus-toast__icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="nexus-toast__body">
        <p className="nexus-toast__title">{title}</p>
        {description ? <p className="nexus-toast__desc">{description}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="nexus-toast__close"
          aria-label="Fechar notificação"
          onClick={() => onDismiss(id)}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
};
Toast.displayName = "Toast";

/**
 * Toaster — fixed-position container that renders the active toast stack.
 * Always rendered in a Portal so it never gets clipped by ancestor overflow.
 */
export type ToastPosition =
  | "bottom-right" | "bottom-left"
  | "top-right"    | "top-left";

export interface ToasterProps {
  toasts: ToastProps[];
  position?: ToastPosition;
  onDismiss?: (id: string) => void;
}

export const Toaster: React.FC<ToasterProps> = ({
  toasts,
  position = "bottom-right",
  onDismiss,
}) => {
  const reduced = useReducedMotion();
  if (toasts.length === 0) return null;
  return (
    <Portal>
      <aside
        className={cn("nexus-toaster", reduced && "is-reduced")}
        role="region"
        aria-label="Notificações"
        data-position={position}
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={onDismiss} />
        ))}
      </aside>
    </Portal>
  );
};
Toaster.displayName = "Toaster";
