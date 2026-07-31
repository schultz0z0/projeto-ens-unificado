import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { cn } from "./lib";

/**
 * ErrorState — destructive feedback for failed requests, network errors,
 * and recoverable exceptions.
 */
export interface ErrorStateProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const ErrorState = React.forwardRef<HTMLElement, ErrorStateProps>(
  ({ className, title, description, icon: Icon = AlertCircle, actions, ...props }, ref) => (
    <section ref={ref} role="alert" className={cn("nexus-error", className)} {...props}>
      <div className="nexus-error__icon" aria-hidden="true">
        <Icon />
      </div>
      <h3 className="nexus-error__title">{title}</h3>
      {description ? <p className="nexus-error__desc">{description}</p> : null}
      {actions ? <div className="nexus-error__actions">{actions}</div> : null}
    </section>
  ),
);
ErrorState.displayName = "ErrorState";
