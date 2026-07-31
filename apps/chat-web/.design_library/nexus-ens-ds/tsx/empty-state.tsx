import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "./lib";

/**
 * EmptyState — generic zero-data placeholder. Use inside a card, list or
 * page when there's nothing to show yet.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLElement, EmptyStateProps>(
  ({ className, title, description, icon: Icon = Inbox, actions, ...props }, ref) => (
    <section ref={ref} className={cn("nexus-empty", className)} {...props}>
      <div className="nexus-empty__icon" aria-hidden="true">
        <Icon />
      </div>
      <h3 className="nexus-empty__title">{title}</h3>
      {description ? <p className="nexus-empty__desc">{description}</p> : null}
      {actions ? <div className="nexus-empty__actions">{actions}</div> : null}
    </section>
  ),
);
EmptyState.displayName = "EmptyState";
