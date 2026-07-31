import * as React from "react";
import { cn } from "./lib";
import { useReducedMotion } from "./hooks";

/**
 * Skeleton — shimmer placeholder (v2.0).
 *
 * Honors `prefers-reduced-motion: reduce` via the `is-reduced` class;
 * the CSS rule below disables the shimmer animation, leaving a static
 * neutral surface — still clearly a placeholder, but no flashing.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLElement> {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  as?: keyof React.JSX.IntrinsicElements;
  /** Forwarded to the rendered element for a11y ("status" for live updates). */
  role?: string;
}

export const Skeleton = React.forwardRef<HTMLElement, SkeletonProps>(
  ({ className, width, height, radius, as: As = "span", style, role = "presentation", ...props }, ref) => {
    const reduced = useReducedMotion();
    const Component = As as React.ElementType;
    const composedStyle: React.CSSProperties = {
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(radius !== undefined ? { borderRadius: radius } : {}),
      ...style,
    };
    return (
      <Component
        ref={ref as React.Ref<unknown>}
        role={role}
        aria-hidden={role === "presentation" ? true : undefined}
        className={cn("nexus-skeleton", reduced && "is-reduced", className)}
        style={composedStyle}
        {...props}
      />
    );
  },
);
Skeleton.displayName = "Skeleton";
